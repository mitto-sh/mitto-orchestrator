import { Request, Response } from 'express'
import { deploySchema } from '@/dto/deploy.dto'
import { runDeploy } from '@/usecases/deploy.usecase'
import { AppError } from '@/middleware/error'

export async function deployController(req: Request, res: Response) {
  const input = deploySchema.parse(req.body)

  try {
    const result = await runDeploy(input)
    res.status(200).json({ success: true, ...result })
  } catch (err) {
    const statusCode = err instanceof AppError ? err.statusCode : 500
    const message = err instanceof Error ? err.message : String(err)
    res.status(statusCode).json({ success: false, error: message })
  }
}
