import { assert } from 'playwright-test/taps'
import delay from 'delay'

/**
 * @param {import('../src/types.js').Kv} kv
 * @param {import('playwright-test/taps').Suite} suite
 */
export function baseTests(kv, suite) {
  const { test } = suite
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

  test('should iterate lexi ordered', async () => {
    await kv.clear()
    await kv.set(['name2'], 1)
    await kv.set(['name1'], 2)

    const v = []
    for await (const { key } of kv) {
      v.push(key)
    }

    assert.deepEqual(v, [['name1'], ['name2']])
  })

  test('should subscribe event', async () => {
    const p = new Promise((resolve) => {
      kv.onChange(['name'], (newValue, oldValue) => {
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
        (newValue, oldValue) => {
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

    // @ts-ignore
    off()

    await kv.set(['name'], 1)

    assert.equal(await p, 'timeout')
  })

  test('should expires', async () => {
    await kv.set(['foo'], 1, 10)

    await delay(20)

    const value = await kv.get(['foo'])

    assert.equal(value, undefined)
  })

  test('should not expires with 0', async () => {
    await kv.set(['should not expires with 0'], 1, 0)

    await delay(100)

    const value = await kv.get(['should not expires with 0'])

    assert.equal(value, 1)
  })
}
