import { ccc } from '@ckb-ccc/core'
import { assembleTransferSporeAction, injectCobuild } from '@ckb-ccc/spore/advanced'
import {
  CKB_UNIT,
  getMNftDep,
  getSporeDep,
  getSudtDep,
  getXudtDep,
  getXudtTypeScript,
  getSudtTypeScript,
  getSporeTypeScript,
  getMNftTypeScript,
  getBitTypeScript,
  getBitDep,
} from '../constants'
import { append0x, remove0x } from '../utils'
import { CKBAsset, Hex, IndexerCell } from '../types'

// maker get the minimum capacity of the cell
export const extraLockCellCapacity = (lock: ccc.ScriptLike): bigint => {
  const lockArgsSize = ccc.Script.from(lock).occupiedSize - 33
  let extra = 0
  if (lockArgsSize < 22) {
    extra = 22 - lockArgsSize
  }
  return BigInt(extra) * CKB_UNIT
}

// minimum occupied capacity and 1 ckb for transaction fee
// assume UDT cell data size is 16bytes
export const calculateUdtCellCapacity = (lock: ccc.ScriptLike, udtType?: ccc.ScriptLike): bigint => {
  const output = ccc.CellOutput.from({
    lock: ccc.Script.from(lock),
    type: udtType ? ccc.Script.from(udtType) : undefined,
  })
  return BigInt(output.occupiedSize + 16) * CKB_UNIT + CKB_UNIT
}

// minimum occupied capacity and 1 ckb for transaction fee
export const calculateNFTCellCapacity = (lock: ccc.ScriptLike, cell: IndexerCell | ccc.Cell): bigint => {
  const output = ccc.CellOutput.from({
    lock: ccc.Script.from(lock),
    type: cell.cellOutput.type,
  })
  return BigInt(output.occupiedSize + ccc.bytesFrom(cell.outputData).length) * CKB_UNIT + CKB_UNIT
}

// minimum occupied capacity and 1 ckb for transaction fee
export const calculateEmptyCellMinCapacity = (lock: ccc.ScriptLike): bigint => {
  return BigInt(ccc.CellOutput.from({ lock: ccc.Script.from(lock) }).occupiedSize) * CKB_UNIT + CKB_UNIT
}

export const calculateTransactionFee = (txSize: number): bigint => {
  return (BigInt(txSize) * BigInt(2000) + BigInt(999)) / BigInt(1000)
}

export const deserializeOutPoints = (outPointHexList: Hex[]): ccc.OutPoint[] => {
  return outPointHexList.map(outPoint => ccc.OutPoint.fromBytes(outPoint))
}

export const cleanUpUdtOutputs = (orderCells: ccc.Cell[], lock: ccc.ScriptLike) => {
  const outputLock = ccc.Script.from(lock)
  const orderUdtTypes = new Map<string, { type: ccc.Script; amount: bigint }>()

  for (const cell of orderCells) {
    const type = cell.cellOutput.type
    if (!type) {
      throw new Error('The UDT order cell must have a type script')
    }
    const key = ccc.hexFrom(type.toBytes())
    const found = orderUdtTypes.get(key)
    const amount = ccc.udtBalanceFrom(cell.outputData)
    if (found) {
      found.amount += amount
    } else {
      orderUdtTypes.set(key, { type, amount })
    }
  }

  const udtOutputs: ccc.CellOutput[] = []
  const udtOutputsData: Hex[] = []
  let sumUdtCapacity = BigInt(0)

  for (const { type, amount } of orderUdtTypes.values()) {
    const capacity = calculateUdtCellCapacity(outputLock, type)
    sumUdtCapacity += capacity
    udtOutputs.push(
      ccc.CellOutput.from({
        lock: outputLock,
        type,
        capacity,
      }),
    )
    udtOutputsData.push(ccc.hexFrom(ccc.numLeToBytes(amount, 16)))
  }

  return { udtOutputs, udtOutputsData, sumUdtCapacity }
}

export const isUdtAsset = (asset: CKBAsset) => {
  return asset === CKBAsset.XUDT || asset === CKBAsset.SUDT
}

export const generateSporeCoBuild = (sporeCells: ccc.Cell[], outputCells: ccc.CellOutput[]): string => {
  if (sporeCells.length !== outputCells.length) {
    throw new Error('The length of spore input cells length and spore output cells are not same')
  }

  const actions = sporeCells.map((sporeCell, index) => assembleTransferSporeAction(sporeCell.cellOutput, outputCells[index]))
  const tx = ccc.Transaction.default()
  injectCobuild(tx, actions)
  return tx.witnesses[0]
}

export const getAssetCellDep = (asset: CKBAsset, isMainnet: boolean): ccc.CellDepLike => {
  switch (asset) {
    case CKBAsset.XUDT:
      return getXudtDep(isMainnet)
    case CKBAsset.SUDT:
      return getSudtDep(isMainnet)
    case CKBAsset.SPORE:
      return getSporeDep(isMainnet)
    case CKBAsset.MNFT:
      return getMNftDep(isMainnet)
    default:
      return getXudtDep(isMainnet)
  }
}

export const getAssetCellDepNew = (codeHash: string, isMainnet: boolean): ccc.CellDepLike => {
  switch (codeHash) {
    case getXudtTypeScript(isMainnet).codeHash:
      return getXudtDep(isMainnet)
    case getSudtTypeScript(isMainnet).codeHash:
      return getSudtDep(isMainnet)
    case getSporeTypeScript(isMainnet).codeHash:
      return getSporeDep(isMainnet)
    case getMNftTypeScript(isMainnet).codeHash:
      return getMNftDep(isMainnet)
    case getBitTypeScript(isMainnet).codeHash:
      return getBitDep(isMainnet)
    default:
      return getXudtDep(isMainnet)
  }
}
