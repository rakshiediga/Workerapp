import {useResource} from "./use-job-requests";
export const verificationStateLabels:Record<string,string>={NOT_SUBMITTED:"Not Submitted",PENDING_REVIEW:"Pending Review",VERIFIED:"Verified",REJECTED:"Rejected",SUSPENDED:"Suspended"};
export interface VerificationState {status:string;submissionState:string;submittedAt:string|null;reviewedAt:string|null;rejectionReason:string|null;verification:{fullLegalName:string;documentType:string;maskedDocumentNumber:string;documents:{front:boolean;back:boolean};submittedAt:string}|null}
export function useVerification(){return useResource<VerificationState>("/api/worker/verification");}
