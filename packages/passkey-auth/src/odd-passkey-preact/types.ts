import type {
  Session,
  Program,
  Configuration,
  Components,
  ProgramError,
} from '@oddjs/odd'

export type OddContext =
  | {
      isLoading: true
      error: undefined
      session: null
      program: undefined
      isUsernameAvailable: (username: string) => Promise<boolean>
    }
  | {
      isLoading: false
      error: ProgramError
      session: null
      program: undefined
      isUsernameAvailable: (username: string) => Promise<boolean>
    }
  | {
      isLoading: false
      error: undefined
      session: Session | null
      program: Program | undefined
      isUsernameAvailable: (username: string) => Promise<boolean>
    }

export interface OddContextProviderProps {
  config: Configuration
  components?: Partial<Components>
  componentsFactory?: (config: Configuration) => Promise<Partial<Components>>
}
