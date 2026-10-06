export interface JobRequest {
  bookingNumber: string; status: "REQUESTED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  service: {id: string; name: string}; customer: {name: string};
  bookingDate: string; bookingTime: string; price: string;
  address: {label: string; houseFlat: string; streetArea: string; landmark: string | null; city: string; state: string; pincode: string};
  problemDescription: string | null; createdAt: string;
  customerPhone?: string;
  statusHistory: {status: string; createdAt: string; reason?: string | null; actor?: string | null}[];
}
export function jobDate(value: string) {return new Intl.DateTimeFormat("en-IN", {dateStyle: "medium"}).format(new Date(value + "T00:00:00"));}

export function jobTimestamp(value:string,timezone="Asia/Kolkata") {return new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short",timeZone:timezone}).format(new Date(value))+" "+(timezone==="Asia/Kolkata"?"IST":timezone);}
export function jobMoney(value:string) {
  const match=/^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if(!match) return "Price unavailable";
  const integer=BigInt(match[1]).toLocaleString("en-IN");
  const fraction=(match[2] || "").padEnd(2,"0");
  return "\u20b9"+integer+(fraction==="00"?"":"."+fraction);
}
export function cancellation(job:JobRequest) {
  const entry=job.statusHistory.slice().reverse().find(item=>item.status==="CANCELLED");
  return {label:entry?.actor==="CUSTOMER"?"Cancelled by Customer":entry?.actor==="WORKER"?"Declined by You":"Cancelled",reason:entry?.reason};
}
