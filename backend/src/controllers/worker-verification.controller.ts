import type {RequestHandler} from "express";
import {getVerification,submitVerification} from "../services/worker-verification.service.js";
import {AuthError} from "../types/auth.types.js";
export const status:RequestHandler=async(req,res,next)=>{try{if(!req.user)throw new AuthError(401,"Authentication is required.");res.json({success:true,data:await getVerification(req.user.userId)});}catch(error){next(error);}};
export const submit:RequestHandler=async(req,res,next)=>{try{if(!req.user)throw new AuthError(401,"Authentication is required.");const data=await submitVerification(req.user.userId,req.body,(req.files??{}) as Record<string,Express.Multer.File[]>);res.status(201).json({success:true,message:"Verification submitted successfully.",data});}catch(error){next(error);}};
