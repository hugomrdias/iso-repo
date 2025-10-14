import delay from 'delay'
/* eslint-disable unicorn/no-null */
import { assert } from 'playwright-test/taps'

/**
 * @param {import('../src/types.js').IKV} kv
 * @param {import('playwright-test/taps').Suite} suite
 */
export function baseTests(kv, suite) {
  const test = suite

  test.beforeEach(async () => {
    await kv.clear()
  })

  test('should set/get', async () => {
    await kv.set(['foo'], 1)

    const value = await kv.get(['foo'])

    assert.equal(value, 1)
  })

  test('should double set', async () => {
    await kv.set(['foo'], 1)
    await kv.set(['foo'], 2)

    const value = await kv.get(['foo'])

    assert.equal(value, 2)
  })

  test('should get undefined', async () => {
    const value = await kv.get(['get-undefined'])

    assert.equal(value, undefined)
  })

  test('should set/has', async () => {
    await kv.set(['foo'], 1)

    assert.equal(await kv.has(['foo']), true)
  })

  test('should set/get/delete', async () => {
    await kv.set(['foo'], 1)

    const value = await kv.get(['foo'])

    assert.equal(value, 1)

    await kv.delete(['foo'])

    assert.equal(await kv.has(['foo']), false)
  })

  test('should set/clear', async () => {
    await kv.set(['foo1-clear'], 1)
    await kv.set(['foo2-clear'], 2)

    const value = await kv.get(['foo1-clear'])
    assert.equal(value, 1)

    await kv.clear()

    assert.equal(await kv.has(['foo1-clear']), false)
    assert.equal(await kv.has(['foo1-clear']), false)
  })

  test('should iterate', async () => {
    await kv.clear()
    await kv.set(['foo1'], 1)
    await kv.set(['foo2'], 2)

    const v = []
    for await (const { value } of kv) {
      v.push(value)
    }

    assert.deepEqual(v, [1, 2])
  })

  // test('should iterate lexi ordered', async () => {
  //   await kv.clear()
  //   await kv.set(['name2'], 1)
  //   await kv.set(['name1'], 2)

  //   const v = []
  //   for await (const { key } of kv) {
  //     v.push(key)
  //   }

  //   assert.deepEqual(v, [['name1'], ['name2']])
  // })

  test('should subscribe event', async () => {
    const p = new Promise((resolve) => {
      kv.onChange(['name'], (newValue) => {
        resolve(newValue)
      })
    })

    await kv.set(['name'], 1)

    assert.equal(await p, 1)
  })

  test('should subscribe event once', async () => {
    let count = 0

    const p = new Promise((resolve) => {
      kv.onChange(
        ['name'],
        (newValue) => {
          count++
          resolve(newValue)
        },
        true
      )
    })

    await kv.set(['name'], 1)
    await kv.set(['name'], 1)
    await p

    assert.equal(count, 1)
  })

  test('should unsubscribe event', async () => {
    let off
    const p = new Promise((resolve) => {
      setTimeout(() => {
        resolve('timeout')
      }, 50)
      off = kv.onChange(['name'], (newValue) => {
        resolve(newValue)
      })
    })

    // @ts-expect-error
    off()

    await kv.set(['name'], 1)

    assert.equal(await p, 'timeout')
  })

  test('should expires', async () => {
    await kv.set(['foo'], 1, { ttl: 1 })

    await delay(2000)

    const value = await kv.get(['foo'])

    assert.equal(value, undefined)
  })

  test('should support data types', async () => {
    let v
    await kv.set(['undefined'], undefined)
    assert.equal(undefined, await kv.get(['undefined']))

    await kv.set(['null'], null)
    assert.equal(null, await kv.get(['null']))

    await kv.set(['string'], 'string')
    assert.equal('string', await kv.get(['string']))

    await kv.set(['number'], 1)
    assert.equal(1, await kv.get(['number']))

    await kv.set(['bigint'], BigInt(1))
    assert.equal(BigInt(1), await kv.get(['bigint']))

    v = /^[\s\w!,?àáâãçèéêíïñóôõöú-]+$/
    await kv.set(['regex'], v)
    assert.deepEqual(v, await kv.get(['regex']))

    v = new Set(['a', 1, new Set(['c', 'd'])])
    await kv.set(['set'], v)
    assert.deepEqual(v, await kv.get(['set']))
  })

  test('should order', async () => {
    await kv.set(['test', new Date('2000-01-01T11:00:00.000Z')], 2)
    await kv.set(['test', new Date('2000-01-01T10:00:00.000Z')], 3)
    await kv.set(['test', new Date('2000-01-01T09:00:00.000Z')], 1)
    await kv.set(['test', 2], 4)
    await kv.set(['test', 1], 1)
    // await kv.set(['users', Date.now(), crypto.randomUUID()], 1)
    // await kv.set(['users', Date.now(), crypto.randomUUID()], 1)
    // await kv.set(['users', Date.now(), crypto.randomUUID()], 1)

    const expected = [
      ['test', '1'],
      ['test', '2'],
      ['test', '2000-01-01T09:00:00.000Z'],
      ['test', '2000-01-01T10:00:00.000Z'],
      ['test', '2000-01-01T11:00:00.000Z'],
    ]

    const actual = []

    for await (const { key } of kv.list({ prefix: ['test'] })) {
      actual.push(key)
    }

    assert.deepEqual(actual, expected)
  })
}
