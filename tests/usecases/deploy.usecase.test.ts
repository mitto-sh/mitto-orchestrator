import { describe, it, expect, vi } from 'vitest'

const deploy = vi.fn()
const teardown = vi.fn()

vi.mock('@/docker/dockerDriver', () => ({
  dockerDriver: { deploy: (...args: unknown[]) => deploy(...args), status: vi.fn(), teardown: (...args: unknown[]) => teardown(...args) },
}))

describe('runDeploy routed to the docker driver (DEPLOY_MODE=docker)', () => {
  it('delegates to the docker driver and returns its result', async () => {
    vi.doMock('@/config/env', () => ({
      env: { NODE_ENV: 'test', PORT: 3003, DEPLOY_MODE: 'docker', HEALTHCHECK_TIMEOUT_MS: 30000, HEALTHCHECK_INTERVAL_MS: 1000 },
    }))
    vi.resetModules()
    deploy.mockResolvedValue({ deployUrl: 'http://localhost:1234', containerId: 'abc', hostPort: 1234 })

    const { runDeploy } = await import('@/usecases/deploy.usecase')
    const input = {
      deploymentId: 'd1', serviceId: 's1', environmentId: 'e1',
      imageTag: 'mitto-s1:abc', port: 3000, healthCheck: '/healthz',
      envVars: {}, serviceType: 'web' as const,
    }

    const result = await runDeploy(input)

    expect(deploy).toHaveBeenCalledWith(input)
    expect(result).toEqual({ deployUrl: 'http://localhost:1234', containerId: 'abc', hostPort: 1234 })
  })
})

describe('runDeploy with an unimplemented DEPLOY_MODE', () => {
  it('throws a 501 AppError', async () => {
    vi.doMock('@/config/env', () => ({
      env: { NODE_ENV: 'test', PORT: 3003, DEPLOY_MODE: 'kubernetes', HEALTHCHECK_TIMEOUT_MS: 30000, HEALTHCHECK_INTERVAL_MS: 1000 },
    }))
    vi.resetModules()

    const { runDeploy } = await import('@/usecases/deploy.usecase')
    const { AppError } = await import('@/middleware/error')

    await expect(runDeploy({
      deploymentId: 'd1', serviceId: 's1', environmentId: 'e1',
      imageTag: 'mitto-s1:abc', port: null, healthCheck: '/healthz',
      envVars: {}, serviceType: 'worker' as const,
    })).rejects.toThrow(AppError)
  })
})

describe('runTeardown routed to the docker driver (DEPLOY_MODE=docker)', () => {
  it('delegates to the docker driver', async () => {
    vi.doMock('@/config/env', () => ({
      env: { NODE_ENV: 'test', PORT: 3003, DEPLOY_MODE: 'docker', HEALTHCHECK_TIMEOUT_MS: 30000, HEALTHCHECK_INTERVAL_MS: 1000 },
    }))
    vi.resetModules()
    teardown.mockResolvedValue(undefined)

    const { runTeardown } = await import('@/usecases/deploy.usecase')
    const input = { serviceId: 's1', environmentId: 'e1' }

    await runTeardown(input)

    expect(teardown).toHaveBeenCalledWith(input)
  })
})

describe('runTeardown with an unimplemented DEPLOY_MODE', () => {
  it('throws a 501 AppError', async () => {
    vi.doMock('@/config/env', () => ({
      env: { NODE_ENV: 'test', PORT: 3003, DEPLOY_MODE: 'kubernetes', HEALTHCHECK_TIMEOUT_MS: 30000, HEALTHCHECK_INTERVAL_MS: 1000 },
    }))
    vi.resetModules()

    const { runTeardown } = await import('@/usecases/deploy.usecase')
    const { AppError } = await import('@/middleware/error')

    await expect(runTeardown({ serviceId: 's1', environmentId: 'e1' })).rejects.toThrow(AppError)
  })
})
