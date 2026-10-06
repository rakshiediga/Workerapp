import type { RequestHandler } from "express";
import * as marketplace from "../services/marketplace.service.js";
export const categories: RequestHandler = async (_req, res, next) => { try { res.json({ success: true, data: { categories: await marketplace.categories() } }); } catch (error) { next(error); } };
export const categoryServices: RequestHandler = async (req, res, next) => { try { res.json({ success: true, data: await marketplace.categoryServices(marketplace.slug(req.params.slug)!) }); } catch (error) { next(error); } };
export const services: RequestHandler = async (req, res, next) => { try { res.json({ success: true, data: { services: await marketplace.services(marketplace.slug(req.query.category)) } }); } catch (error) { next(error); } };
export const workers: RequestHandler = async (req, res, next) => { try { res.json({ success: true, data: { workers: await marketplace.workers(req.query) } }); } catch (error) { next(error); } };
export const worker: RequestHandler = async (req, res, next) => { try { res.json({ success: true, data: { worker: await marketplace.worker(String(req.params.id)) } }); } catch (error) { next(error); } };
