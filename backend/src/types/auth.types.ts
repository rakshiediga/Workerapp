import type { Role } from "../generated/prisma/client.js";

export type AuthUser = { userId: string; role: Role };
export type RegisterCustomerInput = { name: string; phone: string; email?: string; password: string };
export type LoginInput = ({ phone: string; email?: never } | { email: string; phone?: never }) & { password: string };

export class AuthError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = "AuthError";
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
