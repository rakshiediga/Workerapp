import {test,mock} from "node:test";
import assert from "node:assert/strict";
import {once} from "node:events";
import {randomUUID,randomBytes} from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
// Isolated database double; not a PostgreSQL persistence test.
const users=[];const select=(u,s)=>u?Object.fromEntries(Object.keys(s).map(k=>[k,u[k]])):null;
const db={user:{findUnique:async({where,select:s})=>select(users.find(u=>Object.entries(where).every(([k,v])=>u[k]===v)),s),findMany:async({where,select:s})=>users.filter(u=>where.OR.some(x=>Object.entries(x).every(([k,v])=>u[k]===v))).map(u=>select(u,s)),create:async({data,select:s})=>{const u={id:randomUUID(),...data};users.push(u);return select(u,s);}}};
mock.module('../dist/lib/prisma.js',{namedExports:{getPrismaClient:()=>db}});
process.env.JWT_SECRET=randomBytes(48).toString('hex');
const {adminCredentials,createAdmin}=await import('../dist/services/admin-bootstrap.service.js');
const {default:app}=await import('../dist/app.js');
test('admin bootstrap, authentication and role security (isolated database)',async t=>{
 const input=adminCredentials({ADMIN_NAME:' Test Admin ',ADMIN_EMAIL:' ADMIN@EXAMPLE.TEST ',ADMIN_PHONE:'00000 00030',ADMIN_PASSWORD:'StrongTestPassword123'});
 assert.equal(input.email,'admin@example.test');assert.equal(input.phone,'0000000030');
 for(const password of ['short','lowercaseonly123','UPPERCASEONLY123','NoNumbersHere'])assert.throws(()=>adminCredentials({...process.env,ADMIN_NAME:'Admin',ADMIN_EMAIL:'a@example.test',ADMIN_PHONE:'0000000031',ADMIN_PASSWORD:password}));
 assert.equal(await createAdmin(input),'Admin account created successfully.');assert.equal(await createAdmin(input),'Admin account already exists.');assert.equal(users.length,1);assert.equal(users[0].role,'ADMIN');assert.equal(users[0].isActive,true);assert.equal(bcrypt.getRounds(users[0].passwordHash),12);assert.ok(await bcrypt.compare(input.password,users[0].passwordHash));assert.notEqual(users[0].passwordHash,input.password);
 const hash=users[0].passwordHash;
 for(const [role,phone,email] of [['CUSTOMER','0000000031','customer@example.test'],['WORKER','0000000032','worker@example.test']])users.push({id:randomUUID(),name:role,phone,email,role,isActive:true,passwordHash:hash});
 await assert.rejects(()=>createAdmin({...input,email:users[1].email}),e=>e.statusCode===409);await assert.rejects(()=>createAdmin({...input,phone:users[2].phone}),e=>e.statusCode===409);assert.equal(users[1].role,'CUSTOMER');assert.equal(users[2].role,'WORKER');
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
 const req=async(path,body,token)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};};
 assert.equal((await req('/api/admin/health')).status,401);
 for(const user of users){const login=await req('/api/auth/login',{email:user.email,password:input.password});assert.equal(login.status,200);assert.equal('passwordHash' in login.body.data.user,false);const token=login.body.data.accessToken;assert.equal((await req('/api/admin/health',undefined,token)).status,user.role==='ADMIN'?200:403);assert.equal((await req('/api/auth/me',undefined,token)).body.data.user.role,user.role);assert.equal((await req('/api/auth/login',{phone:user.phone,password:input.password})).status,200);}
 for(const email of [input.email,'absent@example.test']){const r=await req('/api/auth/login',{email,password:'WrongPassword123'});assert.equal(r.status,401);assert.equal(r.body.message,'Invalid credentials.');}
 const token=jwt.sign({userId:users[0].id,role:'ADMIN'},process.env.JWT_SECRET,{expiresIn:'1h'});users[0].isActive=false;assert.equal((await req('/api/admin/health',undefined,token)).status,403);assert.equal((await req('/api/auth/login',{email:input.email,password:input.password})).status,401);users[0].isActive=true;
 for(const token of ['invalid',jwt.sign({userId:users[0].id,role:'ADMIN'},process.env.JWT_SECRET,{expiresIn:-1})])assert.equal((await req('/api/admin/health',undefined,token)).status,401);
 assert.equal((await req('/api/auth/register/admin',input)).status,404);
 for(const origin of ['http://localhost:3000','http://localhost:3001','http://localhost:3002']){const r=await fetch(base+'/api/health',{headers:{Origin:origin}});assert.equal(r.headers.get('access-control-allow-origin'),origin);}
 console.log('PASS bootstrap/idempotency/no promotion/hash; email + phone login; role/active checks; generic invalid credentials; expired/invalid tokens; CORS; no public admin registration');
});
