// DID Core identifier syntax, plus the legacy semicolon parameters accepted by
// iso-did. Keep encoded components intact for method resolvers.
const idChar = '(?:[a-zA-Z0-9._-]|%[a-fA-F0-9]{2})'
const didUrlPattern = new RegExp(
  `^did:(?<method>[a-z0-9]+):(?<id>(?:${idChar}*:)*${idChar}+)` +
    '(?<params>(?:;[a-zA-Z0-9_.:%-]+=[a-zA-Z0-9_.:%-]*)*)' +
    '(?<path>/[^?#]*)?(?:\\?(?<query>[^#]*))?(?:#(?<fragment>.*))?$'
)

/**
 * @param {string} didUrl
 * @returns {import('./types.js').ParsedDID | null}
 */
export function parseDIDURL(didUrl) {
  const match = didUrlPattern.exec(didUrl)
  if (!match?.groups) return null

  const { method, id, params, path, query, fragment } = match.groups
  /** @type {import('./types.js').ParsedDID} */
  const parsed = { did: `did:${method}:${id}`, didUrl, method, id }
  if (params) {
    parsed.params = Object.fromEntries(
      params
        .slice(1)
        .split(';')
        .map((param) => param.split('='))
    )
  }
  if (path !== undefined) parsed.path = path
  if (query !== undefined) parsed.query = query
  if (fragment !== undefined) parsed.fragment = fragment
  return parsed
}
