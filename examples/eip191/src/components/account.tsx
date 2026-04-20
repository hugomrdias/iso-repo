import { DID } from 'iso-did'
import { MemoryDriver } from 'iso-kv/drivers/memory.js'
import { EdDSASigner } from 'iso-signatures/signers/eddsa.js'
import { EIP191Signer, type Provider } from 'iso-signatures/signers/eip191.js'
import * as EdDSA from 'iso-signatures/verifiers/eddsa.js'
import * as EIP191 from 'iso-signatures/verifiers/eip191.js'
import { Resolver } from 'iso-signatures/verifiers/resolver.js'
import { Capability } from 'iso-ucan/capability'
import type { Delegation } from 'iso-ucan/delegation'
import { Invocation } from 'iso-ucan/invocation'
import { Store } from 'iso-ucan/store'
import { useCallback, useEffect, useState } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { z } from 'zod/v4'

const audience = 'did:key:z6MkmJceVoQSHs45cReEXoLtWm1wosCG8RLxfKwhxoqzoTkC'

const agent = await EdDSASigner.import(
  'gCYA//n3JI0gzjSa+w2RvMVDgO8M1a9iCaJjjM+n3PB4ZQ=='
)

export const resolver = new Resolver({
  ...EdDSA.verifier,
  ...EIP191.verifier,
})
export const store = new Store(new MemoryDriver())
export const CapAccountCreate = Capability.from({
  schema: z.object({
    type: z.string(),
    properties: z
      .object({
        name: z.string(),
      })
      .strict(),
  }),
  cmd: '/account/create',
})

export const CapAccount = Capability.from({
  schema: z
    .object({
      name: z.string(),
    })
    .strict(),
  cmd: '/account',
})

export function Account() {
  const { connector } = useAccount()
  const { disconnect } = useDisconnect()
  const [signer, setSigner] = useState<EIP191Signer | null>(null)
  const [delegation, setDelegation] = useState<Delegation | null>(null)

  useEffect(() => {
    ;(async () => {
      if (connector && 'getProvider' in connector) {
        const provider = (await connector.getProvider()) as Provider
        const signer = await EIP191Signer.from({ provider })
        setSigner(signer)
      }
    })()
  }, [connector])

  const delegate = useCallback(async () => {
    if (!signer) return

    const delegation = await CapAccount.delegate({
      iss: signer,
      aud: agent.did,
      sub: signer.did,
      pol: [],
      store,
    })

    await store.add([delegation])
    setDelegation(delegation)
  }, [signer])

  const invoke = useCallback(async () => {
    if (!signer) return

    const aud = await DID.fromString(audience)

    const invocation = await CapAccount.invoke({
      iss: agent,
      aud: aud.did,
      sub: signer.did,
      store,
      verifierResolver: resolver,
      args: {
        name: 'hello',
      },
    })

    console.log('🚀 ~ Account ~ invocation:', invocation)

    const inv = await Invocation.from({
      bytes: invocation.bytes,
      audience: aud,
      verifierResolver: resolver,
      resolveProof: (cid) => store.resolveProof(cid),
    })

    console.log('🚀 ~ Account ~ inv:', inv)
  }, [signer])

  return (
    <div>
      {signer && <div>{signer.did}</div>}
      <button onClick={() => disconnect()} type="button">
        Disconnect
      </button>
      <button onClick={() => delegate()} type="button">
        Delegate
      </button>
      <button onClick={() => invoke()} type="button">
        Invoke
      </button>
      <div>
        <textarea
          style={{
            marginTop: '1rem',
            width: '100%',
            height: '400px',
            fontFamily: 'monospace',
            fontSize: '12px',
          }}
          value={JSON.stringify(delegation ?? {}, null, 2)}
        />
      </div>
    </div>
  )
}
