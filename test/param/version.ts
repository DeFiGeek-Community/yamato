// V1 contracts
export interface V1 {
  CJPY: string;
  CurrencyOS: string;
  FeePool: string;
  Pool: string;
  PriceFeed: string;
  PriorityRegistry: string;
  Yamato: string;
  YamatoBorrower: string;
  YamatoDepositor: string;
  YamatoRedeemer: string;
  YamatoRepayer: string;
  YamatoSweeper: string;
  YamatoWithdrawer: string;
  PledgeLib: string;
}

// V1.5 additional contracts
export interface V1_5 extends V1 {
  ScoreRegistry: string;
  ScoreWeightController: string;
  veYMT: string;
  YMT: string;
  YmtMinter: string;
  YmtVesting: string;
}

// V2 additional contracts (for future use)
export interface V2 extends V1_5 {
  // Add any V2 specific contracts here
}

// Type to represent all versions
export type Version = V1 | V1_5 | V2;

// Helper function to create version objects with correct typing
function createVersion<T extends Version>(version: T): T {
  return version;
}

// V1 contract versions
export const v1 = createVersion<V1>({
  CJPY: "CJPY",
  CurrencyOS: "CurrencyOSV2",
  FeePool: "FeePool",
  Pool: "PoolV2",
  PriceFeed: "PriceFeedV3",
  PriorityRegistry: "PriorityRegistryV6",
  Yamato: "YamatoV3",
  YamatoBorrower: "YamatoBorrower",
  YamatoDepositor: "YamatoDepositorV2",
  YamatoRedeemer: "YamatoRedeemerV4",
  YamatoRepayer: "YamatoRepayerV2",
  YamatoSweeper: "YamatoSweeperV2",
  YamatoWithdrawer: "YamatoWithdrawerV2",
  PledgeLib: "PledgeLib",
});

// V1.5 contract versions
export const v1_5 = createVersion<V1_5>({
  CJPY: "CJPY",
  CurrencyOS: "CurrencyOSV3", // Upgraded
  FeePool: "FeePoolV2", // Upgraded
  Pool: "PoolV2",
  PriceFeed: "PriceFeedV3",
  PriorityRegistry: "PriorityRegistryV6",
  Yamato: "YamatoV4",
  YamatoBorrower: "YamatoBorrowerV2", // Upgraded
  YamatoDepositor: "YamatoDepositorV3", // Upgraded
  YamatoRedeemer: "YamatoRedeemerV5", // Upgraded
  YamatoRepayer: "YamatoRepayerV3", // Upgraded
  YamatoSweeper: "YamatoSweeperV3", // Upgraded
  YamatoWithdrawer: "YamatoWithdrawerV3", // Upgraded
  PledgeLib: "PledgeLib",
  // Added in v1.5
  ScoreRegistry: "ScoreRegistry",
  ScoreWeightController: "ScoreWeightController",
  veYMT: "veYMT",
  YMT: "YMT",
  YmtMinter: "YmtMinter",
  YmtVesting: "YmtVesting",
});

// Function to get the latest version (currently v1.5)
export function getLatestVersion(): Version {
  return v1_5;
}

/// Deprecated but for consistency
export interface Deprecated__Version {
  CJPY: string;
  CurrencyOS: string;
  FeePool: string;
  Pool: string;
  PriceFeed: string;
  PriorityRegistry: string;
  ScoreRegistry: string;
  ScoreWeightController: string;
  veYMT: string;
  Yamato: string;
  YamatoBorrower: string;
  YamatoDepositor: string;
  YamatoRedeemer: string;
  YamatoRepayer: string;
  YamatoSweeper: string;
  YamatoWithdrawer: string;
  YMT: string;
  YmtMinter: string;
  // YmtOS: string;
}

export const contractVersion: Deprecated__Version = {
  CJPY: "CJPY",
  CurrencyOS: "CurrencyOSV3",
  FeePool: "FeePoolV2",
  Pool: "PoolV2",
  PriceFeed: "PriceFeedV3",
  PriorityRegistry: "PriorityRegistryV6",
  ScoreRegistry: "ScoreRegistry",
  ScoreWeightController: "ScoreWeightController",
  veYMT: "veYMT",
  Yamato: "YamatoV4",
  YamatoBorrower: "YamatoBorrowerV2",
  YamatoDepositor: "YamatoDepositorV3",
  YamatoRedeemer: "YamatoRedeemerV5",
  YamatoRepayer: "YamatoRepayerV3",
  YamatoSweeper: "YamatoSweeperV3",
  YamatoWithdrawer: "YamatoWithdrawerV3",
  YMT: "YMT",
  YmtMinter: "YmtMinter",
};
