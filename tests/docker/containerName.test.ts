import { describe, it, expect } from 'vitest'
import { containerName } from '@/docker/containerName'

describe('containerName', () => {
  it('builds a deterministic name from serviceId and environmentId', () => {
    expect(containerName('svc-1', 'env-1')).toBe('mitto-svc-1-env-1')
  })

  it('is stable across calls with the same inputs', () => {
    expect(containerName('a', 'b')).toBe(containerName('a', 'b'))
  })
})
