// src/require-auth.ts
import type { NextFunction, Request, Response } from "express";

import { verifyToken } from "./auth-service";

/**
 * Exige `Authorization: Bearer <jwt>`. Em caso de sucesso, deixa o id do usuário
 * em `res.locals.userId` para o handler usar.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const [type, token] = (req.headers.authorization ?? "").split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ erro: "Não autenticado." });
  }

  try {
    res.locals.userId = verifyToken(token);
    return next();
  } catch {
    // expirado, assinatura inválida, emissor errado etc.
    return res.status(401).json({ erro: "Sessão expirada. Entre novamente." });
  }
}