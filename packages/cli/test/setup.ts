import { Config } from '@oclif/core'
import { root } from './helpers/root.js'

/**
 * Load Config from package root so runCommand uses the correct root.
 * Fails fast if config cannot be loaded.
 */
await Config.load({ root })
