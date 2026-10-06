import {test, mock} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomUUID, randomBytes} from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {Prisma} from '../dist/generated/prisma/client.js';
const customer = {id:randomUUID(),name:'Customer',phone:'0000000051',email:null,role:'CUSTOMER',isActive:true,passwordHash:await bcrypt.hash('StrongPassword123',12)};
let users=[customer], profiles=[], failProfile=false, uniqueRace=false;
const category={id:randomUUID(),slug:'plumber',name:'Plumber',isActive:true};
const matches=(row,where)=>Object.entries(where).every(([key,value])=>row[key]===value);
const project=(row,select)=>row?Object.fromEntries(Object.keys(select).map(key=>[key,key==='workerProfile'?profiles.find(p=>p.userId===row.id)||null:row[key]])):null;
const database={
 user:{findUnique:async({where,select})=>project(users.find(row=>matches(row,where)),select),create:async({data,select})=>{if(uniqueRace||users.some(u=>u.phone===data.phone))throw new Prisma.PrismaClientKnownRequestError('Private conflict',{code:'P2002',clientVersion:'7.10.0'});const user={id:randomUUID(),email:null,createdAt:new Date(),...data};users.push(user);return project(user,select);}},
 category:{findFirst:async({where})=>matches(category,where)?{id:category.id}:null},
 workerProfile:{create:async({data,select})=>{if(failProfile)throw Error('Private profile failure');const profile={id:randomUUID(),...data,primaryCategory:{id:category.id,name:category.name,slug:category.slug}};profiles.push(profile);return project(profile,select);},findUnique:async({where,select})=>project(profiles.find(row=>matches(row,where)),select)},
 async $transaction(action){const beforeUsers=[...users],beforeProfiles=[...profiles];try{return await action(database);}catch(error){users=beforeUsers;profiles=beforeProfiles;throw error;}},
};
mock.module('../dist/lib/prisma.js',{namedExports:{getPrismaClient:()=>database}});
process.env.JWT_SECRET=randomBytes(48).toString('hex');process.env.ALLOWED_ORIGINS='http://localhost:3000,http://localhost:3001';
const {default:app}=await import('../dist/app.js');
const {validateWorkerRegistration}=await import('../dist/services/auth.service.js');
test('worker authentication and customer regression with isolated database double',async t=>{
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(r=>server.close(r)));
 const request=async(path,body,token,origin)=>{const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...(origin?{Origin:origin}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json(),origin:response.headers.get('access-control-allow-origin')};};
 const input={name:' Test Worker ',phone:'0000000052',profession:'plumber',city:' Bengaluru ',password:'StrongPassword123'};let accessToken,worker;
 await t.test('registration validates fields and refuses protected values',()=>{for(const patch of [{name:' '},{phone:'123'},{profession:''},{city:' '},{password:'short'},{role:'ADMIN'},{isActive:false},{verificationStatus:'VERIFIED'},{rating:5},{totalReviews:10},{userId:customer.id},{workerProfileId:randomUUID()}])assert.throws(()=>validateWorkerRegistration({...input,...patch}));});
 await t.test('atomic WORKER and profile creation, bcrypt12, safe JWT and onboarding defaults',async()=>{
  const result=await request('/api/auth/register/worker',input);assert.equal(result.status,201);accessToken=result.body.data.accessToken;worker=result.body.data.user;
  assert.equal(worker.role,'WORKER');assert.equal(worker.name,'Test Worker');assert.equal('passwordHash' in worker,false);
  const stored=users.find(u=>u.id===worker.id),profile=profiles.find(p=>p.userId===worker.id);assert.equal(await bcrypt.compare(input.password,stored.passwordHash),true);assert.equal(bcrypt.getRounds(stored.passwordHash),12);
  assert.equal(profile.city,'Bengaluru');assert.equal(profile.primaryCategoryId,category.id);assert.equal(profile.verificationStatus,'PENDING');assert.equal(profile.isAvailable,false);assert.equal(profile.rating,0);assert.equal(profile.totalReviews,0);
  const payload=jwt.verify(accessToken,process.env.JWT_SECRET);assert.equal(payload.userId,worker.id);assert.equal(payload.role,'WORKER');for(const key of ['phone','password','passwordHash'])assert.equal(key in payload,false);
 });
 await t.test('shared login/me and WORKER protected profile reject customer',async()=>{
  assert.equal((await request('/api/auth/login',{phone:input.phone,password:input.password})).body.data.user.role,'WORKER');
  assert.equal((await request('/api/auth/me',undefined,accessToken)).body.data.user.id,worker.id);
  const profile=await request('/api/worker/profile',undefined,accessToken);assert.equal(profile.status,200);assert.equal(profile.body.data.workerProfile.verificationStatus,'PENDING');assert.equal(JSON.stringify(profile.body).includes('passwordHash'),false);
  const login=await request('/api/auth/login',{phone:customer.phone,password:input.password});assert.equal(login.status,200);assert.equal(login.body.data.user.role,'CUSTOMER');
  assert.equal((await request('/api/worker/profile',undefined,login.body.data.accessToken)).status,403);
  assert.equal((await request('/api/auth/me',undefined,login.body.data.accessToken)).body.data.user.id,customer.id);
  assert.equal((await request('/api/customer/test',undefined,login.body.data.accessToken)).status,200);
  assert.equal((await request('/api/worker/profile')).status,401);assert.equal((await request('/api/worker/profile',undefined,'invalid')).status,401);
 });
 await t.test('duplicate customer phone and invalid profession never create worker',async()=>{
  assert.equal((await request('/api/auth/register/worker',{...input,phone:customer.phone})).status,409);
  assert.equal((await request('/api/auth/register/worker',{...input,phone:'0000000053',profession:'unknown'})).status,400);
  category.isActive=false;assert.equal((await request('/api/auth/register/worker',{...input,phone:'0000000053'})).status,400);category.isActive=true;
  assert.equal(users.length,2);assert.equal(profiles.length,1);
 });
 await t.test('profile failure rolls back user, concurrent uniqueness conflicts safe',async()=>{
  failProfile=true;const result=await request('/api/auth/register/worker',{...input,phone:'0000000054'});failProfile=false;assert.equal(result.status,500);assert.equal(JSON.stringify(result.body).includes('Private'),false);assert.equal(users.length,2);assert.equal(profiles.length,1);
  uniqueRace=true;assert.equal((await request('/api/auth/register/worker',{...input,phone:'0000000054'})).status,409);uniqueRace=false;
 });
 await t.test('CORS preserves both approved origins and rejects arbitrary browsers',async()=>{for(const origin of ['http://localhost:3000','http://localhost:3001'])assert.equal((await request('/',undefined,undefined,origin)).origin,origin);assert.equal((await request('/',undefined,undefined,'https://unapproved.example')).origin,null);});
});
