import { ccc } from '@ckb-ccc/core'
import { getDexLockScript, getCotaTypeScript, getJoyIDCellDeps, MAX_FEE, JOYID_ESTIMATED_WITNESS_LOCK_SIZE, CKB_UNIT } from '../constants'
import { Hex, SubkeyUnlockReq, MakerParams, MakerResult, CKBAsset, Address } from '../types'
import { append0x } from '../utils'
import { AssetException, NoCotaCellException, NoLiveCellException, NFTException } from '../exceptions'
import {
  calculateEmptyCellMinCapacity,
  calculateNFTCellCapacity,
  calculateTransactionFee,
  calculateUdtCellCapacity,
  generateSporeCoBuild,
  getAssetCellDepNew,
  isUdtAsset,
  extraLockCellCapacity,
} from './helper'
import { OrderArgs } from './orderArgs'

// The difference between the capacity occupied by the owner lock and the seller lock and the result may be negative
export const calculateNFTMakerListPackage = async (
  seller: string | ccc.ScriptLike,
  unitType?: Address,
  client?: ccc.Client,
): Promise<bigint> => {
  if (typeof seller === 'string' && !client) {
    throw new Error('A CCC client is required when seller is an address string')
  }
  const sellerLock =
    typeof seller === 'string' ? await ccc.Address.fromString(seller, client!).then(address => address.script) : ccc.Script.from(seller)

  // The setup and totalValue are only used as a placeholder and does not affect the final size calculation.
  let setup = 4
  if (unitType != null) {
    setup = setup | 0b0000_0010
  }
  const orderArgs = new OrderArgs(sellerLock, setup, BigInt(0), unitType)
  const orderArgsSize = ccc.bytesFrom(orderArgs.toHex()).length

  return BigInt(orderArgsSize - ccc.bytesFrom(sellerLock.args).length) * CKB_UNIT
}

export const calculateUDTMakerListPackage = (seller: ccc.ScriptLike, assetType?: Hex | ccc.ScriptLike, unitType?: Address): bigint => {
  const sellerLock = ccc.Script.from(seller)

  // The setup and totalValue are only used as a placeholder and does not affect the final size calculation.
  let setup = 4
  if (unitType != null) {
    setup = setup | 0b0000_0010
  }
  const orderArgs = new OrderArgs(sellerLock, setup, BigInt(0), unitType)
  const orderLock = ccc.Script.from({
    ...getDexLockScript(false),
    args: orderArgs.toHex(),
  })
  const typeScript = typeof assetType === 'string' ? ccc.Script.fromBytes(assetType) : assetType ? ccc.Script.from(assetType) : undefined

  return calculateUdtCellCapacity(orderLock, typeScript)
}

export const buildMakerTx = async ({
  collector,
  joyID,
  seller,
  listAmount = BigInt(0),
  totalValue,
  assetType,
  fee,
  ckbAsset = CKBAsset.XUDT,
  unitType,
}: MakerParams): Promise<MakerResult> => {
  let txFee = fee ?? MAX_FEE
  const client = collector.getClient()
  const isMainnet = seller.startsWith('ckb')
  const sellerLock = await collector.getAddressLock(seller)
  const assetTypeScript = ccc.Script.fromBytes(assetType)

  const emptyCells = await collector.getCells({ lock: sellerLock })
  if (!emptyCells || emptyCells.length === 0) {
    throw new NoLiveCellException('The address has no empty cells')
  }

  let setup = isUdtAsset(ckbAsset) ? 0 : 0b0000_0100
  if (unitType != null) {
    setup = setup | 0b0000_0010
  }
  const orderArgs = new OrderArgs(sellerLock, setup, totalValue, unitType)
  const orderLock = ccc.Script.from({
    ...getDexLockScript(isMainnet),
    args: orderArgs.toHex(),
  })
  const minCellCapacity = calculateEmptyCellMinCapacity(sellerLock)

  let inputs: ccc.CellInput[] = []
  let outputs: ccc.CellOutput[] = []
  let outputsData: Hex[] = []
  let cellDeps: ccc.CellDepLike[] = []
  let changeCapacity = BigInt(0)
  let orderCellCapacity = BigInt(0)
  let sporeCoBuild = '0x'

  if (isUdtAsset(ckbAsset)) {
    const udtCells = await collector.getCells({ lock: sellerLock, type: assetTypeScript })
    if (!udtCells || udtCells.length === 0) {
      throw new AssetException('The address has no UDT cells')
    }
    const { inputs: udtInputs, capacity: sumInputsCapacity, amount: inputsAmount } = collector.collectUdtInputs(udtCells, listAmount)

    orderCellCapacity = calculateUdtCellCapacity(orderLock, assetTypeScript)
    const udtCellCapacity = calculateUdtCellCapacity(sellerLock, assetTypeScript)
    let totalInputCapacity = sumInputsCapacity
    if (sumInputsCapacity < orderCellCapacity + udtCellCapacity + minCellCapacity + txFee) {
      const needCKB = ((orderCellCapacity + minCellCapacity + CKB_UNIT) / CKB_UNIT).toString()
      const errMsg = `At least ${needCKB} free CKB (refundable) is required to place a sell order.`
      const { inputs: emptyInputs, capacity: emptyInputsCapacity } = collector.collectInputs(
        emptyCells,
        orderCellCapacity,
        txFee,
        minCellCapacity,
        errMsg,
      )
      inputs = [...emptyInputs, ...udtInputs]
      totalInputCapacity += emptyInputsCapacity
    } else {
      inputs = udtInputs
    }

    outputs.push(
      ccc.CellOutput.from({
        lock: orderLock,
        type: assetTypeScript,
        capacity: orderCellCapacity,
      }),
    )
    outputsData.push(ccc.hexFrom(ccc.numLeToBytes(listAmount, 16)))

    changeCapacity = totalInputCapacity - orderCellCapacity - txFee
    if (inputsAmount > listAmount) {
      changeCapacity -= udtCellCapacity
      outputs.push(
        ccc.CellOutput.from({
          lock: sellerLock,
          type: assetTypeScript,
          capacity: udtCellCapacity,
        }),
      )
      outputsData.push(ccc.hexFrom(ccc.numLeToBytes(inputsAmount - listAmount, 16)))
    }
    outputs.push(ccc.CellOutput.from({ lock: sellerLock, capacity: changeCapacity }))
    outputsData.push('0x')
  } else {
    const nftCells = await collector.getCells({ lock: sellerLock, type: assetTypeScript })
    if (!nftCells || nftCells.length === 0) {
      throw new NFTException('The address has no NFT cells')
    }
    const nftCell = nftCells[0]
    orderCellCapacity = calculateNFTCellCapacity(orderLock, nftCell)
    orderCellCapacity += extraLockCellCapacity(sellerLock)
    const orderNeedCapacity = orderCellCapacity > nftCell.cellOutput.capacity ? orderCellCapacity - nftCell.cellOutput.capacity : BigInt(0)

    const needCKB = ((orderNeedCapacity + minCellCapacity + CKB_UNIT) / CKB_UNIT).toString()
    const errMsg = `At least ${needCKB} free CKB (refundable) is required to place a sell order.`
    const { inputs: emptyInputs, capacity: emptyInputsCapacity } = collector.collectInputs(
      emptyCells,
      orderNeedCapacity,
      txFee,
      minCellCapacity,
      errMsg,
    )
    inputs = [...emptyInputs, ccc.CellInput.from(nftCell)]

    const orderOutput = ccc.CellOutput.from(
      {
        lock: orderLock,
        capacity: orderCellCapacity,
        type: nftCell.cellOutput.type,
      },
      nftCell.outputData,
    )
    outputs.push(orderOutput)
    outputsData.push(nftCell.outputData)

    changeCapacity = emptyInputsCapacity + nftCell.cellOutput.capacity - orderCellCapacity - txFee
    outputs.push(ccc.CellOutput.from({ lock: sellerLock, capacity: changeCapacity }))
    outputsData.push('0x')

    if (ckbAsset === CKBAsset.SPORE) {
      sporeCoBuild = generateSporeCoBuild([nftCell], [orderOutput])
    }
  }

  cellDeps.push(getAssetCellDepNew(assetTypeScript.codeHash, isMainnet))
  if (joyID) {
    cellDeps.push(...(await getJoyIDCellDeps(collector.getClient())))
  }

  const emptyWitness = ccc.hexFrom(ccc.WitnessArgs.from({}).toBytes())
  const witnesses: Hex[] = inputs.map((_, index) => (index === 0 ? emptyWitness : '0x'))
  if (ckbAsset === CKBAsset.SPORE) {
    witnesses.push(sporeCoBuild)
  }

  if (joyID && joyID.connectData.keyType === 'sub_key') {
    const pubkeyHash = ccc.hashCkbShort(joyID.connectData.pubkey)
    const req: SubkeyUnlockReq = {
      lockScript: ccc.hexFrom(sellerLock.toBytes()),
      pubkeyHash,
      algIndex: 1,
    }
    const { unlockEntry } = await joyID.aggregator.generateSubkeyUnlockSmt(req)
    witnesses[0] = ccc.hexFrom(
      ccc.WitnessArgs.from({
        outputType: append0x(unlockEntry),
      }).toBytes(),
    )

    const cotaType = getCotaTypeScript(isMainnet)
    const cotaCells = await collector.getCells({ lock: sellerLock, type: cotaType })
    if (!cotaCells || cotaCells.length === 0) {
      throw new NoCotaCellException("Cota cell doesn't exist")
    }
    const cotaCellDep = ccc.CellDep.from({
      outPoint: cotaCells[0].outPoint,
      depType: 'code',
    })
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

  const listPackage = isUdtAsset(ckbAsset) ? orderCellCapacity : await calculateNFTMakerListPackage(sellerLock, unitType, client)

  return { rawTx: tx, txFee, listPackage, witnessIndex: 0 }
}
