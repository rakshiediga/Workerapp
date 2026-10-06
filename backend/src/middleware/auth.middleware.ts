import type { RequestHandler } from "express";
import { getCurrentUser, verifyAccessToken } from "../services/auth.service.js";
import { AuthError, type AuthUser } from "../types/auth.types.js";

export const authenticate: RequestHandler = async (request, _response, next) => {
  const authorization = request.get("Authorization");
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  if (!match) { next(new AuthError(401, "A valid Bearer token is required.")); return; }
  try {
    const payload = verifyAccessToken(match[1]);
    // Recheck account activation and current role, rather than trusting stale claims.
    const user = await getCurrentUser(payload.userId);
    request.user = { userId: user.id, role: user.role };
    next();
  } catch (error) { next(error); }
};

export function authorizeRoles(...roles: AuthUser["role"][]): RequestHandler {
  return (request, _response, next) => {
    if (!request.user) { next(new AuthError(401, "Authentication is required.")); return; }
    if (!roles.includes(request.user.role)) { next(new AuthError(403, "You do not have permission to access this resource.")); return; }
    next();
  };
}
