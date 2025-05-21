import assert from 'assert'
import { resolve as resolveDid } from '../src/index.js'

describe('did pkh ', () => {
  it('should fail with not found', async () => {
    const did = await resolveDid(
      'did:pkh:eip155:1:0xb9c5714089478a327f09197987f16f9e5d936e8a'
    )

    assert.deepStrictEqual(did, {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security#blockchainAccountId',
        'https://identity.foundation/EcdsaSecp256k1RecoverySignature2020#EcdsaSecp256k1RecoveryMethod2020',
      ],
      id: 'did:pkh:eip155:1:0xb9c5714089478a327f09197987f16f9e5d936e8a',
      verificationMethod: [
        {
          id: 'did:pkh:eip155:1:0xb9c5714089478a327f09197987f16f9e5d936e8a#blockchainAccountId',
          type: 'EcdsaSecp256k1RecoveryMethod2020',
          controller:
            'did:pkh:eip155:1:0xb9c5714089478a327f09197987f16f9e5d936e8a',
          blockchainAccountId:
            'eip155:1:0xb9c5714089478a327f09197987f16f9e5d936e8a',
        },
      ],
      authentication: [
        'did:pkh:eip155:1:0xb9c5714089478a327f09197987f16f9e5d936e8a#blockchainAccountId',
      ],
      assertionMethod: [
        'did:pkh:eip155:1:0xb9c5714089478a327f09197987f16f9e5d936e8a#blockchainAccountId',
      ],
      capabilityDelegation: [
        'did:pkh:eip155:1:0xb9c5714089478a327f09197987f16f9e5d936e8a#blockchainAccountId',
      ],
      capabilityInvocation: [
        'did:pkh:eip155:1:0xb9c5714089478a327f09197987f16f9e5d936e8a#blockchainAccountId',
      ],
    })
  })
})
