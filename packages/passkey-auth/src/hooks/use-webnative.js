/* eslint-disable unicorn/no-null */
import { route } from 'preact-router'
import { useEffect, useState } from 'preact/hooks'
import * as wn from 'webnative'

const config = {
  namespace: {
    creator: 'HD',
    name: 'Passkey auth',
  },
  debug: true,
  debugging: {
    injectIntoGlobalContext: true,
  },
}

let cacheSession = null

export function useWebNative({
  redirectTo = '',
  redirectIfFound = false,
} = {}) {
  const [isValidating, setIsValidating] = useState(true)
  const [session, setSession] = useState(
    /** @type {import('webnative').Session | null} */ (cacheSession)
  )

  function updateSession(session) {
    cacheSession = session
    setSession(cacheSession)
  }

  async function setup() {
    if (!session && !cacheSession) {
      const program = await wn.program(config)

      setIsValidating(false)
      setSession(program.session)
    }
  }

  useEffect(() => {
    setup()
  })

  useEffect(() => {
    // if no redirect needed, just return (example: already on /dashboard)
    // if user data not yet there (fetch in progress, logged in or not) then don't do anything yet
    if (!redirectTo || isValidating) return

    if (
      // If redirectTo is set, redirect if the user was not found.
      (redirectTo && !redirectIfFound && !session) ||
      // If redirectIfFound is also set, redirect if the user was found
      (redirectIfFound && session)
    ) {
      route(redirectTo, true)
    }
  }, [redirectIfFound, redirectTo, isValidating, session])

  return { session, setSession: updateSession, config }
}
