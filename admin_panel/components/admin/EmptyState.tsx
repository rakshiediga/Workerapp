import {Icon} from "./Icon";
export function EmptyState({message,icon}:{message:string;icon:string}){return <div className="flex min-h-48 flex-col items-center justify-center gap-4 p-6 text-center"><span className="rounded-full bg-slate-100 p-4 text-slate-400"><Icon name={icon} className="h-6 w-6"/></span><p className="text-sm leading-6 text-slate-500">{message}</p></div>;}
