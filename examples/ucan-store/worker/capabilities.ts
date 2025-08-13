import { Capability } from 'iso-ucan/capability'
import { z } from 'zod/v4'

export const CapAccountCreate = Capability.from({
  schema: z.object({
    type: z.string(),
    properties: z
      .object({
        name: z.string(),
      })
      .strict(),
  }),
  cmd: '/account/create',
})

export const CapAccount = Capability.from({
  schema: z
    .object({
      name: z.string(),
    })
    .strict(),
  cmd: '/account',
})

export const capabilities = [CapAccountCreate, CapAccount] as const
