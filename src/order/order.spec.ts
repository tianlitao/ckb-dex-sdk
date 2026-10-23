import { describe, it, expect } from 'vitest'
import { ccc } from '@ckb-ccc/core'
import { unpackCommonCobuildProof } from '@ckb-ccc/spore/advanced'
import {
  calculateUdtCellCapacity,
  calculateEmptyCellMinCapacity,
  calculateTransactionFee,
  deserializeOutPoints,
  cleanUpUdtOutputs,
  generateSporeCoBuild,
} from './helper'
import { matchOrderOutputs } from './taker'
import { Hex } from '../types'
import { OrderArgs } from './orderArgs'
import { calculateUDTMakerListPackage } from './maker'
import { getSporeTypeScript } from '../constants'

const txHash = `0x${'11'.repeat(32)}`
const makeCell = (
  index: number,
  capacity: bigint | string,
  lock: ccc.ScriptLike,
  type?: ccc.ScriptLike,
  outputData: Hex = '0x',
): ccc.Cell =>
  ccc.Cell.from({
    outPoint: { txHash, index },
    cellOutput: { capacity, lock, type },
    outputData,
  })

describe('dex test cases', () => {
  const joyIDLock = ccc.Script.from({
    codeHash: '0xd23761b364210735c19c60561d213fb3beae2fd6172743719eff6920e020baac',
    hashType: 'type',
    args: '0x0001f21be6c96d2103946d37a1ee882011f7530a92a7',
  })
  const xudtType = ccc.Script.from({
    codeHash: '0x25c29dc317811a6f6f3985a7a9ebc4838bd388d19d0feeecf0bcd60f6c0975bb',
    hashType: 'type',
    args: '0x06ec22c2def100bba3e295a1ff279c490d227151bf3166a4f3f008906c849399',
  })

  it('calculateUdtCellCapacity', () => {
    expect(calculateUdtCellCapacity(joyIDLock, xudtType)).toBe(BigInt(145_0000_0000))
  })

  it('calculateOrderUdtCellCapacity', () => {
    const orderLock = ccc.Script.from({
      codeHash: '0x493510d54e815611a643af97b5ac93bfbb45ddc2aae0f2dceffaf3408b4fcfcd',
      hashType: 'type',
      args: '0x4b000000100000003000000031000000d23761b364210735c19c60561d213fb3beae2fd6172743719eff6920e020baac011600000000014fb353fbaa84df6dc4052a1454b8fccf47ee4a2d0000000000000000000000003a35294400',
    })
    expect(calculateUdtCellCapacity(orderLock, xudtType)).toBe(BigInt(215_0000_0000))
  })

  it('calculateUDTMakerListPackage', () => {
    expect(calculateUDTMakerListPackage(joyIDLock, xudtType)).toBe(BigInt(215_0000_0000))
  })

  it('calculateEmptyCellMinCapacity', () => {
    expect(calculateEmptyCellMinCapacity(joyIDLock)).toBe(BigInt(64_0000_0000))
  })

  it('calculateTransactionFee', () => {
    expect(calculateTransactionFee(1245)).toBe(BigInt(2490))
  })

  it('OrderArgs', () => {
    const orderArgs = new OrderArgs(joyIDLock, 0, BigInt(2000))
    const expectedHex =
      '0x4b000000100000003000000031000000d23761b364210735c19c60561d213fb3beae2fd6172743719eff6920e020baac01160000000001f21be6c96d2103946d37a1ee882011f7530a92a700000000000000000000000000000007d0'
    const expectedArgs = OrderArgs.fromHex(expectedHex)
    expect(orderArgs.toHex()).toBe(expectedHex)
    expect(expectedArgs.ownerLock.eq(orderArgs.ownerLock)).toBe(true)
    expect(expectedArgs.setup).toBe(orderArgs.setup)
    expect(expectedArgs.totalValue).toBe(orderArgs.totalValue)
  })

  it('deserializeOutPoints', () => {
    const outPoints = deserializeOutPoints([
      '0xa29277aba50cb1ef2e37f61ac29b422a565307c3c1b8e9790349d660d39b208801000000',
      '0x59ffc29a0794c4a875a82f3fd76c8be61f242310874cc6d3cf032e12538bdd1512000000',
    ])
    expect(outPoints.map(outPoint => outPoint.txHash)).toEqual([
      '0xa29277aba50cb1ef2e37f61ac29b422a565307c3c1b8e9790349d660d39b2088',
      '0x59ffc29a0794c4a875a82f3fd76c8be61f242310874cc6d3cf032e12538bdd15',
    ])
    expect(outPoints.map(outPoint => outPoint.index)).toEqual([BigInt(1), BigInt(18)])
  })

  const udtTypeA = ccc.Script.from({ ...xudtType, args: '0xaafd7e7eab79726c669d7565888b194dc06bd1dbec16749a721462151e4f1762' })
  const udtTypeB = ccc.Script.from({ ...xudtType, args: '0x06ec22c2def100bba3e295a1ff279c490d227151bf3166a4f3f008906c849399' })
  const udtTypeC = ccc.Script.from({ ...xudtType, args: '0x6a5a8762fc76d5854e69d8a13611acfede063e77d15e964e3a88660e86cff1af' })
  const orderCells: ccc.Cell[] = [
    makeCell(
      0,
      '0x360447100',
      ccc.Script.from({
        args: '0x4b000000100000003000000031000000d23761b364210735c19c60561d213fb3beae2fd6172743719eff6920e020baac01160000000001f21be6c96d2103946d37a1ee882011f7530a92a70000000000000000000000001d1a94a200',
        codeHash: '0x493510d54e815611a643af97b5ac93bfbb45ddc2aae0f2dceffaf3408b4fcfcd',
        hashType: 'type',
      }),
      udtTypeA,
      '0x00e87648170000000000000000000000',
    ),
    makeCell(
      1,
      '0x360447100',
      ccc.Script.from({
        args: '0x4b000000100000003000000031000000d23761b364210735c19c60561d213fb3beae2fd6172743719eff6920e020baac01160000000001f21be6c96d2103946d37a1ee882011f7530a92a70000000000000000000000003a35294400',
        codeHash: '0x493510d54e815611a643af97b5ac93bfbb45ddc2aae0f2dceffaf3408b4fcfcd',
        hashType: 'type',
      }),
      udtTypeA,
      '0x00e87648170000000000000000000000',
    ),
    makeCell(
      2,
      '0x360447100',
      ccc.Script.from({
        args: '0x4b000000100000003000000031000000d23761b364210735c19c60561d213fb3beae2fd6172743719eff6920e020baac01160000000001f21be6c96d2103946d37a1ee882011f7530a92a7000000000000000000000000574fbde600',
        codeHash: '0x493510d54e815611a643af97b5ac93bfbb45ddc2aae0f2dceffaf3408b4fcfcd',
        hashType: 'type',
      }),
      udtTypeA,
      '0x00e87648170000000000000000000000',
    ),
    makeCell(
      3,
      '0x360447100',
      ccc.Script.from({
        args: '0x4b000000100000003000000031000000d23761b364210735c19c60561d213fb3beae2fd6172743719eff6920e020baac01160000000001f21be6c96d2103946d37a1ee882011f7530a92a70000000000000000000000001d1a94a200',
        codeHash: '0x493510d54e815611a643af97b5ac93bfbb45ddc2aae0f2dceffaf3408b4fcfcd',
        hashType: 'type',
      }),
      udtTypeB,
      '0x00e87648170000000000000000000000',
    ),
    makeCell(
      4,
      '0x360447100',
      ccc.Script.from({
        args: '0x4b000000100000003000000031000000d23761b364210735c19c60561d213fb3beae2fd6172743719eff6920e020baac01160000000001f21be6c96d2103946d37a1ee882011f7530a92a7000000000000000000000000574fbde600',
        codeHash: '0x493510d54e815611a643af97b5ac93bfbb45ddc2aae0f2dceffaf3408b4fcfcd',
        hashType: 'type',
      }),
      udtTypeC,
      '0x00e87648170000000000000000000000',
    ),
  ]

  it('cleanUpUdtOutputs', () => {
    const lock = ccc.Script.from({
      codeHash: '0xd23761b364210735c19c60561d213fb3beae2fd6172743719eff6920e020baac',
      hashType: 'type',
      args: '0x00010748fce626e566ab4dbd1c95498bf10518443fc1',
    })
    const { udtOutputs, udtOutputsData, sumUdtCapacity } = cleanUpUdtOutputs(orderCells, lock)

    expect(udtOutputs.map(output => output.type?.args)).toEqual([udtTypeA.args, udtTypeB.args, udtTypeC.args])
    expect(udtOutputsData).toEqual([
      '0x00b864d9450000000000000000000000',
      '0x00e87648170000000000000000000000',
      '0x00e87648170000000000000000000000',
    ])
    expect(sumUdtCapacity).toBe(BigInt(435_0000_0000))
  })

  it('matchOrderOutputs', () => {
    const { sellerOutputs, sellerOutputsData, sumSellerCapacity } = matchOrderOutputs(orderCells)

    expect(sellerOutputs.map(output => output.capacity)).toEqual([
      1464_0000_0000n,
      2714_0000_0000n,
      3964_0000_0000n,
      1464_0000_0000n,
      3964_0000_0000n,
    ])
    expect(sellerOutputsData).toEqual(['0x', '0x', '0x', '0x', '0x'])
    expect(sumSellerCapacity).toBe(12500_0000_0000n)
  })

  it('generateSporeCoBuild', () => {
    const sporeType = ccc.Script.from({ ...getSporeTypeScript(false), args: `0x${'22'.repeat(32)}` })
    const input = makeCell(0, BigInt(1000_0000_0000), joyIDLock, sporeType, '0x1234')
    const output = ccc.CellOutput.from({ lock: joyIDLock, type: sporeType, capacity: BigInt(1000_0000_0000) }, '0x1234')
    const witness = generateSporeCoBuild([input], [output])
    const proof = unpackCommonCobuildProof(witness)
    expect(proof?.type).toBe('SighashAll')
    if (proof?.type !== 'SighashAll') throw new Error('Unexpected CoBuild proof')
    expect(proof.value.message.actions).toHaveLength(1)
  })
})
