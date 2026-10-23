import { ccc } from '@ckb-ccc/core'
import { Collector } from '../src/collector'
import { addressFromP256PrivateKey, append0x, keyFromP256Private } from '../src/utils'
import { Aggregator } from '../src/aggregator'
import { CKBAsset, JoyIDConfig, JoyIDConnectData } from '../src/types'
import { buildMakerTx } from '../src/order'
import { signSecp256r1Tx } from './secp256r1'
import { calculateNFTMakerListPackage } from '../src/order/maker'

// SECP256R1 private key
const SELLER_MAIN_PRIVATE_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001'

const maker = async () => {
  const collector = new Collector({
    ckbNodeUrl: 'https://testnet.ckb.dev/rpc',
    ckbIndexerUrl: 'https://testnet.ckb.dev/indexer',
  })
  const seller = addressFromP256PrivateKey(SELLER_MAIN_PRIVATE_KEY)
  // ckt1qrfrwcdnvssswdwpn3s9v8fp87emat306ctjwsm3nmlkjg8qyza2cqgqq98mx5lm42zd7mwyq54pg49cln850mj2957np7az
  // ckt1qrfrwcdnvssswdwpn3s9v8fp87emat306ctjwsm3nmlkjg8qyza2cqgqqxqyukftmpfang0z2ks6w6syjutass94fujlf09a
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

  // The difference between the capacity occupied by the owner lock and the seller lock and the result may be negative
  const listPackage = await calculateNFTMakerListPackage(seller, undefined, collector.getClient())

  const totalValue = BigInt(800_0000_0000) + listPackage
  const mNftType: ccc.ScriptLike = {
    codeHash: '0xb1837b5ad01a88558731953062d1f5cb547adf89ece01e8934a9f0aeed2d959f',
    hashType: 'type',
    args: '0x3939ecec56db8161b6308c84d6f5f9f12d00d1f00000000100000006',
  }

  const { rawTx, txFee } = await buildMakerTx({
    collector,
    joyID,
    seller,
    // The price whose unit is shannon for CKB native token
    totalValue,
    assetType: append0x(ccc.hexFrom(ccc.Script.from(mNftType).toBytes())),
    ckbAsset: CKBAsset.MNFT,
  })

  const key = keyFromP256Private(SELLER_MAIN_PRIVATE_KEY)
  const signedTx = signSecp256r1Tx(key, rawTx)

  // The rawTx is a CCC Transaction. Sign it with the connected CCC signer in a browser app:
  // const signedTx = await signer.signTransaction(rawTx)

  let txHash = await collector.getClient().sendTransaction(signedTx, 'passthrough')
  console.info(`The mNFT asset has been listed with tx hash: ${txHash}`)
}

maker()
