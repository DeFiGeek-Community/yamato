import { ethers } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { Signer } from "ethers";
import {
  CurrencyOS,
  CJPY,
  FeePool,
  YMT,
  VeYMT,
  Yamato,
  YamatoDepositor,
  YamatoBorrower,
  YamatoRepayer,
  YamatoWithdrawer,
  YamatoRedeemer,
  YamatoSweeper,
  PriceFeedV3,
  CurrencyOS__factory,
  FeePool__factory,
} from "../../typechain";
import { getFakeProxy, getProxy } from "../../src/testUtil";

chai.use(smock.matchers);

describe("CurrencyOS", () => {
  let mockCJPY: FakeContract<CJPY>;
  let mockYMT: FakeContract<YMT>;
  let mockVeYMT: FakeContract<VeYMT>;
  let mockFeed: FakeContract<PriceFeedV3>;
  let mockFeePool: FakeContract<FeePool>;
  let mockYamato: FakeContract<Yamato>;
  let mockYamatoDepositor: FakeContract<YamatoDepositor>;
  let mockYamatoBorrower: FakeContract<YamatoBorrower>;
  let mockYamatoRepayer: FakeContract<YamatoRepayer>;
  let mockYamatoWithdrawer: FakeContract<YamatoWithdrawer>;
  let mockYamatoRedeemer: FakeContract<YamatoRedeemer>;
  let mockYamatoSweeper: FakeContract<YamatoSweeper>;
  let currencyOS: CurrencyOS;
  let accounts: Signer[];
  let ownerAddress: string;
  let userAddress: string;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    ownerAddress = await accounts[0].getAddress();
    userAddress = await accounts[1].getAddress();
    mockCJPY = await smock.fake<CJPY>("CJPY");
    mockFeed = await getFakeProxy<PriceFeedV3>("PriceFeed");
    mockFeePool = await getFakeProxy<FeePool>("FeePool");
    mockYamato = await getFakeProxy<Yamato>("Yamato");
    mockYamatoDepositor = await getFakeProxy<YamatoDepositor>(
      "YamatoDepositor"
    );
    mockYamatoBorrower = await getFakeProxy<YamatoBorrower>("YamatoBorrower");
    mockYamatoRepayer = await getFakeProxy<YamatoRepayer>("YamatoRepayer");
    mockYamatoWithdrawer = await getFakeProxy<YamatoWithdrawer>(
      "YamatoWithdrawer"
    );
    mockYamatoRedeemer = await getFakeProxy<YamatoRedeemer>("YamatoRedeemer");
    mockYamatoSweeper = await getFakeProxy<YamatoSweeper>("YamatoSweeper");
    mockYamato.depositor.returns(mockYamatoDepositor.address);
    mockYamato.borrower.returns(mockYamatoBorrower.address);
    mockYamato.repayer.returns(mockYamatoRepayer.address);
    mockYamato.withdrawer.returns(mockYamatoWithdrawer.address);
    mockYamato.redeemer.returns(mockYamatoRedeemer.address);
    mockYamato.sweeper.returns(mockYamatoSweeper.address);
    mockYamato.permitDeps.returns(true);

    currencyOS = await getProxy<CurrencyOS, CurrencyOS__factory>("CurrencyOS", [
      mockCJPY.address,
      mockFeed.address,
      mockFeePool.address,
    ]);

    mockCJPY.mint.returns(0);
    mockCJPY.burn.returns(0);
  });

  describe("addYamato()", function () {
    it(`fails to add new Yamato for non-governer.`, async function () {
      await expect(
        currencyOS.connect(accounts[1]).addYamato(mockYamato.address)
      ).to.be.revertedWith("You are not the governer.");
    });

    it(`succeeds to add new Yamato`, async function () {
      await currencyOS.addYamato(mockYamato.address); // onlyGovernance
      const _yamato = await currencyOS.yamatoes(0);
      expect(_yamato).to.equal(mockYamato.address);
    });

    it(`fails to add the same Yamato twice.`, async function () {
      await currencyOS.addYamato(mockYamato.address);

      await expect(currencyOS.addYamato(mockYamato.address)).to.be.revertedWith(
        "Duplicated Yamato."
      );
    });
  });

  describe("mintCJPY()", function () {
    it(`fails to mint CJPY`, async function () {
      // await currencyOS.mintCJPY(ownerAddress, 10000);
      await expect(
        currencyOS.mintCurrency(ownerAddress, 10000)
      ).to.be.revertedWith("No Yamato is registered.");
    });

    it(`succeeds to mint CJPY`, async function () {
      await currencyOS.addYamato(mockYamato.address); // onlyGovernance
      await currencyOS.mintCurrency(ownerAddress, 10000); // onlyYamato
      expect(mockCJPY.mint).to.be.calledOnce;
    });
  });

  describe("burnCurrency()", function () {
    it(`fails to burn CJPY`, async function () {
      await expect(
        currencyOS.burnCurrency(ownerAddress, 10000)
      ).to.be.revertedWith("No Yamato is registered.");
    });

    it(`succeeds to burn CJPY`, async function () {
      await currencyOS.addYamato(mockYamato.address); // onlyGovernance
      await currencyOS.burnCurrency(ownerAddress, 10000); // onlyYamato
      expect(mockCJPY.burn).to.be.calledOnce;
    });
  });
});
