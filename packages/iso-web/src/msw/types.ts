import type {
  StartOptions as BrowserStartOptions,
  SetupWorker,
} from 'msw/browser'
import type { SetupServer } from 'msw/node'

interface StartOptions {
  browser: BrowserStartOptions
  node: Parameters<SetupServer['listen']>[0]
}

export interface BrowserNodeServer {
  start: (
    options?: StartOptions
  ) => Promise<ServiceWorkerRegistration | undefined>

  stop: SetupWorker['stop']

  use: SetupServer['use']

  restoreHandlers: SetupServer['restoreHandlers']

  resetHandlers: SetupServer['resetHandlers']

  listHandlers: SetupServer['listHandlers']

  events: SetupServer['events']
}
