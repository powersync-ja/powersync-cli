import { runCommand } from '@oclif/test'
import { describe, expect, it } from 'vitest'

import { root } from '../helpers/root.js'

describe('login', () => {
  it('runs login cmd', async () => {
    const { stdout } = await runCommand('login', { root })
    expect(stdout).toContain('login: not yet implemented')
  })
})
