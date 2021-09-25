import { ethers } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import { BigNumber, utils } from "ethers";
const { AbiCoder, ParamType } = utils;

const { waffleJest } = require("@ethereum-waffle/jest");
expect.extend(waffleJest);
const betterexpect = <any>expect; // TODO: better typing for waffleJest
import chai from "chai";
import {
  summon,
  forge,
  create,
  getSharedProvider,
  getSharedSigners,
  parseAddr,
  parseBool,
  parseInteger,
  getLogs,
  encode,
  decode,
  increaseTime,
  toERC20,
  toFloat,
  onChainNow,
} from "@test/param/helper";
import {
  getBulksaleAbiArgs,
  getTokenAbiArgs,
  sendEther,
} from "@test/param/scenarioHelper";
import { State } from "@test/param/parameterizedSpecs";
import { parameterizedSpecs } from "@test/param/paramSpecEntrypoint";
import { suite, test } from "@testdeck/jest";
import fs from "fs";
import { BalanceLogger } from "@src/BalanceLogger";
import {
  Yamato,
  Pool,
  CjpyOS,
  CJPY,
  YMT,
  VeYMT,
  PriceFeed,
  CjpyOS__factory,
} from "../../typechain";

import { genABI } from "@src/genABI";

const CJPY_OS_ABI = genABI("CjpyOS");

chai.use(smock.matchers);

/* Parameterized Test (Testcases are in /test/parameterizedSpecs.ts) */
describe("Smock for CjpyOS", function () {
  it(`succeeds to make a mock`, async function () {
    const mock = await smock.fake<CjpyOS>("CjpyOS");
    // betterexpect(isMockContract(mock)).toBe(true);
  });
});

describe("CjpyOS", function () {
  let mockCJPY: FakeContract<CJPY>;
  let mockYMT: FakeContract<YMT>;
  let mockVeYMT: FakeContract<VeYMT>;
  let mockFeed: FakeContract<PriceFeed>;
  let cjpyOS: CjpyOS;
  let accounts;

  beforeEach(async () => {
    accounts = await getSharedSigners();
    mockCJPY = await smock.fake<CJPY>("CJPY", { address: accounts[0].address });
    mockYMT = await smock.fake<YMT>("YMT", { address: accounts[0].address });
    mockVeYMT = await smock.fake<VeYMT>("veYMT", {
      address: accounts[0].address,
    });
    mockFeed = await smock.fake<PriceFeed>("PriceFeed", {
      address: accounts[0].address,
    });

    cjpyOS = await (<CjpyOS__factory>(
      await ethers.getContractFactory("CjpyOS")
    )).deploy(
      mockCJPY.address,
      mockYMT.address,
      mockVeYMT.address,
      mockFeed.address
      // governance=deployer
    );

    mockCJPY.mint.returns(0);
    mockCJPY.burnFrom.returns(0);
  });

  describe("addYamato()", function () {
    it(`fails to add new Yamato for non-governer.`, async function () {
      await betterexpect(
        cjpyOS.connect(accounts[1].address).addYamato(accounts[1].address)
      ).toBeReverted();
    });

    it(`succeeds to add new Yamato`, async function () {
      await cjpyOS.addYamato(accounts[0].address); // onlyGovernance
      const _yamato = await cjpyOS.yamatoes(0);
      betterexpect(_yamato).toBe(accounts[0].address);
    });
  });

  describe("mintCJPY()", function () {
    it(`fails to mint CJPY`, async function () {
      await betterexpect(
        cjpyOS.mintCJPY(accounts[0].address, 10000)
      ).toBeReverted();
    });

    it(`succeeds to mint CJPY`, async function () {
      await cjpyOS.addYamato(accounts[0].address); // onlyGovernance
      await cjpyOS.mintCJPY(accounts[0].address, 10000); // onlyYamato
      chai.expect(mockCJPY.mint).to.be.calledOnce;
    });
  });

  describe("burnCJPY()", function () {
    it(`fails to burn CJPY`, async function () {
      await betterexpect(
        cjpyOS.burnCJPY(accounts[0].address, 10000)
      ).toBeReverted();
    });

    it(`succeeds to burn CJPY`, async function () {
      await cjpyOS.addYamato(accounts[0].address); // onlyGovernance
      await cjpyOS.burnCJPY(accounts[0].address, 10000); // onlyYamato
      chai.expect(mockCJPY.burnFrom).to.be.calledOnce;
    });
  });
});
