import {mkdir,writeFile,unlink} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import {fileURLToPath} from "node:url";
import {join} from "node:path";
// Private storage keys, not public URLs. Object storage can replace this adapter.
export interface VerificationStorage {save(bytes:Buffer,extension:"jpg"|"png"|"pdf"):Promise<string>;remove(key:string):Promise<void>}
export const verificationStorage:VerificationStorage={
 async save(bytes,extension){const root=fileURLToPath(new URL("../../uploads/verification/",import.meta.url));await mkdir(root,{recursive:true,mode:0o700});const key=randomUUID()+"."+extension;try{await writeFile(join(root,key),bytes,{flag:"wx",mode:0o600});}catch(error){if(!(error instanceof Error && "code" in error && error.code==="EEXIST"))await unlink(join(root,key)).catch(()=>undefined);throw error;}return key;},
 async remove(key){if(!/^[0-9a-f-]{36}\.(jpg|png|pdf)$/.test(key))throw Error("Invalid private storage key");try{await unlink(join(fileURLToPath(new URL("../../uploads/verification/",import.meta.url)),key));}catch(error){if(!(error instanceof Error && "code" in error && error.code==="ENOENT"))throw error;}},
};
export async function cleanupVerificationFiles(keys:(string|null|undefined)[]){for(const key of keys)if(key)try{await verificationStorage.remove(key);}catch{console.warn("Private verification file cleanup requires attention.");}}
