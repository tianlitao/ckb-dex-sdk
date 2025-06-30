import { addressToScript, blake160, getTransactionSize, serializeScript, serializeWitnessArgs } from '@nervosnetwork/ckb-sdk-utils'
import {
  getCotaTypeScript,
  getJoyIDCellDep,
  getDexCellDep,
  MAX_FEE,
  JOYID_ESTIMATED_WITNESS_LOCK_SIZE,
  CKB_UNIT,
  getAnyOneCanPayCellDep,
  getUSDICellDep,
} from '../constants'
import { CKBAsset, Hex, SubkeyUnlockReq, TakerParams, TakerResult } from '../types'
import { append0x, u128ToLe } from '../utils'
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
import { CKBTransaction } from '@joyid/ckb'
import { calculateNFTMakerListPackage } from './maker'
import { ANYONE_CAN_PAY_MAINNET } from '@nervosnetwork/ckb-sdk-utils/lib/systemScripts'

export const setPlatformFeeOutputs = (feeLock: CKBComponents.Script, sumSellerCapacity: bigint, platformFee: number, capacity: bigint) => {
  const feeOutputs: CKBComponents.CellOutput[] = []
  const feeOutputsData: Hex[] = []
  const platformFeeBigInt = BigInt(Math.floor(platformFee * 100))

  let payFeeCapacity = (sumSellerCapacity * platformFeeBigInt) / BigInt(10000)
  // if(payFeeCapacity < MIN_CAPACITY){
  //   payFeeCapacity = MIN_CAPACITY
  // }
  payFeeCapacity += capacity
  const output: CKBComponents.CellOutput = {
    lock: feeLock,
    capacity: append0x(payFeeCapacity.toString(16)),
  }
  feeOutputs.push(output)
  feeOutputsData.push('0x')
  return { feeOutputs, feeOutputsData, payFeeCapacity }
}

export const matchOrderOutputs = (orderCells: CKBComponents.LiveCell[], unitType?: CKBComponents.Script) => {
  const sellerOutputs: CKBComponents.CellOutput[] = []
  const sellerOutputsData: Hex[] = []
  let sumSellerCapacity = BigInt(0)

  for (const orderCell of orderCells) {
    const orderArgs = OrderArgs.fromHex(orderCell.output.lock.args)
    if (unitType != null) {
      if (orderArgs.unitTypeHash != null) {
        const capacity = calculateUdtCellCapacity(orderArgs.ownerLock, unitType!)
        sumSellerCapacity += capacity
        const output: CKBComponents.CellOutput = {
          lock: orderArgs.ownerLock,
          type: unitType!,
          capacity: append0x(capacity.toString(16)),
        }
        sellerOutputs.push(output)
        sellerOutputsData.push(append0x(u128ToLe(orderArgs.totalValue)))
      } else {
        throw new AssetException('The order must be payed by ckb')
      }
    } else {
      if (orderArgs.unitTypeHash != null) {
        throw new AssetException('The order must be payed by xudt')
      }
      sumSellerCapacity += orderArgs.totalValue
      const payCapacity = orderArgs.totalValue + BigInt(append0x(orderCell.output.capacity))
      const output: CKBComponents.CellOutput = {
        lock: orderArgs.ownerLock,
        capacity: append0x(payCapacity.toString(16)),
      }
      sellerOutputs.push(output)
      sellerOutputsData.push('0x')
    }
  }
  return { sellerOutputs, sellerOutputsData, sumSellerCapacity }
}

export const matchNftOrderCells = (orderCells: CKBComponents.LiveCell[], buyerLock: CKBComponents.Script, unitType?: CKBComponents.Script) => {
  let dexOutputs: CKBComponents.CellOutput[] = []
  let dexOutputsData: Hex[] = []
  let makerNetworkFee = BigInt(0)
  let dexOutputsCapacity = BigInt(0)
  const buyerOutputs: CKBComponents.CellOutput[] = []
  const buyerOutputsData: Hex[] = []

  for (const orderCell of orderCells) {
    const orderArgs = OrderArgs.fromHex(orderCell.output.lock.args)
    if (unitType != null) {
      const capacity = calculateUdtCellCapacity(orderArgs.ownerLock, unitType!)
      dexOutputsCapacity += capacity
      const output: CKBComponents.CellOutput = {
        lock: orderArgs.ownerLock,
        type: unitType!,
        capacity: append0x(capacity.toString(16)),
      }

      dexOutputs.push(output)
      dexOutputsData.push(append0x(u128ToLe(orderArgs.totalValue)))
  
      makerNetworkFee += calculateNFTMakerListPackage(orderArgs.ownerLock, orderArgs.unitTypeHash!)
    } else {
      dexOutputsCapacity += orderArgs.totalValue
      const output: CKBComponents.CellOutput = {
        lock: orderArgs.ownerLock,
        capacity: append0x(orderArgs.totalValue.toString(16)),
      }
      dexOutputs.push(output)
      dexOutputsData.push('0x')
  
      makerNetworkFee += calculateNFTMakerListPackage(orderArgs.ownerLock)
    }
    const buyerNftCapacity = calculateNFTCellCapacity(buyerLock, orderCell)
    buyerOutputs.push({
      lock: buyerLock,
      type: orderCell.output.type,
      capacity: `0x${buyerNftCapacity.toString(16)}`,
    })
    buyerOutputsData.push(orderCell.data?.content!)
  }
  dexOutputs = dexOutputs.concat(buyerOutputs)
  dexOutputsData = dexOutputsData.concat(buyerOutputsData)

  return { dexOutputs, dexOutputsData, makerNetworkFee, dexOutputsCapacity }
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
  const buyerLock = addressToScript(buyer)

  const emptyCells = await collector.getCells({
    lock: buyerLock,
  })
  if (!emptyCells || emptyCells.length === 0) {
    throw new NoLiveCellException('The address has no empty cells')
  }

  // Deserialize outPointHex array to outPoint array
  const outPoints = deserializeOutPoints(orderOutPoints)

  // Fetch udt order cells with outPoints
  const orderCells: CKBComponents.LiveCell[] = []
  for await (const outPoint of outPoints) {
    const cell = await collector.getLiveCell(outPoint)
    if (!cell) {
      throw new AssetException('The udt cell specified by the out point has been spent')
    }
    if (!cell.output.type || !cell.data) {
      throw new AssetException('The udt cell specified by the out point must have type script')
    }
    codeHash = cell.output.type!.codeHash
    orderCells.push(cell)
  }
  const orderInputs: CKBComponents.CellInput[] = outPoints.map(outPoint => ({
    previousOutput: outPoint,
    since: '0x0',
  }))

  let inputs: CKBComponents.CellInput[] = []
  let outputs: CKBComponents.CellOutput[] = []
  let outputsData: Hex[] = []
  let cellDeps: CKBComponents.CellDep[] = [getDexCellDep(isMainnet), getAnyOneCanPayCellDep(isMainnet)]
  let changeCapacity = BigInt(0)
  let sporeCoBuild = '0x'
  let anyOneInputs: CKBComponents.CellInput[] = []

  if (isUdtAsset(ckbAsset)) {
    const { sellerOutputs, sellerOutputsData, sumSellerCapacity } = matchOrderOutputs(orderCells, unitType)
    const { udtOutputs, udtOutputsData, sumUdtCapacity } = cleanUpUdtOutputs(orderCells, buyerLock)

    let needInputsCapacity = sumSellerCapacity + sumUdtCapacity
    outputs = [...sellerOutputs, ...udtOutputs]
    outputsData = [...sellerOutputsData, ...udtOutputsData]

    if (platform) {
      const platformLock = addressToScript(platform)
      const { feeOutputs, feeOutputsData, payFeeCapacity } = setPlatformFeeOutputs(
        platformLock,
        sumSellerCapacity,
        platformFee!,
        platformCell!['capacity'],
      )
      needInputsCapacity += payFeeCapacity
      outputs = [...outputs, ...feeOutputs]
      outputsData = [...outputsData, ...feeOutputsData]
    }

    const minCellCapacity = calculateEmptyCellMinCapacity(buyerLock)
    const needCKB = ((needInputsCapacity + minCellCapacity + CKB_UNIT) / CKB_UNIT).toString()
    const errMsg = `At least ${needCKB} free CKB is required to take the order.`
    const { inputs: emptyInputs, capacity: inputsCapacity } = collector.collectInputs(
      emptyCells,
      needInputsCapacity,
      txFee,
      minCellCapacity,
      errMsg,
    )
    if (platform) {
      anyOneInputs.push({
        previousOutput: { txHash: platformCell!['txHash'], index: platformCell!['index'] },
        since: '0x0',
      })
      inputs = [...orderInputs, ...anyOneInputs, ...emptyInputs]
    } else {
      inputs = [...orderInputs, ...emptyInputs]
    }

    let inputXudtCapacity = BigInt(0)
    let outputXudtCapacity = BigInt(0)
    if (unitType != null) {
      const xudtCells = await collector.getCells({
        lock: buyerLock,
        type: unitType,
      })

      if (!xudtCells || xudtCells.length === 0) {
        throw new NoLiveCellException('The address has no xudt cells')
      }

      let totalValue = BigInt(0)

      for (const orderCell of orderCells) {
        const orderArgs = OrderArgs.fromHex(orderCell.output.lock.args)
        if (orderArgs.unitTypeHash != null) {
          totalValue += orderArgs.totalValue
        } else {
          throw new AssetException('The order must be payed by xudt')
        }
      }
      const { inputs: xudtInputs, capacity: sumCapacity, amount: sumAmount } = collector.collectUdtInputs(xudtCells!, totalValue)
      inputs.push(...xudtInputs)
      inputXudtCapacity = sumCapacity

      const chagneXudt = sumAmount - totalValue
      const capacity = calculateUdtCellCapacity(buyerLock, unitType!)
      const changeXudtOutput: CKBComponents.CellOutput = {
        lock: buyerLock,
        capacity: append0x(capacity.toString(16)),
        type: unitType!
      }
      outputs.push(changeXudtOutput)
      outputsData.push(append0x(u128ToLe(chagneXudt)))
      outputXudtCapacity = capacity
    }

    changeCapacity = inputsCapacity + inputXudtCapacity - needInputsCapacity - txFee - outputXudtCapacity
    const changeOutput: CKBComponents.CellOutput = {
      lock: buyerLock,
      capacity: append0x(changeCapacity.toString(16)),
    }

    outputs.push(changeOutput)
    outputsData.push('0x')
  } else {
    const { dexOutputs, dexOutputsData, makerNetworkFee, dexOutputsCapacity } = matchNftOrderCells(orderCells, buyerLock, unitType)

    outputs = dexOutputs
    outputsData = dexOutputsData

    const minCellCapacity = calculateEmptyCellMinCapacity(buyerLock)
    const needCKB = ((dexOutputsCapacity + minCellCapacity + CKB_UNIT) / CKB_UNIT).toString()
    const errMsg = `At least ${needCKB} free CKB is required to take the order.`
    const { inputs: emptyInputs, capacity: inputsCapacity } = collector.collectInputs(
      emptyCells,
      dexOutputsCapacity,
      txFee,
      minCellCapacity,
      errMsg,
    )
    inputs = [...orderInputs, ...emptyInputs]

    if (ckbAsset === CKBAsset.SPORE) {
      const sporeOutputs = dexOutputs.slice(orderCells.length)
      sporeCoBuild = generateSporeCoBuild(orderCells, sporeOutputs)
    }

    let inputXudtCapacity = BigInt(0)
    let outputXudtCapacity = BigInt(0)
    if (unitType != null) {
      const xudtCells = await collector.getCells({
        lock: buyerLock,
        type: unitType!,
      })

      if (!xudtCells || xudtCells.length === 0) {
        throw new NoLiveCellException('The address has no xudt cells')
      }

      let totalValue = BigInt(0)

      for (const orderCell of orderCells) {
        const orderArgs = OrderArgs.fromHex(orderCell.output.lock.args)
        if (orderArgs.unitTypeHash != null) {
          totalValue += orderArgs.totalValue
        } else {
          throw new AssetException('The order must be payed by xudt')
        }
      }
      const { inputs: xudtInputs, capacity: sumCapacity, amount: sumAmount } = collector.collectUdtInputs(xudtCells!, totalValue)
      inputs.push(...xudtInputs)
      inputXudtCapacity = sumCapacity

      const changeXudt = sumAmount - totalValue
      const capacity = calculateUdtCellCapacity(buyerLock, unitType!)
      const changeXudtOutput: CKBComponents.CellOutput = {
        lock: buyerLock,
        capacity: append0x(capacity.toString(16)),
        type: unitType!
      }
      outputs.push(changeXudtOutput)
      outputsData.push(append0x(u128ToLe(changeXudt)))
      outputXudtCapacity = capacity
    }

    changeCapacity = inputsCapacity + makerNetworkFee + inputXudtCapacity - dexOutputsCapacity - txFee - outputXudtCapacity
    const changeOutput: CKBComponents.CellOutput = {
      lock: buyerLock,
      capacity: append0x(changeCapacity.toString(16)),
    }

    outputs.push(changeOutput)
    outputsData.push('0x')
  }

  if (unitType != null) {
    cellDeps.push(getUSDICellDep(isMainnet))
  }
  cellDeps.push(getAssetCellDepNew(codeHash, isMainnet))
  if (joyID) {
    cellDeps.push(getJoyIDCellDep(isMainnet))
  }

  const emptyWitness = { lock: '', inputType: '', outputType: '' }
  const witnesses = inputs.map((_, index) =>
    index === orderInputs.length + anyOneInputs.length ? serializeWitnessArgs(emptyWitness) : '0x',
  )
  if (ckbAsset === CKBAsset.SPORE) {
    witnesses.push(sporeCoBuild)
  } else if (ckbAsset === CKBAsset.MNFT) {
    // MNFT must not be held and transferred by anyone-can-pay lock
    orderInputs.forEach((_, index) => {
      witnesses[index] = serializeWitnessArgs({ lock: '0x00', inputType: '', outputType: '' })
    })
  }
  if (joyID && joyID.connectData.keyType === 'sub_key') {
    const pubkeyHash = append0x(blake160(append0x(joyID.connectData.pubkey), 'hex'))
    const req: SubkeyUnlockReq = {
      lockScript: serializeScript(buyerLock),
      pubkeyHash,
      algIndex: 1, // secp256r1
    }
    const { unlockEntry } = await joyID.aggregator.generateSubkeyUnlockSmt(req)
    const emptyWitness = {
      lock: '',
      inputType: '',
      outputType: append0x(unlockEntry),
    }
    witnesses[orderInputs.length] = serializeWitnessArgs(emptyWitness)

    const cotaType = getCotaTypeScript(isMainnet)
    const cotaCells = await collector.getCells({ lock: buyerLock, type: cotaType })
    if (!cotaCells || cotaCells.length === 0) {
      throw new NoCotaCellException("Cota cell doesn't exist")
    }
    const cotaCell = cotaCells[0]
    const cotaCellDep: CKBComponents.CellDep = {
      outPoint: cotaCell.outPoint,
      depType: 'code',
    }
    cellDeps = [cotaCellDep, ...cellDeps]
  }

  const tx: CKBComponents.RawTransaction = {
    version: '0x0',
    cellDeps,
    headerDeps: [],
    inputs,
    outputs,
    outputsData,
    witnesses,
  }

  if (txFee === MAX_FEE) {
    const txSize = getTransactionSize(tx) + (joyID ? JOYID_ESTIMATED_WITNESS_LOCK_SIZE : 0)
    const estimatedTxFee = calculateTransactionFee(txSize)
    txFee = estimatedTxFee
    const estimatedChangeCapacity = changeCapacity + (MAX_FEE - estimatedTxFee)
    tx.outputs[tx.outputs.length - 1].capacity = append0x(estimatedChangeCapacity.toString(16))
  }

  return { rawTx: tx as CKBTransaction, txFee, witnessIndex: orderInputs.length + anyOneInputs.length }
}
