import { ccc } from '@ckb-ccc/core'
import { getCotaTypeScript, getJoyIDCellDeps, getDexCellDep, MAX_FEE, JOYID_ESTIMATED_WITNESS_LOCK_SIZE } from '../constants'
import { CKBAsset, CancelParams, Hex, SubkeyUnlockReq, TakerResult } from '../types'
import { append0x } from '../utils'
import { AssetException, NoCotaCellException, NoLiveCellException } from '../exceptions'
import {
  calculateEmptyCellMinCapacity,
  calculateNFTCellCapacity,
  calculateTransactionFee,
  cleanUpUdtOutputs,
  deserializeOutPoints,
  generateSporeCoBuild,
  getAssetCellDepNew,
  isUdtAsset,
} from './helper'
import { OrderArgs } from './orderArgs'

export const buildCancelTx = async ({
  collector,
  joyID,
  seller,
  orderOutPoints,
  fee,
  ckbAsset = CKBAsset.XUDT,
}: CancelParams): Promise<TakerResult> => {
  let txFee = fee ?? MAX_FEE
  let codeHash = '0x'
  const isMainnet = seller.startsWith('ckb')
  const sellerLock = await collector.getAddressLock(seller)

  const emptyCells = await collector.getCells({ lock: sellerLock })
  if (!emptyCells || emptyCells.length === 0) {
    throw new NoLiveCellException('The address has no empty cells')
  }

  const outPoints = deserializeOutPoints(orderOutPoints)
  let orderInputsCapacity = BigInt(0)
  const orderCells: ccc.Cell[] = []

  for (const outPoint of outPoints) {
    const cell = await collector.getLiveCell(outPoint)
    if (!cell) {
      throw new AssetException('The asset cell specified by the out point has been spent')
    }
    const orderArgs = OrderArgs.fromHex(cell.cellOutput.lock.args)
    if (!orderArgs.ownerLock.eq(sellerLock)) {
      throw new AssetException('The asset cell does not belong to the seller address')
    }
    if (!cell.cellOutput.type) {
      throw new AssetException('The asset cell specified by the out point must have type script')
    }
    codeHash = cell.cellOutput.type.codeHash
    orderInputsCapacity += cell.cellOutput.capacity
    orderCells.push(cell)
  }

  const orderInputs = outPoints.map(outPoint => ccc.CellInput.from({ previousOutput: outPoint, since: 0 }))
  let outputs: ccc.CellOutput[] = []
  let outputsData: Hex[] = []
  let cellDeps: ccc.CellDepLike[] = [getDexCellDep(isMainnet)]
  let changeCapacity = BigInt(0)
  let sporeCoBuild = '0x'

  const minCellCapacity = calculateEmptyCellMinCapacity(sellerLock)
  const { inputs: emptyInputs, capacity: inputsCapacity } = collector.collectInputs(
    emptyCells,
    minCellCapacity,
    txFee,
    BigInt(0),
    'Insufficient CKB available balance to pay transaction fee',
  )
  const inputs = [...orderInputs, ...emptyInputs]

  if (isUdtAsset(ckbAsset)) {
    const { udtOutputs, udtOutputsData, sumUdtCapacity } = cleanUpUdtOutputs(orderCells, sellerLock)
    outputs = udtOutputs
    outputsData = udtOutputsData
    changeCapacity = inputsCapacity + orderInputsCapacity - sumUdtCapacity - txFee
  } else {
    let sumNftCapacity = BigInt(0)
    for (const orderCell of orderCells) {
      const minNFTCapacity = calculateNFTCellCapacity(sellerLock, orderCell)
      outputs.push(
        ccc.CellOutput.from(
          {
            lock: sellerLock,
            type: orderCell.cellOutput.type,
            capacity: minNFTCapacity,
          },
          orderCell.outputData,
        ),
      )
      sumNftCapacity += minNFTCapacity
      outputsData.push(orderCell.outputData)
    }

    if (ckbAsset === CKBAsset.SPORE) {
      sporeCoBuild = generateSporeCoBuild(orderCells, outputs)
    }
    changeCapacity = inputsCapacity + orderInputsCapacity - sumNftCapacity - txFee
  }

  outputs.push(ccc.CellOutput.from({ lock: sellerLock, capacity: changeCapacity }))
  outputsData.push('0x')

  cellDeps.push(getAssetCellDepNew(codeHash, isMainnet))
  if (joyID) {
    cellDeps.push(...(await getJoyIDCellDeps(collector.getClient())))
  }

  const emptyWitness = ccc.hexFrom(ccc.WitnessArgs.from({}).toBytes())
  const witnesses: Hex[] = inputs.map((_, index) => (index === orderInputs.length ? emptyWitness : '0x'))
  if (ckbAsset === CKBAsset.SPORE) {
    witnesses.push(sporeCoBuild)
  } else if (ckbAsset === CKBAsset.MNFT) {
    orderInputs.forEach((_, index) => {
      witnesses[index] = ccc.hexFrom(ccc.WitnessArgs.from({ lock: '0x00' }).toBytes())
    })
  }

  if (joyID && joyID.connectData.keyType === 'sub_key') {
    const pubkeyHash = ccc.hashCkbShort(joyID.connectData.pubkey)
    const req: SubkeyUnlockReq = {
      lockScript: ccc.hexFrom(sellerLock.toBytes()),
      pubkeyHash,
      algIndex: 1,
    }
    const { unlockEntry } = await joyID.aggregator.generateSubkeyUnlockSmt(req)
    witnesses[orderInputs.length] = ccc.hexFrom(
      ccc.WitnessArgs.from({
        outputType: append0x(unlockEntry),
      }).toBytes(),
    )

    const cotaType = getCotaTypeScript(isMainnet)
    const cotaCells = await collector.getCells({ lock: sellerLock, type: cotaType })
    if (!cotaCells || cotaCells.length === 0) {
      throw new NoCotaCellException("Cota cell doesn't exist")
    }
    const cotaCellDep = ccc.CellDep.from({ outPoint: cotaCells[0].outPoint, depType: 'code' })
    cellDeps = [cotaCellDep, ...cellDeps]
  }

  const tx = ccc.Transaction.from({
    version: 0,
    cellDeps,
    headerDeps: [],
    inputs,
    outputs,
    outputsData,
    witnesses,
  })

  if (txFee === MAX_FEE) {
    const txSize = tx.toBytes().length + 4 + (joyID ? JOYID_ESTIMATED_WITNESS_LOCK_SIZE : 0)
    const estimatedTxFee = calculateTransactionFee(txSize)
    txFee = estimatedTxFee
    tx.outputs[tx.outputs.length - 1].capacity += MAX_FEE - estimatedTxFee
  }

  return { rawTx: tx, txFee, witnessIndex: orderInputs.length }
}
