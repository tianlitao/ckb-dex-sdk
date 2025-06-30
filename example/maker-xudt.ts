import { serializeScript, scriptToHash } from '@nervosnetwork/ckb-sdk-utils'
import { Collector } from '../src/collector'
import { addressFromP256PrivateKey, append0x, keyFromP256Private } from '../src/utils'
import { Aggregator } from '../src/aggregator'
import { ConnectResponseData } from '@joyid/ckb'
import { CKBAsset, JoyIDConfig } from '../src/types'
import { buildMakerTx } from '../src/order'
import { signSecp256r1Tx } from './secp256r1'
import { getUSDITypeScript } from '../src/constants'

// SECP256R1 private key
const SELLER_MAIN_PRIVATE_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001'

const maker = async () => {
  const collector = new Collector({
    ckbNodeUrl: 'https://testnet.ckb.dev/rpc',
    ckbIndexerUrl: 'https://testnet.ckb.dev/indexer',
  })
  const seller = addressFromP256PrivateKey(SELLER_MAIN_PRIVATE_KEY)
  // ckt1qrfrwcdnvssswdwpn3s9v8fp87emat306ctjwsm3nmlkjg8qyza2cqgqq8chsyjhhlw7qjs35jlsjxjjav4ejfcdpsxpm4ln
  console.log('seller address: ', seller)

  const isMainnet = seller.startsWith('ckb')

  const aggregator = new Aggregator('https://cota.nervina.dev/aggregator')
  // The connectData is the response of the connect with @joyid/ckb
  const connectData: ConnectResponseData = {
    address: seller,
    ethAddress: '',
    nostrPubkey: '',
    pubkey: '',
    keyType: 'main_key',
    alg: -7,
  }
  // The JoyIDConfig is needed if the dapps use JoyID Wallet to connect and sign ckb transaction
  const joyID: JoyIDConfig = {
    aggregator,
    connectData,
  }

  const listAmount = BigInt(500_0000_0000)
  const totalValue = BigInt(120_000_000)
  const dobType: CKBComponents.Script = {
    codeHash: '0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d',
    hashType: 'data1',
    args: '0xa6a0d0a19a896962e98cb7e26fd851fb979093d24b2c4c2bd575612f98ccc6fe',
  }
  const usdiType = getUSDITypeScript(isMainnet)

  const { rawTx, listPackage, txFee } = await buildMakerTx({
    collector,
    joyID,
    seller,
    // The UDT amount to list and it's optional for NFT asset
    listAmount,
    // The price is usdi
    totalValue,
    assetType: append0x(serializeScript(dobType)),
    ckbAsset: CKBAsset.SPORE,
    unitType: scriptToHash(usdiType)
  })

  const key = keyFromP256Private(SELLER_MAIN_PRIVATE_KEY)
  const signedTx = signSecp256r1Tx(key, rawTx)

  // You can call the `signRawTransaction` method to sign the raw tx with JoyID wallet through @joyid/ckb SDK
  // please make sure the seller address is the JoyID wallet ckb address
  // const signedTx = await signRawTransaction(rawTx as CKBTransaction, seller)

  // 0xde752fb3318d1079542cf7fa33a3f28c58f30d142cfca9db6e10273df1ef3c8a
  let txHash = await collector.getCkb().rpc.sendTransaction(signedTx, 'passthrough')
  console.info(`The udt asset has been listed with tx hash: ${txHash}`)
}

maker()
