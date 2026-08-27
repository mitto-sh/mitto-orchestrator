export function containerName(serviceId: string, environmentId: string): string {
  return `mitto-${serviceId}-${environmentId}`
}
