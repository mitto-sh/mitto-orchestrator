import { env } from '@/config/env'
import { AppError } from '@/middleware/error'
import { dockerDriver } from '@/docker/dockerDriver'
import type { DeployDriver, DeployRequest, DeployResult } from '@/drivers/DeployDriver'
import type { TeardownInput } from '@/dto/teardown.dto'

const DRIVERS: Partial<Record<typeof env.DEPLOY_MODE, DeployDriver>> = {
  docker: dockerDriver,
}

function getDriver(): DeployDriver {
  const driver = DRIVERS[env.DEPLOY_MODE]

  if (!driver) {
    throw new AppError(501, `Deploy mode "${env.DEPLOY_MODE}" is not implemented yet`)
  }

  return driver
}

export async function runDeploy(input: DeployRequest): Promise<DeployResult> {
  return getDriver().deploy(input)
}

export async function runTeardown(input: TeardownInput): Promise<void> {
  return getDriver().teardown(input)
}
