import { Request, Response } from 'express'
import { teardownSchema } from '@/dto/teardown.dto'
import { runTeardown } from '@/usecases/deploy.usecase'
import { AppError } from '@/middleware/error'

export async function teardownController(req: Request, res: Response) {
  const input = teardownSchema.parse(req.body)

  try {
    await runTeardown(input)
    res.status(200).json({ success: true })
  } catch (err) {
    const statusCode = err instanceof AppError ? err.statusCode : 500
    const message = err instanceof Error ? err.message : String(err)
    res.status(statusCode).json({ success: false, error: message })
  }
}
