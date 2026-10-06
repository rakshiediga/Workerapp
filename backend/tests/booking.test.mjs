import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { Prisma } from "../dist/generated/prisma/client.js";

// Isolated transactional database double. No real PostgreSQL persistence is
// claimed; query predicates, server-controlled values and HTTP contracts are tested.
const customerA = { id: randomUUID(), name: "Customer A", phone: "0000000011", email: null, role: "CUSTOMER", isActive: true };
const customerB = { ...customerA, id: randomUUID(), name: "Customer B", phone: "0000000012" };
const workerUser = { ...customerA, id: randomUUID(), role: "WORKER" };
const users = [customerA, customerB, workerUser];
const workerId = randomUUID(), serviceId = randomUUID(), categoryId = randomUUID();
let rows = [], available = true, workerAvailable = true, workerPublic = true, serviceActive = true, offered = true;
let failCreateHistory = false, failCancelHistory = false;
let clock = Date.now(), queue = Promise.resolve();
const stamp = () => new Date(++clock);
const matches = (row, where) => Object.entries(where).every(([key,value]) => row[key] === value);
const database = {
 user: {
  async findUnique({where,select}) { const user = users.find(user=>matches(user,where)); return user ? Object.fromEntries(Object.keys(select).map(key=>[key,user[key]])) : null; },
  async findFirst({where,select}) { const user = users.find(user=>matches(user,where)); assert.deepEqual(select,{phone:true}); return user ? {phone:user.phone} : null; },
 },
 workerProfile: { async findFirst({where,select}) {
  assert.equal(where.verificationStatus,"VERIFIED");assert.deepEqual(where.user,{role:"WORKER",isActive:true});assert.deepEqual(select,{isAvailable:true});
  return where.id === workerId && workerPublic ? { isAvailable: workerAvailable } : null;
 } },
 workerService: { async findFirst({where,select}) {
  assert.deepEqual(where.service,{isActive:true,category:{isActive:true}});assert.deepEqual(select,{price:true});
  return where.workerId===workerId && where.serviceId===serviceId && offered && serviceActive ? {price:new Prisma.Decimal("299.25")} : null;
 } },
 booking: {
  async create({data,select}) {
   assert.deepEqual(select.worker.select.user,{select:{name:true}});
   assert.equal(data.statusHistory.create.status,"REQUESTED");assert.equal(data.statusHistory.create.changedByUserId,customerA.id);
   const createdAt=stamp();const row={id:randomUUID(),...data,createdAt,worker:{id:workerId,user:{name:"Test Worker"}},service:{id:serviceId,name:"Tap Repair",category:{id:categoryId,name:"Plumber",slug:"plumber"}},statusHistory:[{status:"REQUESTED",createdAt}]};
   rows.push(row);if(failCreateHistory)throw Error("Private database error");return row;
  },
  async findFirst({where}) { return rows.find(row=>matches(row,where)) || null; },
  async findMany({where,orderBy}) { assert.deepEqual(orderBy,[{createdAt:"desc"},{id:"desc"}]);return rows.filter(row=>matches(row,where)).sort((a,b)=>b.createdAt-a.createdAt); },
  async updateMany({where,data}) { assert.equal(where.status,"REQUESTED");assert.equal(typeof where.customerId,"string");const row=rows.find(row=>matches(row,where));if(!row)return {count:0};row.status=data.status;return {count:1}; },
 },
 bookingStatusHistory: { async create({data}) { if(failCancelHistory)throw Error("Private history error");const row=rows.find(row=>row.id===data.bookingId);assert.equal(row.customerId,data.changedByUserId);row.statusHistory.push({status:data.status,createdAt:stamp()});return data; } },
 async $transaction(callback) {
  const previous=queue;let release;queue=new Promise(resolve=>release=resolve);await previous;
  const before=rows.map(row=>({...row,statusHistory:[...row.statusHistory]}));
  try { return await callback(database); } catch(error) { rows=before;throw error; } finally { release(); }
 },
};
mock.module("../dist/lib/prisma.js",{namedExports:{getPrismaClient:()=>available?database:null}});
process.env.JWT_SECRET=randomBytes(48).toString("hex");process.env.JWT_EXPIRES_IN="7d";
const token=user=>jwt.sign({userId:user.id,role:user.role},process.env.JWT_SECRET,{algorithm:"HS256",expiresIn:"1h"});
const {default:app}=await import("../dist/app.js");
const {validateBooking,indiaToday}=await import("../dist/services/booking.service.js");

test("customer booking security, validation, transactions and HTTP contracts",async t=>{
 const server=app.listen(0,"127.0.0.1");await once(server,"listening");t.after(()=>new Promise(resolve=>server.close(resolve)));
 const authA=token(customerA),authB=token(customerB),authWorker=token(workerUser);
 const request=async(path,method="GET",body,auth=authA)=>{const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{...(auth?{Authorization:"Bearer "+auth}:{}),...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json()};};
 const input={workerId,serviceId,bookingDate:"2099-10-10",bookingTime:"10:00",address:{label:"Home",houseFlat:"#12",streetArea:"Test Area",landmark:"Near Test Road",city:"Bengaluru",state:"Karnataka",pincode:"560076"},problemDescription:"Kitchen tap leaks"};
 let number;
 await t.test("no token, invalid token and wrong role are blocked on every booking route",async()=>{
  for(const [path,method] of [["/api/bookings","POST"],["/api/bookings/my","GET"],["/api/bookings/WBINVALID","GET"],["/api/bookings/WBINVALID/cancel","PATCH"]]){
   assert.equal((await request(path,method,method==="POST"?input:undefined,null)).status,401);
   assert.equal((await request(path,method,method==="POST"?input:undefined,"invalid")).status,401);
   assert.equal((await request(path,method,method==="POST"?input:undefined,authWorker)).status,403);
  }
 });
 await t.test("validation uses India calendar dates and approved HH:mm slots",async()=>{
  const now=new Date("2026-10-01T19:00:00Z");assert.equal(indiaToday(now),"2026-10-02");
  assert.equal(validateBooking({...input,bookingDate:"2026-10-02"},now).bookingDate.toISOString(),"2026-10-02T00:00:00.000Z");
  assert.throws(()=>validateBooking({...input,bookingDate:"2026-10-01"},now));
  for(const patch of [{bookingDate:"2026-02-30"},{bookingTime:"10:00 AM"},{bookingTime:"23:00"},{address:{...input.address,state:""}},{address:{...input.address,pincode:"12345"}},{customerId:customerB.id},{customerPhone:"1111111111"},{status:"COMPLETED"},{bookingNumber:"client"}]) assert.equal((await request("/api/bookings","POST",{...input,...patch})).status,400,JSON.stringify(patch));
  assert.equal((await request("/api/bookings","POST",{...input,workerId:"INVALID"})).status,404);
  assert.equal((await request("/api/bookings","POST",{...input,bookingDate:"2000-01-01"})).status,400);
 });
 await t.test("creation ignores forged price and derives owner/phone/history from server",async()=>{
  const result=await request("/api/bookings","POST",{...input,price:"1.00"});assert.equal(result.status,201);const booking=result.body.data.booking;number=booking.bookingNumber;
  assert.match(number,/^WB[0-9A-F]{40}$/);assert.equal(booking.price,"299.25");assert.equal(booking.status,"REQUESTED");assert.equal(booking.customerPhone,customerA.phone);assert.deepEqual(booking.address,input.address);assert.equal(booking.statusHistory[0].status,"REQUESTED");
  assert.equal(rows[0].customerId,customerA.id);assert.equal(rows[0].price.toFixed(2),"299.25");
  for(const field of ["passwordHash","email","customerId","changedByUserId","userId"])assert.equal(JSON.stringify(result.body).includes('"'+field+'"'),false,field);
 });
 await t.test("worker/service activation, availability and offering validation",async()=>{
  assert.equal((await request("/api/bookings","POST",{...input,workerId:randomUUID()})).status,404);
  workerPublic=false;assert.equal((await request("/api/bookings","POST",input)).status,404);workerPublic=true;
  workerAvailable=false;assert.equal((await request("/api/bookings","POST",input)).status,400);workerAvailable=true;
  for(const patch of [{serviceId:"invalid"},{serviceId:randomUUID()}])assert.equal((await request("/api/bookings","POST",{...input,...patch})).status,400);
  offered=false;assert.equal((await request("/api/bookings","POST",input)).status,400);offered=true;
  serviceActive=false;assert.equal((await request("/api/bookings","POST",input)).status,400);serviceActive=true;
 });
 await t.test("my bookings and detail ownership are isolated between customers",async()=>{
  assert.equal((await request("/api/bookings/my")).body.data.bookings.length,1);
  assert.equal((await request("/api/bookings/my?status=REQUESTED")).body.data.bookings.length,1);
  assert.equal((await request("/api/bookings/my?customerId="+customerB.id)).body.data.bookings.length,1);
  assert.equal((await request("/api/bookings/my","GET",undefined,authB)).body.data.bookings.length,0);
  assert.equal((await request("/api/bookings/"+number)).status,200);
  for(const suffix of ["","/cancel"])assert.equal((await request("/api/bookings/"+number+suffix,suffix?"PATCH":"GET",undefined,authB)).status,404);
  assert.equal((await request("/api/bookings/INVALID-ID")).status,404);
  for(const status of ["bad","Requested","REQUESTED&status=CANCELLED"])assert.equal((await request("/api/bookings/my?status="+status)).status,400);
 });
 await t.test("history failure rolls back creation and cancellation",async()=>{
  const count=rows.length;failCreateHistory=true;assert.equal((await request("/api/bookings","POST",input)).status,500);assert.equal(rows.length,count);failCreateHistory=false;
  failCancelHistory=true;const result=await request("/api/bookings/"+number+"/cancel","PATCH");assert.equal(result.status,500);assert.equal(JSON.stringify(result.body).includes("Private"),false);assert.equal(rows[0].status,"REQUESTED");assert.equal(rows[0].statusHistory.length,1);failCancelHistory=false;
 });
 await t.test("concurrent cancellation only updates REQUESTED once; history persists",async()=>{
  const results=await Promise.all([request("/api/bookings/"+number+"/cancel","PATCH"),request("/api/bookings/"+number+"/cancel","PATCH")]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const booking=(await request("/api/bookings/"+number)).body.data.booking;assert.equal(booking.status,"CANCELLED");assert.deepEqual(booking.statusHistory.map(row=>row.status),["REQUESTED","CANCELLED"]);assert.equal(rows.length,1);
  assert.equal((await request("/api/bookings/"+number+"/cancel","PATCH")).status,409);
  assert.equal((await request("/api/bookings/my?status=CANCELLED")).body.data.bookings.length,1);
  assert.equal((await request("/api/bookings/my?status=REQUESTED")).body.data.bookings.length,0);
 });
 await t.test("other statuses reject cancellation and multiple creations get unique numbers",async()=>{
  const result=await request("/api/bookings","POST",input);assert.equal(result.status,201);const second=result.body.data.booking.bookingNumber;assert.notEqual(second,number);
  for(const status of ["ACCEPTED","IN_PROGRESS","COMPLETED"]){rows.find(row=>row.bookingNumber===second).status=status;assert.equal((await request("/api/bookings/"+second+"/cancel","PATCH")).status,409);}
  available=false;assert.equal((await request("/api/bookings/my")).status,503);available=true;
 });
});
