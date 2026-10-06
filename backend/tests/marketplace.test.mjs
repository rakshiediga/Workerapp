import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { Prisma } from "../dist/generated/prisma/client.js";
// These query/HTTP tests use an isolated database double, not PostgreSQL.
const id = "9aed55ee-6d27-4f31-b36c-c031c2636f93";
const category = { id, name: "Plumber", slug: "plumber", description: null, isActive: true };
const service = { id, name: "Tap Repair", slug: "tap-repair", description: null, basePrice: new Prisma.Decimal("299.00"), category };
const row = { id, user: { name: "Test Worker" }, bio: "Updated public bio", city: "Bengaluru", serviceArea: "BTM Layout", experienceYears: 8, startingPrice: new Prisma.Decimal("299.00"), rating: new Prisma.Decimal("4.80"), totalReviews: 1, isAvailable: true, verificationStatus: "VERIFIED", services: [{ price: new Prisma.Decimal("299.25"), service }], reviews: [{ id, rating: 5, comment: "Good", createdAt: new Date("2026-01-01"), customer: { name: "Reviewer" } }] };
let available = true;
let lastWorkerQuery;
const database = {
 category: { findMany: async args => { assert.deepEqual(args.where,{isActive:true}); return [category]; }, findFirst: async args => args.where.slug === "plumber" ? category : null },
 service: { findMany: async args => { assert.equal(args.where.isActive,true); assert.equal(args.where.category.isActive,true); return args.where.category.slug && args.where.category.slug !== "plumber" ? [] : [service]; } },
 workerProfile: { findMany: async args => { lastWorkerQuery=args; assert.equal(args.where.verificationStatus,"VERIFIED"); assert.deepEqual(args.where.user,{isActive:true,role:"WORKER"}); assert.deepEqual(args.select.user,{select:{name:true}}); return args.where.isAvailable === false || args.where.services.some.service.category.slug === "electrician" ? [] : [row]; }, findFirst: async args => { assert.equal(args.where.verificationStatus,"VERIFIED"); assert.deepEqual(args.select.reviews.select.customer,{select:{name:true}}); return args.where.id === id ? row : null; } },
};
mock.module("../dist/lib/prisma.js",{namedExports:{getPrismaClient:()=>available?database:null}});
const { default: app }=await import("../dist/app.js");
test("public marketplace HTTP contracts and conservative Prisma queries",async t=>{
 const server=app.listen(0,"127.0.0.1");await once(server,"listening");t.after(()=>new Promise(resolve=>server.close(resolve)));
 const get=async path=>{const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`);return {status:response.status,body:await response.json()};};
 await t.test("public catalogue, category services, filtering and missing category",async()=>{
  for(const path of ["/api/categories","/api/categories/plumber/services","/api/services","/api/services?category=plumber"])assert.equal((await get(path)).status,200,path);
  assert.equal((await get("/api/services")).body.data.services[0].basePrice,"299.00");
  assert.equal((await get("/api/services?category=electrician")).body.data.services.length,0);
  assert.equal((await get("/api/categories/missing/services")).status,404);
 });
 await t.test("verified workers, filters, decimal strings, deterministic sorting",async()=>{
  for(const path of ["/api/workers","/api/workers?category=plumber","/api/workers?availability=true","/api/workers?service=tap-repair&sort=price"]){const result=await get(path);assert.equal(result.status,200);assert.equal(result.body.data.workers[0].startingPrice,"299.25");assert.equal(result.body.data.workers[0].services[0].price,"299.25");}
  assert.equal(lastWorkerQuery.where.services.some.service.slug,"tap-repair");assert.deepEqual(lastWorkerQuery.orderBy,[{startingPrice:"asc"},{id:"asc"}]);
  assert.equal((await get("/api/workers?category=electrician")).body.data.workers.length,0);
  assert.equal((await get("/api/workers?availability=false")).body.data.workers.length,0);
 });
 await t.test("worker details, public reviews and invalid/hidden IDs",async()=>{
  const result=await get("/api/workers/"+id);assert.equal(result.status,200);assert.equal(result.body.data.worker.reviews[0].customerName,"Reviewer");assert.equal(result.body.data.worker.city,"Bengaluru");assert.equal(result.body.data.worker.serviceArea,"BTM Layout");assert.equal(result.body.data.worker.bio,"Updated public bio");
  for(const key of ["passwordHash","phone","email","userId","customerId","bookingId","providerPaymentId"])assert.equal(JSON.stringify(result.body).includes('"'+key+'"'),false,key);
  for(const value of ["INVALID-ID","11111111-1111-1111-1111-111111111111"]){const result=await get("/api/workers/"+value);assert.equal(result.status,404);assert.equal(result.body.message,"Worker not found");}
 });
 await t.test("query validation and safe unavailable database response",async()=>{
  for(const query of ["sort=unsupported","sort=rating&sort=price","availability=yes","category=Plumber","service=tap-repair&service=other"])assert.equal((await get("/api/workers?"+query)).status,400,query);
  available=false;const result=await get("/api/workers");assert.equal(result.status,503);assert.equal(result.body.success,false);available=true;
  assert.equal((await get("/")).status,200);
 });
});
