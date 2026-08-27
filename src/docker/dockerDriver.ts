import { docker } from '@/lib/docker'
import { containerName } from '@/docker/containerName'
import { tailLogs } from '@/docker/tailLogs'
import { publisher } from '@/lib/redis'
import { runtimeLogsChannel } from 'mitto-lib-redis'
import { env } from '@/config/env'
import { AppError } from '@/middleware/error'
import type { DeployDriver, DeployRequest, DeployResult } from '@/drivers/DeployDriver'

async function removeExisting(name: string): Promise<void> {
  const container = docker.getContainer(name)

  try {
    await container.inspect()
  } catch {
    return
  }

  try {
    await container.stop()
  } catch {}

  await container.remove()
}

async function waitForHealthy(deployUrl: string, healthCheck: string): Promise<boolean> {
  const deadline = Date.now() + env.HEALTHCHECK_TIMEOUT_MS

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${deployUrl}${healthCheck}`)
      if (res.ok) return true
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, env.HEALTHCHECK_INTERVAL_MS))
  }

  return false
}

async function deploy(req: DeployRequest): Promise<DeployResult> {
  const name = containerName(req.serviceId, req.environmentId)
  const candidateName = `${name}-candidate`
  await removeExisting(candidateName)

  const isWeb = req.serviceType === 'web' && req.port !== null

  const container = await docker.createContainer({
    name: candidateName,
    Image: req.imageTag,
    Env: Object.entries(req.envVars).map(([key, value]) => `${key}=${value}`),
    ExposedPorts: isWeb ? { [`${req.port}/tcp`]: {} } : undefined,
    HostConfig: {
      RestartPolicy: { Name: 'unless-stopped' },
      ...(isWeb ? { PortBindings: { [`${req.port}/tcp`]: [{ HostPort: '0' }] } } : {}),
    },
  })

  await container.start()

  if (!isWeb) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const info = await container.inspect()
    if (!info.State.Running) {
      await container.remove({ force: true })
      throw new AppError(502, `Container for service ${req.serviceId} exited immediately after start`)
    }
    await removeExisting(name)
    await container.rename({ name })
    const channel = runtimeLogsChannel(req.deploymentId)
    tailLogs(container.id, (line) => { publisher.publish(channel, line).catch(() => {}) })
    return { deployUrl: null, containerId: container.id, hostPort: null }
  }

  const info = await container.inspect()
  const hostPort = Number(info.NetworkSettings.Ports[`${req.port}/tcp`]?.[0]?.HostPort)
  const deployUrl = `http://${env.DEPLOY_HOST}:${hostPort}`

  const healthy = await waitForHealthy(deployUrl, req.healthCheck)
  if (!healthy) {
    await container.stop().catch(() => {})
    await container.remove({ force: true }).catch(() => {})
    throw new AppError(502, `Health check ${req.healthCheck} did not pass within ${env.HEALTHCHECK_TIMEOUT_MS}ms`)
  }

  await removeExisting(name)
  await container.rename({ name })
  const channel = runtimeLogsChannel(req.deploymentId)
  tailLogs(container.id, (line) => { publisher.publish(channel, line).catch(() => {}) })

  return { deployUrl, containerId: container.id, hostPort }
}

async function status(containerId: string): Promise<{ running: boolean }> {
  try {
    const info = await docker.getContainer(containerId).inspect()
    return { running: info.State.Running }
  } catch {
    return { running: false }
  }
}

async function teardown(req: { serviceId: string; environmentId: string }): Promise<void> {
  await removeExisting(containerName(req.serviceId, req.environmentId))
}

export const dockerDriver: DeployDriver = { deploy, status, teardown }
