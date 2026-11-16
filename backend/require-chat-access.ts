// src/require-chat-access.ts
import type { NextFunction, Request, Response } from "express";

import { getUserPermissions } from "./users";

/**
 * Autorização: confirma que o usuário autenticado PODE usar o chat.
 * Precisa vir depois do requireAuth, que preenche res.locals.userId.
 *
 * Respostas:
 *  - 401: o usuário do token não existe mais (conta apagada). O app encerra a sessão.
 *  - 403: o usuário existe, mas não tem permissão.
 */
export async function requireChatAccess(_req: Request, res: Response, next: NextFunction) {
  try {
    const permissions = await getUserPermissions(res.locals.userId as string);

    if (!permissions) {
      res.status(401).json({ error: "Sessão inválida. Entre novamente." });
      return;
    }
    if (!permissions.llm_enabled) {
      res.status(403).json({ error: "Seu usuário não tem permissão para usar o chat." });
      return;
    }
    next();
  } catch (err) {
    console.error("[requireChatAccess]", err);
    res.status(500).json({ error: "Erro interno. Tente novamente." });
  }
}
