import { ccc } from '@ckb-ccc/core'
import { IndexerCell, CollectResult, IndexerCapacity, CollectUdtResult } from '../types/collector'
import { MIN_CAPACITY } from '../constants'
import { CapacityNotEnoughException, IndexerException, UdtAmountNotEnoughException } from '../exceptions'

export type CollectorNetwork = 'mainnet' | 'testnet'

export interface CollectorOptions {
  ckbNodeUrl?: string
  ckbIndexerUrl?: string
  network?: CollectorNetwork
  client?: ccc.Client
}

const normalizePublicUrl = (url: string): string => {
  return url.replace(/\/$/, '').replace(/\/(rpc|indexer)$/, '') + '/'
}

export class Collector {
  private ckbNodeUrl?: string
  private ckbIndexerUrl?: string
  private readonly clientInstance: ccc.Client
  private readonly clientOwner?: { dispose: () => Promise<void> }

  constructor({ ckbNodeUrl, ckbIndexerUrl, network, client }: CollectorOptions) {
    this.ckbNodeUrl = ckbNodeUrl
    this.ckbIndexerUrl = ckbIndexerUrl

    if (client) {
      this.clientInstance = client
      return
    }

    const sourceUrl = ckbNodeUrl ?? ckbIndexerUrl
    if (!sourceUrl) {
      throw new Error('Collector requires ckbNodeUrl, ckbIndexerUrl, or a CCC client')
    }

    const urls: [string, ...string[]] = [normalizePublicUrl(sourceUrl)]
    const detectedNetwork = network ?? (urls[0].toLowerCase().includes('mainnet') ? 'mainnet' : 'testnet')
    // Public endpoints can be slow on indexer queries (e.g. known-script dep resolution);
    // raise the per-request timeout from CCC's 30s default.
    const owner =
      detectedNetwork === 'mainnet'
        ? ccc.ClientPublicMainnet.open({ urls, timeout: 60_000 })
        : ccc.ClientPublicTestnet.open({ urls, timeout: 60_000 })

    this.clientInstance = owner.value
    this.clientOwner = owner
  }

  getClient(): ccc.Client {
    return this.clientInstance
  }

  /**
   * @deprecated Use getClient() and CCC APIs instead.
   */
  getCkb(): ccc.Client {
    return this.getClient()
  }

  async getAddressLock(address: string): Promise<ccc.Script> {
    return (await ccc.Address.fromString(address, this.getClient())).script
  }

  async getCells({ lock, type }: { lock?: ccc.ScriptLike; type?: ccc.ScriptLike }): Promise<IndexerCell[] | undefined> {
    if (!lock && !type) {
      throw new IndexerException('Either lock or type must be provided')
    }

    const cells: ccc.Cell[] = []
    const searchKey = lock
      ? {
          script: ccc.Script.from(lock),
          scriptType: 'lock' as const,
          scriptSearchMode: 'exact' as const,
          filter: type
            ? { script: ccc.Script.from(type) }
            : {
                scriptLenRange: [0, 1] as [number, number],
                outputDataLenRange: [0, 1] as [number, number],
              },
          withData: true,
        }
      : {
          script: ccc.Script.from(type!),
          scriptType: 'type' as const,
          scriptSearchMode: 'exact' as const,
          withData: true,
        }

    for await (const cell of this.clientInstance.findCells(searchKey, 'asc', 1000)) {
      cells.push(cell)
    }

    return cells.length === 0 ? undefined : cells
  }

  async getCapacity(lock: ccc.ScriptLike): Promise<IndexerCapacity | undefined> {
    try {
      const capacity = await this.clientInstance.getCellsCapacity({
        script: ccc.Script.from(lock),
        scriptType: 'lock',
        scriptSearchMode: 'exact',
      })
      return { capacity }
    } catch (error) {
      console.error(error)
      throw new IndexerException('Get cells capacity error')
    }
  }

  collectInputs(liveCells: IndexerCell[], needCapacity: bigint, fee: bigint, minCapacity?: bigint, errMsg?: string): CollectResult {
    const changeCapacity = minCapacity ?? MIN_CAPACITY
    const inputs: ccc.CellInput[] = []
    let sum = BigInt(0)

    for (const cell of liveCells) {
      inputs.push(ccc.CellInput.from(cell))
      sum += cell.cellOutput.capacity
      if (sum >= needCapacity + changeCapacity + fee) {
        break
      }
    }

    if (sum < needCapacity + changeCapacity + fee) {
      throw new CapacityNotEnoughException(errMsg ?? 'Insufficient free CKB balance')
    }

    return { inputs, capacity: sum }
  }

  collectUdtInputs(liveCells: IndexerCell[], needAmount: bigint): CollectUdtResult {
    const inputs: ccc.CellInput[] = []
    let sumCapacity = BigInt(0)
    let sumAmount = BigInt(0)

    for (const cell of liveCells) {
      inputs.push(ccc.CellInput.from(cell))
      sumCapacity += cell.cellOutput.capacity
      sumAmount += ccc.udtBalanceFrom(cell.outputData)
      if (sumAmount >= needAmount) {
        break
      }
    }

    if (sumAmount < needAmount) {
      throw new UdtAmountNotEnoughException('Insufficient UDT balance')
    }

    return { inputs, capacity: sumCapacity, amount: sumAmount }
  }

  async getLiveCell(outPoint: ccc.OutPointLike | ccc.OutPoint): Promise<ccc.Cell | undefined> {
    return this.clientInstance.getCellLive(ccc.OutPoint.from(outPoint), true)
  }

  async close(): Promise<void> {
    await this.clientOwner?.dispose()
  }
}
