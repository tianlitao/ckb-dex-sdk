# CKB DEX SDK

JavaScript/TypeScript SDK for building CKB DEX maker, taker, and cancel transactions.

The SDK now uses [CCC](https://github.com/ckb-devrel/ccc) for all CKB primitives: addresses, scripts, cells, transactions, RPC/indexer access, witness encoding, and transaction hashing. It no longer imports `ckb-lumos`, `ckb-sdk-js`, or `spore-sdk` directly.

## What changed

- `@ckb-ccc/core` replaces `@ckb-lumos/base` and the `@nervosnetwork/ckb-sdk-*` packages.
- `@ckb-ccc/spore/advanced` replaces the Spore SDK CoBuild helpers.
- `rawTx` returned by `buildMakerTx`, `buildTakerTx`, `buildCancelTx`, and `buildMultiNftsMakerTx` is a `ccc.Transaction`.
- `Collector` owns a `ccc.Client`; use `collector.getClient()` for RPC/indexer calls.
- `Collector.getCkb()` remains as a deprecated alias for `collector.getClient()`.
- Address-string helpers are asynchronous because CCC resolves addresses through a network-aware `ccc.Client`.
- JoyID cell deps are resolved on chain through CCC's known-script registry (`getJoyIDCellDeps(client)`); the previously pinned testnet/mainnet outPoints are no longer live. The CCC client used by `Collector` raises the per-request timeout to 60s because public endpoints can be slow on indexer queries.

## Installation

```bash
npm i @ckb-ccc/core @ckb-ccc/spore
# or
pnpm add @ckb-ccc/core @ckb-ccc/spore
```

If this repository is published as `omiga-dex`, install that package as well:

```bash
npm i omiga-dex
```

## Client configuration

CCC's JSON-RPC client expects an endpoint that exposes both CKB RPC and the indexer. For the public network this is the root endpoint:

```typescript
import { Collector } from 'omiga-dex'

const collector = new Collector({
  ckbNodeUrl: 'https://testnet.ckb.dev/',
  network: 'testnet',
})

const client = collector.getClient()
// client.sendTransaction(...)
// client.findCellsByLock(...)
```

For a custom deployment, pass a fully configured CCC client instead of splitting URLs:

```typescript
import { ccc } from '@ckb-ccc/core'
import { Collector } from 'omiga-dex'

const client = new ccc.ClientPublicTestnet({
  url: 'https://my-ckb-service.example/',
})

const collector = new Collector({ client })
```

`ckbIndexerUrl` is still accepted for source compatibility, but CCC uses the endpoint selected from `ckbNodeUrl` / `ckbIndexerUrl`. `client` is the reliable option when node and indexer are exposed separately.

## Build and sign transactions

`buildMakerTx`, `buildTakerTx`, and `buildCancelTx` return a CCC transaction plus the fee and witness index:

```typescript
import { ccc } from '@ckb-ccc/core'
import { Collector, buildMakerTx, CKBAsset } from 'omiga-dex'

const collector = new Collector({ ckbNodeUrl: 'https://testnet.ckb.dev/' })
const client = collector.getClient()

const { rawTx, txFee, witnessIndex } = await buildMakerTx({
  collector,
  seller,
  totalValue: 120_000_000n,
  listAmount: 500_0000_0000n,
  assetType: ccc.hexFrom(ccc.Script.from(tokenType).toBytes()),
  ckbAsset: CKBAsset.XUDT,
})

const signedTx = await signer.signTransaction(rawTx)
const txHash = await client.sendTransaction(signedTx, 'passthrough')
```

For a private-key signer in Node.js:

```typescript
const signer = new ccc.SignerCkbPrivateKey(client, privateKey)
const signedTx = await signer.signTransaction(rawTx)
```

For a browser wallet, use the CCC connector and pass the connected `ccc.Signer` to your application. `JoyIDConfig` remains available only for JoyID sub-key unlock metadata used by the custom witness flow.

## Assets and transaction shapes

Supported order assets are defined by:

```typescript
export enum CKBAsset {
  XUDT,
  SUDT,
  SPORE,
  MNFT,
}
```

The transaction layout is unchanged: the SDK still builds DEX lock arguments, order cells, maker payment outputs, taker outputs, platform-fee outputs, UDT changes, and Spore CoBuild witnesses with the same byte-level formats. Only the primitive serialization and transaction construction layer has moved to CCC.

Spore transfer witnesses are generated with `@ckb-ccc/spore/advanced` using `assembleTransferSporeAction` and `injectCobuild`.

## Development

```bash
npm test
npm run build
```

Some examples use a local secp256r1 key for deterministic reproduction. Never use the example private keys in production. The examples are under `example/` and use the CCC transaction and serialization APIs as well.
