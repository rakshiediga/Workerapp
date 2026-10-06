import {apiFetch} from "./api";
export interface EligibleService {id:string;name:string;slug:string;description:string|null;category:{id:string;name:string;slug:string}}
export interface OfferedService {id:string;serviceId:string;name:string;category:EligibleService["category"];price:string;isActive:boolean}
export const getServices=()=>apiFetch<{data:{services:OfferedService[]}}>("/api/worker/services").then(result=>result.data.services);
export const getEligibleServices=()=>apiFetch<{data:{services:EligibleService[]}}>("/api/worker/available-services").then(result=>result.data.services);
export function saveService(price:string,serviceId:string,id?:string){return apiFetch(id?`/api/worker/services/${encodeURIComponent(id)}`:"/api/worker/services",{method:id?"PATCH":"POST",body:JSON.stringify(id?{price}:{serviceId,price})});}
export function removeService(id:string){return apiFetch(`/api/worker/services/${encodeURIComponent(id)}`,{method:"DELETE"});}
export function priceError(price:string){
  const value=price.trim();if(!/^\d{1,7}(?:\.\d{1,2})?$/.test(value))return "Enter a price greater than zero, up to 1000000.00, with at most two decimal places.";
  const [whole,fraction=""]=value.split(".");const minor=BigInt(whole)*BigInt(100)+BigInt(fraction.padEnd(2,"0"));
  return minor<=BigInt(0)||minor>BigInt(100000000)?"Price must be greater than zero and at most 1000000.00.":"";
}
