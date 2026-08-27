import { PassThrough } from 'node:stream'
import { docker } from '@/lib/docker'

export function tailLogs(containerId: string, onLine: (line: string) => void): void {
  docker.getContainer(containerId)
    .logs({ follow: true, stdout: true, stderr: true, tail: 50 })
    .then((stream) => {
      const stdout = new PassThrough()
      const stderr = new PassThrough()

      function handleChunk(chunk: Buffer) {
        for (const line of chunk.toString('utf8').split('\n')) {
          const trimmed = line.trim()
          if (trimmed) onLine(trimmed)
        }
      }

      stdout.on('data', handleChunk)
      stderr.on('data', handleChunk)
      docker.modem.demuxStream(stream, stdout, stderr)
    })
    .catch(() => {})
}
