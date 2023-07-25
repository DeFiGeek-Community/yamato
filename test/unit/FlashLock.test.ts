import { ethers } from "hardhat";
import { smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { Signer, BigNumber } from "ethers";
import { toERC20 } from "../param/helper";
import {
  ChainLinkMock,
  PriceFeedV3,
  FeePool,
  CurrencyOS,
  CJPY,
  Yamato,
  YamatoDepositor,
  YamatoBorrower,
  YamatoRepayer,
  YamatoWithdrawer,
  YamatoRedeemer,
  YamatoSweeper,
  PriorityRegistry,
  Pool,
  SameBlockClient,
  ChainLinkMock__factory,
  PriceFeedV3__factory,
  FeePool__factory,
  CurrencyOS__factory,
  CJPY__factory,
  Yamato__factory,
  YamatoDepositor__factory,
  YamatoBorrower__factory,
  YamatoRepayer__factory,
  YamatoWithdrawer__factory,
  YamatoRedeemer__factory,
  YamatoSweeper__factory,
  Pool__factory,
  PriorityRegistry__factory,
  SameBlockClient__factory,
} from "../../typechain";
import { getProxy, getLinkedProxy } from "../../src/testUtil";

chai.use(smock.matchers);

describe("FlashLock :: contract Yamato", () => {
  let ChainLinkEthUsd: ChainLinkMock;
  let ChainLinkUsdJpy: ChainLinkMock;
  let PriceFeed: PriceFeedV3;
  let CJPY: CJPY;
  let FeePool: FeePool;
  let CurrencyOS: CurrencyOS;
  let Yamato: Yamato;
  let YamatoDepositor: YamatoDepositor;
  let YamatoBorrower: YamatoBorrower;
  let YamatoRepayer: YamatoRepayer;
  let YamatoWithdrawer: YamatoWithdrawer;
  let YamatoRedeemer: YamatoRedeemer;
  let YamatoSweeper: YamatoSweeper;
  let Pool: Pool;
  let PriorityRegistry: PriorityRegistry;
  let accounts: Signer[];
  let ownerAddress: string;
  let userAddress: string;
  let SameBlockClient: SameBlockClient;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    ownerAddress = await accounts[0].getAddress();
    userAddress = await accounts[1].getAddress();

    ChainLinkEthUsd = await (<ChainLinkMock__factory>(
      await ethers.getContractFactory("ChainLinkMock")
    )).deploy("ETH/USD");
    ChainLinkUsdJpy = await (<ChainLinkMock__factory>(
      await ethers.getContractFactory("ChainLinkMock")
    )).deploy("JPY/USD");

    await (
      await ChainLinkEthUsd.connect(accounts[0]).simulatePriceMove({
        gasLimit: 200000,
      })
    ).wait();
    await (
      await ChainLinkUsdJpy.connect(accounts[0]).simulatePriceMove({
        gasLimit: 200000,
      })
    ).wait();
    await (
      await ChainLinkEthUsd.connect(accounts[0]).simulatePriceMove({
        gasLimit: 200000,
      })
    ).wait();
    await (
      await ChainLinkUsdJpy.connect(accounts[0]).simulatePriceMove({
        gasLimit: 200000,
      })
    ).wait();

    PriceFeed = await getProxy<PriceFeedV3, PriceFeedV3__factory>(
      "PriceFeed",
      [ChainLinkEthUsd.address, ChainLinkUsdJpy.address],
      3
    );

    CJPY = await (<CJPY__factory>(
      await ethers.getContractFactory("CJPY")
    )).deploy();

    FeePool = await getProxy<FeePool, FeePool__factory>("FeePool", []);

    CurrencyOS = await getProxy<CurrencyOS, CurrencyOS__factory>("CurrencyOS", [
      CJPY.address,
      PriceFeed.address,
      FeePool.address,
    ]);

    Yamato = await getLinkedProxy<Yamato, Yamato__factory>(
      "Yamato",
      [CurrencyOS.address],
      ["PledgeLib"]
    );

    YamatoDepositor = await getLinkedProxy<
      YamatoDepositor,
      YamatoDepositor__factory
    >("YamatoDepositor", [Yamato.address], ["PledgeLib"]);

    YamatoBorrower = await getLinkedProxy<
      YamatoBorrower,
      YamatoBorrower__factory
    >("YamatoBorrower", [Yamato.address], ["PledgeLib"]);

    YamatoRepayer = await getLinkedProxy<YamatoRepayer, YamatoRepayer__factory>(
      "YamatoRepayer",
      [Yamato.address],
      ["PledgeLib"]
    );

    YamatoWithdrawer = await getLinkedProxy<
      YamatoWithdrawer,
      YamatoWithdrawer__factory
    >("YamatoWithdrawer", [Yamato.address], ["PledgeLib"]);

    YamatoRedeemer = await getLinkedProxy<
      YamatoRedeemer,
      YamatoRedeemer__factory
    >("YamatoRedeemer", [Yamato.address], ["PledgeLib"]);

    YamatoSweeper = await getLinkedProxy<YamatoSweeper, YamatoSweeper__factory>(
      "YamatoSweeper",
      [Yamato.address],
      ["PledgeLib"]
    );

    Pool = await getProxy<Pool, Pool__factory>("Pool", [Yamato.address]);

    PriorityRegistry = await getLinkedProxy<
      PriorityRegistry,
      PriorityRegistry__factory
    >("PriorityRegistry", [Yamato.address], ["PledgeLib"]);

    await (
      await Yamato.setDeps(
        YamatoDepositor.address,
        YamatoBorrower.address,
        YamatoRepayer.address,
        YamatoWithdrawer.address,
        YamatoRedeemer.address,
        YamatoSweeper.address,
        Pool.address,
        PriorityRegistry.address
      )
    ).wait();
    await (await CurrencyOS.addYamato(Yamato.address)).wait();
    await (await CJPY.setCurrencyOS(CurrencyOS.address)).wait();

    SameBlockClient = await (<SameBlockClient__factory>(
      await ethers.getContractFactory("SameBlockClient")
    )).deploy(Yamato.address);

    await (await PriceFeed.fetchPrice()).wait();
  });

  describe("depositAndBorrow()", function () {
    it(`should be reverted`, async function () {
      const PRICE = await PriceFeed.lastGoodPrice();
      const MCR = BigNumber.from(130);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");

      await expect(
        SameBlockClient.depositAndBorrow(toERC20(toBorrow + ""), {
          value: toERC20(toCollateralize + ""),
        })
      ).to.be.revertedWith("Those can't be called in the same block.");
    });
  });

  describe("borrowAndWithdraw()", function () {
    it(`should be reverted`, async function () {
      const PRICE = await PriceFeed.lastGoodPrice();
      const MCR = BigNumber.from(130);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");

      // Note: Align signer with following execution
      await (
        await SameBlockClient.depositFromClient({
          value: toERC20(toCollateralize * 3 + ""),
        })
      ).wait();

      await expect(
        SameBlockClient.borrowAndWithdraw(
          toERC20(toBorrow + ""),
          toERC20(toCollateralize + "")
        )
      ).to.be.revertedWith("Those can't be called in the same block.");
    });
  });

  describe("depositAndWithdraw()", function () {
    it(`should be reverted`, async function () {
      const PRICE = await PriceFeed.lastGoodPrice();
      const MCR = BigNumber.from(130);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");

      await expect(
        SameBlockClient.depositAndWithdraw(toERC20(toCollateralize + ""), {
          value: toERC20(toCollateralize + ""),
        })
      ).to.be.revertedWith("Those can't be called in the same block.");
    });
  });

  describe("depositAndBorrowAndWithdraw()", function () {
    it(`should be reverted`, async function () {
      const PRICE = await PriceFeed.lastGoodPrice();
      const MCR = BigNumber.from(130);
      const toCollateralize = 1;
      const toBorrow = PRICE.mul(toCollateralize)
        .mul(100)
        .div(MCR)
        .div(1e18 + "");

      await expect(
        SameBlockClient.depositAndBorrowAndWithdraw(
          toERC20(toBorrow + ""),
          toERC20(toCollateralize + ""),
          { value: toERC20(toCollateralize + "") }
        )
      ).to.be.revertedWith("Those can't be called in the same block.");
    });
  });
});
