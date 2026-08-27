import { z } from 'zod'

export const teardownSchema = z.object({
  serviceId: z.string().uuid(),
  environmentId: z.string().uuid(),
})

export type TeardownInput = z.infer<typeof teardownSchema>
