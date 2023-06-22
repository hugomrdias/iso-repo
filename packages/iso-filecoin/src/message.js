import { z } from 'zod'
import { encode } from '@ipld/dag-cbor'
import { base64 } from 'iso-base/rfc4648'

import * as Address from './address.js'
import { Token } from './token.js'

const MessageSchema = z.object({
  version: z.literal(0).default(0),
  to: z.string(),
  from: z.string(),
  nonce: z.number().nonnegative().safe().default(0),
  value: z
    .string()
    .min(1)
    .refine((v) => !v.startsWith('-'), {
      message: 'value must not be negative',
    }),
  gasLimit: z.number().nonnegative().safe().default(0),
  gasFeeCap: z.string().default('0'),
  gasPremium: z.string().default('0'),
  method: z.number().nonnegative().safe().default(0),
  params: z.string().default(''),
})

const MessageSchemaPartial = MessageSchema.partial({
  version: true,
  nonce: true,
  gasLimit: true,
  gasFeeCap: true,
  gasPremium: true,
  method: true,
  params: true,
})
export const Schemas = {
  message: MessageSchema,
  messagePartial: MessageSchemaPartial,
}

export class Message {
  /**
   *
   * @param {z.infer<typeof MessageSchemaPartial>} msg
   */
  constructor(msg) {
    const _msg = MessageSchema.parse(msg)
    this.version = _msg.version
    this.to = _msg.to
    this.from = _msg.from
    this.nonce = _msg.nonce
    this.value = _msg.value
    this.gasLimit = _msg.gasLimit
    this.gasFeeCap = _msg.gasFeeCap
    this.gasPremium = _msg.gasPremium
    this.method = _msg.method
    this.params = _msg.params
  }

  toLotus() {
    return {
      Version: this.version,
      To: this.to,
      From: this.from,
      Nonce: this.nonce,
      Value: this.value,
      GasLimit: this.gasLimit,
      GasFeeCap: this.gasFeeCap,
      GasPremium: this.gasPremium,
      Method: this.method,
      Params: this.params,
    }
  }

  /**
   *
   * @param {import('./types').LotusMessage} json
   */
  static fromLotus(json) {
    const obj = {
      version: json.Version,
      to: json.To,
      from: json.From,
      nonce: json.Nonce,
      value: json.Value,
      gasLimit: json.GasLimit,
      gasFeeCap: json.GasFeeCap,
      gasPremium: json.GasPremium,
      method: json.Method,
      params: json.Params,
    }

    return new Message(obj)
  }

  /**
   *
   * @param {import('./rpc.js').RPC} rpc
   */
  async prepare(rpc) {
    const nonce = await rpc.nonce(this.from)
    if (nonce.error) {
      throw new Error(nonce.error.message)
    }

    this.nonce = nonce.result

    const gas = await rpc.gasEstimate(this)

    if (gas.error) {
      throw new Error(gas.error.message)
    }

    this.gasLimit = gas.result.GasLimit
    this.gasFeeCap = gas.result.GasFeeCap
    this.gasPremium = gas.result.GasPremium

    return this
  }

  serialize() {
    const msg = [
      this.version,
      Address.fromString(this.to).toBytes(),
      Address.fromString(this.from).toBytes(),
      this.nonce,
      Token.fromAttoFIL(this.value).toBytes(),
      this.gasLimit,
      Token.fromAttoFIL(this.gasFeeCap).toBytes(),
      Token.fromAttoFIL(this.gasPremium).toBytes(),
      this.method,
      base64.decode(this.params),
    ]

    return encode(msg)
  }
}
