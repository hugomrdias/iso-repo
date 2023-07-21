import { Message } from './message.js'
import { Signature } from './signature.js'
import { getNetworkPrefix } from './utils.js'

export class RPC {
  /**
   * @param {import("./types.js").Options} options
   */
  constructor({
    api,
    token,
    network = 'mainnet',
    fetch = globalThis.fetch.bind(globalThis),
  }) {
    this.fetch = fetch
    this.api = new URL(api)
    this.network = network
    this.headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  async version() {
    return /** @type {import("./types.js").VersionResponse} */ (
      await this.call('Filecoin.Version')
    )
  }

  async networkName() {
    return /** @type {import("./types.js").StateNetworkNameResponse} */ (
      await this.call('Filecoin.StateNetworkName')
    )
  }

  /**
   * GasEstimateMessageGas estimates gas values for unset message gas fields
   *
   * @see https://lotus.filecoin.io/reference/lotus/gas/#gasestimatemessagegas
   * @param {import("./types.js").PartialMessageObj} msg
   * @param {string} maxFee - max fee to pay for gas (attoFIL/gas units)
   */
  async gasEstimate(msg, maxFee = '0') {
    this.#validateNetwork(msg.from)
    this.#validateNetwork(msg.to)

    return /** @type {import("./types.js").GasEstimateMessageGasResponse} */ (
      await this.call(
        'Filecoin.GasEstimateMessageGas',
        new Message(msg).toLotus(),
        { MaxFee: maxFee },
        // eslint-disable-next-line unicorn/no-useless-undefined
        undefined
      )
    )
  }

  /**
   * WalletBalance returns the balance of the given address at the current head of the chain.
   *
   * @see https://lotus.filecoin.io/reference/lotus/wallet/#walletbalance
   * @param {string} address
   */
  async balance(address) {
    address = this.#validateNetwork(address)
    return /** @type {import("./types.js").WalletBalanceResponse} */ (
      await this.call('Filecoin.WalletBalance', address)
    )
  }

  /**
   * MpoolGetNonce gets next nonce for the specified sender. Note that this method may not be atomic. Use MpoolPushMessage instead.
   *
   * @see https://lotus.filecoin.io/reference/lotus/mpool/#mpoolgetnonce
   * @param {string} address
   */
  async nonce(address) {
    address = this.#validateNetwork(address)
    return /** @type {import("./types.js").MpoolGetNonceResponse} */ (
      await this.call('Filecoin.MpoolGetNonce', address)
    )
  }

  /**
   * MpoolPush pushes a signed message to mempool.
   *
   * @see https://lotus.filecoin.io/reference/lotus/mpool/#mpoolpush
   * @param {import('./types.js').MessageObj} msg
   * @param {import('./types.js').SignatureObj} signature
   */
  async pushMessage(msg, signature) {
    this.#validateNetwork(msg.from)
    this.#validateNetwork(msg.to)

    return /** @type {import("./types.js").MpoolPushResponse} */ (
      await this.call('Filecoin.MpoolPush', {
        Message: new Message(msg).toLotus(),
        Signature: new Signature(signature).toLotus(),
      })
    )
  }

  /**
   * StateWaitMsg looks back in the chain for a message. If not found, it blocks until the message arrives on chain, and gets to the indicated confidence depth.
   *
   * @param {{ "/": string }} cid
   * @param {number} confidence
   * @param {number} lookBackLimit
   */
  async stateWaitMsg(cid, confidence = 2, lookBackLimit = 100) {
    return /** @type {any} */ (
      await this.call(
        'Filecoin.StateWaitMsg',
        cid,
        confidence,
        lookBackLimit,
        false
      )
    )
  }

  /**
   * Generic method to call any method on the lotus rpc api.
   *
   * @template R
   * @param {string} method
   * @param {any[]} params
   */
  async call(method, ...params) {
    try {
      const res = await this.fetch(this.api, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          method,
          params,
          id: 1,
        }),
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

        if (json.error) {
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
  }

  /**
   * @param {string} address
   */
  #validateNetwork(address) {
    const prefix = getNetworkPrefix(this.network)

    if (!address.startsWith(prefix)) {
      throw new TypeError(`Address does not belong to ${this.network}`)
    }

    return address
  }
}
