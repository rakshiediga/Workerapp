import {test, mock} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomUUID, randomBytes} from 'node:crypto';
import jwt from 'jsonwebtoken';
import {Prisma} from '../dist/generated/prisma/client.js';
// Real HTTP handlers with an isolated transactional database double. PostgreSQL
// persistence and real competing connection/row-lock behavior need DATABASE_URL.
const users=['WORKER','WORKER','CUSTOMER'].map((role,i)=>({id:randomUUID(),name:'Account '+i,phone:'000000020'+i,email:'account'+i+'@example.test',passwordHash:'private',role,isActive:true}));
const [workerA,workerB,customer]=users;
const category={id:randomUUID(),name:'Plumber',slug:'plumber',isActive:true};
const service={id:randomUUID(),name:'Tap Repair',isActive:true,category};
const profiles=users.slice(0,2).map(user=>({id:randomUUID(),userId:user.id,user,isAvailable:true,verificationStatus:'VERIFIED'}));
const offerings=profiles.map(profile=>({workerId:profile.id,serviceId:service.id,service,price:new Prisma.Decimal('499.00')}));
let bookings=[],queue=Promise.resolve(),clock=Date.now(),failHistory=false;
const matches=(row,where)=>!!row&&Object.entries(where).every(([key,value])=>value&&typeof value==='object'&&!Array.isArray(value)?Array.isArray(value.in)?value.in.includes(row[key]):matches(row[key],value):row[key]===value);
function project(row,fields){return row?Object.fromEntries(Object.entries(fields).map(([key,field])=>[key,field===true?row[key]:Array.isArray(row[key])?row[key].map(item=>project(item,field.select)):project(row[key],field.select)])):null;}
const database={
 async $queryRaw(query){const rows=bookings.filter(row=>row.worker.userId===query.values[0]&&row.status==="COMPLETED");const sum=list=>list.reduce((value,row)=>value.plus(row.price),new Prisma.Decimal(0));const completed=rows.filter(row=>row.statusHistory.some(h=>h.status==="COMPLETED"));return [{total:sum(rows),today:sum(completed),month:sum(completed),count:BigInt(rows.length)}];},
 user:{findUnique:async({where,select})=>project(users.find(row=>matches(row,where)),select),findFirst:async({where,select})=>project(users.find(row=>matches(row,where)),select)},
 workerProfile:{findFirst:async({where,select})=>project(profiles.find(row=>matches(row,where)),select)},
 workerService:{findFirst:async({where,select})=>project(offerings.find(row=>matches(row,where)),select)},
 booking:{
  create:async({data,select})=>{const createdAt=new Date(++clock),row={...data,id:randomUUID(),createdAt,updatedAt:createdAt,customer,worker:profiles.find(p=>p.id===data.workerId),service,statusHistory:[{id:randomUUID(),...data.statusHistory.create,createdAt,reason:null,changedBy:customer}]};bookings.push(row);return project(row,select);},
  findFirst:async({where,select})=>project(bookings.find(row=>matches(row,where)),select),
  findMany:async({where,select,orderBy,skip=0,take=bookings.length})=>bookings.filter(row=>matches(row,where)).sort((a,b)=>{for(const order of orderBy||[]){const [key,direction]=Object.entries(order)[0];const diff=a[key] instanceof Date?a[key]-b[key]:String(a[key]).localeCompare(String(b[key]));if(diff)return direction==="desc"?-diff:diff;}return 0;}).slice(skip,skip+take).map(row=>project(row,select)),
  count:async({where})=>bookings.filter(row=>matches(row,where)).length,
  updateMany:async({where,data})=>{assert.ok(['REQUESTED','ACCEPTED','IN_PROGRESS'].includes(where.status));assert.ok(where.customerId||where.worker?.userId);const rows=bookings.filter(row=>matches(row,where));rows.forEach(row=>Object.assign(row,data,{updatedAt:new Date(++clock)}));return{count:rows.length};},
 },
 bookingStatusHistory:{create:async({data})=>{if(failHistory)throw Error('Private database history failure');const row={id:randomUUID(),...data,createdAt:new Date(++clock),changedBy:users.find(user=>user.id===data.changedByUserId)};bookings.find(b=>b.id===data.bookingId).statusHistory.push(row);return row;}},
 async $transaction(action){const previous=queue;let release;queue=new Promise(resolve=>release=resolve);await previous;const before=bookings.map(b=>({...b,statusHistory:b.statusHistory.map(h=>({...h}))}));try{return await action(database);}catch(error){bookings=before;throw error;}finally{release();}},
};
mock.module('../dist/lib/prisma.js',{namedExports:{getPrismaClient:()=>database}});
process.env.JWT_SECRET=randomBytes(48).toString('hex');
const token=user=>jwt.sign({userId:user.id,role:user.role},process.env.JWT_SECRET,{expiresIn:'1h'});
const {default:app}=await import('../dist/app.js');
test('worker accept/reject, contact privacy and conditional transition integration (database double)',async t=>{
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
 const request=async(path,method='GET',body,user=workerA)=>{const auth=typeof user==='string'?user:user?token(user):null;const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{...(auth?{Authorization:'Bearer '+auth}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});return{status:response.status,body:await response.json()};};
 const create=async(worker=profiles[0])=>{const result=await request('/api/bookings','POST',{workerId:worker.id,serviceId:service.id,bookingDate:'2099-10-10',bookingTime:'10:00',address:{label:'Home',houseFlat:'#12',streetArea:'Original Area',landmark:'Near Main Road',city:'Bengaluru',state:'Karnataka',pincode:'560076'},problemDescription:'Tap is leaking',price:'1.00'},customer);assert.equal(result.status,201);return result.body.data.booking;};
 const action=(number,target,body,user=workerA)=>request('/api/worker/job-requests/'+number+'/'+target,'PATCH',body,user);
 const stored=number=>bookings.find(b=>b.bookingNumber===number);
 await t.test('JWT role/ownership and input whitelist guard both transitions and job details',async()=>{
  const booking=await create();
  for(const [path,method] of [['/api/worker/jobs','GET'],['/api/worker/jobs/'+booking.bookingNumber,'GET'],['/api/worker/job-requests/'+booking.bookingNumber+'/accept','PATCH'],['/api/worker/job-requests/'+booking.bookingNumber+'/reject','PATCH']]){
   assert.equal((await request(path,method,undefined,null)).status,401);assert.equal((await request(path,method,undefined,'invalid')).status,401);assert.equal((await request(path,method,undefined,customer)).status,403);
  }
  for(const target of ['accept','reject']){const result=await action(booking.bookingNumber,target,undefined,workerB);assert.equal(result.status,404);assert.equal(result.body.message,'Job request not found');}
  assert.equal((await request('/api/worker/jobs/'+booking.bookingNumber,'GET',undefined,workerB)).status,404);
  for(const key of ['workerId','userId','workerProfileId','status','role','customerPhone','price'])for(const target of ['accept','reject'])assert.equal((await action(booking.bookingNumber,target,{[key]:'forged'})).status,400);
  assert.equal(stored(booking.bookingNumber).status,'REQUESTED');assert.equal(stored(booking.bookingNumber).statusHistory.length,1);
 });
 await t.test('accept preserves snapshots, reveals only booking phone and writes one actor/history row',async()=>{
  const booking=await create(),number=booking.bookingNumber,phone=booking.customerPhone;
  assert.equal('customerPhone' in (await request('/api/worker/jobs/'+number)).body.data.booking,false);
  assert.equal('customerPhone' in (await request('/api/worker/job-requests/'+number)).body.data.request,false);
  customer.phone='0000000999';offerings[0].price=new Prisma.Decimal('599');
  const result=await action(number,'accept');assert.equal(result.status,200);const accepted=result.body.data.booking;
  assert.equal(accepted.status,'ACCEPTED');assert.equal(accepted.customerPhone,phone);assert.equal(accepted.price,'499.00');assert.equal(accepted.address.streetArea,'Original Area');
  assert.deepEqual(accepted.statusHistory.map(h=>h.status),['REQUESTED','ACCEPTED']);assert.equal(accepted.statusHistory[1].actor,'WORKER');assert.equal(stored(number).statusHistory[1].changedByUserId,workerA.id);
  assert.equal((await action(number,'accept')).status,409);assert.equal((await action(number,'reject')).status,409);assert.equal(stored(number).statusHistory.length,2);
  assert.equal((await request('/api/bookings/'+number+'/cancel','PATCH',undefined,customer)).status,409);
  assert.equal((await request('/api/worker/job-requests')).body.data.requests.some(b=>b.bookingNumber===number),false);
  assert.equal((await request('/api/worker/jobs?limit=50')).body.data.jobs.some(b=>b.bookingNumber===number),true);
  const owned=(await request('/api/worker/jobs/'+number)).body.data.booking;assert.equal(owned.customerPhone,phone);for(const key of ['email','passwordHash','userId','customerId'])assert.equal(JSON.stringify(owned).includes('"'+key+'"'),false);
  const customerView=(await request('/api/bookings/'+number,'GET',undefined,customer)).body.data.booking;assert.equal(customerView.status,'ACCEPTED');assert.equal(customerView.statusHistory[1].actor,'WORKER');assert.equal((await request('/api/bookings/my','GET',undefined,customer)).body.data.bookings.find(b=>b.bookingNumber===number).status,'ACCEPTED');
 });
 await t.test('reject validates/trims optional reason, records worker actor and never reveals contact',async()=>{
  const booking=await create(),number=booking.bookingNumber;
  for(const reason of [42,null,'x'.repeat(501)])assert.equal((await action(number,'reject',{reason})).status,400);
  const rejected=await action(number,'reject',{reason:'  Unavailable at requested time  '});assert.equal(rejected.status,200);const view=rejected.body.data.booking;
  assert.equal(view.status,'CANCELLED');assert.equal('customerPhone' in view,false);assert.deepEqual(view.statusHistory.map(h=>h.status),['REQUESTED','CANCELLED']);assert.equal(view.statusHistory[1].reason,'Unavailable at requested time');assert.equal(view.statusHistory[1].actor,'WORKER');
  const customerView=(await request('/api/bookings/'+number,'GET',undefined,customer)).body.data.booking;assert.equal(customerView.status,'CANCELLED');assert.equal(customerView.statusHistory[1].actor,'WORKER');assert.equal(customerView.statusHistory[1].reason,'Unavailable at requested time');
  assert.equal((await action(number,'reject')).status,409);assert.equal((await action(number,'accept')).status,409);assert.equal(stored(number).statusHistory.length,2);
  assert.equal('customerPhone' in (await request('/api/worker/jobs/'+number)).body.data.booking,false);
  const noReason=await create();assert.equal((await action(noReason.bookingNumber,'reject')).status,200);assert.equal(stored(noReason.bookingNumber).statusHistory[1].reason,null);
 });
 await t.test('invalid lifecycle states cannot transition and history failures roll back status',async()=>{
  for(const status of ['ACCEPTED','IN_PROGRESS','COMPLETED','CANCELLED']){const booking=await create();stored(booking.bookingNumber).status=status;for(const target of ['accept','reject'])assert.equal((await action(booking.bookingNumber,target)).status,409);assert.equal(stored(booking.bookingNumber).status,status);assert.equal(stored(booking.bookingNumber).statusHistory.length,1);}
  const booking=await create();failHistory=true;const result=await action(booking.bookingNumber,'accept');failHistory=false;assert.equal(result.status,500);assert.equal(JSON.stringify(result).includes('Private database'),false);assert.equal(stored(booking.bookingNumber).status,'REQUESTED');assert.equal(stored(booking.bookingNumber).statusHistory.length,1);
 });
 await t.test('duplicate accepts, accept/reject and customer-cancel races permit exactly one transition',async()=>{
  for(const targets of [['accept','accept'],['accept','reject'],['reject','accept']]){const booking=await create();const results=await Promise.all(targets.map(target=>action(booking.bookingNumber,target)));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);const row=stored(booking.bookingNumber);assert.ok(['ACCEPTED','CANCELLED'].includes(row.status));assert.equal(row.statusHistory.length,2);assert.equal(row.statusHistory[1].status,row.status);}
  for(const customerFirst of [true,false]){const booking=await create(),number=booking.bookingNumber;const cancel=()=>request('/api/bookings/'+number+'/cancel','PATCH',undefined,customer),accept=()=>action(number,'accept');const results=await Promise.all(customerFirst?[cancel(),accept()]:[accept(),cancel()]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);const row=stored(number);assert.equal(row.statusHistory.length,2);assert.equal(row.statusHistory[1].status,row.status);if(row.status==='CANCELLED'){assert.equal(row.statusHistory[1].changedByUserId,customer.id);assert.equal((await request('/api/bookings/'+number,'GET',undefined,customer)).body.data.booking.statusHistory[1].actor,'CUSTOMER');}}
 });
 await t.test('accepted jobs and request counts remain owner/status scoped on repeated reads',async()=>{
  const booking=await create(profiles[1]);assert.equal((await action(booking.bookingNumber,'accept',undefined,workerB)).status,200);
  const list=(await request('/api/worker/jobs?status=ACCEPTED&workerId='+profiles[1].id)).body.data.jobs;assert.ok(list.every(b=>b.status==='ACCEPTED'&&stored(b.bookingNumber).workerId===profiles[0].id));assert.ok(list.every(b=>!('customerPhone' in b)));
  assert.deepEqual((await request('/api/worker/jobs','GET',undefined,workerB)).body.data.jobs.map(b=>b.bookingNumber),[booking.bookingNumber]);
  const requested=(await request('/api/worker/job-requests')).body.data.requests;assert.equal(requested.length,bookings.filter(b=>b.workerId===profiles[0].id&&b.status==='REQUESTED').length);assert.equal(list.length,bookings.filter(b=>b.workerId===profiles[0].id&&b.status==='ACCEPTED').length);
 });
 const workflow=(number,target,body,user=workerA)=>request('/api/worker/jobs/'+number+'/'+target,'PATCH',body,user);
 await t.test('full lifecycle writes exactly ordered history and preserves booking snapshots/contact',async()=>{
  const booking=await create(),number=booking.bookingNumber;
  assert.equal((await action(number,'accept')).status,200);
  for(const [target,status]of [['start','IN_PROGRESS'],['complete','COMPLETED']]){
   const result=await workflow(number,target);assert.equal(result.status,200);const job=result.body.data.booking;assert.equal(job.status,status);assert.equal(job.price,booking.price);assert.deepEqual(job.address,booking.address);assert.equal(job.customerPhone,booking.customerPhone);
   const customerView=(await request('/api/bookings/'+number,'GET',undefined,customer)).body.data.booking;assert.equal(customerView.status,status);assert.equal((await request('/api/bookings/'+number+'/cancel','PATCH',undefined,customer)).status,409);
  }
  const job=(await request('/api/worker/jobs/'+number)).body.data.booking;assert.deepEqual(job.statusHistory.map(h=>h.status),['REQUESTED','ACCEPTED','IN_PROGRESS','COMPLETED']);assert.ok(job.statusHistory.slice(1).every(h=>h.actor==='WORKER'));assert.ok(stored(number).statusHistory.slice(1).every(h=>h.changedByUserId===workerA.id));assert.ok(job.statusHistory.every((h,i)=>!i||Date.parse(h.createdAt)>=Date.parse(job.statusHistory[i-1].createdAt)));assert.equal((await workflow(number,'complete')).status,409);assert.equal(stored(number).statusHistory.length,4);
 });
 await t.test('start/complete require worker role, JWT ownership and no client-selected status/identity',async()=>{
  const booking=await create();await action(booking.bookingNumber,'accept');
  for(const target of ['start','complete']){
   assert.equal((await workflow(booking.bookingNumber,target,undefined,null)).status,401);assert.equal((await workflow(booking.bookingNumber,target,undefined,'invalid')).status,401);assert.equal((await workflow(booking.bookingNumber,target,undefined,customer)).status,403);assert.equal((await workflow(booking.bookingNumber,target,undefined,workerB)).status,404);
   for(const key of ['status','workerId','workerProfileId','userId','reason','price'])assert.equal((await workflow(booking.bookingNumber,target,{[key]:'forged'})).status,400);
  }
  assert.equal(stored(booking.bookingNumber).status,'ACCEPTED');assert.equal(stored(booking.bookingNumber).statusHistory.length,2);
 });
 await t.test('invalid transitions leave status and history unchanged',async()=>{
  for(const [status,target]of [['REQUESTED','start'],['REQUESTED','complete'],['ACCEPTED','complete'],['IN_PROGRESS','start'],['COMPLETED','start'],['COMPLETED','complete'],['CANCELLED','start'],['CANCELLED','complete']]){
   const booking=await create(),number=booking.bookingNumber;stored(number).status=status;const before=stored(number).statusHistory.length;const result=await workflow(number,target);assert.equal(result.status,409);assert.equal(result.body.message,'This job has already changed status.');assert.equal(stored(number).status,status);assert.equal(stored(number).statusHistory.length,before);
  }
 });
 await t.test('concurrent starts/completions append one transition each and rollback on history failure',async()=>{
  const booking=await create(),number=booking.bookingNumber;await action(number,'accept');
  for(const [target,from,to,count]of [['start','ACCEPTED','IN_PROGRESS',3],['complete','IN_PROGRESS','COMPLETED',4]]){
   failHistory=true;const failed=await workflow(number,target);failHistory=false;assert.equal(failed.status,500);assert.equal(stored(number).status,from);assert.equal(stored(number).statusHistory.length,count-1);
   const results=await Promise.all([workflow(number,target),workflow(number,target)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(stored(number).status,to);assert.equal(stored(number).statusHistory.length,count);assert.equal(stored(number).statusHistory.filter(h=>h.status===to).length,1);
  }
 });
 await t.test('job status whitelist, owner scoping and active/completed dashboard counts use real rows',async()=>{
  for(const status of ['REQUESTED','bad','COMPLETED&status=ACCEPTED'])assert.equal((await request('/api/worker/jobs?limit=50&status='+status)).status,400);
  const all=(await request('/api/worker/jobs?limit=50')).body.data.jobs;assert.ok(all.every(b=>['ACCEPTED','IN_PROGRESS','COMPLETED','CANCELLED'].includes(b.status)&&stored(b.bookingNumber).workerId===profiles[0].id));assert.ok(all.every(b=>!('customerPhone' in b)));
  for(const status of ['ACCEPTED','IN_PROGRESS','COMPLETED']){const filtered=(await request('/api/worker/jobs?status='+status)).body.data.jobs;assert.ok(filtered.every(b=>b.status===status));assert.equal(filtered.length,bookings.filter(b=>b.workerId===profiles[0].id&&b.status===status).length);}
  assert.equal(all.filter(b=>b.status==='ACCEPTED'||b.status==='IN_PROGRESS').length,bookings.filter(b=>b.workerId===profiles[0].id&&['ACCEPTED','IN_PROGRESS'].includes(b.status)).length);
 });
 await t.test('paginated history and dashboard counts isolate workers, preserve history and validate queries',async()=>{
  bookings=[];
  for(const status of ['REQUESTED','ACCEPTED','IN_PROGRESS','COMPLETED','COMPLETED','CANCELLED']){
   const booking=await create(),n=booking.bookingNumber;
   if(['ACCEPTED','IN_PROGRESS','COMPLETED'].includes(status))await action(n,'accept');
   if(['IN_PROGRESS','COMPLETED'].includes(status))await workflow(n,'start');
   if(status==='COMPLETED')await workflow(n,'complete');
   if(status==='CANCELLED')await request('/api/bookings/'+n+'/cancel','PATCH',undefined,customer);
  }
  const foreign=await create(profiles[1]);await action(foreign.bookingNumber,'accept',undefined,workerB);
  const summary=await request('/api/worker/dashboard');assert.equal(summary.status,200);
  assert.deepEqual([summary.body.data.newRequests,summary.body.data.activeJobs,summary.body.data.completedJobs,summary.body.data.cancelledJobs],[1,2,2,1]);assert.equal(summary.body.data.todayGrossEarnings,bookings.filter(row=>row.workerId===profiles[0].id&&row.status==="COMPLETED").reduce((value,row)=>value.plus(row.price),new Prisma.Decimal(0)).toFixed(2));
  assert.equal((await request('/api/worker/dashboard','GET',undefined,customer)).status,403);
  assert.equal((await request('/api/worker/dashboard','GET',undefined,null)).status,401);
  const other=(await request('/api/worker/dashboard','GET',undefined,workerB)).body.data;assert.equal(other.activeJobs,1);assert.equal(other.completedJobs,0);
  const combined=(await request('/api/worker/jobs?status=ACCEPTED,IN_PROGRESS')).body.data;assert.equal(combined.pagination.total,2);
  const seen=[];for(let page=1;page<=3;page++){const result=await request('/api/worker/jobs?page='+page+'&limit=2');assert.equal(result.status,200);assert.deepEqual(result.body.data.pagination,{page,limit:2,total:5,totalPages:3});seen.push(...result.body.data.jobs.map(j=>j.bookingNumber));}
  assert.equal(new Set(seen).size,5);assert.ok(!seen.includes(foreign.bookingNumber));assert.ok(seen.every(n=>stored(n).status!=='REQUESTED'));
  for(const query of ['page=0','page=-1','page=1.5','limit=0','limit=51','limit=bad','status=REQUESTED','status=COMPLETED,bad','page=1&page=2'])assert.equal((await request('/api/worker/jobs?'+query)).status,400);
  const cancelled=(await request('/api/worker/jobs?status=CANCELLED')).body.data.jobs[0];assert.equal(cancelled.statusHistory[1].actor,'CUSTOMER');assert.ok(!('customerPhone' in cancelled));
  const completed=(await request('/api/worker/jobs?status=COMPLETED')).body.data.jobs[0];assert.deepEqual(completed.statusHistory.map(h=>h.status),['REQUESTED','ACCEPTED','IN_PROGRESS','COMPLETED']);assert.equal((await request('/api/worker/jobs/'+completed.bookingNumber,'GET',undefined,workerB)).status,404);
  for(let i=0;i<5;i++)await create();const bounded=(await request('/api/worker/dashboard')).body.data;assert.equal(bounded.newRequests,6);assert.equal(bounded.previews.requests.length,3);assert.ok(bounded.previews.requests.every(j=>!('customerPhone' in j)));
  const declined=await create();await action(declined.bookingNumber,'reject',{reason:'Unavailable'});const declinedDetail=(await request('/api/worker/jobs/'+declined.bookingNumber)).body.data.booking;assert.equal(declinedDetail.statusHistory[1].actor,'WORKER');assert.equal(declinedDetail.statusHistory[1].reason,'Unavailable');assert.ok(!('customerPhone' in declinedDetail));
 });
});
