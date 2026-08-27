export interface DeployRequest {
  deploymentId: string
  serviceId: string
  environmentId: string
  imageTag: string
  port: number | null
  healthCheck: string
  envVars: Record<string, string>
  serviceType: 'web' | 'worker' | 'cron' | 'static'
}

export interface DeployResult {
  deployUrl: string | null
  containerId: string
  hostPort: number | null
}

export interface DeployDriver {
  deploy(req: DeployRequest): Promise<DeployResult>
  status(containerId: string): Promise<{ running: boolean }>
  teardown(req: { serviceId: string; environmentId: string }): Promise<void>
}
