import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { Prisma } from "../dist/generated/prisma/client.js";
// Isolated database double: exercises HTTP, ownership, lock predicates and
// rollback. Actual PostgreSQL persistence/row-lock behavior requires configuration.
const a={id:randomUUID(),name:"A",phone:"0000000021",email:null,role:"CUSTOMER",isActive:true};
const b={...a,id:randomUUID(),name:"B",phone:"0000000022"},workerUser={...a,id:randomUUID(),role:"WORKER"};
const users=[a,b,workerUser],workerId=randomUUID(),serviceId=randomUUID();
let rows=[],bookings=[],available=true,clock=Date.now(),queue=Promise.resolve(),failDefault=false;
const matches=(row,where)=>Object.entries(where).every(([key,value])=>row[key]===value);
const project=(row,select)=>row?Object.fromEntries(Object.keys(select).map(key=>[key,row[key]])):null;
const sorted=(items,orderBy)=>[...items].sort((a,b)=>{for(const clause of orderBy||[]){const [key,direction]=Object.entries(clause)[0];const compare=a[key]>b[key]?1:a[key]<b[key]?-1:0;if(compare)return direction==='desc'?-compare:compare;}return 0;});
const database={
 user:{findUnique:async({where,select})=>project(users.find(u=>matches(u,where)),select),findFirst:async({where,select})=>project(users.find(u=>matches(u,where)),select)},
 async $queryRaw(query){assert.match(query.strings.join('?'),/FOR UPDATE/);assert.match(query.strings.join('?'),/"role" = 'CUSTOMER'/);return users.filter(u=>u.id===query.values[0]&&u.role==='CUSTOMER'&&u.isActive).map(u=>({id:u.id}));},
 address:{
  count:async({where})=>rows.filter(r=>matches(r,where)).length,
  findMany:async({where,select,orderBy})=>sorted(rows.filter(r=>matches(r,where)),orderBy).map(r=>project(r,select)),
  findFirst:async({where,select,orderBy})=>project(sorted(rows.filter(r=>matches(r,where)),orderBy)[0],select),
  create:async({data,select})=>{const row={id:randomUUID(),createdAt:new Date(++clock),latitude:null,longitude:null,...data};rows.push(row);return project(row,select);},
  updateMany:async({where,data})=>{if(failDefault&&data.isDefault===true)throw Error('Private DB error');let count=0;for(const row of rows)if(matches(row,where)){Object.assign(row,data);count++;}return {count};},
  deleteMany:async({where})=>{const before=rows.length;rows=rows.filter(r=>!matches(r,where));return {count:before-rows.length};},
 },
 workerProfile:{findFirst:async()=>({isAvailable:true})},workerService:{findFirst:async()=>({price:new Prisma.Decimal('299.00')})},
 booking:{create:async({data})=>{const createdAt=new Date(++clock);const row={...data,createdAt,worker:{id:workerId,userId:workerUser.id,user:{name:'Worker'}},customer:{name:a.name},service:{id:serviceId,name:'Tap Repair',category:{id:randomUUID(),name:'Plumber',slug:'plumber'}},statusHistory:[{status:'REQUESTED',createdAt}]};bookings.push(row);return row;},findFirst:async({where})=>bookings.find(r=>where.worker?r.bookingNumber===where.bookingNumber&&r.status===where.status&&r.worker.userId===where.worker.userId:matches(r,where))||null},
 async $transaction(action){const prev=queue;let release;queue=new Promise(r=>release=r);await prev;const before=rows.map(row=>({...row}));try{return await action(database);}catch(e){rows=before;throw e;}finally{release();}},
};
mock.module('../dist/lib/prisma.js',{namedExports:{getPrismaClient:()=>available?database:null}});
process.env.JWT_SECRET=randomBytes(48).toString('hex');
const token=user=>jwt.sign({userId:user.id,role:user.role},process.env.JWT_SECRET,{algorithm:'HS256',expiresIn:'1h'});
const {default:app}=await import('../dist/app.js');
test('customer address API ownership, default safety and booking snapshots',async t=>{
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(r=>server.close(r)));
 const authA=token(a),authB=token(b),authWorker=token(workerUser);
 const request=async(path,method='GET',body,auth=authA)=>{const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{...(auth?{Authorization:'Bearer '+auth}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json()};};
 const input={label:'Home',houseFlat:'#12',streetArea:'Original Area',landmark:'Near Main Road',city:'Bengaluru',state:'Karnataka',pincode:'560076'};
 let first,second;
 await t.test('all routes require CUSTOMER authentication',async()=>{for(const [path,method] of [['/api/addresses','GET'],['/api/addresses','POST'],['/api/addresses/invalid','PATCH'],['/api/addresses/invalid','DELETE'],['/api/addresses/invalid/default','PATCH']]){assert.equal((await request(path,method,method==='POST'||method==='PATCH'?input:undefined,null)).status,401);assert.equal((await request(path,method,method==='GET'?undefined:input,'invalid')).status,401);assert.equal((await request(path,method,method==='GET'?undefined:input,authWorker)).status,403);}});
 await t.test('required fields, partial updates and forbidden ownership/default fields',async()=>{
  for(const patch of [{label:''},{state:''},{pincode:'12345'},{userId:b.id},{customerId:b.id},{id:randomUUID()},{isDefault:true},{latitude:1},{createdAt:'x'}])assert.equal((await request('/api/addresses','POST',{...input,...patch})).status,400);
  const created=await request('/api/addresses','POST',{...input,city:' Bengaluru '});assert.equal(created.status,201);first=created.body.data.address;assert.equal(first.city,'Bengaluru');assert.equal(first.isDefault,true);assert.equal(first.latitude,null);assert.equal('userId' in first,false);
  assert.equal((await request('/api/addresses/'+first.id,'PATCH',{})).status,400);assert.equal((await request('/api/addresses/'+first.id,'PATCH',{isDefault:false})).status,400);
 });
 await t.test('defaults switch atomically and stay owned; not-found does not leak',async()=>{
  second=(await request('/api/addresses','POST',{...input,label:'Work'})).body.data.address;assert.equal(second.isDefault,false);
  for(const [method,suffix] of [['PATCH',''],['DELETE',''],['PATCH','/default']]){const result=await request('/api/addresses/'+first.id+suffix,method,method==='PATCH'&&!suffix?{city:'Other'}:undefined,authB);assert.equal(result.status,404);assert.equal(result.body.message,'Address not found');}
  assert.equal((await request('/api/addresses','GET',undefined,authB)).body.data.addresses.length,0);
  assert.equal((await request('/api/addresses/'+second.id+'/default','PATCH')).status,200);
  let list=(await request('/api/addresses')).body.data.addresses;assert.equal(list[0].id,second.id);assert.equal(list.filter(r=>r.isDefault).length,1);
  failDefault=true;assert.equal((await request('/api/addresses/'+first.id+'/default','PATCH')).status,500);failDefault=false;list=(await request('/api/addresses')).body.data.addresses;assert.equal(list[0].id,second.id);assert.equal(list[0].isDefault,true);
  assert.equal((await request('/api/addresses/'+second.id,'DELETE')).status,200);list=(await request('/api/addresses')).body.data.addresses;assert.equal(list[0].id,first.id);assert.equal(list[0].isDefault,true);
 });
 await t.test('saved address edits/deletion never alter a booking snapshot',async()=>{
  const result=await request('/api/bookings','POST',{workerId,serviceId,bookingDate:'2099-10-10',bookingTime:'10:00',address:input});assert.equal(result.status,201);const number=result.body.data.booking.bookingNumber;
  assert.equal((await request('/api/addresses/'+first.id,'PATCH',{streetArea:'Changed Area',landmark:null})).status,200);
  assert.equal((await request('/api/bookings/'+number)).body.data.booking.address.streetArea,'Original Area');assert.equal((await request('/api/worker/job-requests/'+number,'GET',undefined,token(workerUser))).body.data.request.address.streetArea,'Original Area');
  assert.equal((await request('/api/addresses/'+first.id,'DELETE')).status,200);const old=(await request('/api/bookings/'+number)).body.data.booking;assert.equal(old.address.streetArea,'Original Area');assert.equal(old.address.landmark,'Near Main Road');const workerRequest=await request('/api/worker/job-requests/'+number,'GET',undefined,token(workerUser));assert.equal(workerRequest.status,200);assert.equal(workerRequest.body.data.request.address.streetArea,'Original Area');assert.equal(workerRequest.body.data.request.address.landmark,'Near Main Road');assert.equal((await request('/api/addresses')).body.data.addresses.length,0);
 });
 await t.test('concurrent first creates and default switches retain exactly one default',async()=>{
  const creates=await Promise.all([request('/api/addresses','POST',input),request('/api/addresses','POST',{...input,label:'Work'})]);assert.deepEqual(creates.map(r=>r.status),[201,201]);let list=(await request('/api/addresses')).body.data.addresses;assert.equal(list.filter(r=>r.isDefault).length,1);
  const switches=await Promise.all(list.map(row=>request('/api/addresses/'+row.id+'/default','PATCH')));assert.deepEqual(switches.map(r=>r.status),[200,200]);list=(await request('/api/addresses')).body.data.addresses;assert.equal(list.filter(r=>r.isDefault).length,1);
  const ownB=(await request('/api/addresses','POST',input,authB)).body.data.address;assert.equal(ownB.isDefault,true);assert.equal((await request('/api/addresses')).body.data.addresses.length,2);
  for(const row of list)assert.equal((await request('/api/addresses/'+row.id,'DELETE')).status,200);assert.equal((await request('/api/addresses')).body.data.addresses.length,0);assert.equal((await request('/api/addresses','GET',undefined,authB)).body.data.addresses[0].isDefault,true);
  available=false;assert.equal((await request('/api/addresses')).status,503);available=true;
 });
});
