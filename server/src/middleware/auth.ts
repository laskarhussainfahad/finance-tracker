import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: number;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as unknown as { sub: number };
    req.userId = Number(payload.sub);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
