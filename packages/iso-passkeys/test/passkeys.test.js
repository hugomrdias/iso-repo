import assert from 'assert'
import { hex } from 'iso-base/rfc4648'
import { utf8 } from 'iso-base/utf8'
import { unwrapEC2Signature, validateAuth } from '../src/validation.js'

// A P-256 WebAuthn-style assertion signed with WebCrypto, with both DER
// integers requiring a leading sign byte. No private key is needed to verify it.
const fixture = {
  clientData:
    '{"type":"webauthn.get","challenge":"dGVzdA","origin":"https://example.com"}',
  authenticatorData:
    'a379a6f6eeafb9a55e378c118034e2751e682fab9f2d30ab13d2125586ce19470100000001',
  signature:
    '3046022100e5982e80cfb19f378161173acc1ac7e94736cb3aff405ec8859ccf7cbd655076022100c2062c3d8d1dc0d893f5da097904baee3bdf05a7911ef1da0a398ff6bf96f728',
  rawSignature:
    'e5982e80cfb19f378161173acc1ac7e94736cb3aff405ec8859ccf7cbd655076c2062c3d8d1dc0d893f5da097904baee3bdf05a7911ef1da0a398ff6bf96f728',
  x: 'd69bb9837a323f0a5c56c6e60de89477c4e5636edf10c0b44c3bc9a5baed0e16',
  y: '3006b41c44eb10b782fd1b632b5ccb0065661c6481e82a5a45ded634893f44b8',
}

/** @param {string} value */
function decodeHex(value) {
  return new Uint8Array(hex.decode(value))
}

/** @type {import('../src/types.js').COSEPublicKeyEC2} */
const key = {
  1: 2,
  3: -7,
  '-1': 1,
  '-2': decodeHex(fixture.x),
  '-3': decodeHex(fixture.y),
}

function assertion() {
  return {
    authenticatorDataBytes: decodeHex(fixture.authenticatorData),
    clientDataBytes: utf8.decode(fixture.clientData).slice(),
    signature: decodeHex(fixture.signature),
  }
}

describe('EC2 signatures', () => {
  it('should unwrap a WebAuthn DER signature', () => {
    assert.deepEqual(
      unwrapEC2Signature(decodeHex(fixture.signature)),
      decodeHex(fixture.rawSignature)
    )
  })

  for (const r of [0x01, 0x80]) {
    for (const s of [0x02, 0x81]) {
      it(`should decode DER sign padding for r=${r} and s=${s}`, () => {
        const rBytes = new Uint8Array(32).fill(r)
        const sBytes = new Uint8Array(32).fill(s)
        const rInteger = r >= 0x80 ? [0, ...rBytes] : [...rBytes]
        const sInteger = s >= 0x80 ? [0, ...sBytes] : [...sBytes]
        const der = new Uint8Array([
          0x30,
          4 + rInteger.length + sInteger.length,
          0x02,
          rInteger.length,
          ...rInteger,
          0x02,
          sInteger.length,
          ...sInteger,
        ])

        assert.deepEqual(
          unwrapEC2Signature(der),
          new Uint8Array([...rBytes, ...sBytes])
        )
      })
    }
  }

  it('should reject malformed DER signatures', () => {
    for (const der of [
      new Uint8Array(),
      new Uint8Array([0x30, 0x00]),
      decodeHex(fixture.signature).slice(0, -1),
    ]) {
      assert.throws(() => unwrapEC2Signature(der))
    }
  })

  it('should verify a WebAuthn assertion with a COSE P-256 key', async () => {
    assert.equal(await validateAuth(assertion(), key), true)
  })

  for (const field of /** @type {const} */ ([
    'authenticatorDataBytes',
    'clientDataBytes',
    'signature',
  ])) {
    it(`should reject a changed ${field}`, async () => {
      const data = assertion()
      data[field][data[field].length - 1] ^= 1
      assert.equal(await validateAuth(data, key), false)
    })
  }
})
