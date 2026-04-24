import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(3041),
  USERS: z.string().min(1, "USERS is required"),
  PASS: z.string().min(1, "PASS is required"),
  IP: z.string().min(1, "IP is required"),
  PORT: z.coerce.number().int().positive().default(5432),
  DBASE: z.string().min(1, "DBASE is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  JWT_COOKIE_NAME: z.string().min(1).default("token"),
  CORS_ORIGIN: z.string().default("*"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const formattedErrors = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid environment variables:\n${formattedErrors}`);
}

export const env = parsedEnv.data;
