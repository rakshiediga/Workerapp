import {Prisma} from "../generated/prisma/client.js";
import {getPrismaClient} from "../lib/prisma.js";
import {AuthError} from "../types/auth.types.js";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const activeService = {isActive: true, category: {isActive: true}};
const serviceSelect = {id:true,name:true,slug:true,description:true,isActive:true,category:{select:{id:true,name:true,slug:true,isActive:true}}} satisfies Prisma.ServiceSelect;
const offeringSelect = {id:true,serviceId:true,price:true,service:{select:serviceSelect}} satisfies Prisma.WorkerServiceSelect;
function database() {const client=getPrismaClient();if(!client)throw new AuthError(503,"Worker services are temporarily unavailable.");return client;}
async function worker(client: Prisma.TransactionClient, userId: string) {
  const profile=await client.workerProfile.findFirst({where:{userId,user:{role:"WORKER",isActive:true}},select:{id:true,primaryCategoryId:true,isAvailable:true}});
  if(!profile)throw new AuthError(404,"Worker profile not found");return profile;
}
function dto(row: Prisma.WorkerServiceGetPayload<{select:typeof offeringSelect}>) {return {id:row.id,serviceId:row.serviceId,name:row.service.name,category:row.service.category,isActive:row.service.isActive&&row.service.category.isActive,price:row.price.toFixed(2)};}
function body(value:unknown,fields:string[]) {
  if(!value||typeof value!=="object"||Array.isArray(value))throw new AuthError(400,"A JSON request body is required.");
  const input=value as Record<string,unknown>;
  if(Object.keys(input).some(key=>!fields.includes(key)))throw new AuthError(400,"Unsupported fields.");return input;
}
export function validatePrice(value:unknown) {
  if(typeof value!=="string"||!/^\d{1,7}(?:\.\d{1,2})?$/.test(value.trim()))throw new AuthError(400,"Price must be a decimal amount greater than zero and at most 1000000.00.");
  const price=new Prisma.Decimal(value.trim());
  if(price.lte(0)||price.gt("1000000.00"))throw new AuthError(400,"Price must be greater than zero and at most 1000000.00.");return price;
}
export function validateOffering(value:unknown,create:boolean) {
  const input=body(value,create?["serviceId","price"]:["price"]);
  if(create&&(typeof input.serviceId!=="string"||!uuid.test(input.serviceId)))throw new AuthError(400,"Select a valid service.");
  return {serviceId:input.serviceId as string,price:validatePrice(input.price)};
}
export function validateAvailability(value:unknown) {const input=body(value,["isAvailable"]);if(typeof input.isAvailable!=="boolean")throw new AuthError(400,"isAvailable must be true or false.");return input.isAvailable;}
function validId(id:string) {if(!uuid.test(id))throw new AuthError(404,"Service not found");}
async function mutation<T>(userId:string,action:(tx:Prisma.TransactionClient,profile:Awaited<ReturnType<typeof worker>>)=>Promise<T>) {
  return database().$transaction(async tx=>{
    // Serialize service/availability changes, including concurrent last-service removal.
    const locked=await tx.$queryRaw<{id:string}[]>(Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid AND "role" = 'WORKER' AND "isActive" = true FOR UPDATE`);
    if(!locked.length)throw new AuthError(403,"Worker access is required.");
    return action(tx,await worker(tx,userId));
  });
}
export async function workerServices(userId:string) {const client=database(),profile=await worker(client,userId);return (await client.workerService.findMany({where:{workerId:profile.id},select:offeringSelect,orderBy:[{service:{name:"asc"}},{id:"asc"}]})).map(dto);}
export async function eligibleServices(userId:string) {
  const client=database(),profile=await worker(client,userId);
  if(!profile.primaryCategoryId) return [];
  return client.service.findMany({where:{...activeService,categoryId:profile.primaryCategoryId},select:serviceSelect,orderBy:[{name:"asc"},{id:"asc"}]});
}
export async function addService(userId:string,input:ReturnType<typeof validateOffering>) {
  try {return await mutation(userId,async(tx,profile)=>{
    const service=await tx.service.findFirst({where:{id:input.serviceId,...activeService,categoryId:profile.primaryCategoryId??"00000000-0000-0000-0000-000000000000"},select:{id:true}});
    if(!service)throw new AuthError(400,"Select an active service from your profession.");
    return dto(await tx.workerService.create({data:{workerId:profile.id,serviceId:service.id,price:input.price},select:offeringSelect}));
  });}catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002")throw new AuthError(409,"You already offer this service.");throw error;}
}
export async function updatePrice(userId:string,id:string,input:ReturnType<typeof validateOffering>) {
  validId(id);return mutation(userId,async(tx,profile)=>{
    const updated=await tx.workerService.updateMany({where:{id,workerId:profile.id},data:{price:input.price}});
    if(!updated.count)throw new AuthError(404,"Service not found");
    const row=await tx.workerService.findFirst({where:{id,workerId:profile.id},select:offeringSelect});if(!row)throw new AuthError(404,"Service not found");return dto(row);
  });
}
export async function removeService(userId:string,id:string) {
  validId(id);return mutation(userId,async(tx,profile)=>{
    const result=await tx.workerService.deleteMany({where:{id,workerId:profile.id}});if(!result.count)throw new AuthError(404,"Service not found");
    if(!await tx.workerService.count({where:{workerId:profile.id,service:activeService}}))await tx.workerProfile.update({where:{id:profile.id},data:{isAvailable:false}});
  });
}
export async function setAvailability(userId:string,isAvailable:boolean) {
  return mutation(userId,async(tx,profile)=>{
    if(isAvailable&&!await tx.workerService.count({where:{workerId:profile.id,service:activeService}}))throw new AuthError(400,"Add at least one active service before becoming available.");
    // Availability is a preference; VERIFIED remains independently required for booking.
    return tx.workerProfile.update({where:{id:profile.id},data:{isAvailable},select:{isAvailable:true}});
  });
}
