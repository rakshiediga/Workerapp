import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomUUID,randomBytes} from 'node:crypto';
import jwt from 'jsonwebtoken';
import {Prisma} from '../dist/generated/prisma/client.js';
// Isolated transactional database double; real PostgreSQL configuration is required
// to prove persistence and actual row-lock behavior.
const a={id:randomUUID(),name:'Worker A',phone:'0000000091',email:null,role:'WORKER',isActive:true},b={...a,id:randomUUID(),name:'Worker B'},customer={...a,id:randomUUID(),role:'CUSTOMER'};
const users=[a,b,customer];
const category={id:randomUUID(),name:'Plumber',slug:'plumber',isActive:true},otherCategory={...category,id:randomUUID(),name:'Electrician',slug:'electrician'};
const services=[{id:randomUUID(),name:'Tap Repair',slug:'tap-repair',description:null,isActive:true,categoryId:category.id,category},{id:randomUUID(),name:'Pipe Repair',slug:'pipe-repair',description:null,isActive:true,categoryId:category.id,category},{id:randomUUID(),name:'Inactive',slug:'inactive',isActive:false,categoryId:category.id,category},{id:randomUUID(),name:'Switch Repair',slug:'switch-repair',isActive:true,categoryId:otherCategory.id,category:otherCategory}];
const profiles=[a,b].map(user=>({id:randomUUID(),userId:user.id,user,primaryCategoryId:category.id,isAvailable:false,verificationStatus:'PENDING',startingPrice:new Prisma.Decimal(9999),rating:new Prisma.Decimal(0),totalReviews:0,experienceYears:0,bio:null,city:'Bengaluru',serviceArea:null}));
let offerings=[],bookings=[],queue=Promise.resolve();
function matches(row,where){return Object.entries(where).every(([key,value])=>key==='services'?offerings.some(o=>o.workerId===row.id&&matches(o,value.some)):value&&typeof value==='object'&&!Array.isArray(value)?matches(row[key],value):row[key]===value);}
function select(row,fields){return row?Object.fromEntries(Object.entries(fields).map(([key,field])=>[key,field===true?row[key]:Array.isArray(row[key])?row[key].map(item=>select(item,field.select)):select(row[key],field.select)])):null;}
const joined=row=>({...row,services:offerings.filter(o=>o.workerId===row.id&&o.service.isActive&&o.service.category.isActive),reviews:[]});
const database={
 user:{findUnique:async({where,select:fields})=>select(users.find(u=>matches(u,where)),fields),findFirst:async({where,select:fields})=>select(users.find(u=>matches(u,where)),fields)},
 async $queryRaw(query){assert.match(query.strings.join('?'),/FOR UPDATE/);assert.match(query.strings.join('?'),/"role" = 'WORKER'/);return users.filter(u=>u.id===query.values[0]&&u.role==='WORKER'&&u.isActive).map(u=>({id:u.id}));},
 workerProfile:{findFirst:async({where,select:fields})=>{const row=profiles.map(joined).find(p=>matches(p,where));return fields.services?row:select(row,fields);},findMany:async({where,select:fields})=>profiles.map(joined).filter(p=>matches(p,where)).map(p=>({...p,services:p.services.filter(o=>matches(o,fields.services.where))})),update:async({where,data,select:fields})=>{const p=profiles.find(p=>matches(p,where));Object.assign(p,data);return fields?select(p,fields):p;}},
 service:{findFirst:async({where,select:fields})=>select(services.find(s=>matches(s,where)),fields),findMany:async({where})=>services.filter(s=>matches(s,where))},
 workerService:{findMany:async({where})=>offerings.filter(o=>matches(o,where)),findFirst:async({where,select:fields})=>select(offerings.find(o=>matches(o,where)),fields),create:async({data})=>{if(offerings.some(o=>o.workerId===data.workerId&&o.serviceId===data.serviceId))throw new Prisma.PrismaClientKnownRequestError('Private duplicate',{code:'P2002',clientVersion:'7.10.0'});const row={id:randomUUID(),...data,service:services.find(s=>s.id===data.serviceId)};offerings.push(row);return row;},updateMany:async({where,data})=>{const row=offerings.find(o=>matches(o,where));if(!row)return{count:0};Object.assign(row,data);return{count:1};},deleteMany:async({where})=>{const before=offerings.length;offerings=offerings.filter(o=>!matches(o,where));return{count:before-offerings.length};},count:async({where})=>offerings.filter(o=>matches(o,where)).length},
 booking:{create:async({data})=>{const worker=profiles.find(p=>p.id===data.workerId),service=services.find(s=>s.id===data.serviceId),createdAt=new Date();const row={id:randomUUID(),...data,worker,customer:users.find(u=>u.id===data.customerId),service,statusHistory:[{status:'REQUESTED',createdAt}],createdAt};bookings.push(row);return row;},findFirst:async({where,select:fields})=>select(bookings.find(row=>matches(row,where)),fields),findMany:async({where,select:fields})=>bookings.filter(row=>matches(row,where)).sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id)).map(row=>select(row,fields)),updateMany:async({where,data})=>{const rows=bookings.filter(row=>matches(row,where));rows.forEach(row=>Object.assign(row,data));return {count:rows.length};}},
 bookingStatusHistory:{create:async({data})=>{const row={...data,createdAt:new Date()};bookings.find(b=>b.id===data.bookingId).statusHistory.push(row);return row;}},
 async $transaction(action){const previous=queue;let release;queue=new Promise(resolve=>release=resolve);await previous;const before=offerings.map(o=>({...o})),profileBefore=profiles.map(p=>({...p}));try{return await action(database);}catch(error){offerings=before;profiles.forEach((p,i)=>Object.assign(p,profileBefore[i]));throw error;}finally{release();}},
};
mock.module('../dist/lib/prisma.js',{namedExports:{getPrismaClient:()=>database}});
process.env.JWT_SECRET=randomBytes(48).toString('hex');
const token=user=>jwt.sign({userId:user.id,role:user.role},process.env.JWT_SECRET,{expiresIn:'1h'});
const {default:app}=await import('../dist/app.js');
test('worker services, availability, marketplace and booking integration (database double)',async t=>{
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
 const request=async(path,method='GET',body,auth=token(a))=>{const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{...(auth?{Authorization:'Bearer '+auth}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:response.status,body:await response.json()};};
 let first,second,booking;
 await t.test('all routes require active WORKER and eligible services are restricted',async()=>{
  for(const [path,method,body] of [['/api/worker/services','GET'],['/api/worker/available-services','GET'],['/api/worker/services','POST',{serviceId:services[0].id,price:'299'}],['/api/worker/services/'+randomUUID(),'PATCH',{price:'349'}],['/api/worker/services/'+randomUUID(),'DELETE'],['/api/worker/availability','PATCH',{isAvailable:true}]]){assert.equal((await request(path,method,body,null)).status,401);assert.equal((await request(path,method,body,'invalid')).status,401);assert.equal((await request(path,method,body,token(customer))).status,403);}
  const eligible=(await request('/api/worker/available-services')).body.data.services;assert.deepEqual(eligible.map(s=>s.id),services.slice(0,2).map(s=>s.id));
  assert.equal((await request('/api/worker/availability','PATCH',{isAvailable:true})).status,400);
 });
 await t.test('validates decimals, category, duplicate offering and ownership-controlled input',async()=>{
  for(const price of ['0','-1','1.001','1000000.01','1e3',299,'bad'])assert.equal((await request('/api/worker/services','POST',{serviceId:services[0].id,price})).status,400);
  for(const key of ['workerId','workerProfileId','userId','role','rating','verificationStatus','isActive'])assert.equal((await request('/api/worker/services','POST',{serviceId:services[0].id,price:'299',[key]:a.id})).status,400);
  for(const serviceId of [services[2].id,services[3].id,randomUUID()])assert.equal((await request('/api/worker/services','POST',{serviceId,price:'299'})).status,400);
  const result=await request('/api/worker/services','POST',{serviceId:services[0].id,price:'299.10'});assert.equal(result.status,201);first=result.body.data.service;assert.equal(first.price,'299.10');assert.equal(offerings[0].workerId,profiles[0].id);assert.ok(offerings[0].price instanceof Prisma.Decimal);
  const duplicate=await request('/api/worker/services','POST',{serviceId:services[0].id,price:'299'});assert.equal(duplicate.status,409);assert.equal(duplicate.body.message,'You already offer this service.');assert.equal(offerings.length,1);
 });
 await t.test('only owner edits/removes pricing, availability is not verification',async()=>{
  for(const method of ['PATCH','DELETE']){const result=await request('/api/worker/services/'+first.id,method,method==='PATCH'?{price:'1'}:undefined,token(b));assert.equal(result.status,404);assert.equal(result.body.message,'Service not found');}
  assert.equal((await request('/api/worker/services/'+first.id,'PATCH',{price:'349.00',serviceId:services[1].id})).status,400);
  assert.equal((await request('/api/worker/services/'+first.id,'PATCH',{price:'349'})).body.data.service.price,'349.00');
  for(const body of [{isAvailable:'true'},{isAvailable:true,verificationStatus:'VERIFIED'},{isAvailable:true,workerId:profiles[1].id}])assert.equal((await request('/api/worker/availability','PATCH',body)).status,400);
  assert.equal((await request('/api/worker/availability','PATCH',{isAvailable:true})).status,200);assert.equal(profiles[0].isAvailable,true);assert.equal(profiles[0].verificationStatus,'PENDING');assert.equal((await request('/api/workers', 'GET',undefined,null)).body.data.workers.length,0);
 });
 await t.test('verified active offerings set public minimum/relevant price; availability controls bookings',async()=>{
  second=(await request('/api/worker/services','POST',{serviceId:services[1].id,price:'499'})).body.data.service;profiles[0].verificationStatus='VERIFIED';
  const publicList=(await request('/api/workers')).body.data.workers;assert.equal(publicList.length,1);assert.equal(publicList[0].startingPrice,'349.00');assert.equal((await request('/api/workers?service=pipe-repair')).body.data.workers[0].startingPrice,'499.00');
  const detail=(await request('/api/workers/'+profiles[0].id)).body.data.worker;assert.equal(detail.services.length,2);for(const key of ['phone','email','passwordHash','userId'])assert.equal(JSON.stringify(detail).includes('"'+key+'"'),false);
  await request('/api/worker/availability','PATCH',{isAvailable:false});assert.equal((await request('/api/workers?availability=true')).body.data.workers.length,0);assert.equal((await request('/api/workers')).body.data.workers[0].isAvailable,false);
  await request('/api/worker/availability','PATCH',{isAvailable:true});
 });
 const bookingBody=()=>({workerId:profiles[0].id,serviceId:services[1].id,bookingDate:'2099-10-10',bookingTime:'10:00',address:{label:'Home',houseFlat:'#12',streetArea:'BTM Layout',city:'Bengaluru',state:'Karnataka',pincode:'560076'},price:'1.00'});
 await t.test('booking price comes from current offering; removal preserves historical booking',async()=>{
  const result=await request('/api/bookings','POST',bookingBody(),token(customer));assert.equal(result.status,201);booking=result.body.data.booking;assert.equal(booking.price,'499.00');assert.equal(bookings[0].customerId,customer.id);
  assert.equal((await request('/api/worker/services/'+second.id,'DELETE')).status,200);assert.equal((await request('/api/bookings','POST',bookingBody(),token(customer))).status,400);
  const historical=(await request('/api/bookings/'+booking.bookingNumber,'GET',undefined,token(customer))).body.data.booking;assert.equal(historical.price,'499.00');assert.equal(historical.service.name,'Pipe Repair');
  assert.equal(bookings.length,1);assert.equal((await request('/api/worker/services')).body.data.services.length,1);
 });
 await t.test('worker requests are read-only, private and scoped to JWT ownership',async()=>{
  for(const path of ['/api/worker/job-requests','/api/worker/job-requests/'+booking.bookingNumber]){
   assert.equal((await request(path,'GET',undefined,null)).status,401);
   assert.equal((await request(path,'GET',undefined,'invalid')).status,401);
   assert.equal((await request(path,'GET',undefined,token(customer))).status,403);
  }
  const body={...bookingBody(),serviceId:services[0].id};delete body.price;
  for(let i=0;i<2;i++)assert.equal((await request('/api/bookings','POST',body,token(customer))).status,201);
  const otherOffer=(await request('/api/worker/services','POST',{serviceId:services[0].id,price:'299'},token(b))).body.data.service;profiles[1].verificationStatus='VERIFIED';await request('/api/worker/availability','PATCH',{isAvailable:true},token(b));const otherBooking=await request('/api/bookings','POST',{...body,workerId:profiles[1].id},token(customer));assert.equal(otherBooking.status,201);assert.equal((await request('/api/worker/job-requests/'+otherBooking.body.data.booking.bookingNumber,'GET',undefined,token(b))).status,200);await request('/api/worker/services/'+otherOffer.id,'DELETE',undefined,token(b));
  const list=(await request('/api/worker/job-requests?workerId='+profiles[1].id)).body.data.requests;assert.equal(list.length,3);
  const detail=(await request('/api/worker/job-requests/'+booking.bookingNumber)).body.data.request;
  assert.equal(detail.customer.name,customer.name);assert.deepEqual(Object.keys(detail.customer),['name']);assert.equal(detail.price,'499.00');assert.equal(detail.address.streetArea,'BTM Layout');assert.equal(detail.statusHistory[0].status,'REQUESTED');
  for(const key of ['customerPhone','phone','email','passwordHash','customerId','userId'])assert.equal(JSON.stringify(detail).includes('"'+key+'"'),false);
  assert.equal((await request('/api/worker/job-requests','GET',undefined,token(b))).body.data.requests.length,1);
  assert.equal((await request('/api/worker/job-requests/'+booking.bookingNumber,'GET',undefined,token(b))).status,404);
  assert.equal((await request('/api/worker/job-requests/invalid')).status,404);
  for(const suffix of ['/accept','/reject'])assert.equal((await request('/api/worker/job-requests/'+booking.bookingNumber+suffix,'POST')).status,404);
  const snapshot=bookings[1].price.toFixed(2);await request('/api/worker/services/'+first.id,'PATCH',{price:'599'});
  assert.equal((await request('/api/worker/job-requests/'+bookings[1].bookingNumber)).body.data.request.price,snapshot);
  const cancelled=await request('/api/bookings/'+booking.bookingNumber+'/cancel','PATCH',undefined,token(customer));assert.equal(cancelled.status,200);
  assert.equal((await request('/api/worker/job-requests')).body.data.requests.length,2);
  assert.equal((await request('/api/worker/job-requests/'+booking.bookingNumber)).status,404);
  assert.equal((await request('/api/bookings/'+booking.bookingNumber,'GET',undefined,token(customer))).body.data.booking.status,'CANCELLED');assert.equal(bookings.length,4);
 });
 await t.test('serialized last-service removal and availability changes leave safe state',async()=>{
  const results=await Promise.all([request('/api/worker/services/'+first.id,'DELETE'),request('/api/worker/availability','PATCH',{isAvailable:true})]);assert.equal(results[0].status,200);assert.equal(results[1].status,400);assert.equal(profiles[0].isAvailable,false);assert.equal((await request('/api/workers')).body.data.workers.length,0);assert.equal(bookings.length,4);
  a.isActive=false;assert.equal((await request('/api/worker/services')).status,403);a.isActive=true;
 });
});
