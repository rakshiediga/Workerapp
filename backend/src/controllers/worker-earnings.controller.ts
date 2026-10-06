import type {RequestHandler} from "express";
import {earningsSummary,earningsHistory} from "../services/worker-earnings.service.js";
import {AuthError} from "../types/auth.types.js";
export const summary:RequestHandler=async(req,res,next)=>{try{if(!req.user)throw new AuthError(401,"Authentication is required.");res.json({success:true,data:await earningsSummary(req.user.userId)});}catch(error){next(error);}};
export const history:RequestHandler=async(req,res,next)=>{try{if(!req.user)throw new AuthError(401,"Authentication is required.");res.json({success:true,data:await earningsHistory(req.user.userId,req.query)});}catch(error){next(error);}};
