import assert from 'assert'
import { DIDCore } from '../src/core.js'

describe('did', function () {
  it(`should parse from string`, function () {
    const did = DIDCore.fromString(
      'did:example:21tDAKCERh95uGgKbJNHYp;service=agent;foo:bar=high/some/path?foo=bar#key1'
    )

    assert.equal(did.did, 'did:example:21tDAKCERh95uGgKbJNHYp')
    assert.equal(
      did.didUrl,
      'did:example:21tDAKCERh95uGgKbJNHYp;service=agent;foo:bar=high/some/path?foo=bar#key1'
    )
    assert.equal(did.method, 'example')
    assert.equal(did.id, '21tDAKCERh95uGgKbJNHYp')
    assert.equal(did.path, '/some/path')
    assert.equal(did.fragment, 'key1')
    assert.equal(did.query, 'foo=bar')
    assert.deepStrictEqual(did.params, {
      service: 'agent',
      'foo:bar': 'high',
    })
  })
})
