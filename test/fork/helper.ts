import { ethers } from "hardhat";
import { BigNumber, Contract, Signer } from "ethers";


class EVMUtils {
  async snapshot(): Promise<string> {
    return await ethers.provider.send("evm_snapshot", []);
  }

  async restore(snapshotId: string): Promise<void> {
    return await ethers.provider.send("evm_revert", [snapshotId]);
  }
}

class TestSetup {

  readonly DAY = BigNumber.from(86400);
  readonly WEEK = BigNumber.from(86400 * 7);
  readonly MONTH = BigNumber.from(86400 * 30);
  readonly YEAR = BigNumber.from(86400 * 365);

  readonly name = "Token";
  readonly symbol = "Token";
  readonly decimal = 18;
  readonly INITIAL_SUPPLY = BigNumber.from("1303030303000000000000000000");

  readonly ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  readonly ten_to_the_24 = BigNumber.from("1000000000000000000000000");
  readonly ten_to_the_21 = BigNumber.from("1000000000000000000000");
  readonly ten_to_the_20 = BigNumber.from("100000000000000000000");
  readonly ten_to_the_19 = BigNumber.from("10000000000000000000");
  readonly ten_to_the_18 = BigNumber.from("1000000000000000000");
  readonly ten_to_the_17 = BigNumber.from("100000000000000000");
  readonly ten_to_the_9 = BigNumber.from("1000000000");
  readonly a = BigNumber.from("2");
  readonly b = BigNumber.from("5");
  readonly zero = BigNumber.from("0");
  readonly MAX_UINT256 = BigNumber.from("115792089237316195423570985008687907853269984665640564039457584007913129639935");

  readonly GAUGE_TYPES = [BigNumber.from("1"), BigNumber.from("1"), BigNumber.from("2")];


  creator: Signer;
  alice: Signer;
  bob: Signer;
  charly: Signer;
  creatorAddress: String;
  aliceAddress: String;
  bobAddress: String;
  charlyAddress: String;
  accounts: Signer[];
  accountsAddress: String[];
  token: Contract;
  votingEscrow: Contract;
  gaugeController: Contract;
  mockLpToken: Contract;
  minter: Contract;
  lg: Contract;
  gaugesContracts: Contract[];
  gaugesAddress: string[];

  TYPE_WEIGHTS: BigNumber[];
  GAUGE_WEIGHTS: BigNumber[];

  async setup() {
    
    [this.creator, this.alice, this.bob, this.charly] = await ethers.getSigners();
    this.accounts = [this.creator, this.alice, this.bob, this.charly];
    this.creatorAddress = await this.creator.getAddress();
    this.aliceAddress = await this.alice.getAddress();
    this.bobAddress = await this.bob.getAddress();
    this.charlyAddress = await this.charly.getAddress();
    this.accountsAddress = [
      this.creatorAddress,
      this.aliceAddress,
      this.bobAddress,
      this.charlyAddress,
    ];

    this.TYPE_WEIGHTS = [this.ten_to_the_17.mul(this.b), this.ten_to_the_18.mul(this.a)];
    this.GAUGE_WEIGHTS = [this.ten_to_the_18.mul(this.a), this.ten_to_the_18, this.ten_to_the_17.mul(this.b)];

    const Token = await ethers.getContractFactory("CRV");
    const VotingEscrow = await ethers.getContractFactory("VotingEscrow");
    const GaugeController = await ethers.getContractFactory("GaugeController");
    const LiquidityGauge = await ethers.getContractFactory("LiquidityGaugeV6");
    const TestLP = await ethers.getContractFactory("TestLP");
    const Minter = await ethers.getContractFactory("Minter");

    // deploy
    this.token = await Token.deploy();
    this.votingEscrow = await VotingEscrow.deploy(
      this.token.address,
      "Voting-escrowed token",
      "vetoken",
      "v1"
      );
    this.gaugeController = await GaugeController.deploy(this.token.address, this.votingEscrow.address);
    this.mockLpToken = await TestLP.deploy("tokenDAO LP token", "iToken", 18, this.ten_to_the_21.mul("2"));
    this.minter = await Minter.deploy(this.token.address, this.gaugeController.address);
    this.lg = await LiquidityGauge.deploy(
      this.mockLpToken.address,
      this.minter.address,
      );
    const lg2 = await LiquidityGauge.deploy(
      this.mockLpToken.address,
      this.minter.address,
    );
    const lg3 = await LiquidityGauge.deploy(
      this.mockLpToken.address,
      this.minter.address,
    );
    this.gaugesContracts = [this.lg, lg2, lg3];
    this.gaugesAddress = [this.lg.address, lg2.address, lg3.address];
    await this.token.setMinter(this.minter.address);
    // setup
    await this.gaugeController.addType("none", 0);
  }


  async addType(){
    await this.gaugeController.addType("Liquidity", this.TYPE_WEIGHTS[0]);
    await this.gaugeController.addType("Liquidity", this.TYPE_WEIGHTS[1]);
  }

  async addGaugeZero(){
    for (let i = 0; i < 2; i++) {
      await this.gaugeController.addGauge(this.gaugesAddress[i], this.GAUGE_TYPES[i], 0);
    }
  }
  async addGauge(){
    for (let i = 0; i < 3; i++) {
      await this.gaugeController.addGauge(this.gaugesAddress[i], this.GAUGE_TYPES[i], this.GAUGE_WEIGHTS[i]);
    }
  }

  async createLock(){
    await this.token.approve(this.votingEscrow.address, BigNumber.from("1000000000000000000000000"));
    await this.votingEscrow.createLock(
      BigNumber.from("1000000000000000000000000"),
      BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).add(this.YEAR)
    );
  }

  async createLP(){
    for (let i = 1; i < 4; i++) {
      await this.mockLpToken.transfer(this.accountsAddress[i], this.ten_to_the_18);
    }

    for (let i = 0; i < 3; i++) {
      for (let t = 0; t < 3; t++) {
        await this.mockLpToken.connect(this.accounts[i + 1]).approve(this.gaugesAddress[t], this.ten_to_the_18);
      }
    }
  }
}

export { EVMUtils, TestSetup };
