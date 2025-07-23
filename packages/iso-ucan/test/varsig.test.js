import { IOBuffer } from 'iobuffer'
import { varint } from 'iso-base/varint'
import { assert, suite } from 'playwright-test/taps'
import { decode, encode, VARSIG, VERSION } from '../src/varsig.js'

const test = suite('varsig')

test('RS256+RAW', () => {
  const varsig = encode({
    alg: 'RS256',
    enc: 'RAW',
  })

  const bytes = new IOBuffer(varsig)

  assert.deepEqual(bytes.readBytes(1), varint.encode(VARSIG)[0], 'VARSIG')
  assert.deepEqual(bytes.readBytes(1), varint.encode(VERSION)[0], 'VERSION')
  assert.deepEqual(bytes.readBytes(2), varint.encode(0x1205)[0], 'prefix')
  assert.deepEqual(bytes.readBytes(1), varint.encode(0x12)[0], 'hash')
  assert.deepEqual(bytes.readBytes(2), varint.encode(256)[0], 'key length')
  assert.deepEqual(bytes.readBytes(1), varint.encode(0x5f)[0], 'encoding')

  const rawVarsig = Uint8Array.from([52, 1, 133, 36, 18, 128, 2, 95])
  const decoded = decode(rawVarsig)

  assert.deepEqual(decoded.alg, 'RS256')
  assert.deepEqual(decoded.enc, 'RAW')
})

test('Ed25519+RAW', () => {
  const varsig = encode({
    alg: 'Ed25519',
    enc: 'RAW',
  })

  const bytes = new IOBuffer(varsig)

  assert.deepEqual(bytes.readBytes(1), varint.encode(VARSIG)[0], 'VARSIG')
  assert.deepEqual(bytes.readBytes(1), varint.encode(VERSION)[0], 'VERSION')
  assert.deepEqual(bytes.readBytes(2), varint.encode(0xed)[0], 'prefix')
  assert.deepEqual(bytes.readBytes(2), varint.encode(0xed)[0], 'curve')
  assert.deepEqual(bytes.readBytes(1), varint.encode(0x13)[0], 'hash')
  assert.deepEqual(bytes.readBytes(1), varint.encode(0x5f)[0], 'encoding')

  const decoded = decode(Uint8Array.from([52, 1, 237, 1, 237, 1, 19, 95]))

  assert.deepEqual(decoded.alg, 'Ed25519')
  assert.deepEqual(decoded.enc, 'RAW')
})

test('ES256+RAW', () => {
  const varsig = encode({
    alg: 'ES256',
    enc: 'RAW',
  })

  const bytes = new IOBuffer(varsig)

  assert.deepEqual(bytes.readBytes(1), varint.encode(VARSIG)[0], 'VARSIG')
  assert.deepEqual(bytes.readBytes(1), varint.encode(VERSION)[0], 'VERSION')
  assert.deepEqual(bytes.readBytes(2), varint.encode(0xec)[0], 'prefix')
  assert.deepEqual(bytes.readBytes(2), varint.encode(0x1200)[0], 'curve')
  assert.deepEqual(bytes.readBytes(1), varint.encode(0x12)[0], 'hash')
  assert.deepEqual(bytes.readBytes(1), varint.encode(0x5f)[0], 'encoding')

  const decoded = decode(Uint8Array.from([52, 1, 236, 1, 128, 36, 18, 95]))

  assert.deepEqual(decoded.alg, 'ES256')
  assert.deepEqual(decoded.enc, 'RAW')
})

test('ES512+RAW', () => {
  const varsig = encode({
    alg: 'ES512',
    enc: 'RAW',
  })

  const bytes = new IOBuffer(varsig)

  assert.deepEqual(bytes.readBytes(1), varint.encode(VARSIG)[0], 'VARSIG')
  assert.deepEqual(bytes.readBytes(1), varint.encode(VERSION)[0], 'VERSION')
  assert.deepEqual(bytes.readBytes(2), varint.encode(0xec)[0], 'prefix')
  assert.deepEqual(bytes.readBytes(2), varint.encode(0x1202)[0], 'curve')
  assert.deepEqual(bytes.readBytes(1), varint.encode(0x13)[0], 'hash')
  assert.deepEqual(bytes.readBytes(1), varint.encode(0x5f)[0], 'encoding')

  const decoded = decode(Uint8Array.from([52, 1, 236, 1, 130, 36, 19, 95]))

  assert.deepEqual(decoded.alg, 'ES512')
  assert.deepEqual(decoded.enc, 'RAW')
})

test('ES256K+RAW', () => {
  const varsig = encode({
    alg: 'ES256K',
    enc: 'RAW',
  })

  const bytes = new IOBuffer(varsig)

  assert.deepEqual(bytes.readBytes(1), varint.encode(VARSIG)[0], 'VARSIG')
  assert.deepEqual(bytes.readBytes(1), varint.encode(VERSION)[0], 'VERSION')
  assert.deepEqual(bytes.readBytes(2), varint.encode(0xec)[0], 'prefix')
  assert.deepEqual(bytes.readBytes(2), varint.encode(0xe7)[0], 'curve')
  assert.deepEqual(bytes.readBytes(1), varint.encode(0x12)[0], 'hash')
  assert.deepEqual(bytes.readBytes(1), varint.encode(0x5f)[0], 'encoding')

  const decoded = decode(Uint8Array.from([52, 1, 236, 1, 231, 1, 18, 95]))

  assert.deepEqual(decoded.alg, 'ES256K')
  assert.deepEqual(decoded.enc, 'RAW')
})

test('EIP191+RAW', () => {
  const varsig = encode({
    alg: 'EIP191',
    enc: 'RAW',
  })

  const bytes = new IOBuffer(varsig)

  assert.deepEqual(bytes.readBytes(1), varint.encode(VARSIG)[0], 'VARSIG')
  assert.deepEqual(bytes.readBytes(1), varint.encode(VERSION)[0], 'VERSION')
  assert.deepEqual(bytes.readBytes(2), varint.encode(0xec)[0], 'prefix')
  assert.deepEqual(bytes.readBytes(2), varint.encode(0xe7)[0], 'curve')
  assert.deepEqual(bytes.readBytes(1), varint.encode(0x1b)[0], 'hash')
  assert.deepEqual(bytes.readBytes(3), varint.encode(0xe191)[0], 'encoding')
  assert.deepEqual(bytes.readBytes(1), varint.encode(0x5f)[0], 'encoding-info')

  const decoded = decode(
    Uint8Array.from([52, 1, 236, 1, 231, 1, 27, 145, 195, 3, 95])
  )

  assert.deepEqual(decoded.alg, 'EIP191')
  assert.deepEqual(decoded.enc, 'RAW')
})

test('EIP191+DAG-CBOR', () => {
  const varsig = encode({
    alg: 'EIP191',
    enc: 'DAG-CBOR',
  })

  const bytes = new IOBuffer(varsig)

  assert.deepEqual(bytes.readBytes(1), varint.encode(VARSIG)[0], 'VARSIG')
  assert.deepEqual(bytes.readBytes(1), varint.encode(VERSION)[0], 'VERSION')
  assert.deepEqual(bytes.readBytes(2), varint.encode(0xec)[0], 'prefix')
  assert.deepEqual(bytes.readBytes(2), varint.encode(0xe7)[0], 'curve')
  assert.deepEqual(bytes.readBytes(1), varint.encode(0x1b)[0], 'hash')
  assert.deepEqual(bytes.readBytes(3), varint.encode(0xe191)[0], 'encoding')
  assert.deepEqual(bytes.readBytes(1), varint.encode(0x71)[0], 'encoding-info')

  const decoded = decode(
    Uint8Array.from([52, 1, 236, 1, 231, 1, 27, 145, 195, 3, 113])
  )

  assert.deepEqual(decoded.alg, 'EIP191')
  assert.deepEqual(decoded.enc, 'DAG-CBOR')
})
