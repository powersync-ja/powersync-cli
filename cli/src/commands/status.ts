

// powersync status is an alias of powersync fetch status, so we can reuse the implementation and tests for fetch status. This file exists mainly to provide a more intuitive command for users to check the status of their instance.


export {default} from './fetch/status.js';