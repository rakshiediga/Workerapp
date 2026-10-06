import type {RequestHandler} from "express";
import {getWorkerProfile, updateWorkerProfile, validateWorkerProfile} from "../services/worker-profile.service.js";
import {AuthError} from "../types/auth.types.js";
export const get: RequestHandler = async (request, response, next) => {
  try { if (!request.user) throw new AuthError(401, "Authentication is required."); response.json({success: true, data: await getWorkerProfile(request.user.userId)}); }
  catch (error) {next(error);}
};
export const update: RequestHandler = async (request, response, next) => {
  try { if (!request.user) throw new AuthError(401, "Authentication is required."); response.json({success: true, message: "Profile updated successfully", data: await updateWorkerProfile(request.user.userId, validateWorkerProfile(request.body))}); }
  catch (error) {next(error);}
};
