import { describe, it, expect, vi, beforeEach } from 'vitest'

const getContainer = vi.fn()
const createContainer = vi.fn()

vi.mock('@/lib/docker', () => ({
  docker: {
    getContainer: (...args: unknown[]) => getContainer(...args),
    createContainer: (...args: unknown[]) => createContainer(...args),
  },
}))

vi.mock('@/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 3003,
    DEPLOY_MODE: 'docker',
    HEALTHCHECK_TIMEOUT_MS: 30,
    HEALTHCHECK_INTERVAL_MS: 5,
  },
}))

const { dockerDriver } = await import('@/docker/dockerDriver')
const { AppError } = await import('@/middleware/error')

function noExistingContainer() {
  return { inspect: vi.fn().mockRejectedValue(new Error('no such container')) }
}

function existingContainer(stop = vi.fn().mockResolvedValue(undefined), remove = vi.fn().mockResolvedValue(undefined)) {
  return { inspect: vi.fn().mockResolvedValue({}), stop, remove }
}

beforeEach(() => {
  getContainer.mockReset()
  createContainer.mockReset()
  vi.restoreAllMocks()
  getContainer.mockReturnValue(noExistingContainer())
})

describe('dockerDriver.deploy', () => {
  it('deploys a web service: builds under a candidate name, allocates a dynamic host port, waits out a failed health-check attempt, then renames to the canonical name', async () => {
    const start = vi.fn().mockResolvedValue(undefined)
    const rename = vi.fn().mockResolvedValue(undefined)
    const inspect = vi.fn().mockResolvedValue({
      NetworkSettings: { Ports: { '3000/tcp': [{ HostPort: '32768' }] } },
    })
    createContainer.mockResolvedValue({ id: 'new-container-id', start, inspect, rename })

    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({ ok: true } as Response)
    vi.stubGlobal('fetch', fetchMock)

    const result = await dockerDriver.deploy({
      deploymentId: 'd1', serviceId: 's1', environmentId: 'e1',
      imageTag: 'mitto-s1:abc123', port: 3000, healthCheck: '/healthz',
      envVars: { FOO: 'bar' }, serviceType: 'web',
    })

    expect(createContainer).toHaveBeenCalledWith(expect.objectContaining({
      Image: 'mitto-s1:abc123',
      name: 'mitto-s1-e1-candidate',
      Env: ['FOO=bar'],
    }))
    expect(start).toHaveBeenCalled()
    expect(rename).toHaveBeenCalledWith({ name: 'mitto-s1-e1' })
    expect(result).toEqual({ deployUrl: 'http://localhost:32768', containerId: 'new-container-id', hostPort: 32768 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('stops and removes an existing container for the same service+environment, but only after the new one is confirmed healthy', async () => {
    const stop = vi.fn().mockResolvedValue(undefined)
    const remove = vi.fn().mockResolvedValue(undefined)
    getContainer.mockImplementation((queriedName: string) =>
      queriedName === 'mitto-s1-e1' ? existingContainer(stop, remove) : noExistingContainer(),
    )

    const start = vi.fn().mockResolvedValue(undefined)
    const rename = vi.fn().mockResolvedValue(undefined)
    const inspect = vi.fn().mockResolvedValue({ State: { Running: true } })
    createContainer.mockResolvedValue({ id: 'new-id', start, inspect, rename })

    await dockerDriver.deploy({
      deploymentId: 'd1', serviceId: 's1', environmentId: 'e1',
      imageTag: 'mitto-s1:abc123', port: null, healthCheck: '/healthz',
      envVars: {}, serviceType: 'worker',
    })

    expect(getContainer).toHaveBeenCalledWith('mitto-s1-e1')
    expect(stop).toHaveBeenCalled()
    expect(remove).toHaveBeenCalled()
    expect(rename).toHaveBeenCalledWith({ name: 'mitto-s1-e1' })
  })

  it('deploys a non-web service without allocating a port or polling health checks', async () => {
    const start = vi.fn().mockResolvedValue(undefined)
    const rename = vi.fn().mockResolvedValue(undefined)
    const inspect = vi.fn().mockResolvedValue({ State: { Running: true } })
    createContainer.mockResolvedValue({ id: 'worker-id', start, inspect, rename })

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await dockerDriver.deploy({
      deploymentId: 'd1', serviceId: 's1', environmentId: 'e1',
      imageTag: 'mitto-s1:abc123', port: null, healthCheck: '/healthz',
      envVars: {}, serviceType: 'worker',
    })

    expect(result).toEqual({ deployUrl: null, containerId: 'worker-id', hostPort: null })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws and cleans up the candidate when the health check never passes, leaving an existing container running (rollback)', async () => {
    const oldStop = vi.fn()
    const oldRemove = vi.fn()
    getContainer.mockImplementation((queriedName: string) =>
      queriedName === 'mitto-s1-e1' ? existingContainer(oldStop, oldRemove) : noExistingContainer(),
    )

    const stop = vi.fn().mockResolvedValue(undefined)
    const remove = vi.fn().mockResolvedValue(undefined)
    const start = vi.fn().mockResolvedValue(undefined)
    const inspect = vi.fn().mockResolvedValue({
      NetworkSettings: { Ports: { '3000/tcp': [{ HostPort: '40000' }] } },
    })
    createContainer.mockResolvedValue({ id: 'unhealthy-id', start, inspect, stop, remove })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response))

    await expect(dockerDriver.deploy({
      deploymentId: 'd1', serviceId: 's1', environmentId: 'e1',
      imageTag: 'mitto-s1:abc123', port: 3000, healthCheck: '/healthz',
      envVars: {}, serviceType: 'web',
    })).rejects.toThrow(AppError)

    expect(createContainer).toHaveBeenCalledWith(expect.objectContaining({ name: 'mitto-s1-e1-candidate' }))
    expect(stop).toHaveBeenCalled()
    expect(remove).toHaveBeenCalled()
    expect(oldStop).not.toHaveBeenCalled()
    expect(oldRemove).not.toHaveBeenCalled()
  })

  it('throws when a non-web container exits immediately after start, leaving an existing container running (rollback)', async () => {
    const oldStop = vi.fn()
    const oldRemove = vi.fn()
    getContainer.mockImplementation((queriedName: string) =>
      queriedName === 'mitto-s1-e1' ? existingContainer(oldStop, oldRemove) : noExistingContainer(),
    )

    const start = vi.fn().mockResolvedValue(undefined)
    const inspect = vi.fn().mockResolvedValue({ State: { Running: false } })
    const remove = vi.fn().mockResolvedValue(undefined)
    createContainer.mockResolvedValue({ id: 'crashed-id', start, inspect, remove })

    await expect(dockerDriver.deploy({
      deploymentId: 'd1', serviceId: 's1', environmentId: 'e1',
      imageTag: 'mitto-s1:abc123', port: null, healthCheck: '/healthz',
      envVars: {}, serviceType: 'cron',
    })).rejects.toThrow('exited immediately after start')

    expect(remove).toHaveBeenCalled()
    expect(oldStop).not.toHaveBeenCalled()
    expect(oldRemove).not.toHaveBeenCalled()
  })
})

describe('dockerDriver.status', () => {
  it('returns running: true when the container is up', async () => {
    getContainer.mockReturnValue({ inspect: vi.fn().mockResolvedValue({ State: { Running: true } }) })
    await expect(dockerDriver.status('some-id')).resolves.toEqual({ running: true })
  })

  it('returns running: false when the container inspect call fails (e.g. not found)', async () => {
    getContainer.mockReturnValue({ inspect: vi.fn().mockRejectedValue(new Error('no such container')) })
    await expect(dockerDriver.status('missing-id')).resolves.toEqual({ running: false })
  })
})

describe('dockerDriver.teardown', () => {
  it('stops and removes the container for the given service+environment when it exists', async () => {
    const stop = vi.fn().mockResolvedValue(undefined)
    const remove = vi.fn().mockResolvedValue(undefined)
    getContainer.mockReturnValue(existingContainer(stop, remove))

    await dockerDriver.teardown({ serviceId: 's1', environmentId: 'e1' })

    expect(getContainer).toHaveBeenCalledWith('mitto-s1-e1')
    expect(stop).toHaveBeenCalled()
    expect(remove).toHaveBeenCalled()
  })

  it('is a no-op when no container exists for the given service+environment', async () => {
    await expect(dockerDriver.teardown({ serviceId: 's1', environmentId: 'e1' })).resolves.toBeUndefined()
  })

  it('ignores stop errors for a container that is already stopped', async () => {
    const stop = vi.fn().mockRejectedValue(new Error('container already stopped'))
    const remove = vi.fn().mockResolvedValue(undefined)
    getContainer.mockReturnValue(existingContainer(stop, remove))

    await expect(dockerDriver.teardown({ serviceId: 's1', environmentId: 'e1' })).resolves.toBeUndefined()
    expect(remove).toHaveBeenCalled()
  })
})
