import { base64 } from 'iso-base/rfc4648'
import { isBufferSource, u8 } from 'iso-base/utils'
import { z } from 'zod'

export const SIGNATURE_TYPE = /** @type {const} */ ({
  SECP256K1: 1,
  BLS: 3,
})

export const SIGNATURE_CODE = /** @type {const} */ ({
  1: 'SECP256K1',
  3: 'BLS',
})

/** @type {import("zod").ZodType<BufferSource>} */
const _zBufferSource = z.custom((value) => {
  return isBufferSource(value)
}, 'Value must be a BufferSource')

const zBuf = _zBufferSource.transform((value) => u8(value))

/**
 * @typedef {z.infer<typeof zBuf>} LotusSignature
 */

export const Schemas = {
  lotusSignature: z.object({
    Type: z.literal(1).or(z.literal(3)),
    Data: z.string(),
  }),
  signature: z.object({
    type: z.enum([SIGNATURE_CODE[1], SIGNATURE_CODE[3]]),
    data: zBuf,
  }),
}

export class Signature {
  /**
   *
   * @param {z.infer<typeof Schemas.signature>} sig
   */
  constructor(sig) {
    sig = Schemas.signature.parse(sig)
    this.type = sig.type
    this.data = sig.data
  }

  get code() {
    return SIGNATURE_TYPE[this.type]
  }

  /**
   *
   * @param {z.infer<typeof Schemas.lotusSignature>} json
   */
  static fromLotus(json) {
    json = Schemas.lotusSignature.parse(json)
    return new Signature({
      type: SIGNATURE_CODE[json.Type],
      data: base64.decode(json.Data),
    })
  }

  /**
   * Encodes the signature as a JSON object in the Lotus RPC format.
   *
   * @returns {import("./types.js").LotusSignature}
   */
  toLotus() {
    return {
      Type: this.code,
      Data: base64.encode(this.data, true),
    }
  }
}
