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
import { Auth } from '../odd-passkeys/index.js'

/** @type {import('preact').Context<import('./types.js').OddContext>} */
// @ts-ignore - TODO fix this
const OddContext = createContext({
  isLoading: true,
  error: undefined,
  session: null,
  program: undefined,
  isUsernameAvailable: undefined,
  login: undefined,
})
/**
 *
 * @param {import('./types.js').OddContextProviderProps & {children : import('preact').ComponentChildren}} props
 * @returns
 */
export function OddContextProvider({
  components,
  componentsFactory,
  config,
  children,
}) {
  // State
  const [error, setError] = useState(
    /** @type {odd.ProgramError |undefined} */ (undefined)
  )
  const [program, setProgram] = useState(
    /** @type {odd.Program | undefined} */ (undefined)
  )
  const [session, setSession] = useState(
    /** @type {import('@oddjs/odd').Session | null} */ (null)
  )

  // Effects
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
        } catch (error) {
          setError(/** @type {odd.ProgramError} */ (error))
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

  const login = useCallback(
    async (/** @type {string | undefined} */ username) => {
      if (!program) {
        throw new Error('Needs program.')
      }
      return await Auth.login(program, username)
    },
    [program]
  )

  /** @type {import('./types.js').OddContext} */
  const value = useMemo(() => {
    if (!program) {
      return {
        isLoading: true,
        error: undefined,
        session: null,
        program: undefined,
        isUsernameAvailable,
        login,
      }
    }

    if (error) {
      return {
        isLoading: false,
        error,
        session: null,
        program: undefined,
        isUsernameAvailable,
        login,
      }
    }
    if (program) {
      return {
        isLoading: false,
        error,
        session,
        program,
        isUsernameAvailable,
        login,
      }
    }

    return {
      isLoading: false,
      error: undefined,
      session,
      program,
      isUsernameAvailable,
      login,
    }
  }, [program, error, session, isUsernameAvailable, login])

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
