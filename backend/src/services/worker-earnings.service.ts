import {Prisma} from "../generated/prisma/client.js";
import {getPrismaClient} from "../lib/prisma.js";
import {AuthError} from "../types/auth.types.js";
import {pageNumber} from "../lib/pagination.js";
function database() {const client=getPrismaClient();if(!client)throw new AuthError(503,"Earnings are temporarily unavailable.");return client;}
export function businessTimezone() {
  const timezone=process.env.APP_TIMEZONE || "Asia/Kolkata";
  try {new Intl.DateTimeFormat("en",{timeZone:timezone});}catch{throw new AuthError(503,"Earnings are temporarily unavailable.");}
  return timezone;
}
// MIN chooses the first authoritative completion event, even if legacy history
// has duplicates. One Booking contributes once. Missing events have no period.
function completedBookings(userId:string) {return Prisma.sql`
  WITH completed AS (
    SELECT b."id", b."bookingNumber", b."price", b."serviceId", b."customerId",
      (SELECT MIN(h."createdAt") FROM "BookingStatusHistory" h WHERE h."bookingId"=b."id" AND h."status"='COMPLETED') AS "completedAt"
    FROM "Booking" b JOIN "WorkerProfile" w ON w."id"=b."workerId" JOIN "User" u ON u."id"=w."userId"
    WHERE w."userId"=${userId}::uuid AND u."role"='WORKER' AND u."isActive"=true AND b."status"='COMPLETED'
  )`;}
type SummaryRow={total:Prisma.Decimal;today:Prisma.Decimal;month:Prisma.Decimal;count:bigint};
export async function earningsSummary(userId:string, client:Prisma.TransactionClient=database()) {
  const timezone=businessTimezone();
  const rows=await client.$queryRaw<SummaryRow[]>(Prisma.sql`${completedBookings(userId)}
    SELECT COALESCE(SUM("price"),0) AS total,
      COALESCE(SUM("price") FILTER (WHERE ("completedAt" AT TIME ZONE ${timezone})::date=(CURRENT_TIMESTAMP AT TIME ZONE ${timezone})::date),0) AS today,
      COALESCE(SUM("price") FILTER (WHERE date_trunc('month',"completedAt" AT TIME ZONE ${timezone})=date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE ${timezone})),0) AS month,
      COUNT(*) AS count FROM completed`);
  const row=rows[0];
  return {totalGrossEarnings:new Prisma.Decimal(row?.total ?? 0).toFixed(2),todayGrossEarnings:new Prisma.Decimal(row?.today ?? 0).toFixed(2),monthGrossEarnings:new Prisma.Decimal(row?.month ?? 0).toFixed(2),completedJobs:Number(row?.count ?? 0),timezone};
}
type HistoryRow={bookingNumber:string;price:Prisma.Decimal;completedAt:Date|null;serviceName:string;customerName:string};
export async function earningsHistory(userId:string,query:Record<string,unknown>) {
  const page=pageNumber(query.page,1),limit=pageNumber(query.limit,20,50),skip=(page-1)*limit;
  if(!Number.isSafeInteger(skip)||skip>2147483647)throw new AuthError(400,"Invalid pagination parameters.");
  return database().$transaction(async tx=>{
    const [rows,counts]=await Promise.all([
      tx.$queryRaw<HistoryRow[]>(Prisma.sql`${completedBookings(userId)} SELECT c."bookingNumber",c."price",c."completedAt",s."name" AS "serviceName",u."name" AS "customerName" FROM completed c JOIN "Service" s ON s."id"=c."serviceId" JOIN "User" u ON u."id"=c."customerId" ORDER BY c."completedAt" DESC NULLS LAST,c."id" DESC LIMIT ${limit} OFFSET ${skip}`),
      tx.$queryRaw<{count:bigint}[]>(Prisma.sql`${completedBookings(userId)} SELECT COUNT(*) AS count FROM completed`),
    ]);
    const total=Number(counts[0]?.count ?? 0);
    return {earnings:rows.map(row=>({bookingNumber:row.bookingNumber,service:{name:row.serviceName},customer:{name:row.customerName},bookingPrice:new Prisma.Decimal(row.price).toFixed(2),completedAt:row.completedAt?.toISOString() ?? null})),pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
}
