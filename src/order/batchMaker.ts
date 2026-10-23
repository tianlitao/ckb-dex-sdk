import { ccc } from '@ckb-ccc/core'
import { getDexLockScript, getCotaTypeScript, getJoyIDCellDeps, MAX_FEE, JOYID_ESTIMATED_WITNESS_LOCK_SIZE, CKB_UNIT } from '../constants'
import { Hex, SubkeyUnlockReq, MakerParams, CKBAsset } from '../types'
import { append0x } from '../utils'
import { NoCotaCellException, NoLiveCellException, NFTException, NoSupportUDTAssetException } from '../exceptions'
import {
  calculateEmptyCellMinCapacity,
  calculateNFTCellCapacity,
  calculateTransactionFee,
  generateSporeCoBuild,
  getAssetCellDep,
  isUdtAsset,
} from './helper'
import { OrderArgs } from './orderArgs'
import { calculateNFTMakerListPackage } from './maker'

export const buildMultiNftsMakerTx = async (
  { collector, joyID, seller, fee, ckbAsset = CKBAsset.SPORE }: MakerParams,
  nfts: { totalValue: bigint; assetType: string }[],
): Promise<{
  rawTx: ccc.Transaction
  listPackage: bigint
  txFee: bigint
  witnessIndex?: number
}> => {
  let txFee = fee ?? MAX_FEE
  const isMainnet = seller.startsWith('ckb')
  const sellerLock = await collector.getAddressLock(seller)

  const emptyCells = await collector.getCells({ lock: sellerLock })
  if (!emptyCells || emptyCells.length === 0) {
    throw new NoLiveCellException('The address has no empty cells')
  }
  if (isUdtAsset(ckbAsset)) {
    throw new NoSupportUDTAssetException('Just support nft asset')
  }

  const minCellCapacity = calculateEmptyCellMinCapacity(sellerLock)

  let outputs: ccc.CellOutput[] = []
  let outputsData: Hex[] = []
  let cellDeps: ccc.CellDepLike[] = []
  let orderNeedCapacity = BigInt(0)
  const nftCellList: Array<{ nftCell: ccc.Cell; orderLock: ccc.Script; orderCellCapacity: bigint }> = []

  for (const nft of nfts) {
    const assetTypeScript = ccc.Script.fromBytes(nft.assetType)
    const orderArgs = new OrderArgs(sellerLock, 4, nft.totalValue)
    const orderLock = ccc.Script.from({
      ...getDexLockScript(isMainnet),
      args: orderArgs.toHex(),
    })

    const nftCells = await collector.getCells({ lock: sellerLock, type: assetTypeScript })
    if (!nftCells || nftCells.length === 0) {
      throw new NFTException('The address has no NFT cells')
    }
    const nftCell = nftCells[0]
    const orderCellCapacity = calculateNFTCellCapacity(orderLock, nftCell)
    const orderInputCapacity = nftCell.cellOutput.capacity
    orderNeedCapacity += orderCellCapacity > orderInputCapacity ? orderCellCapacity - orderInputCapacity : BigInt(0)
    nftCellList.push({ nftCell, orderLock, orderCellCapacity })
  }

  const needCKB = ((orderNeedCapacity + minCellCapacity + CKB_UNIT) / CKB_UNIT).toString()
  const errMsg = `At least ${needCKB} free CKB (refundable) is required to place a sell order.`
  const { inputs: emptyInputs, capacity: emptyInputsCapacity } = collector.collectInputs(
    emptyCells,
    orderNeedCapacity,
    txFee,
    minCellCapacity,
    errMsg,
  )

  const nftInputs: ccc.CellInput[] = []
  const sporeCoBuildNftCellList: ccc.Cell[] = []
  const sporeCoBuildOutputList: ccc.CellOutput[] = []

  for (const { nftCell, orderLock, orderCellCapacity } of nftCellList) {
    nftInputs.push(ccc.CellInput.from(nftCell))
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

    if (ckbAsset === CKBAsset.SPORE) {
      sporeCoBuildNftCellList.push(nftCell)
      sporeCoBuildOutputList.push(orderOutput)
    }
  }

  const inputs = [...emptyInputs, ...nftInputs]
  let sporeCoBuild = '0x'
  if (ckbAsset === CKBAsset.SPORE) {
    sporeCoBuild = generateSporeCoBuild(sporeCoBuildNftCellList, sporeCoBuildOutputList)
  }

  const changeCapacity = emptyInputsCapacity - orderNeedCapacity - txFee
  outputs.push(ccc.CellOutput.from({ lock: sellerLock, capacity: changeCapacity }))
  outputsData.push('0x')

  cellDeps.push(getAssetCellDep(ckbAsset, isMainnet))
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

  const listPackage = await calculateNFTMakerListPackage(sellerLock, undefined, collector.getClient())
  return { rawTx: tx, listPackage, txFee, witnessIndex: 0 }
}
