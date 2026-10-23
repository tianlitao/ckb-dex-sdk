import { ccc } from '@ckb-ccc/core'
import { OrderLockArgsException } from '../exceptions'
import { Hex, Address } from '../types'
import { append0x, beToU128, leToU32, remove0x, u128ToBe, u8ToHex } from '../utils'

export class OrderArgs {
  public ownerLock: ccc.Script
  public setup: number
  public totalValue: bigint
  public unitTypeHash?: Address

  constructor(ownerLock: ccc.ScriptLike, setup: number, totalValue: bigint, unitTypeHash?: Address) {
    this.ownerLock = ccc.Script.from(ownerLock)
    this.setup = setup
    this.totalValue = totalValue
    this.unitTypeHash = unitTypeHash
  }

  static fromHex(args: Hex) {
    const data = remove0x(args)

    if (data.length < 132) {
      throw new OrderLockArgsException('The length of dex lock args must not be smaller than 66bytes')
    }

    const ownerLockHexLen = leToU32(data.substring(0, 8)) * 2
    const ownerLock = ccc.Script.fromBytes(append0x(data.substring(0, ownerLockHexLen)))

    if (data.length < ownerLockHexLen + 34) {
      throw new OrderLockArgsException('The length of dex lock args is invalid')
    }

    const setup = parseInt(data.substring(ownerLockHexLen, ownerLockHexLen + 2), 16)
    const totalValue = beToU128(data.substring(ownerLockHexLen + 2, ownerLockHexLen + 34))

    if (setup > 7) {
      throw new OrderLockArgsException('Invalid setup')
    }

    const receiverLockFlag = (setup & 0b0000_0001) != 0
    if (receiverLockFlag) {
      throw new OrderLockArgsException('Invalid setup, not support receiver_lock')
    }

    const unitTypeHashFlag = (setup & 0b0000_0010) != 0
    if (unitTypeHashFlag) {
      const unitTypeHash = data.substring(ownerLockHexLen + 34, ownerLockHexLen + 34 + 64)
      if (unitTypeHash.length !== 64) {
        throw new OrderLockArgsException('The unit type hash of dex lock args is invalid')
      }

      return {
        ownerLock,
        setup,
        totalValue,
        unitTypeHash,
      }
    }

    return {
      ownerLock,
      setup,
      totalValue,
    }
  }

  toHex(): Hex {
    const ownerLockHex = ccc.hexFrom(this.ownerLock.toBytes())
    if (this.unitTypeHash != null) {
      return `${ownerLockHex}${u8ToHex(this.setup)}${u128ToBe(this.totalValue)}${remove0x(this.unitTypeHash)}`
    }
    return `${ownerLockHex}${u8ToHex(this.setup)}${u128ToBe(this.totalValue)}`
  }
}
