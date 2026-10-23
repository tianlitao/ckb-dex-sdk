import { ccc } from '@ckb-ccc/core'
import { Collector } from '../src/collector'
import { addressFromP256PrivateKey, keyFromP256Private } from '../src/utils'
import { Aggregator } from '../src/aggregator'
import { JoyIDConfig, JoyIDConnectData, CKBAsset } from '../src/types'
import { buildTakerTx } from '../src/order'
import { signSecp256r1Tx } from './secp256r1'
import { getUSDITypeScript } from '../src/constants'

// SECP256R1 private key
const BUYER_MAIN_PRIVATE_KEY = '0x9a6751112a424f0ea2ff9b1f416dd07b7b06897a07749f9a889aafb7b21c0869'

const taker = async () => {
  const collector = new Collector({
    ckbNodeUrl: 'https://testnet.ckb.dev/rpc',
    ckbIndexerUrl: 'https://testnet.ckb.dev/indexer',
  })
  const buyer = addressFromP256PrivateKey(BUYER_MAIN_PRIVATE_KEY)
  // ckt1qrfrwcdnvssswdwpn3s9v8fp87emat306ctjwsm3nmlkjg8qyza2cqgqqxj2f0vv9f7v9vkf8gu9q5zdcsf3gjk2lghe20tg
  console.log('buyer address: ', buyer)

  const aggregator = new Aggregator('https://cota.nervina.dev/aggregator')
  // Connection data returned by the JoyID connect flow
  const connectData: JoyIDConnectData = {
    address: buyer,
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
      txHash: '0xa4c4ccd8adb9fd9573f2d81d8a309c47298456da3d065c977aec78fd8c77a128',
      index: '0x0',
    },
  ]

  const isMainnet = buyer.startsWith('ckb')
  const usdiType = getUSDITypeScript(isMainnet)

  const { rawTx, txFee, witnessIndex } = await buildTakerTx({
    collector,
    joyID,
    buyer,
    orderOutPoints: xudtOrderOutPoints.map(outPoint => ccc.hexFrom(ccc.OutPoint.from(outPoint).toBytes())),
    ckbAsset: CKBAsset.SPORE,
    unitType: usdiType,
  })

  const key = keyFromP256Private(BUYER_MAIN_PRIVATE_KEY)
  const signedTx = signSecp256r1Tx(key, rawTx, witnessIndex)

  // The rawTx is a CCC Transaction. Sign it with the connected CCC signer in a browser app:
  // const signedTx = await signer.signTransaction(rawTx)
  let txHash = await collector.getClient().sendTransaction(signedTx, 'passthrough')
  console.info(`The taker of udt asset has been finished with tx hash: ${txHash}`)
  // 0x215de162d464e8cffbbfe5eed4f6b764b9ac1fe02089c017bb7785dc8a94b075
}

taker()
