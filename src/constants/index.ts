export const CKB_UNIT = BigInt(10000_0000)
export const MAX_FEE = BigInt(2000_0000)
export const MIN_CAPACITY = BigInt(63) * BigInt(10000_0000)
export const WITNESS_NATIVE_MODE = '01'
export const WITNESS_SUBKEY_MODE = '02'
export const SECP256R1_PUBKEY_SIG_LEN = (1 + 64 + 64) * 2
export const JOYID_ESTIMATED_WITNESS_LOCK_SIZE = 129 + 1000

const TestnetInfo = {
  JoyIDLockScript: {
    codeHash: '0xd23761b364210735c19c60561d213fb3beae2fd6172743719eff6920e020baac',
    hashType: 'type',
    args: '',
  } as CKBComponents.Script,

  JoyIDLockDep: {
    outPoint: {
      txHash: '0x4dcf3f3b09efac8995d6cbee87c5345e812d310094651e0c3d9a730f32dc9263',
      index: '0x0',
    },
    depType: 'depGroup',
  } as CKBComponents.CellDep,

  CotaTypeScript: {
    codeHash: '0x89cd8003a0eaf8e65e0c31525b7d1d5c1becefd2ea75bb4cff87810ae37764d8',
    hashType: 'type',
    args: '0x',
  } as CKBComponents.Script,

  CotaTypeDep: {
    outPoint: {
      txHash: '0x636a786001f87cb615acfcf408be0f9a1f077001f0bbc75ca54eadfe7e221713',
      index: '0x0',
    },
    depType: 'depGroup',
  } as CKBComponents.CellDep,

  DexLockScript: {
    codeHash: '0x493510d54e815611a643af97b5ac93bfbb45ddc2aae0f2dceffaf3408b4fcfcd',
    hashType: 'type',
    args: '',
  } as CKBComponents.Script,

  DexLockDep: {
    outPoint: {
      txHash: '0x1b39e5c3300df753b021ef7e8917076bf7111221843362926f4c7e52e3275c33',
      index: '0x0',
    },
    depType: 'code',
  } as CKBComponents.CellDep,

  AnyOneCanPayLockDep: {
    outPoint: {
      txHash: '0xec26b0f85ed839ece5f11c4c4e837ec359f5adc4420410f6453b1f6b60fb96a6',
      index: '0x0',
    },
    depType: 'depGroup',
  } as CKBComponents.CellDep,

  XUDTTypeScript: {
    codeHash: '0x25c29dc317811a6f6f3985a7a9ebc4838bd388d19d0feeecf0bcd60f6c0975bb',
    hashType: 'type',
    args: '',
  } as CKBComponents.Script,

  XUDTTypeDep: {
    outPoint: {
      txHash: '0xbf6fb538763efec2a70a6a3dcb7242787087e1030c4e7d86585bc63a9d337f5f',
      index: '0x0',
    },
    depType: 'code',
  } as CKBComponents.CellDep,

  SUDTTypeScript: {
    codeHash: '0xc5e5dcf215925f7ef4dfaf5f4b4f105bc321c02776d6e7d52a1db3fcd9d011a4',
    hashType: 'type',
    args: '',
  } as CKBComponents.Script,

  SUDTTypeDep: {
    outPoint: {
      txHash: '0xe12877ebd2c3c364dc46c5c992bcfaf4fee33fa13eebdf82c591fc9825aab769',
      index: '0x0',
    },
    depType: 'code',
  } as CKBComponents.CellDep,

  SporeTypeScript: {
    codeHash: '0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d',
    hashType: 'data1',
    args: '',
  } as CKBComponents.Script,

  SporeTypeDep: {
    outPoint: {
      txHash: '0x5e8d2a517d50fd4bb4d01737a7952a1f1d35c8afc77240695bb569cd7d9d5a1f',
      index: '0x0',
    },
    depType: 'code',
  } as CKBComponents.CellDep,

  MNftTypeScript: {
    codeHash: '0xb1837b5ad01a88558731953062d1f5cb547adf89ece01e8934a9f0aeed2d959f',
    hashType: 'type',
    args: '',
  } as CKBComponents.Script,

  MNftTypeDep: {
    outPoint: {
      txHash: '0xf11ccb6079c1a4b3d86abe2c574c5db8d2fd3505fdc1d5970b69b31864a4bd1c',
      index: '0x2',
    },
    depType: 'code',
  } as CKBComponents.CellDep,

  BitTypeScript: {
    codeHash: '0x0b1f412fbae26853ff7d082d422c2bdd9e2ff94ee8aaec11240a5b34cc6e890f',
    hashType: 'type',
    args: '0xa6877b034b6df9165fb977936c361308ce12ba5839b7a6679315dc600ad055de',
  } as CKBComponents.Script,

  BitTypeDep: {
    outPoint: {
      txHash: '0x306961e0eb04ed972c60cb89a0aed1b0ef065d96d2fc0000c62db5275e32dc6f',
      index: '0x0',
    },
    depType: 'code',
  } as CKBComponents.CellDep,

  USDITypeScript: {
    codeHash: '0xcc9dc33ef234e14bc788c43a4848556a5fb16401a04662fc55db9bb201987037',
    hashType: 'type',
    args: '0x71fd1985b2971a9903e4d8ed0d59e6710166985217ca0681437883837b86162f',
  } as CKBComponents.Script,

  USDITypeDep: {
    outPoint: {
      txHash: '0xaec423c2af7fe844b476333190096b10fc5726e6d9ac58a9b71f71ffac204fee',
      index: '0x0',
    },
    depType: 'code',
  } as CKBComponents.CellDep,
}

const MainnetInfo = {
  JoyIDLockScript: {
    codeHash: '0xd00c84f0ec8fd441c38bc3f87a371f547190f2fcff88e642bc5bf54b9e318323',
    hashType: 'type',
    args: '',
  } as CKBComponents.Script,

  JoyIDLockDep: {
    outPoint: {
      txHash: '0xf05188e5f3a6767fc4687faf45ba5f1a6e25d3ada6129dae8722cb282f262493',
      index: '0x0',
    },
    depType: 'depGroup',
  } as CKBComponents.CellDep,

  CotaTypeScript: {
    codeHash: '0x1122a4fb54697cf2e6e3a96c9d80fd398a936559b90954c6e88eb7ba0cf652df',
    hashType: 'type',
    args: '0x',
  } as CKBComponents.Script,

  CotaTypeDep: {
    outPoint: {
      txHash: '0xabaa25237554f0d6c586dc010e7e85e6870bcfd9fb8773257ecacfbe1fd738a0',
      index: '0x0',
    },
    depType: 'depGroup',
  } as CKBComponents.CellDep,

  DexLockScript: {
    codeHash: '0xab0ede4350a201bd615892044ea9edf12180189572e49a7ff3f78cce179ae09f',
    hashType: 'type',
    args: '',
  } as CKBComponents.Script,

  DexLockDep: {
    outPoint: {
      txHash: '0x2819ccd6bcd0313d03929ef64e9d8ffb932dcd8247c432d3e9cbf0ac8d671616',
      index: '0x0',
    },
    depType: 'code',
  } as CKBComponents.CellDep,

  AnyOneCanPayLockDep: {
    outPoint: {
      txHash: '0x4153a2014952d7cac45f285ce9a7c5c0c0e1b21f2d378b82ac1433cb11c25c4d',
      index: '0x0',
    },
    depType: 'depGroup',
  } as CKBComponents.CellDep,

  XUDTTypeScript: {
    codeHash: '0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95',
    hashType: 'data1',
    args: '',
  } as CKBComponents.Script,

  XUDTTypeDep: {
    outPoint: {
      txHash: '0xc07844ce21b38e4b071dd0e1ee3b0e27afd8d7532491327f39b786343f558ab7',
      index: '0x0',
    },
    depType: 'code',
  } as CKBComponents.CellDep,

  SUDTTypeScript: {
    codeHash: '0x5e7a36a77e68eecc013dfa2fe6a23f3b6c344b04005808694ae6dd45eea4cfd5',
    hashType: 'type',
    args: '',
  } as CKBComponents.Script,

  SUDTTypeDep: {
    outPoint: {
      txHash: '0xc7813f6a415144643970c2e88e0bb6ca6a8edc5dd7c1022746f628284a9936d5',
      index: '0x0',
    },
    depType: 'code',
  } as CKBComponents.CellDep,

  SporeTypeScript: {
    codeHash: '0x4a4dce1df3dffff7f8b2cd7dff7303df3b6150c9788cb75dcf6747247132b9f5',
    hashType: 'data1',
    args: '',
  } as CKBComponents.Script,

  SporeTypeDep: {
    outPoint: {
      txHash: '0x96b198fb5ddbd1eed57ed667068f1f1e55d07907b4c0dbd38675a69ea1b69824',
      index: '0x0',
    },
    depType: 'code',
  } as CKBComponents.CellDep,

  MNftTypeScript: {
    codeHash: '0x2b24f0d644ccbdd77bbf86b27c8cca02efa0ad051e447c212636d9ee7acaaec9',
    hashType: 'type',
    args: '',
  } as CKBComponents.Script,

  MNftTypeDep: {
    outPoint: {
      txHash: '0x5dce8acab1750d4790059f22284870216db086cb32ba118ee5e08b97dc21d471',
      index: '0x2',
    },
    depType: 'code',
  } as CKBComponents.CellDep,

  BitTypeScript: {
    codeHash: '0xcfba73b58b6f30e70caed8a999748781b164ef9a1e218424a6fb55ebf641cb33',
    hashType: 'type',
    args: '0x2717bc17500393ed29bfb038025dba00cffb0ac3e588060b96ed54650a8230ae',
  } as CKBComponents.Script,

  BitTypeDep: {
    outPoint: {
      txHash: '0xb88032a061bf5f4834b7b709ad17f745413ddc049cdf88482405a38d3d960c6d',
      index: '0x0',
    },
    depType: 'code',
  } as CKBComponents.CellDep,

  USDITypeScript: {
    codeHash: '0xbfa35a9c38a676682b65ade8f02be164d48632281477e36f8dc2f41f79e56bfc',
    hashType: 'type',
    args: '0xd591ebdc69626647e056e13345fd830c8b876bb06aa07ba610479eb77153ea9f',
  } as CKBComponents.Script,

  USDITypeDep: {
    outPoint: {
      txHash: '0xf6a5eef65101899db9709c8de1cc28f23c1bee90d857ebe176f6647ef109e20d',
      index: '0x0',
    },
    depType: 'code',
  } as CKBComponents.CellDep,
}

export const getJoyIDLockScript = (isMainnet: boolean) => (isMainnet ? MainnetInfo.JoyIDLockScript : TestnetInfo.JoyIDLockScript)
export const getJoyIDCellDep = (isMainnet: boolean) => (isMainnet ? MainnetInfo.JoyIDLockDep : TestnetInfo.JoyIDLockDep)

export const getCotaTypeScript = (isMainnet: boolean) => (isMainnet ? MainnetInfo.CotaTypeScript : TestnetInfo.CotaTypeScript)
export const getCotaCellDep = (isMainnet: boolean) => (isMainnet ? MainnetInfo.CotaTypeDep : TestnetInfo.CotaTypeDep)

export const getDexLockScript = (isMainnet: boolean) => (isMainnet ? MainnetInfo.DexLockScript : TestnetInfo.DexLockScript)
export const getDexCellDep = (isMainnet: boolean) => (isMainnet ? MainnetInfo.DexLockDep : TestnetInfo.DexLockDep)

export const getXudtTypeScript = (isMainnet: boolean) => (isMainnet ? MainnetInfo.XUDTTypeScript : TestnetInfo.XUDTTypeScript)
export const getXudtDep = (isMainnet: boolean) => (isMainnet ? MainnetInfo.XUDTTypeDep : TestnetInfo.XUDTTypeDep)

export const getSudtTypeScript = (isMainnet: boolean) => (isMainnet ? MainnetInfo.SUDTTypeScript : TestnetInfo.SUDTTypeScript)
export const getSudtDep = (isMainnet: boolean) => (isMainnet ? MainnetInfo.SUDTTypeDep : TestnetInfo.SUDTTypeDep)

export const getSporeTypeScript = (isMainnet: boolean) => (isMainnet ? MainnetInfo.SporeTypeScript : TestnetInfo.SporeTypeScript)
export const getSporeDep = (isMainnet: boolean) => (isMainnet ? MainnetInfo.SporeTypeDep : TestnetInfo.SporeTypeDep)

export const getMNftTypeScript = (isMainnet: boolean) => (isMainnet ? MainnetInfo.MNftTypeScript : TestnetInfo.MNftTypeScript)
export const getMNftDep = (isMainnet: boolean) => (isMainnet ? MainnetInfo.MNftTypeDep : TestnetInfo.MNftTypeDep)

export const getBitTypeScript = (isMainnet: boolean) => (isMainnet ? MainnetInfo.BitTypeScript : TestnetInfo.BitTypeScript)
export const getBitDep = (isMainnet: boolean) => (isMainnet ? MainnetInfo.BitTypeDep : TestnetInfo.BitTypeDep)

export const getAnyOneCanPayCellDep = (isMainnet: boolean) =>
  isMainnet ? MainnetInfo.AnyOneCanPayLockDep : TestnetInfo.AnyOneCanPayLockDep

export const getUSDITypeScript = (isMainnet: boolean) => (isMainnet ? MainnetInfo.USDITypeScript : TestnetInfo.USDITypeScript)
export const getUSDICellDep = (isMainnet: boolean) => (isMainnet ? MainnetInfo.USDITypeDep : TestnetInfo.USDITypeDep)
