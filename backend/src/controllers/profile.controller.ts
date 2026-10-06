import type { RequestHandler } from "express";
import { getProfile, updateProfile, validateProfile } from "../services/profile.service.js";
import { AuthError } from "../types/auth.types.js";

export const get: RequestHandler = async (request, response, next) => {
  try {
    if (!request.user) throw new AuthError(401, "Authentication is required.");
    response.json({ success: true, data: { user: await getProfile(request.user.userId) } });
  } catch (error) { next(error); }
};
export const update: RequestHandler = async (request, response, next) => {
  try {
    if (!request.user) throw new AuthError(401, "Authentication is required.");
    const user = await updateProfile(request.user.userId, validateProfile(request.body));
    response.json({ success: true, message: "Profile updated successfully", data: { user } });
  } catch (error) { next(error); }
};
