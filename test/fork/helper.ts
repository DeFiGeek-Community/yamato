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
  readonly MONTH: BigNumber = BigNumber.from(86400 * 30);
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

  readonly GAUGE_TYPES = [BigNumber.from("1"), BigNumber.from("1"), BigNumber.from("2")];

  accounts: Signer[];
  accountsAddress: String[];
  token: Contract;
  voting_escrow: Contract;
  gauge_controller: Contract;
  mock_lp_token: Contract;
  minter: Contract;
  three_gauges_contracts: Contract[];
  three_gauges: string[];

  TYPE_WEIGHTS: BigNumber[];
  GAUGE_WEIGHTS: BigNumber[];

  async setup() {
    
    const [creator, alice, bob, charly] = await ethers.getSigners();
    this.accounts = [creator, alice, bob, charly];
    this.accountsAddress = [
      await creator.getAddress(),
      await alice.getAddress(),
      await bob.getAddress(),
      await charly.getAddress(),
    ];

    this.TYPE_WEIGHTS = [this.ten_to_the_17.mul(this.b), this.ten_to_the_18.mul(this.a)];
    this.GAUGE_WEIGHTS = [this.ten_to_the_18.mul(this.a), this.ten_to_the_18, this.ten_to_the_17.mul(this.b)];

    const Token = await ethers.getContractFactory("CRV");
    const VotingEscrow = await ethers.getContractFactory("VotingEscrow");
    const GaugeController = await ethers.getContractFactory("GaugeController");
    const LiquidityGauge = await ethers.getContractFactory("LiquidityGauge");
    const TestLP = await ethers.getContractFactory("TestLP");
    const Minter = await ethers.getContractFactory("Minter");

    // deploy
    this.token = await Token.deploy();
    this.voting_escrow = await VotingEscrow.deploy(
      this.token.address,
      "Voting-escrowed token",
      "vetoken",
      "v1"
    );
    this.gauge_controller = await GaugeController.deploy(this.token.address, this.voting_escrow.address);
    this.mock_lp_token = await TestLP.deploy("tokenDAO LP token", "iToken", 18, BigNumber.from("1000000000000000000000"));
    this.minter = await Minter.deploy(this.token.address, this.gauge_controller.address);
    const lg1 = await LiquidityGauge.deploy(this.mock_lp_token.address, this.minter.address);
    const lg2 = await LiquidityGauge.deploy(this.mock_lp_token.address, this.minter.address);
    const lg3 = await LiquidityGauge.deploy(this.mock_lp_token.address, this.minter.address);
    this.three_gauges_contracts = [lg1, lg2, lg3];
    this.three_gauges = [lg1.address, lg2.address, lg3.address];

    await this.token.setMinter(this.minter.address);
    // setup
    await this.gauge_controller.addType("none", 0);
  }


  async addType(){
    await this.gauge_controller.addType("Liquidity", this.TYPE_WEIGHTS[0]);
    await this.gauge_controller.addType("Liquidity", this.TYPE_WEIGHTS[1]);
  }

  async addGaugeZero(){
    for (let i = 0; i < 2; i++) {
      await this.gauge_controller.addGauge(this.three_gauges[i], this.GAUGE_TYPES[i], 0);
    }
  }
  async addGauge(){
    for (let i = 0; i < 3; i++) {
      await this.gauge_controller.addGauge(this.three_gauges[i], this.GAUGE_TYPES[i], this.GAUGE_WEIGHTS[i]);
    }
  }

  async createLock(){
    await this.token.approve(this.voting_escrow.address, BigNumber.from("1000000000000000000000000"));
    await this.voting_escrow.createLock(
      BigNumber.from("1000000000000000000000000"),
      BigNumber.from((await ethers.provider.getBlock("latest")).timestamp).add(this.YEAR)
    );
  }

  async createLP(){
    for (let i = 1; i < 4; i++) {
      await this.mock_lp_token.transfer(this.accountsAddress[i], this.ten_to_the_18);
    }

    for (let i = 0; i < 3; i++) {
      for (let t = 0; t < 3; t++) {
        await this.mock_lp_token.connect(this.accounts[i + 1]).approve(this.three_gauges[t], this.ten_to_the_18);
      }
    }
  }
}

export { EVMUtils, TestSetup };
