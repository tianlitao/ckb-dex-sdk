import { ccc } from '@ckb-ccc/core'
import { ec as EC } from 'elliptic'
import { getJoyIDLockScript } from '../constants'
import { Address, Hex } from '../types'
import { append0x, remove0x } from './hex'

export const addressToScript = async (address: string, client: ccc.Client): Promise<ccc.Script> => {
  return (await ccc.Address.fromString(address, client)).script
}

export const scriptToAddress = (script: ccc.ScriptLike, isMainnet = false): Address => {
  return ccc.Address.from({
    script: ccc.Script.from(script),
    prefix: isMainnet ? 'ckb' : 'ckt',
  }).toString()
}

export const keyFromP256Private = (privateKey: Uint8Array | Hex): EC.KeyPair => {
  const privkey = typeof privateKey == 'string' ? remove0x(privateKey) : privateKey
  const ec = new EC('p256')
  return ec.keyFromPrivate(privkey)
}

// uncompressed pubkey without 0x
export const getPublicKey = (key: EC.KeyPair) => key.getPublic(false, 'hex').substring(2)

export const addressFromP256PrivateKey = (privateKey: Uint8Array | Hex, isMainnet = false): Address => {
  const pubkey = append0x(getPublicKey(keyFromP256Private(privateKey)))
  const lock = {
    ...getJoyIDLockScript(isMainnet),
    args: `0x0001${ccc.hashCkbShort(pubkey).slice(2)}`,
  }
  return scriptToAddress(lock, isMainnet)
}

export const pubkeyFromP256PrivateKey = (privateKey: Uint8Array | Hex) => {
  return append0x(getPublicKey(keyFromP256Private(privateKey)))
}
