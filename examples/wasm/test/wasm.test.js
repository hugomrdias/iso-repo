import assert from 'assert'
import { add } from '../dist/bundler/wasm.js'

// const assert = require('assert')
// const { add } = require('../dist/nodejs/wasm.cjs')

describe('test', function () {
  it('test1', async function () {
    assert.ok(add(1, 1) === 2)
  })
})
