import { anySignal } from 'iso-web/signals'
import { Message } from './message.js'
import { Signature } from './signature.js'
import { getNetworkPrefix } from './utils.js'

export class RPC {
  /**
   * @param {import("./types.js").Options} options
   * @param {import('./types.js').FetchOptions} [fetchOptions]
   */
  constructor(
    {
      api,
      token,
      network = 'mainnet',
      fetch = globalThis.fetch.bind(globalThis),
    },
    fetchOptions = {}
  ) {
    this.fetch = fetch
    this.api = new URL(api)
    this.network = network
    this.headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }

    this.fetchOptions = fetchOptions
  }

  /**
   * Version returns the version of the Filecoin node.
   *
   * @param {import('./types.js').FetchOptions} [fetchOptions]
   */
  async version(fetchOptions = {}) {
    return /** @type {import('./types.js').VersionResponse} */ (
      await this.call({ method: 'Filecoin.Version' }, fetchOptions)
    )
  }

  /**
   * NetworkName returns the name of the network the node is synced to.
   *
   * @param {import('./types.js').FetchOptions} [fetchOptions]
   * @returns
   */
  async networkName(fetchOptions = {}) {
    return /** @type {import("./types.js").StateNetworkNameResponse} */ (
      await this.call({ method: 'Filecoin.StateNetworkName' }, fetchOptions)
    )
  }

  /**
   * GasEstimateMessageGas estimates gas values for unset message gas fields
   *
   * @see https://lotus.filecoin.io/reference/lotus/gas/#gasestimatemessagegas
   *
   * @param {import('./types.js').GasEstimateParams} params
   * @param {import('./types.js').FetchOptions} [fetchOptions]
   */
  async gasEstimate(params, fetchOptions = {}) {
    this.#validateNetwork(params.msg.from)
    this.#validateNetwork(params.msg.to)

    return /** @type {import("./types.js").GasEstimateMessageGasResponse} */ (
      await this.call(
        {
          method: 'Filecoin.GasEstimateMessageGas',
          params: [
            new Message(params.msg).toLotus(),
            { MaxFee: params.maxFee ?? '0' },
            undefined,
          ],
        },
        fetchOptions
      )
    )
  }

  /**
   * WalletBalance returns the balance of the given address at the current head of the chain.
   *
   * @see https://lotus.filecoin.io/reference/lotus/wallet/#walletbalance
   *
   * @param {string} address
   * @param {import('./types.js').FetchOptions} [fetchOptions]
   */
  async balance(address, fetchOptions = {}) {
    address = this.#validateNetwork(address)
    return /** @type {import("./types.js").WalletBalanceResponse} */ (
      await this.call(
        { method: 'Filecoin.WalletBalance', params: [address] },
        fetchOptions
      )
    )
  }

  /**
   * MpoolGetNonce gets next nonce for the specified sender. Note that this method may not be atomic. Use MpoolPushMessage instead.
   *
   * @see https://lotus.filecoin.io/reference/lotus/mpool/#mpoolgetnonce
   * @param {string} address
   * @param {import('./types.js').FetchOptions} [fetchOptions]
   */
  async nonce(address, fetchOptions = {}) {
    address = this.#validateNetwork(address)
    return /** @type {import("./types.js").MpoolGetNonceResponse} */ (
      await this.call(
        { method: 'Filecoin.MpoolGetNonce', params: [address] },
        fetchOptions
      )
    )
  }

  /**
   * MpoolPush pushes a signed message to mempool.
   *
   * @see https://lotus.filecoin.io/reference/lotus/mpool/#mpoolpush
   *
   * @param {import('./types.js').PushMessageParams} params
   * @param {import('./types.js').FetchOptions} [fetchOptions]
   */
  async pushMessage(params, fetchOptions = {}) {
    this.#validateNetwork(params.msg.from)
    this.#validateNetwork(params.msg.to)

    return /** @type {import("./types.js").MpoolPushResponse} */ (
      await this.call(
        {
          method: 'Filecoin.MpoolPush',
          params: [
            {
              Message: new Message(params.msg).toLotus(),
              Signature: new Signature(params.signature).toLotus(),
            },
          ],
        },
        fetchOptions
      )
    )
  }

  /**
   * StateWaitMsg looks back in the chain for a message. If not found, it blocks until the message arrives on chain, and gets to the indicated confidence depth.
   *
   * Timeout is increased to 60s instead of the default 5s.
   *
   * @see https://lotus.filecoin.io/reference/lotus/state/#statewaitmsg
   * @param {import('./types.js').waitMsgParams} params
   * @param {import('./types.js').FetchOptions} [fetchOptions]
   */
  async waitMsg(params, fetchOptions = {}) {
    return /** @type {import('./types.js').WaitMsgResponse} */ (
      await this.call(
        {
          method: 'Filecoin.StateWaitMsg',
          params: [
            params.cid,
            params.confidence ?? 2,
            params.lookback ?? 100,
            false,
          ],
        },
        { timeout: 60_000, ...fetchOptions }
      )
    )
  }

  /**
   * Generic method to call any method on the lotus rpc api.
   *
   * @template R
   * @param {import('./types.js').RpcOptions} rpcOptions
   * @param {import('./types.js').FetchOptions} [fetchOptions]
   * @returns {Promise<R | import('./types.js').RpcError>}
   */

  async call(rpcOptions, fetchOptions = {}) {
    const opts = {
      ...this.fetchOptions,
      ...fetchOptions,
    }
    try {
      const res = await this.fetch(this.api, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: rpcOptions.method,
          params: rpcOptions.params,
          id: 1,
        }),
        signal: anySignal([
          opts.signal,
          AbortSignal.timeout(opts.timeout ?? 5000),
        ]),
      })

      if (res.ok) {
        const json = await res.json()
        // eslint-disable-next-line unicorn/prefer-ternary
        if (json.result === undefined) {
          return /** @type {import("./types.js").RpcError} */ ({
            error: {
              code: json.error.code,
              message: 'RPC_ERROR: ' + json.error.message,
            },
          })
        } else {
          return /** @type {R} */ ({ result: json.result })
        }
      } else {
        const text = await res.text()
        let json
        try {
          json = JSON.parse(text)
        } catch {}

        if (json && json.error) {
          return /** @type {import("./types.js").RpcError} */ ({
            error: {
              code: json.error.code,
              message: 'RPC_ERROR: ' + json.error.message,
            },
          })
        }
        if (!json || !json.error) {
          return /** @type {import("./types.js").RpcError} */ ({
            error: {
              code: res.status,
              message: `HTTP_ERROR: ${res.statusText} ${
                text ? `- ${text}` : ``
              }`,
            },
          })
        }
      }
    } catch (error) {
      const err = /** @type {Error} */ (error)
      return /** @type {import("./types.js").RpcError} */ ({
        error: {
          code: 0,
          message: `FETCH_ERROR: ${err.message}`,
        },
      })
    }

    return /** @type {import("./types.js").RpcError} */ ({
      error: {
        code: 0,
        message: `ERROR: unknown error`,
      },
    })
  }

  /**
   * @param {string} address
   */
  #validateNetwork(address) {
    const prefix = getNetworkPrefix(this.network)

    if (!address.startsWith(prefix)) {
      throw new TypeError(
        `Address ${address} does not belong to ${this.network}`
      )
    }

    return address
  }
}
