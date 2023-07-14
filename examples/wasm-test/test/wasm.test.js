import assert from 'assert'
import { add } from 'wasm'

// const assert = require('assert')
// const { add } = require('wasm')

describe('test', function () {
  it('test1', async function () {
    assert.ok(add(1, 1) === 2)
  })
})
