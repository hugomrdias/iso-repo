import type {
  Session,
  Program,
  Configuration,
  Components,
  ProgramError,
  Maybe,
} from '@oddjs/odd'

export type OddContext =
  | {
      isLoading: true
      error: undefined
      session: null
      program: undefined
      isUsernameAvailable: (username: string) => Promise<boolean>
      login: (username?: string) => Promise<Maybe<Session>>
    }
  | {
      isLoading: false
      error: ProgramError
      session: null
      program: undefined
      isUsernameAvailable: (username: string) => Promise<boolean>
      login: (username?: string) => Promise<Maybe<Session>>
    }
  | {
      isLoading: false
      error: undefined
      session: Session | null
      program: Program
      isUsernameAvailable: (username: string) => Promise<boolean>
      login: (username?: string) => Promise<Maybe<Session>>
    }
  | {
      isLoading: false
      error: undefined
      session: Session | null
      program: Program
      isUsernameAvailable: (username: string) => Promise<boolean>
      login: (username?: string) => Promise<Maybe<Session>>
    }

export interface OddContextProviderProps {
  config: Configuration
  components?: Partial<Components>
  componentsFactory?: (config: Configuration) => Promise<Partial<Components>>
}
