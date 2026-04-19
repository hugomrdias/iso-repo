import { z } from 'zod/v4'
import { defineCommand } from '../../src/rpc/command.js'
import { receipt, receiptError, receiptResult } from '../../src/rpc/receipt.js'

export const AccountCreateCommand = defineCommand({
  cmd: '/account/create',
  args: z.object({
    name: z.string(),
    createdAt: z.number(),
  }),
  receipt: receipt(
    receiptResult(
      z.object({
        name: z.string(),
      })
    ),
    receiptError(
      'NAME_TAKEN',
      'The requested account name is already taken.',
      z.object({
        name: z.string(),
      })
    )
  ),
})

export const AccountCommand = defineCommand({
  cmd: '/account',
  args: z.object({
    name: z.string(),
    createdAt: z.number(),
  }),
  receipt: receipt(
    receiptResult(
      z.object({
        name: z.string(),
        id: z.string(),
      })
    ),
    receiptError(
      'NOT_FOUND',
      'Account not found.',
      z.object({
        name: z.string(),
      })
    )
  ),
})
