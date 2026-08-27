import { describe, it, expect, vi } from 'vitest'
import { PassThrough } from 'node:stream'

const logs = vi.fn()
const getContainer = vi.fn(() => ({ logs }))
const demuxStream = vi.fn((_stream: unknown, stdout: PassThrough, stderr: PassThrough) => {
  stdout.write('Server listening on 3000\n')
  stderr.write('a warning\nanother line')
})

vi.mock('@/lib/docker', () => ({
  docker: {
    getContainer: (...args: unknown[]) => getContainer(...args),
    modem: { demuxStream: (...args: [unknown, PassThrough, PassThrough]) => demuxStream(...args) },
  },
}))

describe('tailLogs', () => {
  it('demuxes stdout and stderr and calls onLine for each non-empty line', async () => {
    logs.mockResolvedValue({ fakeStream: true })
    const { tailLogs } = await import('@/docker/tailLogs')
    const onLine = vi.fn()

    tailLogs('container-1', onLine)
    await new Promise((resolve) => setImmediate(resolve))

    expect(getContainer).toHaveBeenCalledWith('container-1')
    expect(logs).toHaveBeenCalledWith(expect.objectContaining({ follow: true, stdout: true, stderr: true }))
    expect(onLine).toHaveBeenCalledWith('Server listening on 3000')
    expect(onLine).toHaveBeenCalledWith('a warning')
    expect(onLine).toHaveBeenCalledWith('another line')
  })

  it('does not throw when container.logs() rejects', async () => {
    logs.mockRejectedValue(new Error('no such container'))
    const { tailLogs } = await import('@/docker/tailLogs')

    expect(() => tailLogs('missing-container', vi.fn())).not.toThrow()
    await new Promise((resolve) => setImmediate(resolve))
  })
})
