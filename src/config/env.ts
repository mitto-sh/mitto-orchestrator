import { z } from 'zod'
import 'dotenv/config'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3003),

  DEPLOY_MODE: z.enum(['docker', 'swarm', 'kubernetes', 'aws-terraform']).default('docker'),

  DEPLOY_HOST: z.string().default('localhost'),

  HEALTHCHECK_TIMEOUT_MS: z.coerce.number().default(30000),
  HEALTHCHECK_INTERVAL_MS: z.coerce.number().default(1000),

  REDIS_URL: z.string().default('redis://localhost:6379'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
export type Env = typeof env
