import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "tailor";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const JWT_SECRET: string = process.env.JWT_SECRET ?? "tailorbook-dev-secret-change-me";
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN ?? "30d";

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN as any }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return { id: decoded.id, email: decoded.email, role: decoded.role };
  } catch {
    return null;
  }
}

/**
 * Auth middleware — verifies the Authorization: Bearer <token> header and
 * populates `req.user`. Use for protected routes.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("authorization") || req.header("Authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }
  const token = header.slice(7).trim();
  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  req.user = user;
  next();
}

/**
 * Admin-only middleware. Use AFTER `authMiddleware`.
 */
export function adminOnly(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
