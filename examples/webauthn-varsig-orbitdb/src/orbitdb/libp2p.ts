import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { autoNAT } from '@libp2p/autonat'
import { bootstrap } from '@libp2p/bootstrap'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { dcutr } from '@libp2p/dcutr'
import { identify, identifyPush } from '@libp2p/identify'
import { ping } from '@libp2p/ping'
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
import { webRTC, webRTCDirect } from '@libp2p/webrtc'
import { webSockets } from '@libp2p/websockets'
import { concat } from 'iso-webauthn-varsig'
import { createLibp2p } from 'libp2p'

const RELAY_BOOTSTRAP_ADDR_PROD =
  import.meta.env.VITE_RELAY_BOOTSTRAP_ADDR_PROD ||
  '/dns4/159-69-119-82.k51qzi5uqu5dmesgnxu1wjx2r2rk797fre6yxj284fqhcn2dekq3mar5sz63jx.libp2p.direct/tcp/4002/wss/p2p/12D3KooWSdmKqDDpRftU2ayyGH66svXd3P6zuyH7cMyFV1iXRR4p'
const PUBSUB_TOPICS = (
  import.meta.env.VITE_PUBSUB_TOPICS || 'todo._peer-discovery._p2p._pubsub'
)
  .split(',')
  .map((topic: string) => topic.trim())
const RELAY_BOOTSTRAP_ADDR = (
  import.meta.env.VITE_RELAY_BOOTSTRAP_ADDR || RELAY_BOOTSTRAP_ADDR_PROD
)
  .split(',')
  .map((addr: string) => addr.trim())

export async function readStream(stream: {
  source: AsyncIterable<Uint8Array>
}) {
  const chunks: Uint8Array[] = []
  for await (const chunk of stream.source as AsyncIterable<unknown>) {
    if (chunk instanceof Uint8Array) {
      chunks.push(chunk)
      continue
    }
    const maybe = chunk as {
      toUint8Array?: () => Uint8Array
      subarray?: () => Uint8Array
      length?: number
    }
    if (typeof maybe?.toUint8Array === 'function') {
      chunks.push(maybe.toUint8Array())
      continue
    }
    if (typeof maybe?.subarray === 'function') {
      chunks.push(maybe.subarray())
      continue
    }
    if (typeof maybe?.length === 'number') {
      chunks.push(Uint8Array.from(maybe as ArrayLike<number>))
    }
  }
  return concat(chunks)
}

export function createLibp2pNode() {
  return createLibp2p({
    addresses: {
      listen: ['/p2p-circuit', '/webrtc'],
    },
    transports: [
      webSockets(),
      webRTCDirect({
        rtcConfiguration: {
          iceServers: [
            {
              urls: [
                'stun:stun.l.google.com:19302',
                'stun:global.stun.twilio.com:3478',
              ],
            },
          ],
        },
      }),
      webRTC({
        rtcConfiguration: {
          iceServers: [
            {
              urls: [
                'stun:stun.l.google.com:19302',
                'stun:global.stun.twilio.com:3478',
              ],
            },
          ],
        },
      }),
      circuitRelayTransport({
        reservationCompletionTimeout: 20000,
      }),
    ],
    connectionEncrypters: [noise()],
    connectionGater: {
      denyDialMultiaddr: () => false,
    },
    connectionManager: {
      inboundStreamProtocolNegotiationTimeout: 10000,
      inboundUpgradeTimeout: 10000,
      outboundStreamProtocolNegotiationTimeout: 10000,
      outboundUpgradeTimeout: 10000,
    },
    streamMuxers: [yamux()],
    peerDiscovery: [
      pubsubPeerDiscovery({
        interval: 3000,
        topics: PUBSUB_TOPICS,
        listenOnly: false,
      }),
    ],
    services: {
      identify: identify(),
      identifyPush: identifyPush(),
      pubsub: gossipsub({
        emitSelf: false,
        allowPublishToZeroTopicPeers: true,
      }),
      ping: ping(),
      bootstrap: bootstrap({ list: RELAY_BOOTSTRAP_ADDR }),
      autonat: autoNAT(),
      dcutr: dcutr(),
    },
  })
}
