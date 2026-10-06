import type { Request, RequestHandler } from "express";
import * as service from "../services/address.service.js";
function owner(req: Request) { if (!req.user) throw new service.AddressError("Authentication is required.", 401); return req.user.userId; }
export const list: RequestHandler = async (req, res, next) => { try { res.json({ success: true, data: { addresses: await service.addresses(owner(req)) } }); } catch (error) { next(error); } };
export const create: RequestHandler = async (req, res, next) => { try { res.status(201).json({ success: true, message: "Address saved successfully", data: { address: await service.createAddress(owner(req), service.validateAddress(req.body)) } }); } catch (error) { next(error); } };
export const update: RequestHandler = async (req, res, next) => { try { res.json({ success: true, message: "Address updated successfully", data: { address: await service.updateAddress(owner(req), req.params.id, service.validateAddress(req.body, true)) } }); } catch (error) { next(error); } };
export const remove: RequestHandler = async (req, res, next) => { try { await service.deleteAddress(owner(req), req.params.id); res.json({ success: true, message: "Address deleted successfully" }); } catch (error) { next(error); } };
export const setDefault: RequestHandler = async (req, res, next) => { try { res.json({ success: true, message: "Default address updated successfully", data: { address: await service.defaultAddress(owner(req), req.params.id) } }); } catch (error) { next(error); } };
