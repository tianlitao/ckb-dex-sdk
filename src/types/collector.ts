import { ccc } from '@ckb-ccc/core'
import { Aggregator } from '../aggregator'
import { Collector } from '../collector'

export type IndexerCell = ccc.Cell

export interface IndexerCapacity {
  blockNumber?: bigint
  blockHash?: string
  capacity: bigint
}

export interface CollectResult {
  inputs: ccc.CellInput[]
  capacity: bigint
}

export interface CollectUdtResult extends CollectResult {
  amount: bigint
}

export interface Service {
  collector: Collector
  aggregator: Aggregator
}
