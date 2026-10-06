import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomUUID,randomBytes} from 'node:crypto';
import jwt from 'jsonwebtoken';
import {Prisma} from '../dist/generated/prisma/client.js';
const users=['WORKER','WORKER','CUSTOMER'].map(role=>({id:randomUUID(),name:role,phone:'0000000000',role,isActive:true}));
const [a,b,c]=users;let rows=[];const now=new Date('2026-10-06T18:30:00Z');
const date=(value,tz)=>new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
function first(row){return row.events.length?new Date(Math.min(...row.events.map(v=>Date.parse(v)))):null;}
const db={user:{findUnique:async({where})=>users.find(u=>u.id===where.id)},async $transaction(action){return action(db);},async $queryRaw(query){
 const sql=query.sql;assert.match(sql,/b\."status"='COMPLETED'/);assert.match(sql,/w\."userId"=\?::uuid/);assert.match(sql,/u\."isActive"=true/);assert.match(sql,/MIN\(h\."createdAt"\)/);assert.ok(!sql.includes('Payment')&&!sql.includes('WorkerService'));const owned=rows.filter(r=>r.userId===query.values[0]&&r.status==='COMPLETED');
 if(sql.includes(' AS total')){const tz=query.values[1],today=date(now,tz),sum=list=>list.reduce((n,r)=>n.plus(r.price),new Prisma.Decimal(0));return [{total:sum(owned),today:sum(owned.filter(r=>first(r)&&date(first(r),tz)===today)),month:sum(owned.filter(r=>first(r)&&date(first(r),tz).slice(0,7)===today.slice(0,7))),count:BigInt(owned.length)}];}
 if(sql.includes('serviceName')){assert.match(sql,/ORDER BY c\."completedAt" DESC NULLS LAST,c\."id" DESC/);const [limit,offset]=query.values.slice(-2);return owned.sort((a,b)=>(first(b)?.getTime()??-Infinity)-(first(a)?.getTime()??-Infinity)||b.bookingNumber.localeCompare(a.bookingNumber)).slice(offset,offset+limit).map(r=>({bookingNumber:r.bookingNumber,price:new Prisma.Decimal(r.price),completedAt:first(r),serviceName:'Tap Repair',customerName:'Safe Customer'}));}
 return [{count:BigInt(owned.length)}];
}};
mock.module('../dist/lib/prisma.js',{namedExports:{getPrismaClient:()=>db}});
process.env.JWT_SECRET=randomBytes(48).toString('hex');process.env.APP_TIMEZONE='Asia/Kolkata';
const {default:app}=await import('../dist/app.js');
const add=(user,price,status='COMPLETED',events=['2026-10-06T18:30:00Z'])=>rows.push({userId:user.id,price,status,events,bookingNumber:'WB'+randomUUID().replaceAll('-','').toUpperCase().padStart(40,'0')});
test('worker earnings HTTP, Decimal snapshots, completion periods and ownership (database double)',async t=>{
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
 const get=async(path,user=a)=>{const response=await fetch('http://127.0.0.1:'+server.address().port+path,{headers:user?{Authorization:'Bearer '+jwt.sign({userId:user.id,role:user.role},process.env.JWT_SECRET,{expiresIn:"1h"})}:{}});return {status:response.status,data:await response.json()};};
 await t.test('empty earnings are decimal zeros; JWT and customer-role checks protect both endpoints',async()=>{
  const result=await get('/api/worker/earnings/summary');assert.equal(result.status,200);assert.deepEqual(result.data.data,{totalGrossEarnings:'0.00',todayGrossEarnings:'0.00',monthGrossEarnings:'0.00',completedJobs:0,timezone:'Asia/Kolkata'});
  for(const path of ['/api/worker/earnings','/api/worker/earnings/summary']){assert.equal((await get(path,null)).status,401);assert.equal((await get(path,c)).status,403);}
 });
 await t.test('only COMPLETED Booking prices count once; old creation dates and duplicate completion history cannot distort periods',async()=>{
  add(a,'499','COMPLETED',['2026-09-30T18:29:59Z','2026-10-06T18:30:00Z']);add(a,'799');add(b,'5000');for(const status of ['REQUESTED','ACCEPTED','IN_PROGRESS','CANCELLED'])add(a,'5000',status);
  const value=(await get('/api/worker/earnings/summary?workerId='+b.id)).data.data;assert.deepEqual([value.totalGrossEarnings,value.todayGrossEarnings,value.monthGrossEarnings,value.completedJobs],['1298.00','799.00','799.00',2]);assert.equal((await get('/api/worker/earnings/summary',b)).data.data.totalGrossEarnings,'5000.00');
 });
 await t.test('India midnight and month boundaries use completion timestamp; exact cents remain Decimal-safe',async()=>{
  rows=[];add(a,'0.10','COMPLETED',['2026-10-06T18:29:59Z']);add(a,'0.20','COMPLETED',['2026-10-06T18:30:00Z']);add(a,'499','COMPLETED',['2026-09-30T18:30:00Z']);
  const value=(await get('/api/worker/earnings/summary')).data.data;assert.equal(value.totalGrossEarnings,'499.30');assert.equal(value.todayGrossEarnings,'0.20');assert.equal(value.monthGrossEarnings,'499.30');process.env.APP_TIMEZONE='UTC';assert.equal((await get('/api/worker/earnings/summary')).data.data.todayGrossEarnings,'0.30');process.env.APP_TIMEZONE='Asia/Kolkata';
 });
 await t.test('history is completed-date ordered, owner-only, paginated and contains no private contact fields',async()=>{
  add(b,'9000');const firstPage=(await get('/api/worker/earnings?page=1&limit=2')).data.data;assert.deepEqual(firstPage.pagination,{page:1,limit:2,total:3,totalPages:2});assert.deepEqual(firstPage.earnings.map(r=>r.bookingPrice),['0.20','0.10']);assert.equal(firstPage.earnings[0].completedAt,'2026-10-06T18:30:00.000Z');const second=(await get('/api/worker/earnings?page=2&limit=2')).data.data;assert.equal(second.earnings.length,1);assert.equal(second.earnings[0].bookingPrice,'499.00');for(const key of ['phone','email','customerId','userId','passwordHash'])assert.ok(!JSON.stringify(firstPage).includes('"'+key+'"'));
  for(const q of ['page=0','page=-1','page=1.5','limit=0','limit=51','limit=bad','page=1&page=2'])assert.equal((await get('/api/worker/earnings?'+q)).status,400);
 });
 await t.test('missing legacy completion timestamps do not invent a period; invalid timezone errors remain safe',async()=>{
  add(a,'10','COMPLETED',[]);const value=(await get('/api/worker/earnings/summary')).data.data;assert.equal(value.totalGrossEarnings,'509.30');assert.equal(value.todayGrossEarnings,'0.20');assert.equal((await get('/api/worker/earnings?limit=50')).data.data.earnings.at(-1).completedAt,null);process.env.APP_TIMEZONE='Invalid/Private';const error=await get('/api/worker/earnings/summary');assert.equal(error.status,503);assert.ok(!JSON.stringify(error).includes('Invalid/Private'));process.env.APP_TIMEZONE='Asia/Kolkata';
 });
});
