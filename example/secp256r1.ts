import { ccc } from '@ckb-ccc/core'
import { ec as EC } from 'elliptic'
import sha256 from 'fast-sha256'
import { append0x, getPublicKey, remove0x } from '../src/utils'
import { Hex } from '../src/types'
import { SECP256R1_PUBKEY_SIG_LEN, WITNESS_NATIVE_MODE } from '../src/constants'

const calcSignedWitnessLock = (key: EC.KeyPair, tx: ccc.Transaction, witnessIndex = 0, mode = WITNESS_NATIVE_MODE): ccc.Hex => {
  if (!key) throw new Error('Private key or address object')

  if (tx.witnesses.length === 0) {
    throw new Error('WitnessGroup cannot be empty')
  }

  const transactionHash = tx.hash()
  const witnessArgs = ccc.WitnessArgs.fromBytes(tx.witnesses[witnessIndex])
  witnessArgs.lock = `0x${'0'.repeat(SECP256R1_PUBKEY_SIG_LEN)}`

  const serializedEmptyWitness = witnessArgs.toBytes()
  const hasher = new ccc.HasherCkb()
  hasher.update(transactionHash)
  hasher.update(ccc.numLeToBytes(serializedEmptyWitness.length, 8))
  hasher.update(serializedEmptyWitness)

  tx.witnesses.slice(witnessIndex + 1).forEach(witness => {
    const bytes = ccc.bytesFrom(witness)
    hasher.update(ccc.numLeToBytes(bytes.length, 8))
    hasher.update(bytes)
  })

  const message = remove0x(hasher.digest())
  const base64 = Buffer.from(message).toString('base64url')
  const sighashAll = Buffer.from(base64, 'utf8').toString('hex')

  const pubKey = getPublicKey(key)
  const authData = '49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630162f9fb77'
  const clientData = `7b2274797065223a22776562617574686e2e676574222c226368616c6c656e6765223a22${sighashAll}222c226f726967696e223a22687474703a2f2f6c6f63616c686f73743a38303030222c2263726f73734f726967696e223a66616c73657d`

  const clientDataHash = sha256Hash(clientData)
  const signData = `0x${authData}${clientDataHash}`
  const signature = signSecp256r1Message(key, signData)

  return `${mode}${pubKey}${signature}${authData}${clientData}` as ccc.Hex
}

export const signSecp256r1Tx = (
  key: EC.KeyPair,
  transaction: ccc.Transaction,
  witnessIndex = 0,
  mode = WITNESS_NATIVE_MODE,
): ccc.Transaction => {
  const tx = ccc.Transaction.from(transaction)
  if (tx.witnesses.length === 0) {
    throw new Error('WitnessGroup cannot be empty')
  }
  const witnessArgs = ccc.WitnessArgs.fromBytes(tx.witnesses[witnessIndex])
  witnessArgs.lock = calcSignedWitnessLock(key, tx, witnessIndex, mode)
  tx.setWitness(witnessIndex, ccc.hexFrom(witnessArgs.toBytes()))
  return tx
}

export const signSecp256r1Message = (key: EC.KeyPair, message: Hex) => {
  if (!message.startsWith('0x')) {
    throw new Error('Message format error')
  }

  const msg = sha256(ccc.bytesFrom(message))
  const sig = key.sign(msg)

  const fmtR = sig.r.toString(16).padStart(64, '0')
  const fmtS = sig.s.toString(16).padStart(64, '0')
  return `${fmtR}${fmtS}`
}

export const sha256Hash = (message: Hex): Hex => {
  const hash = sha256(ccc.bytesFrom(append0x(message)))
  return remove0x(ccc.hexFrom(hash))
}
