import { ccc } from '@ckb-ccc/core'
import { Aggregator } from '../aggregator'
import { Collector } from '../collector'
import { Address, Hex, Bytes } from './common'

export interface JoyIDConnectData {
  address: string
  ethAddress?: string
  nostrPubkey?: string
  pubkey: string
  keyType: 'main_key' | 'sub_key' | string
  alg?: number
}

export interface JoyIDConfig {
  aggregator: Aggregator
  connectData: JoyIDConnectData
}

export enum CKBAsset {
  XUDT,
  SUDT,
  SPORE,
  MNFT,
}

interface BaseParams {
  collector: Collector
  fee?: bigint
  joyID?: JoyIDConfig
  ckbAsset?: CKBAsset
}

export interface MakerParams extends BaseParams {
  seller: Address
  // Unit is shannon for CKB native token
  totalValue: bigint
  // The UDT amount to list and it's optional for NFT asset
  listAmount?: bigint
  // The deserialized string of UDT and NFT(spore NFT, mNFT, CoTA NFT, etc.) type script
  assetType: Hex
  // Payment in XUDT
  unitType?: Address
}

export interface MakerResult {
  rawTx: ccc.Transaction
  // The capacity(shannon) for packaging the order cell
  listPackage: bigint
  // Unit is shannon
  txFee: bigint
  // The position of WitnessArgs in witnesses for lock script to sign transaction
  witnessIndex?: number
}

export interface TakerParams extends BaseParams {
  orderOutPoints: Hex[]
  buyer: Address
  platform?: Address
  platformFee?: number
  platformCell?: { txHash: Bytes; index: Bytes; capacity: bigint }
  unitType?: ccc.ScriptLike
}

export interface TakerResult {
  rawTx: ccc.Transaction
  // Unit is shannon
  txFee: bigint
  // The position of WitnessArgs in witnesses for lock script to sign transaction
  witnessIndex?: number
}

export interface CancelParams extends BaseParams {
  orderOutPoints: Hex[]
  seller: Address
}

export interface CancelResult {
  rawTx: ccc.Transaction
  // Unit is shannon
  txFee: bigint
  // The position of WitnessArgs in witnesses for lock script to sign transaction
  witnessIndex?: number
}
