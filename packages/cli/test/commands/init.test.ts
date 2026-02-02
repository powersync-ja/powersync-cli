import { runCommand } from '@oclif/test'
import { describe, expect, it } from 'vitest'
import { root } from '../helpers/root.js'

describe('init', () => {
  it('runs init cmd', async () => {
    const { stdout } = await runCommand('init', { root })
    expect(stdout).toContain('init: not yet implemented')
  })
})
