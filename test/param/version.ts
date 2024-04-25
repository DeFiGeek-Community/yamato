export interface Version {
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
  YmtOS: string;
}

export const contractVersion: Version = {
  CurrencyOS: "CurrencyOSV3",
  FeePool: "FeePoolV2",
  Pool: "PoolV2",
  PriceFeed: "PriceFeedV3",
  PriorityRegistry: "PriorityRegistryV6",
  ScoreRegistry: "ScoreRegistry",
  ScoreWeightController: "ScoreWeightControllerV2",
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
  YmtOS: "YmtOS",
};
