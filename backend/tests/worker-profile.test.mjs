import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomUUID,randomBytes} from 'node:crypto';
import jwt from 'jsonwebtoken';
import {Prisma} from '../dist/generated/prisma/client.js';
const a={id:randomUUID(),name:'Worker A',phone:'0000000071',email:'a@example.com',role:'WORKER',isActive:true,createdAt:new Date(),passwordHash:'private'};
const b={...a,id:randomUUID(),name:'Worker B',email:'b@example.com'},customer={...a,id:randomUUID(),role:'CUSTOMER'};
const users=[a,b,customer];
const profiles=[a,b].map(user=>({id:randomUUID(),userId:user.id,bio:null,experienceYears:0,city:'Bengaluru',serviceArea:null,startingPrice:new Prisma.Decimal(0),rating:new Prisma.Decimal(0),totalReviews:0,isAvailable:false,verificationStatus:'PENDING',primaryCategory:{id:randomUUID(),name:'Plumber',slug:'plumber'}}));
let fail=false;
const matches=(row,where)=>Object.entries(where).every(([key,value])=>row[key]===value);
const select=(row,fields)=>row?Object.fromEntries(Object.keys(fields).map(key=>[key,key==='workerProfile'?select(profiles.find(p=>p.userId===row.id),fields[key].select):row[key]])):null;
const database={user:{findUnique:async({where,select:fields})=>select(users.find(u=>matches(u,where)),fields),update:async({where,data,select:fields})=>{const user=users.find(u=>matches(u,where));if(data.email&&users.some(u=>u.id!==user.id&&u.email===data.email))throw new Prisma.PrismaClientKnownRequestError('Private duplicate',{code:'P2002',clientVersion:'7.10.0'});Object.assign(user,data);return select(user,fields);}},workerProfile:{update:async({where,data,select:fields})=>{if(fail)throw Error('Private profile database error');const profile=profiles.find(p=>matches(p,where));Object.assign(profile,data);return select(profile,fields);}},async $transaction(action){const before=users.map(u=>({...u})),profileBefore=profiles.map(p=>({...p}));try{return await action(database);}catch(e){users.forEach((u,i)=>Object.assign(u,before[i]));profiles.forEach((p,i)=>Object.assign(p,profileBefore[i]));throw e;}}};
mock.module('../dist/lib/prisma.js',{namedExports:{getPrismaClient:()=>database}});
process.env.JWT_SECRET=randomBytes(48).toString('hex');
const token=u=>jwt.sign({userId:u.id,role:u.role},process.env.JWT_SECRET,{expiresIn:'1h'});
const {default:app}=await import('../dist/app.js');
test('worker profile ownership, validation, atomicity and protected fields (database double)',async t=>{
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(r=>server.close(r)));
 const request=async(body,auth=token(a),path='/api/worker/profile')=>{const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method:body?'PATCH':'GET',headers:{...(auth?{Authorization:'Bearer '+auth}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:response.status,body:await response.json()};};
 await t.test('safe GET, role/account checks and missing profile',async()=>{
  const result=await request();assert.equal(result.status,200);assert.equal(result.body.data.user.id,a.id);assert.equal(result.body.data.workerProfile.startingPrice,'0.00');assert.equal(JSON.stringify(result.body).includes('passwordHash'),false);assert.equal(JSON.stringify(result.body).includes('userId'),false);
  for(const body of [undefined,{bio:'Test'}]){assert.equal((await request(body,null)).status,401);assert.equal((await request(body,'invalid')).status,401);assert.equal((await request(body,token(customer))).status,403);}
  a.isActive=false;assert.equal((await request()).status,403);a.isActive=true;
  const profile=profiles.shift();assert.equal((await request()).status,404);profiles.unshift(profile);
 });
 await t.test('invalid values and protected fields never modify database',async()=>{
  const beforeUser={...a},beforeProfile={...profiles[0]};
  for(const body of [{},{name:' '},{city:' '},{bio:'x'.repeat(1001)},{serviceArea:'x'.repeat(201)},{experienceYears:-1},{experienceYears:1.5},{experienceYears:61},{experienceYears:'8'},{email:'bad'},{startingPrice:'-1'},{startingPrice:'1.001'},{startingPrice:299},{startingPrice:'10000000000'},...['role','phone','isActive','rating','totalReviews','verificationStatus','isAvailable','userId','workerProfileId','primaryCategoryId','createdAt'].map(key=>({[key]:'forbidden'}))])assert.equal((await request(body)).status,400);
  assert.equal((await request({verificationStatus:'VERIFIED',rating:5,totalReviews:500,role:'ADMIN',isAvailable:true})).status,400);
  assert.deepEqual(a,beforeUser);assert.deepEqual(profiles[0],beforeProfile);
 });
 await t.test('JWT owner only, Decimal price, whitespace/email normalization, persistent reads',async()=>{
  const beforeB={...b},profileB={...profiles[1]};
  const result=await request({name:' Updated Worker ',email:' NEW@EXAMPLE.COM ',bio:' Experienced plumber ',experienceYears:8,city:' Bengaluru ',serviceArea:' BTM Layout ',startingPrice:'299.10'});
  assert.equal(result.status,200);assert.equal(result.body.data.user.name,'Updated Worker');assert.equal(result.body.data.user.email,'new@example.com');assert.equal(result.body.data.workerProfile.startingPrice,'299.10');assert.equal(result.body.data.workerProfile.bio,'Experienced plumber');assert.equal(result.body.data.workerProfile.serviceArea,'BTM Layout');assert.ok(profiles[0].startingPrice instanceof Prisma.Decimal);assert.equal(profiles[0].verificationStatus,'PENDING');assert.equal(profiles[0].isAvailable,false);
  assert.deepEqual(b,beforeB);assert.deepEqual(profiles[1],profileB);assert.equal((await request()).body.data.workerProfile.serviceArea,'BTM Layout');
  assert.equal((await request({bio:'Other'},token(a),'/api/worker/profile/'+profiles[1].id)).status,404);
 });
 await t.test('email uniqueness and profile failure roll back all account changes',async()=>{
  assert.equal((await request({email:b.email})).status,409);assert.equal(a.email,'new@example.com');assert.equal((await request({email:a.email})).status,200);
  fail=true;const result=await request({name:'Must roll back',bio:'Failure'});fail=false;assert.equal(result.status,500);assert.equal(a.name,'Updated Worker');assert.equal(profiles[0].bio,'Experienced plumber');assert.equal(JSON.stringify(result.body).includes('Private'),false);
  assert.equal((await request({email:' ',bio:' ',serviceArea:null})).status,200);assert.equal(a.email,null);assert.equal(profiles[0].bio,null);assert.equal(profiles[0].serviceArea,null);
 });
});
