import "dotenv/config";
import { getPrismaClient } from "../src/lib/prisma.js";

// Idempotent catalogue; optional development workers require explicit opt-in.
const catalogue = [
  { name: "Plumber", slug: "plumber", services: [
    { name: "Tap Repair", slug: "tap-repair", price: "299.00" },
    { name: "Pipe Leakage Repair", slug: "pipe-leakage-repair", price: "399.00" },
    { name: "Bathroom Plumbing", slug: "bathroom-plumbing", price: "599.00" },
    { name: "Water Tank Repair", slug: "water-tank-repair", price: "499.00" },
  ] },
  { name: "Electrician", slug: "electrician", services: [
    { name: "Switch Repair", slug: "switch-repair", price: "199.00" },
    { name: "Fan Installation", slug: "fan-installation", price: "349.00" },
    { name: "Light Installation", slug: "light-installation", price: "249.00" },
    { name: "Electrical Inspection", slug: "electrical-inspection", price: "399.00" },
  ] },
  { name: "Carpenter", slug: "carpenter", services: [
    { name: "Furniture Repair", slug: "furniture-repair", price: "399.00" },
    { name: "Door Repair", slug: "door-repair", price: "349.00" },
    { name: "Furniture Assembly", slug: "furniture-assembly", price: "499.00" },
  ] },
  { name: "Mechanic", slug: "mechanic", services: [
    { name: "Vehicle Inspection", slug: "vehicle-inspection", price: "499.00" },
  ] },
  { name: "Painter", slug: "painter", services: [
    { name: "Wall Touch-up", slug: "wall-touch-up", price: "599.00" },
  ] },
  { name: "AC Service", slug: "ac-service", services: [
    { name: "AC Cleaning", slug: "ac-cleaning", price: "499.00" },
  ] },
  { name: "Cleaning", slug: "cleaning", services: [
    { name: "Home Cleaning", slug: "home-cleaning", price: "999.00" },
  ] },
  { name: "Appliance Repair", slug: "appliance-repair", services: [
    { name: "Washing Machine Inspection", slug: "washing-machine-inspection", price: "299.00" },
  ] },
];

async function main() {
  if (process.env.SEED_DEVELOPMENT_WORKERS === "true" && process.env.NODE_ENV === "production") throw new Error("Development workers cannot be seeded in production.");
  const prisma = getPrismaClient();
  if (!prisma) throw new Error("DATABASE_URL is required to seed PostgreSQL.");
  try {
    for (const item of catalogue) {
      const category = await prisma.category.upsert({
        where: { slug: item.slug }, update: {},
        create: { name: item.name, slug: item.slug },
      });
      for (const service of item.services) {
        await prisma.service.upsert({
          where: { slug: service.slug }, update: {},
          create: { categoryId: category.id, name: service.name, slug: service.slug, basePrice: service.price },
        });
      }
    }
    if (process.env.SEED_DEVELOPMENT_WORKERS === "true") {
      const examples = [
        { name: "Rajesh Kumar", phone: "0000000001", experienceYears: 8, price: "299.00", isAvailable: true },
        { name: "Arun Sharma", phone: "0000000002", experienceYears: 5, price: "250.00", isAvailable: true },
        { name: "Mohammed Imran", phone: "0000000003", experienceYears: 10, price: "350.00", isAvailable: false },
      ];
      const plumbing = await prisma.service.findMany({ where: { category: { slug: "plumber" } }, orderBy: { basePrice: "asc" } });
      for (const example of examples) {
        await prisma.$transaction(async (tx) => {
          const user = await tx.user.upsert({ where: { phone: example.phone }, update: {}, create: { name: example.name, phone: example.phone, role: "WORKER", isActive: true } });
          if (user.role !== "WORKER" || user.name !== example.name) throw new Error("Development seed identity conflict.");
          const worker = await tx.workerProfile.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id, bio: "Fictional development worker for marketplace testing.", experienceYears: example.experienceYears, startingPrice: example.price, isAvailable: example.isAvailable, verificationStatus: "VERIFIED" } });
          for (let index = 0; index < plumbing.length; index++) {
            const service = plumbing[index];
            await tx.workerService.upsert({ where: { workerId_serviceId: { workerId: worker.id, serviceId: service.id } }, update: {}, create: { workerId: worker.id, serviceId: service.id, price: index === 0 ? example.price : service.basePrice } });
          }
        });
      }
      console.log("Three fictional development workers seeded.");
    }
    console.log("Service categories and services seeded successfully.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error("Database seeding failed. Check DATABASE_URL, PostgreSQL availability, and applied migrations.");
  process.exitCode = 1;
});
