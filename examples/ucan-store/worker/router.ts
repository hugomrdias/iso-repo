import { route } from 'iso-ucan/server'
import type { InferProtocol, Router } from 'iso-ucan/types'
import * as Capabilities from './capabilities'

const accountRoute = route({
  capability: Capabilities.CapAccount,
  handler: ({ args, store }) => {
    console.log(args)

    return {
      status: 200,
      body: {
        message: 'Account created',
      },
    }
  },
})

const accountCreate = route({
  capability: Capabilities.CapAccountCreate,
  handler: ({ args, store }) => {
    console.log(args)

    return {
      id: args.properties.name,
    }
  },
})

export const router = {
  '/account/create': accountCreate,
  '/account': accountRoute,
} satisfies Router<typeof Capabilities.capabilities>

export type Protocol = InferProtocol<typeof router>
