/**
 * Policy types
 * @see https://github.com/ucan-wg/delegation/#policy
 */

/**
 * Type-safe selector utilities
 */

/**
 * Extracts all possible paths from a data structure as string literals
 */
type PathsToStringProps<T> = T extends
  | string
  | number
  | boolean
  | null
  | undefined
  ? never
  : T extends Array<infer U>
    ?
        | `[]`
        | `[${number}]`
        | `[${number}:${number}]`
        | `[${number}:]`
        | `[:${number}]`
        | `[:]`
        | PathsToStringProps<U>
    : T extends object
      ? {
          [K in keyof T & (string | number)]: K extends string
            ? `.${K}` | `.${K}?` | `.${K}${PathsToStringProps<T[K]>}`
            : `[${K}]` | `[${K}]?` | `[${K}]${PathsToStringProps<T[K]>}`
        }[keyof T & (string | number)]
      : never

/**
 * Flattens nested path strings into a union of all possible selectors
 */
type FlattenPaths<T> = T extends string
  ? T
  : T extends object
    ? {
        [K in keyof T]: T[K] extends string
          ? T[K]
          : T[K] extends object
            ? FlattenPaths<T[K]>
            : never
      }[keyof T]
    : never

/**
 * Type-safe selector that only allows valid paths for the given data structure
 */
export type Selector<Args = unknown> = Args extends unknown
  ? FlattenPaths<PathsToStringProps<Args>> | '.'
  : string

/**
 * Extracts the type of the value at a given selector path (minimal version)
 */
type SelectorValue<T, S extends string> = S extends `.${infer K}`
  ? K extends keyof T
    ? T[K]
    : never
  : S extends `[${infer I}]`
    ? T extends Array<infer U>
      ? U
      : never
    : never

/** Connectives */
export type EqualityOp = '==' | '!='
export type Equality<Args = unknown> = [EqualityOp, Selector<Args>, unknown]
export type InequalityOp = '<' | '<=' | '>' | '>='
export type Inequality<Args = unknown> = [InequalityOp, Selector<Args>, number]

export type NegateOp = 'not'
export type Negate<Args = unknown> = [NegateOp, Statement<Args>]

export type ConnectiveOp = 'and' | 'or'
export type Connective<Args = unknown> = [ConnectiveOp, Statement<Args>[]]

export type QuantifierOp = 'all' | 'any'
export type Quantifier<
  Args = unknown,
  Sel extends Selector<Args> = Selector<Args>,
> = [QuantifierOp, Sel, Statement<SelectorValue<Args, Sel>>]
export type LikeOp = 'like'
export type Like<Args = unknown> = [LikeOp, Selector<Args>, string]

export type Statement<Args = unknown> =
  | Equality<Args>
  | Inequality<Args>
  | Negate<Args>
  | Connective<Args>
  | Quantifier<Args>
  | Like<Args>

export type Policy<Args = unknown> = Statement<Args>[]
