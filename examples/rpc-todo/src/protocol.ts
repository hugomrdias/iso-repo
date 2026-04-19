/**
 * Shared protocol definition.
 *
 * Both the server and the CLI import these commands so that the request/
 * response shapes (and their receipt schemas) are statically guaranteed to
 * match.
 */
import {
  defineCommand,
  receipt,
  receiptError,
  receiptResult,
} from 'iso-ucan/rpc'
import { z } from 'zod/v4'

/** A single todo item exchanged over the wire. */
export const TodoSchema = z.object({
  id: z.string(),
  text: z.string(),
  done: z.boolean(),
})
export type Todo = z.infer<typeof TodoSchema>

/** `/todo/list` — return every todo. */
export const TodoList = defineCommand({
  cmd: '/todo/list',
  args: z.object({}),
  receipt: receipt(receiptResult(z.object({ todos: z.array(TodoSchema) }))),
})

/** `/todo/add` — create a new todo and return it. */
export const TodoAdd = defineCommand({
  cmd: '/todo/add',
  args: z.object({
    text: z.string().min(1, 'text must not be empty'),
  }),
  receipt: receipt(receiptResult(z.object({ todo: TodoSchema }))),
})

/**
 * `/todo/complete` — mark a todo as done.
 *
 * Defines a domain `NOT_FOUND` error alongside the success result. This is
 * the kind of failure handlers raise themselves (vs. internal server errors,
 * which are represented by the `SERVER_ERROR` variant added implicitly by
 * `receipt()`).
 */
export const TodoComplete = defineCommand({
  cmd: '/todo/complete',
  args: z.object({ id: z.string() }),
  receipt: receipt(
    receiptResult(z.object({ todo: TodoSchema })),
    receiptError('NOT_FOUND', 'Todo not found.', z.object({ id: z.string() }))
  ),
})

/**
 * Full protocol — exported as an object so it can be passed to both
 * `defineClient(Protocol, ...)` and `defineServer(Protocol, ...)`.
 */
export const Protocol = {
  TodoList,
  TodoAdd,
  TodoComplete,
} as const
