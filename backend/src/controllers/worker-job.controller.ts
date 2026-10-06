import type {RequestHandler} from "express";
import {jobRequests,jobRequest,workerJobs,jobStatus,pageNumber,workerDashboard,jobDetails,transitionJob,actionReason,type JobAction} from "../services/worker-job.service.js";
import {AuthError} from "../types/auth.types.js";
export const list:RequestHandler=async(req,res,next)=>{try{if(!req.user)throw new AuthError(401,"Authentication is required.");res.json({success:true,data:{requests:await jobRequests(req.user.userId)}});}catch(error){next(error);}};
export const details:RequestHandler=async(req,res,next)=>{try{if(!req.user)throw new AuthError(401,"Authentication is required.");res.json({success:true,data:{request:await jobRequest(req.user.userId,req.params.bookingNumber)}});}catch(error){next(error);}};
export const jobs:RequestHandler=async(req,res,next)=>{try{if(!req.user)throw new AuthError(401,"Authentication is required.");res.json({success:true,data:await workerJobs(req.user.userId,jobStatus(req.query.status),pageNumber(req.query.page,1),pageNumber(req.query.limit,20,50))});}catch(error){next(error);}};
export const job:RequestHandler=async(req,res,next)=>{try{if(!req.user)throw new AuthError(401,"Authentication is required.");res.json({success:true,data:{booking:await jobDetails(req.user.userId,req.params.bookingNumber)}});}catch(error){next(error);}};
const messages:Record<JobAction,string>={accept:"Job accepted successfully",reject:"Job request rejected",start:"Job started successfully",complete:"Job completed successfully"};
function action(kind:JobAction):RequestHandler{return async(req,res,next)=>{try{if(!req.user)throw new AuthError(401,"Authentication is required.");const reason=actionReason(req.body,kind==="reject");const booking=await transitionJob(req.user.userId,req.params.bookingNumber,kind,reason);res.json({success:true,message:messages[kind],data:{booking}});}catch(error){next(error);}};}
export const accept=action("accept");
export const reject=action("reject");
export const start=action("start");
export const complete=action("complete");

export const dashboard:RequestHandler=async(req,res,next)=>{try{if(!req.user)throw new AuthError(401,"Authentication is required.");res.json({success:true,data:await workerDashboard(req.user.userId)});}catch(error){next(error);}};