import { ccc } from '@ckb-ccc/core'
import {
  getCotaTypeScript,
  getJoyIDCellDeps,
  getDexCellDep,
  MAX_FEE,
  JOYID_ESTIMATED_WITNESS_LOCK_SIZE,
  CKB_UNIT,
  getAnyOneCanPayCellDep,
  getUSDICellDep,
} from '../constants'
import { CKBAsset, Hex, SubkeyUnlockReq, TakerParams, TakerResult } from '../types'
import { append0x } from '../utils'
import { AssetException, NoCotaCellException, NoLiveCellException } from '../exceptions'
import {
  calculateEmptyCellMinCapacity,
  calculateTransactionFee,
  deserializeOutPoints,
  cleanUpUdtOutputs,
  isUdtAsset,
  calculateNFTCellCapacity,
  generateSporeCoBuild,
  getAssetCellDepNew,
  calculateUdtCellCapacity,
} from './helper'
import { OrderArgs } from './orderArgs'

export const setPlatformFeeOutputs = (feeLock: ccc.ScriptLike, sumSellerCapacity: bigint, platformFee: number, capacity: bigint) => {
  const feeOutputs: ccc.CellOutput[] = []
  const feeOutputsData: Hex[] = []
  const platformFeeBigInt = BigInt(Math.floor(platformFee * 100))

  let payFeeCapacity = (sumSellerCapacity * platformFeeBigInt) / BigInt(10000)
  payFeeCapacity += capacity
  feeOutputs.push(ccc.CellOutput.from({ lock: ccc.Script.from(feeLock), capacity: payFeeCapacity }))
  feeOutputsData.push('0x')
  return { feeOutputs, feeOutputsData, payFeeCapacity }
}

export const matchOrderOutputs = (orderCells: ccc.Cell[], unitType?: ccc.ScriptLike) => {
  const sellerOutputs: ccc.CellOutput[] = []
  const sellerOutputsData: Hex[] = []
  let sumSellerCapacity = BigInt(0)
  const paymentType = unitType ? ccc.Script.from(unitType) : undefined

  for (const orderCell of orderCells) {
    const orderArgs = OrderArgs.fromHex(orderCell.cellOutput.lock.args)
    if (paymentType) {
      if (orderArgs.unitTypeHash == null) {
        throw new AssetException('The order must be payed by ckb')
      }
      const capacity = calculateUdtCellCapacity(orderArgs.ownerLock, paymentType)
      sumSellerCapacity += capacity
      sellerOutputs.push(
        ccc.CellOutput.from({
          lock: orderArgs.ownerLock,
          type: paymentType,
          capacity,
        }),
      )
      sellerOutputsData.push(ccc.hexFrom(ccc.numLeToBytes(orderArgs.totalValue, 16)))
    } else {
      if (orderArgs.unitTypeHash != null) {
        throw new AssetException('The order must be payed by xudt')
      }
      sumSellerCapacity += orderArgs.totalValue
      sellerOutputs.push(
        ccc.CellOutput.from({
          lock: orderArgs.ownerLock,
          capacity: orderArgs.totalValue + orderCell.cellOutput.capacity,
        }),
      )
      sellerOutputsData.push('0x')
    }
  }
  return { sellerOutputs, sellerOutputsData, sumSellerCapacity }
}

export const matchNftOrderCells = (orderCells: ccc.Cell[], buyerLock: ccc.ScriptLike, unitType?: ccc.ScriptLike) => {
  const dexOutputs: ccc.CellOutput[] = []
  const dexOutputsData: Hex[] = []
  let makerNetworkFee = BigInt(0)
  let dexOutputsCapacity = BigInt(0)
  const buyerOutputs: ccc.CellOutput[] = []
  const buyerOutputsData: Hex[] = []
  const resolvedBuyerLock = ccc.Script.from(buyerLock)
  const paymentType = unitType ? ccc.Script.from(unitType) : undefined

  for (const orderCell of orderCells) {
    const orderArgs = OrderArgs.fromHex(orderCell.cellOutput.lock.args)
    const buyerNftCapacity = calculateNFTCellCapacity(resolvedBuyerLock, orderCell)

    if (paymentType) {
      const capacity = calculateUdtCellCapacity(orderArgs.ownerLock, paymentType)
      dexOutputsCapacity += capacity
      dexOutputs.push(
        ccc.CellOutput.from({
          lock: orderArgs.ownerLock,
          type: paymentType,
          capacity,
        }),
      )
      dexOutputsData.push(ccc.hexFrom(ccc.numLeToBytes(orderArgs.totalValue, 16)))
    } else {
      dexOutputsCapacity += orderArgs.totalValue
      dexOutputs.push(ccc.CellOutput.from({ lock: orderArgs.ownerLock, capacity: orderArgs.totalValue }))
      dexOutputsData.push('0x')
    }

    makerNetworkFee += orderCell.cellOutput.capacity - buyerNftCapacity
    buyerOutputs.push(
      ccc.CellOutput.from(
        {
          lock: resolvedBuyerLock,
          type: orderCell.cellOutput.type,
          capacity: buyerNftCapacity,
        },
        orderCell.outputData,
      ),
    )
    buyerOutputsData.push(orderCell.outputData)
  }

  return {
    dexOutputs: [...dexOutputs, ...buyerOutputs],
    dexOutputsData: [...dexOutputsData, ...buyerOutputsData],
    makerNetworkFee,
    dexOutputsCapacity,
  }
}

export const buildTakerTx = async ({
  collector,
  joyID,
  buyer,
  orderOutPoints,
  fee,
  ckbAsset = CKBAsset.XUDT,
  platform,
  platformFee,
  platformCell,
  unitType,
}: TakerParams): Promise<TakerResult> => {
  let txFee = fee ?? MAX_FEE
  let codeHash = '0x'
  const isMainnet = buyer.startsWith('ckb')
  const buyerLock = await collector.getAddressLock(buyer)

  const emptyCells = await collector.getCells({ lock: buyerLock })
  if (!emptyCells || emptyCells.length === 0) {
    throw new NoLiveCellException('The address has no empty cells')
  }

  const outPoints = deserializeOutPoints(orderOutPoints)
  const orderCells: ccc.Cell[] = []
  for (const outPoint of outPoints) {
    const cell = await collector.getLiveCell(outPoint)
    if (!cell) {
      throw new AssetException('The udt cell specified by the out point has been spent')
    }
    if (!cell.cellOutput.type) {
      throw new AssetException('The udt cell specified by the out point must have type script')
    }
    codeHash = cell.cellOutput.type.codeHash
    orderCells.push(cell)
  }

  const orderInputs = outPoints.map(outPoint => ccc.CellInput.from({ previousOutput: outPoint, since: 0 }))
  let inputs: ccc.CellInput[] = []
  let outputs: ccc.CellOutput[] = []
  let outputsData: Hex[] = []
  let cellDeps: ccc.CellDepLike[] = [getDexCellDep(isMainnet), getAnyOneCanPayCellDep(isMainnet)]
  let changeCapacity = BigInt(0)
  let sporeCoBuild = '0x'
  const anyOneInputs: ccc.CellInput[] = []
  const paymentType = unitType ? ccc.Script.from(unitType) : undefined

  if (isUdtAsset(ckbAsset)) {
    const { sellerOutputs, sellerOutputsData, sumSellerCapacity } = matchOrderOutputs(orderCells, paymentType)
    const { udtOutputs, udtOutputsData, sumUdtCapacity } = cleanUpUdtOutputs(orderCells, buyerLock)

    let needInputsCapacity = sumSellerCapacity + sumUdtCapacity
    outputs = [...sellerOutputs, ...udtOutputs]
    outputsData = [...sellerOutputsData, ...udtOutputsData]

    if (platform) {
      if (platformFee == null || !platformCell) {
        throw new AssetException('platformFee and platformCell are required when platform is set')
      }
      const platformLock = await collector.getAddressLock(platform)
      const { feeOutputs, feeOutputsData, payFeeCapacity } = setPlatformFeeOutputs(
        platformLock,
        sumSellerCapacity,
        platformFee,
        platformCell.capacity,
      )
      needInputsCapacity += payFeeCapacity
      outputs = [...outputs, ...feeOutputs]
      outputsData = [...outputsData, ...feeOutputsData]
    }

    const minCellCapacity = calculateEmptyCellMinCapacity(buyerLock)
    const needCKB = ((needInputsCapacity + minCellCapacity + CKB_UNIT) / CKB_UNIT).toString()
    const { inputs: emptyInputs, capacity: inputsCapacity } = collector.collectInputs(
      emptyCells,
      needInputsCapacity,
      txFee,
      minCellCapacity,
      `At least ${needCKB} free CKB is required to take the order.`,
    )

    if (platform && platformCell) {
      anyOneInputs.push(ccc.CellInput.from({ previousOutput: platformCell, since: 0 }))
      inputs = [...orderInputs, ...anyOneInputs, ...emptyInputs]
    } else {
      inputs = [...orderInputs, ...emptyInputs]
    }

    let inputXudtCapacity = BigInt(0)
    let outputXudtCapacity = BigInt(0)
    if (paymentType) {
      const xudtCells = await collector.getCells({ lock: buyerLock, type: paymentType })
      if (!xudtCells || xudtCells.length === 0) {
        throw new NoLiveCellException('The address has no xudt cells')
      }

      let totalValue = BigInt(0)
      for (const orderCell of orderCells) {
        const orderArgs = OrderArgs.fromHex(orderCell.cellOutput.lock.args)
        if (orderArgs.unitTypeHash == null) {
          throw new AssetException('The order must be payed by xudt')
        }
        totalValue += orderArgs.totalValue
      }

      const { inputs: xudtInputs, capacity: sumCapacity, amount: sumAmount } = collector.collectUdtInputs(xudtCells, totalValue)
      inputs.push(...xudtInputs)
      inputXudtCapacity = sumCapacity

      const changeXudt = sumAmount - totalValue
      const capacity = calculateUdtCellCapacity(buyerLock, paymentType)
      outputs.push(ccc.CellOutput.from({ lock: buyerLock, type: paymentType, capacity }))
      outputsData.push(ccc.hexFrom(ccc.numLeToBytes(changeXudt, 16)))
      outputXudtCapacity = capacity
    }

    changeCapacity = inputsCapacity + inputXudtCapacity - needInputsCapacity - txFee - outputXudtCapacity
    outputs.push(ccc.CellOutput.from({ lock: buyerLock, capacity: changeCapacity }))
    outputsData.push('0x')
  } else {
    const { dexOutputs, dexOutputsData, makerNetworkFee, dexOutputsCapacity } = matchNftOrderCells(orderCells, buyerLock, paymentType)
    outputs = dexOutputs
    outputsData = dexOutputsData

    const minCellCapacity = calculateEmptyCellMinCapacity(buyerLock)
    const needCKB = ((dexOutputsCapacity + minCellCapacity + CKB_UNIT) / CKB_UNIT).toString()
    const { inputs: emptyInputs, capacity: inputsCapacity } = collector.collectInputs(
      emptyCells,
      dexOutputsCapacity,
      txFee,
      minCellCapacity,
      `At least ${needCKB} free CKB is required to take the order.`,
    )
    inputs = [...orderInputs, ...emptyInputs]

    if (ckbAsset === CKBAsset.SPORE) {
      const sporeOutputs = dexOutputs.slice(orderCells.length)
      sporeCoBuild = generateSporeCoBuild(orderCells, sporeOutputs)
    }

    let inputXudtCapacity = BigInt(0)
    let outputXudtCapacity = BigInt(0)
    if (paymentType) {
      const xudtCells = await collector.getCells({ lock: buyerLock, type: paymentType })
      if (!xudtCells || xudtCells.length === 0) {
        throw new NoLiveCellException('The address has no xudt cells')
      }

      let totalValue = BigInt(0)
      for (const orderCell of orderCells) {
        const orderArgs = OrderArgs.fromHex(orderCell.cellOutput.lock.args)
        if (orderArgs.unitTypeHash == null) {
          throw new AssetException('The order must be payed by xudt')
        }
        totalValue += orderArgs.totalValue
      }

      const { inputs: xudtInputs, capacity: sumCapacity, amount: sumAmount } = collector.collectUdtInputs(xudtCells, totalValue)
      inputs.push(...xudtInputs)
      inputXudtCapacity = sumCapacity

      const changeXudt = sumAmount - totalValue
      const capacity = calculateUdtCellCapacity(buyerLock, paymentType)
      outputs.push(ccc.CellOutput.from({ lock: buyerLock, type: paymentType, capacity }))
      outputsData.push(ccc.hexFrom(ccc.numLeToBytes(changeXudt, 16)))
      outputXudtCapacity = capacity
    }

    changeCapacity = inputsCapacity + makerNetworkFee + inputXudtCapacity - dexOutputsCapacity - txFee - outputXudtCapacity
    outputs.push(ccc.CellOutput.from({ lock: buyerLock, capacity: changeCapacity }))
    outputsData.push('0x')
  }

  if (paymentType) {
    cellDeps.push(getUSDICellDep(isMainnet))
  }
  cellDeps.push(getAssetCellDepNew(codeHash, isMainnet))
  if (joyID) {
    cellDeps.push(...(await getJoyIDCellDeps(collector.getClient())))
  }

  const emptyWitness = ccc.hexFrom(ccc.WitnessArgs.from({}).toBytes())
  const witnesses: Hex[] = inputs.map((_, index) => (index === orderInputs.length + anyOneInputs.length ? emptyWitness : '0x'))
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
      lockScript: ccc.hexFrom(buyerLock.toBytes()),
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
    const cotaCells = await collector.getCells({ lock: buyerLock, type: cotaType })
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

  return { rawTx: tx, txFee, witnessIndex: orderInputs.length + anyOneInputs.length }
}
