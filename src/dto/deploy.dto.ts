import { z } from 'zod'

export const deploySchema = z.object({
  deploymentId: z.string().uuid(),
  serviceId: z.string().uuid(),
  environmentId: z.string().uuid(),
  imageTag: z.string().min(1),
  port: z.number().int().positive().nullable(),
  healthCheck: z.string().min(1),
  envVars: z.record(z.string()),
  serviceType: z.enum(['web', 'worker', 'cron', 'static']),
})

export type DeployInput = z.infer<typeof deploySchema>
