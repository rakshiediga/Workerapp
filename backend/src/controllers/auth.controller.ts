import type { RequestHandler } from "express";
import { getCurrentUser, login, registerCustomer, registerWorker, validateWorkerRegistration, validateLogin, validateRegistration } from "../services/auth.service.js";
import { AuthError } from "../types/auth.types.js";

export const registerCustomerController: RequestHandler = async (request, response, next) => {
  try {
    const data = await registerCustomer(validateRegistration(request.body));
    response.status(201).json({ success: true, message: "Customer registered successfully", data });
  } catch (error) { next(error); }
};

export const loginController: RequestHandler = async (request, response, next) => {
  try {
    const data = await login(validateLogin(request.body));
    response.json({ success: true, message: "Login successful", data });
  } catch (error) { next(error); }
};

export const registerWorkerController: RequestHandler = async (request, response, next) => {
  try { response.status(201).json({ success: true, message: "Worker account created successfully", data: await registerWorker(validateWorkerRegistration(request.body)) }); }
  catch (error) { next(error); }
};

export const meController: RequestHandler = async (request, response, next) => {
  try {
    if (!request.user) throw new AuthError(401, "Authentication is required.");
    const user = await getCurrentUser(request.user.userId);
    response.json({ success: true, data: { user } });
  } catch (error) { next(error); }
};
