import 'dotenv/config'
import { app } from '@/app'
import { env } from '@/config/env'

app.listen(env.PORT, () => {
  console.log(`mitto-orchestrator running on port ${env.PORT} [${env.NODE_ENV}]`)
})

export default app
