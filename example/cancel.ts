import { ccc } from '@ckb-ccc/core'
import { Collector } from '../src/collector'
import { addressFromP256PrivateKey, keyFromP256Private } from '../src/utils'
import { Aggregator } from '../src/aggregator'
import { JoyIDConfig, JoyIDConnectData } from '../src/types'
import { buildCancelTx } from '../src/order'
import { signSecp256r1Tx } from './secp256r1'

// SECP256R1 private key
const SELLER_MAIN_PRIVATE_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001'

const cancel = async () => {
  const collector = new Collector({
    ckbNodeUrl: 'https://testnet.ckb.dev/rpc',
    ckbIndexerUrl: 'https://testnet.ckb.dev/indexer',
  })
  const seller = addressFromP256PrivateKey(SELLER_MAIN_PRIVATE_KEY)
  // ckt1qrfrwcdnvssswdwpn3s9v8fp87emat306ctjwsm3nmlkjg8qyza2cqgqq98mx5lm42zd7mwyq54pg49cln850mj2957np7az
  console.log('seller address: ', seller)

  const aggregator = new Aggregator('https://cota.nervina.dev/aggregator')
  // Connection data returned by the JoyID connect flow
  const connectData: JoyIDConnectData = {
    address: seller,
    ethAddress: '',
    nostrPubkey: '',
    pubkey: '',
    keyType: 'main_key',
    alg: -7,
  }
  // JoyID metadata is only needed for JoyID sub-key witnesses
  const joyID: JoyIDConfig = {
    aggregator,
    connectData,
  }

  const xudtOrderOutPoints: ccc.OutPointLike[] = [
    {
      txHash: '0x835a283e8371c1e55db27e0e09bf468175b047268ca82609e74ef6ee9e81403c',
      index: '0x0',
    },
    {
      txHash: '0x48d64acadc78709ac2de78c88ec3cd015c5d1cb02a0afa986d408b30e82a2eb6',
      index: '0x0',
    },
  ]

  const { rawTx, txFee, witnessIndex } = await buildCancelTx({
    collector,
    joyID,
    seller,
    orderOutPoints: xudtOrderOutPoints.map(outPoint => ccc.hexFrom(ccc.OutPoint.from(outPoint).toBytes())),
  })

  const key = keyFromP256Private(SELLER_MAIN_PRIVATE_KEY)
  const signedTx = signSecp256r1Tx(key, rawTx, witnessIndex)

  // The rawTx is a CCC Transaction. Sign it with the connected CCC signer in a browser app:
  // const signedTx = await signer.signTransaction(rawTx)

  let txHash = await collector.getClient().sendTransaction(signedTx, 'passthrough')
  console.info(`The udt asset has been cancelled with tx hash: ${txHash}`)
}

cancel()
