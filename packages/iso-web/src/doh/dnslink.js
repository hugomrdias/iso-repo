import { resolve as doh } from './index.js'

const DOMAIN_PREFIX = '_dnslink.'
const TXT_PREFIX = 'dnslink='

/**
 * @typedef {import('../http.js').Errors | import('./index.js').DohError} Errors
 */

export {
  AbortError,
  DohError,
  HttpError,
  NetworkError,
  RequestError,
  RetryError,
  TimeoutError,
} from './index.js'

/**
 * Resolve dnslink records
 *
 * @see https://dnslink.dev/
 * @see https://docs.ipfs.tech/concepts/dnslink
 *
 * @param {string} domain
 * @param {import('./types.js').ResolveOptions} [options]
 */
export async function resolve(domain, options) {
  if (domain.startsWith(DOMAIN_PREFIX)) {
    domain = domain.slice(DOMAIN_PREFIX.length)
  }

  const main = await _resolve(`_dnslink.${domain}`, options)

  if (main.error || main.result.length === 0) {
    return await _resolve(domain, options)
  }

  return { result: main.result }
}

/**
 * @param {string} domain
 * @param {import('./types.js').ResolveOptions} [options]
 */
async function _resolve(domain, options) {
  const { error, result } = await doh(domain, 'TXT', options)

  if (error) {
    return { error }
  }

  return { result: parseData(result) }
}

/**
 *
 * @param {string[]} data
 */
function parseData(data) {
  const records = []
  for (let entry of data.sort().filter((e) => e.startsWith(TXT_PREFIX))) {
    entry = entry.slice(TXT_PREFIX.length)

    if (!entry.startsWith('/')) {
      continue
    }

    // https://datatracker.ietf.org/doc/html/rfc4343#section-2.1
    if (!/^[\u0020-\u007E]*$/.test(entry)) {
      continue
    }

    const parts = entry.split('/')
    let namespace

    parts.shift()

    // namespace
    if (parts.length > 0) {
      namespace = parts.shift()
    }
    if (namespace === undefined) {
      continue
    }

    // identifier
    let identifier
    if (parts.length > 0) {
      identifier = parts.join('/')
    }

    if (identifier === undefined || identifier.length === 0) {
      continue
    }

    records.push(entry)
  }

  return records
}
