import "dotenv/config";
import { adminCredentials, createAdmin } from "../services/admin-bootstrap.service.js";
import { getPrismaClient } from "../lib/prisma.js";
import { AuthError } from "../types/auth.types.js";
try { console.log(await createAdmin(adminCredentials(process.env))); }
catch(error) { console.error(error instanceof AuthError ? error.message : "Admin creation failed. Check database connectivity and schema."); process.exitCode = 1; }
finally { await getPrismaClient()?.$disconnect(); }
