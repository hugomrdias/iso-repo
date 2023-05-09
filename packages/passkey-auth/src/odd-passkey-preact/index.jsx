/* eslint-disable unicorn/no-null */
/* eslint-disable unicorn/no-useless-undefined */
import { createContext } from 'preact'
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'preact/hooks'
import * as odd from '@oddjs/odd'
import { route } from 'preact-router'

/** @type {import('preact').Context<import('./types').OddContext>} */
// @ts-ignore - TODO fix this
const OddContext = createContext({
  isLoading: true,
  error: undefined,
  session: null,
  program: undefined,
  isUsernameAvailable: () => {
    throw new Error('Needs program.')
  },
})
/**
 *
 * @param {import('./types').OddContextProviderProps & {children : import('preact').ComponentChildren}} props
 * @returns
 */
export function OddContextProvider({
  components,
  componentsFactory,
  config,
  children,
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(
    /** @type {odd.ProgramError |undefined} */ (undefined)
  )
  const [program, setProgram] = useState(
    /** @type {odd.Program | undefined} */ (undefined)
  )
  const [session, setSession] = useState(
    /** @type {import('@oddjs/odd').Session | null} */ (null)
  )
  useEffect(() => {
    let mounted = true

    async function setup() {
      if (mounted) {
        try {
          let comps
          if (components) {
            comps = components
          }
          if (componentsFactory) {
            comps = await componentsFactory(config)
          }
          const program = await odd.program({
            ...config,
            ...comps,
          })
          setProgram(program)
          setSession(program.session)
          setIsLoading(false)
        } catch (error) {
          setError(/** @type {odd.ProgramError} */ (error))
          setIsLoading(false)
        }
      }
    }

    setup()

    return () => {
      mounted = false
    }
  }, [components, componentsFactory, config])

  useEffect(() => {
    if (program) {
      // TODO unregister listeners
      program.on('session:destroy', () => {
        setSession(null)
      })
      program.on('session:create', ({ session }) => {
        setSession(session)
      })
    }
  }, [program])

  const isUsernameAvailable = useCallback(
    async (/** @type {string} */ username) => {
      if (!program) {
        throw new Error('Needs program.')
      }
      if (!(await program.auth.isUsernameValid(username))) {
        throw new Error('Invalid username')
      }

      return program.auth.isUsernameAvailable(username)
    },
    [program]
  )

  /** @type {import('./types').OddContext} */
  const value = useMemo(() => {
    if (isLoading) {
      return {
        isLoading: true,
        error: undefined,
        session: null,
        program: undefined,
        isUsernameAvailable,
      }
    }

    if (error) {
      return {
        isLoading: false,
        error,
        session: null,
        program: undefined,
        isUsernameAvailable,
      }
    }

    return {
      isLoading: false,
      error: undefined,
      session,
      program,
      isUsernameAvailable,
    }
  }, [isLoading, error, session, program, isUsernameAvailable])

  return <OddContext.Provider value={value}>{children}</OddContext.Provider>
}

export function useOddContext() {
  const context = useContext(OddContext)
  if (context === undefined) {
    throw new Error(`useOddContext must be used within a OddContextProvider.`)
  }

  return context
}

export function useOdd({ redirectTo = '', redirectIfFound = false } = {}) {
  const context = useContext(OddContext)
  if (context === undefined) {
    throw new Error(`useOddContext must be used within a OddContextProvider.`)
  }
  const { isLoading, session } = context

  useEffect(() => {
    // if no redirect needed, just return (example: already on /dashboard)
    // if session not yet there (fetch in progress, logged in or not) then don't do anything yet
    if (!redirectTo || isLoading) return

    if (
      // If redirectTo is set, redirect if the session was not found.
      (redirectTo && !redirectIfFound && !session) ||
      // If redirectIfFound is also set, redirect if the session was found
      (redirectIfFound && session)
    ) {
      route(redirectTo, true)
    }
  }, [redirectIfFound, redirectTo, isLoading, session])

  return context
}
