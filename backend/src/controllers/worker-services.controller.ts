import type {RequestHandler} from "express";
import * as service from "../services/worker-services.service.js";
import {AuthError} from "../types/auth.types.js";
function userId(request:Parameters<RequestHandler>[0]) {if(!request.user)throw new AuthError(401,"Authentication is required.");return request.user.userId;}
export const list:RequestHandler=async(req,res,next)=>{try{res.json({success:true,data:{services:await service.workerServices(userId(req))}});}catch(error){next(error);}};
export const eligible:RequestHandler=async(req,res,next)=>{try{res.json({success:true,data:{services:await service.eligibleServices(userId(req))}});}catch(error){next(error);}};
export const add:RequestHandler=async(req,res,next)=>{try{res.status(201).json({success:true,message:"Service added successfully",data:{service:await service.addService(userId(req),service.validateOffering(req.body,true))}});}catch(error){next(error);}};
export const update:RequestHandler=async(req,res,next)=>{try{res.json({success:true,message:"Price updated successfully",data:{service:await service.updatePrice(userId(req),String(req.params.id),service.validateOffering(req.body,false))}});}catch(error){next(error);}};
export const remove:RequestHandler=async(req,res,next)=>{try{await service.removeService(userId(req),String(req.params.id));res.json({success:true,message:"Service removed successfully"});}catch(error){next(error);}};
export const availability:RequestHandler=async(req,res,next)=>{try{res.json({success:true,message:"Availability updated",data:await service.setAvailability(userId(req),service.validateAvailability(req.body))});}catch(error){next(error);}};
