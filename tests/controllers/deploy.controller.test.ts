import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

const runDeploy = vi.fn()

vi.mock('@/usecases/deploy.usecase', () => ({
  runDeploy: (...args: unknown[]) => runDeploy(...args),
}))

const { app } = await import('@/app')

const validBody = {
  deploymentId: '11111111-1111-1111-1111-111111111111',
  serviceId: '22222222-2222-2222-2222-222222222222',
  environmentId: '33333333-3333-3333-3333-333333333333',
  imageTag: 'mitto-s1:abc123',
  port: 3000,
  healthCheck: '/healthz',
  envVars: { FOO: 'bar' },
  serviceType: 'web',
}

beforeEach(() => {
  runDeploy.mockReset()
})

describe('POST /deploy', () => {
  it('returns 200 with the success shape on a valid request', async () => {
    runDeploy.mockResolvedValue({ deployUrl: 'http://localhost:3000', containerId: 'c1', hostPort: 3000 })

    const res = await request(app).post('/deploy').send(validBody)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, deployUrl: 'http://localhost:3000', containerId: 'c1', hostPort: 3000 })
  })

  it('returns 400 on an invalid body', async () => {
    const res = await request(app).post('/deploy').send({ ...validBody, deploymentId: 'not-a-uuid' })

    expect(res.status).toBe(400)
    expect(runDeploy).not.toHaveBeenCalled()
  })

  it('returns the {success:false, error} shape when the usecase throws an AppError', async () => {
    const { AppError } = await import('@/middleware/error')
    runDeploy.mockRejectedValue(new AppError(502, 'Health check failed for http://localhost:3000/healthz'))

    const res = await request(app).post('/deploy').send(validBody)

    expect(res.status).toBe(502)
    expect(res.body).toEqual({ success: false, error: 'Health check failed for http://localhost:3000/healthz' })
  })

  it('returns a 500 {success:false, error} shape when the usecase throws a plain error', async () => {
    runDeploy.mockRejectedValue(new Error('unexpected'))

    const res = await request(app).post('/deploy').send(validBody)

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ success: false, error: 'unexpected' })
  })
})

describe('GET /healthz', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/healthz')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})
