import { createPublisher } from 'mitto-lib-redis'
import { env } from '@/config/env'

export const publisher = createPublisher(env.REDIS_URL)
