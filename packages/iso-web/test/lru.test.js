import delay from 'delay'
import { assert, suite } from 'playwright-test/taps'
import { LRUCache } from '../src/lru.js'

const test = suite('lru')

test('should get what was set', () => {
  const cache = new LRUCache()
  cache.set(['a'], { result: ['1'] }, { ttl: 60 })

  assert.deepEqual(cache.get(['a']), { result: ['1'] })
  assert.equal(cache.get(['b']), undefined)
  assert.equal(cache.size, 1)
})

test('should expire entries after ttl', async () => {
  const cache = new LRUCache()
  cache.set(['a'], 'value', { ttl: 0.05 })
  assert.equal(cache.get(['a']), 'value')

  await delay(80)

  assert.equal(cache.get(['a']), undefined)
  assert.equal(cache.size, 0)
})

test('should not cache entries without a positive ttl', () => {
  const cache = new LRUCache()
  cache.set(['zero'], 'value', { ttl: 0 })
  cache.set(['negative'], 'value', { ttl: -1 })
  cache.set(['nan'], 'value', { ttl: Number.NaN })

  assert.equal(cache.size, 0)
})

test('should remove an existing entry when set without a positive ttl', () => {
  const cache = new LRUCache()
  cache.set(['a'], 'value', { ttl: 60 })
  cache.set(['a'], 'value', { ttl: 0 })

  assert.equal(cache.get(['a']), undefined)
})

test('should evict the least recently set entry', () => {
  const cache = new LRUCache({ max: 2 })
  cache.set(['a'], 'a', { ttl: 60 })
  cache.set(['b'], 'b', { ttl: 60 })
  cache.set(['c'], 'c', { ttl: 60 })

  assert.equal(cache.size, 2)
  assert.equal(cache.get(['a']), undefined)
  assert.equal(cache.get(['b']), 'b')
  assert.equal(cache.get(['c']), 'c')
})

test('should evict the least recently read entry', () => {
  const cache = new LRUCache({ max: 2 })
  cache.set(['a'], 'a', { ttl: 60 })
  cache.set(['b'], 'b', { ttl: 60 })
  cache.get(['a'])
  cache.set(['c'], 'c', { ttl: 60 })

  assert.equal(cache.get(['a']), 'a')
  assert.equal(cache.get(['b']), undefined)
  assert.equal(cache.get(['c']), 'c')
})

test('should not evict when overwriting an entry', () => {
  const cache = new LRUCache({ max: 2 })
  cache.set(['a'], 'a', { ttl: 60 })
  cache.set(['b'], 'b', { ttl: 60 })
  cache.set(['a'], 'a2', { ttl: 60 })

  assert.equal(cache.size, 2)
  assert.equal(cache.get(['a']), 'a2')
  assert.equal(cache.get(['b']), 'b')
})

test('should stay bounded', () => {
  const cache = new LRUCache({ max: 100 })
  for (let i = 0; i < 5000; i++) {
    cache.set([`name-${i}`], i, { ttl: 60 })
  }

  assert.equal(cache.size, 100)
  assert.equal(cache.get(['name-4899']), undefined)
  assert.equal(cache.get(['name-4900']), 4900)
})

test('should delete and clear', () => {
  const cache = new LRUCache()
  cache.set(['a'], 'a', { ttl: 60 })
  cache.set(['b'], 'b', { ttl: 60 })

  cache.delete(['a'])
  assert.equal(cache.get(['a']), undefined)
  assert.equal(cache.size, 1)

  cache.clear()
  assert.equal(cache.size, 0)
})

test('should join key parts', () => {
  const cache = new LRUCache()
  cache.set(['a', 'b'], 'value', { ttl: 60 })

  assert.equal(cache.get(['a', 'b']), 'value')
  assert.equal(cache.get('a b'), 'value')
  assert.equal(cache.get(['a']), undefined)
})

test('should accept string keys', () => {
  /** @type {LRUCache<number>} */
  const cache = new LRUCache({ max: 2 })
  cache.set('a', 1)
  cache.set('b', 2)
  cache.set('c', 3)

  assert.equal(cache.get('a'), undefined)
  assert.equal(cache.get('b'), 2)
  assert.equal(cache.get('c'), 3)
})

test('should keep entries without ttl until evicted', async () => {
  const cache = new LRUCache({ max: 2 })
  cache.set('forever', 'value')

  await delay(20)
  assert.equal(cache.get('forever'), 'value')

  cache.set('b', 'b')
  cache.set('c', 'c')
  assert.equal(cache.get('forever'), undefined)
})

test('should reject an invalid max', () => {
  for (const max of [0, -1, 1.5, Number.NaN]) {
    assert.throws(() => new LRUCache({ max }), /`max` must be a positive/)
  }
})
