import { assert, test } from 'playwright-test/taps'
import { TypedEventTarget } from '../src/event-target/index.js'

/**
 * @typedef {object} EventMap
 * @property {Event} hello
 * @property {CustomEvent<number>} time
 * @property {CustomEvent} any
 */

test('dispatchTypedEvent fires listeners for the matching type', () => {
  /** @type {TypedEventTarget<EventMap>} */
  const target = new TypedEventTarget()
  let count = 0
  target.addEventListener('hello', () => {
    count++
  })

  target.dispatchTypedEvent('hello', new Event('hello'))

  assert.equal(count, 1)
})

test('dispatchTypedEvent throws when event type does not match', () => {
  /** @type {TypedEventTarget<EventMap>} */
  const target = new TypedEventTarget()
  let count = 0
  target.addEventListener('time', () => {
    count++
  })

  assert.throws(
    () => target.dispatchTypedEvent('hello', new CustomEvent('time')),
    TypeError
  )
  assert.equal(count, 0)
})

test('emit dispatches a CustomEvent with detail', () => {
  /** @type {TypedEventTarget<EventMap>} */
  const target = new TypedEventTarget()
  /** @type {number[]} */
  const details = []
  target.on('time', (event) => {
    details.push(event.detail)
  })

  target.emit('time', 42)

  assert.deepEqual(details, [42])
})

test('emit supports Event and untyped CustomEvent values', () => {
  /** @type {TypedEventTarget<EventMap>} */
  const target = new TypedEventTarget()
  /** @type {string[]} */
  const types = []
  target.on('hello', (event) => {
    types.push(event.type)
  })
  target.on('any', (event) => {
    types.push(event.type)
  })

  target.emit('hello')
  target.emit('any')
  target.emit('any', 'detail')

  assert.deepEqual(types, ['hello', 'any', 'any'])

  // @ts-expect-error - Event values do not accept detail
  target.emit('hello', 1)
  // @ts-expect-error - typed CustomEvent requires detail
  target.emit('time')
  // @ts-expect-error - detail must match the CustomEvent type
  target.emit('time', 'nope')
})
