import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

const runTeardown = vi.fn()

vi.mock('@/usecases/deploy.usecase', () => ({
  runTeardown: (...args: unknown[]) => runTeardown(...args),
}))

const { app } = await import('@/app')

const validBody = {
  serviceId: '22222222-2222-2222-2222-222222222222',
  environmentId: '33333333-3333-3333-3333-333333333333',
}

beforeEach(() => {
  runTeardown.mockReset()
})

describe('POST /teardown', () => {
  it('returns 200 {success:true} on a valid request', async () => {
    runTeardown.mockResolvedValue(undefined)

    const res = await request(app).post('/teardown').send(validBody)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })
    expect(runTeardown).toHaveBeenCalledWith(validBody)
  })

  it('returns 400 on an invalid body', async () => {
    const res = await request(app).post('/teardown').send({ serviceId: 'not-a-uuid' })

    expect(res.status).toBe(400)
    expect(runTeardown).not.toHaveBeenCalled()
  })

  it('returns the {success:false, error} shape when the usecase throws an AppError', async () => {
    const { AppError } = await import('@/middleware/error')
    runTeardown.mockRejectedValue(new AppError(501, 'Deploy mode "aws-terraform" is not implemented yet'))

    const res = await request(app).post('/teardown').send(validBody)

    expect(res.status).toBe(501)
    expect(res.body).toEqual({ success: false, error: 'Deploy mode "aws-terraform" is not implemented yet' })
  })

  it('returns a 500 {success:false, error} shape when the usecase throws a plain error', async () => {
    runTeardown.mockRejectedValue(new Error('unexpected'))

    const res = await request(app).post('/teardown').send(validBody)

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ success: false, error: 'unexpected' })
  })
})
