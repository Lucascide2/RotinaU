import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages";

import { assertAuthConfig, cleanupExpired } from "./auth-service";
import { authRouter } from "./auth-routes";
import { requireAuth } from "./require-auth";
import { requireChatAccess } from "./require-chat-access";
import { premiumRouter } from "./premium-routes";

/* -------------------------------------------------------------------------- */
/*                                Configuração                                */
/* -------------------------------------------------------------------------- */

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;
const DAILY_LIMIT = 15; // por usuário
const GLOBAL_DAILY_LIMIT = Number(process.env.GLOBAL_DAILY_LIMIT ?? 500); // teto somando todos os usuários
const PORT = Number(process.env.PORT ?? 3000);
// Em produção atrás do Nginx, use HOST=127.0.0.1: o Node deixa de ser acessível direto
// pela internet (que contornaria o HTTPS e permitiria forjar o IP via X-Forwarded-For).
// Em desenvolvimento, o padrão aceita conexões da rede local (celular via Expo).
const HOST = process.env.HOST ?? "0.0.0.0";
const TRUST_PROXY = Number(process.env.TRUST_PROXY ?? 0); // nº de proxies à frente do servidor (0 = nenhum)
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";
const MAX_OUTPUT_TOKENS = 8192;

// A chave fica só no servidor (variável de ambiente), nunca vem do cliente.
const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error("Defina GOOGLE_API_KEY no arquivo .env");
  process.exit(1);
}

// Falha logo na partida se faltar JWT_SECRET (mínimo de 32 caracteres).
assertAuthConfig();

/* -------------------------------------------------------------------------- */
/*                                    Tipos                                   */
/* -------------------------------------------------------------------------- */

type TextPart = { type: "text"; text: string };
type ChatMessage = { role: "user" | "assistant"; content: string | TextPart[] };

/** Mesmo formato do corpo enviado pelo app (estilo Messages API). */
type ChatBody = {
  system?: string;
  max_tokens?: number;
  temperature?: number;
  messages: ChatMessage[];
};

/* -------------------------------------------------------------------------- */
/*                         Função que chama o Gemini                          */
/* -------------------------------------------------------------------------- */

function contentToText(content: string | TextPart[]): string {
  return typeof content === "string" ? content : content.map((p) => p.text).join("");
}

/** Recebe o corpo da requisição e a api_key, e chama o Gemini via LangChain. */
export async function callGemini(body: ChatBody, apiKey: string): Promise<string> {
  const llm = new ChatGoogleGenerativeAI({
    model: GEMINI_MODEL, // o `model` do corpo é ignorado: o app envia um nome de outro provedor
    apiKey,
    maxOutputTokens: Math.min(body.max_tokens ?? 2048, MAX_OUTPUT_TOKENS),
    ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
  });

  const messages: BaseMessage[] = [];
  if (body.system) messages.push(new SystemMessage(body.system));
  for (const m of body.messages) {
    const text = contentToText(m.content);
    messages.push(m.role === "assistant" ? new AIMessage(text) : new HumanMessage(text));
  }

  const response = await llm.invoke(messages);
  console.log(response.content)

  // `content` pode ser string ou lista de partes
  if (typeof response.content === "string") return response.content;
  return response.content
    .map((part) => (part.type === "text" && "text" in part ? String(part.text) : ""))
    .join("");
}

/* -------------------------------------------------------------------------- */
/*                                 Validação                                  */
/* -------------------------------------------------------------------------- */

function parseBody(raw: unknown): ChatBody | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;

  if (!Array.isArray(b.messages) || b.messages.length === 0 || b.messages.length > 20) return null;
  const messages: ChatMessage[] = [];

  for (const m of b.messages) {
    if (!m || typeof m !== "object") return null;
    const { role, content } = m as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") return null;

    if (typeof content === "string") {
      messages.push({ role, content });
    } else if (Array.isArray(content)) {
      const parts: TextPart[] = [];
      for (const p of content) {
        if (!p || typeof p !== "object") return null;
        const { type, text } = p as Record<string, unknown>;
        if (type !== "text" || typeof text !== "string") return null;
        parts.push({ type: "text", text });
      }
      messages.push({ role, content: parts });
    } else {
      return null;
    }
  }

  if (b.system !== undefined && typeof b.system !== "string") return null;
  if (b.max_tokens !== undefined && (typeof b.max_tokens !== "number" || b.max_tokens <= 0)) return null;
  if (b.temperature !== undefined && typeof b.temperature !== "number") return null;

  const body: ChatBody = { messages };
  if (b.system !== undefined) body.system = b.system as string;
  if (b.max_tokens !== undefined) body.max_tokens = b.max_tokens as number;
  if (b.temperature !== undefined) body.temperature = b.temperature as number;
  return body;
}

/* -------------------------------------------------------------------------- */
/*                                Middlewares                                 */
/* -------------------------------------------------------------------------- */

// Rejeita (403) requisições vindas de um navegador cuja origem não seja a permitida.
// Apps nativos (iOS/Android) não enviam o header Origin, então passam por aqui;
// quem protege a rota de verdade é o requireAuth (o Origin é só um filtro extra,
// pois qualquer cliente fora do navegador consegue forjá-lo).
function requireAllowedOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.get("origin");
  if (origin && origin !== ALLOWED_ORIGIN) {
    res.status(403).json({ error: "Origem não permitida." });
    return;
  }
  next();
}

// Limite diário POR USUÁRIO (chave = id do usuário autenticado).
// Precisa vir DEPOIS do requireAuth, que é quem preenche res.locals.userId.
// Janela fixa de 24h a partir da primeira requisição; o contador fica em memória.
const userDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: DAILY_LIMIT,
  keyGenerator: (_req, res) => res.locals.userId as string,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: `Limite de ${DAILY_LIMIT} requisições por dia atingido. Tente novamente mais tarde.` },
});

// Teto global diário (chave fixa "global"): protege a cota e o custo do Gemini
// mesmo que existam muitos usuários. Fica depois do limite por usuário para que
// quem já estourou a própria cota não gaste o teto de todo mundo.
const globalDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: GLOBAL_DAILY_LIMIT,
  keyGenerator: () => "global",
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "O serviço atingiu o limite diário de uso. Tente novamente mais tarde." },
});

/* -------------------------------------------------------------------------- */
/*                                    App                                     */
/* -------------------------------------------------------------------------- */

const app = express();

// Atrás de proxy (Render, Railway, Nginx...) defina TRUST_PROXY=1 no .env,
// senão o servidor enxerga o IP do proxy e o bloqueio de login por IP fica errado.
if (TRUST_PROXY > 0) app.set("trust proxy", TRUST_PROXY);

// CORS: o navegador só aceita respostas para a origem permitida (e responde ao preflight).
// "Authorization" precisa estar liberado, senão o navegador bloqueia o token no preflight.
app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "100kb" }));

// Cadastro, login, refresh e logout
app.use("/api/auth", authRouter);

// Ordem: origem (barato) → autenticação → permissão → limite por usuário → teto global → handler.
// Autenticação e permissão vêm antes dos limitadores para que requisições sem token válido,
// ou de quem não tem acesso ao chat, não consumam a cota de ninguém.
app.post(
  "/api/chat",
  requireAllowedOrigin,
  requireAuth, // quem é você? (JWT válido)
  requireChatAccess, // você pode usar o chat? (permissão no banco)
  userDailyLimiter,
  globalDailyLimiter,
  async (req: Request, res: Response) => {
    console.log("Enviou para a rota correta")

    const body = parseBody(req.body);
    if (!body) {
      res.status(400).json({ error: "Corpo inválido. Envie { messages: [{ role, content }], system?, max_tokens? }." });
      return;
    }

    try {
      const text = await callGemini(body, API_KEY);
      // Mesmo formato de resposta esperado pelo app: { content: [{ type: "text", text }] }
      res.json({ content: [{ type: "text", text }] });
    } catch (err) {
      console.error("[/api/chat] erro ao chamar o Gemini:", err);
      res.status(502).json({ error: "Falha ao chamar o modelo." });
    }
  },
);

// Erros de parse do JSON etc.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(400).json({ error: "Requisição inválida." });
});

app.use("/api/premium", premiumRouter);

// Limpeza horária de refresh tokens expirados e tentativas de login antigas
setInterval(() => cleanupExpired().catch(console.error), 60 * 60 * 1000).unref();

app.listen(PORT, HOST, () => {
  console.log(`API em http://${HOST}:${PORT} (origem permitida: ${ALLOWED_ORIGIN})`);
});