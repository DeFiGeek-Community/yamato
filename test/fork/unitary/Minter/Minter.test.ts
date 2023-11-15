import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract } from "ethers";
import {
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { deployContracts } from "../../helper";
import Constants from "../../Constants";

describe("Minter", function () {
  let accounts: SignerWithAddress[];
  let minter: Contract;
  let gaugeController: Contract;
  let token: Contract;
  let mockLpToken: Contract;
  let threeGauges: String[];
  let gauges: Contract[];

  let snapshot: SnapshotRestorer;

  const TYPE_WEIGHTS = Constants.TYPE_WEIGHTS;
  const GAUGE_WEIGHTS = Constants.GAUGE_WEIGHTS;
  const GAUGE_TYPES = [0, 0, 1];

  const ten_to_the_18 = Constants.ten_to_the_18;
  const ten_to_the_17 = Constants.ten_to_the_17;
  const ZERO_ADDRESS = Constants.ZERO_ADDRESS;
  const zero = Constants.zero;
  const WEEK = Constants.WEEK;
  const month = Constants.month;
  const week = Constants.week;

  beforeEach(async function () {
    snapshot = await takeSnapshot();
    accounts = await ethers.getSigners();
    ({ gaugeController, minter, token, mockLpToken, threeGauges, gauges } =
      await deployContracts());

    // Set minter for the token
    await token.setMinter(minter.address);

    // Skip to the start of a new epoch week
    const currentWeek = BigNumber.from(
      (await ethers.provider.getBlock("latest")).timestamp
    )
      .div(WEEK)
      .mul(WEEK);
    await ethers.provider.send("evm_setNextBlockTimestamp", [
      currentWeek.add(WEEK).toNumber(),
    ]);

    // Add types and gauges
    for (const weight of TYPE_WEIGHTS) {
      await gaugeController.addType("Liquidity", weight);
    }
    for (let i = 0; i < 3; i++) {
      await gaugeController.addGauge(
        threeGauges[i],
        GAUGE_TYPES[i],
        GAUGE_WEIGHTS[i]
      );
    }
    for (const account of accounts) {
      mockLpToken.transfer(account.address, ten_to_the_18);
    }
    for (let i = 1; i <= 3; i++) {
      for (const gauge of threeGauges) {
        await mockLpToken.connect(accounts[i]).approve(gauge, ten_to_the_18);
      }
    }
  });

  afterEach(async () => {
    await snapshot.restore();
  });
  describe("Minter Behavior", function () {
    // Test basic mint functionality
    it("test_mint", async () => {
      await gauges[0]
        .connect(accounts[1])
        .deposit(ten_to_the_17, accounts[1].address, false);

      await ethers.provider.send("evm_increaseTime", [month]);

      await minter.connect(accounts[1]).mint(threeGauges[0]); //gauge_address, msg.sender, mint
      let expected = await gauges[0].integrateFraction(accounts[1].address);

      expect(expected.gt(BigNumber.from("0"))).to.be.equal(true);
      expect(await token.balanceOf(accounts[1].address)).to.equal(expected);
      expect(await minter.minted(accounts[1].address, threeGauges[0])).to.equal(
        expected
      );
    });

    // Test minting immediately after setup
    it("test_mint_immediate", async () => {
      await gauges[0]
        .connect(accounts[1])
        .deposit(ten_to_the_18, accounts[1].address, false);

      let t0 = BigNumber.from(
        (await ethers.provider.getBlock("latest")).timestamp
      );
      let moment = t0.add(WEEK).div(WEEK).mul(WEEK).add("5");
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        moment.toNumber(),
      ]);

      //mint
      expect(await minter.minted(accounts[1].address, threeGauges[0])).to.equal(
        "0"
      );
      await minter.connect(accounts[1]).mint(threeGauges[0]);

      //check
      let balance = await token.balanceOf(accounts[1].address);
      expect(await minter.minted(accounts[1].address, threeGauges[0])).to.equal(
        balance
      );
    });

    // Test multiple mint operations on the same gauge
    it("test_mint_multiple_same_gauge", async () => {
      await gauges[0]
        .connect(accounts[1])
        .deposit(ten_to_the_18, accounts[1].address, false);
      await ethers.provider.send("evm_increaseTime", [month]);
      await minter.connect(accounts[1]).mint(threeGauges[0]);
      let balance = await token.balanceOf(accounts[1].address);
      await ethers.provider.send("evm_increaseTime", [month]);
      await minter.connect(accounts[1]).mint(threeGauges[0]);
      let expected = await gauges[0].integrateFraction(accounts[1].address);
      let final_balance = await token.balanceOf(accounts[1].address);

      expect(final_balance.gt(balance)).to.be.equal(true); //2nd mint success
      expect(final_balance).to.equal(expected); //2nd mint works fine
      expect(await minter.minted(accounts[1].address, threeGauges[0])).to.equal(
        expected
      ); //tracks fine
    });

    // Test minting across multiple gauges
    it("test_mint_multiple_gauges", async () => {
      //setup
      await gauges[0]
        .connect(accounts[1])
        .deposit(ten_to_the_17, accounts[1].address, false);
      await gauges[1]
        .connect(accounts[1])
        .deposit(ten_to_the_17, accounts[1].address, false);
      await gauges[2]
        .connect(accounts[1])
        .deposit(ten_to_the_17, accounts[1].address, false);

      await ethers.provider.send("evm_increaseTime", [month]);

      //mint
      for (let i = 0; i < 3; i++) {
        await minter.connect(accounts[1]).mint(threeGauges[i]);
      }

      //check
      let total_minted = BigNumber.from("0");

      for (let i = 0; i < 3; i++) {
        let gauge = gauges[i];
        let minted = await minter.minted(accounts[1].address, gauge.address);
        expect(minted).to.equal(
          await gauge.integrateFraction(accounts[1].address)
        );
        total_minted = total_minted.add(minted);
      }

      expect(await token.balanceOf(accounts[1].address)).to.equal(total_minted);
    });

    // Test minting after withdrawing
    it("test_mint_after_withdraw", async () => {
      await gauges[0]
        .connect(accounts[1])
        .deposit(ten_to_the_18, accounts[1].address, false);

      await ethers.provider.send("evm_increaseTime", [week * 2]);

      await gauges[0].connect(accounts[1]).withdraw(ten_to_the_18, false);
      await minter.connect(accounts[1]).mint(threeGauges[0]);

      expect(
        (await token.balanceOf(accounts[1].address)).gt(BigNumber.from("0"))
      ).to.equal(true);
    });

    // Test multiple mints after withdrawing
    it("test_mint_multiple_after_withdraw", async () => {
      await gauges[0]
        .connect(accounts[1])
        .deposit(ten_to_the_18, accounts[1].address, false);

      await ethers.provider.send("evm_increaseTime", [10]);
      await gauges[0].connect(accounts[1]).withdraw(ten_to_the_18, false);
      await minter.connect(accounts[1]).mint(threeGauges[0]);

      let balance = await token.balanceOf(accounts[1].address);

      await ethers.provider.send("evm_increaseTime", [10]);
      await minter.connect(accounts[1]).mint(threeGauges[0]);

      expect(await token.balanceOf(accounts[1].address)).to.equal(balance);
    });

    // Test mint without any deposit
    it("test_no_deposit", async () => {
      await minter.connect(accounts[1]).mint(threeGauges[0]);
      expect(await token.balanceOf(accounts[1].address)).to.equal(zero);
      expect(await minter.minted(accounts[1].address, threeGauges[0])).to.equal(
        zero
      );
    });

    // Test minting with the wrong gauge
    it("test_mint_wrong_gauge", async () => {
      await gauges[0]
        .connect(accounts[1])
        .deposit(ten_to_the_18, accounts[1].address, false);

      await ethers.provider.send("evm_increaseTime", [month]);
      await minter.connect(accounts[1]).mint(threeGauges[1]);

      //check
      expect(await token.balanceOf(accounts[1].address)).to.equal(zero);
      expect(await minter.minted(accounts[1].address, threeGauges[0])).to.equal(
        zero
      );
      expect(await minter.minted(accounts[1].address, threeGauges[1])).to.equal(
        zero
      );
    });

    // Test minting with an invalid gauge address
    it("test_mint_not_a_gauge", async () => {
      await expect(minter.mint(accounts[1].address)).to.revertedWith(
        "dev: gauge is not added"
      );
    });

    // Test minting before inflation begins
    it("test_mint_before_inflation_begins", async function () {
      await gauges[0]
        .connect(accounts[1])
        .deposit(ten_to_the_18, accounts[1].address, false);
      const startEpochTime = await token.startEpochTime();
      const currentTime = BigNumber.from(
        (await ethers.provider.getBlock("latest")).timestamp
      );
      const timeToSleep = startEpochTime.sub(currentTime).sub(5);
      await ethers.provider.send("evm_increaseTime", [timeToSleep.toNumber()]);

      await minter.connect(accounts[1]).mint(threeGauges[0]);

      expect(await token.balanceOf(accounts[1].address)).to.equal(
        BigNumber.from(0)
      );
      expect(await minter.minted(accounts[1].address, threeGauges[0])).to.equal(
        BigNumber.from(0)
      );
    });

    // Test mintMany function with multiple gauges
    it("test_mintMany_function_multiple_gauges", async () => {
      //setup
      await gauges[0]
        .connect(accounts[1])
        .deposit(ten_to_the_17, accounts[1].address, false);
      await gauges[1]
        .connect(accounts[1])
        .deposit(ten_to_the_17, accounts[1].address, false);
      await gauges[2]
        .connect(accounts[1])
        .deposit(ten_to_the_17, accounts[1].address, false);

      await ethers.provider.send("evm_increaseTime", [month]);

      let addresses = [
        threeGauges[0],
        threeGauges[1],
        threeGauges[2],
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
      ];
      await minter.connect(accounts[1]).mintMany(addresses);

      //check
      let total_minted = BigNumber.from("0");

      for (let i = 0; i < 3; i++) {
        let gauge = gauges[i];
        let minted = await minter.minted(accounts[1].address, gauge.address);
        expect(minted).to.equal(
          await gauge.integrateFraction(accounts[1].address)
        );
        total_minted = total_minted.add(minted);
      }

      expect(await token.balanceOf(accounts[1].address)).to.equal(total_minted);
    });

    // Test toggling of the mint approval function
    it("test_toggleApproveMint_function", async () => {
      await minter.connect(accounts[1]).toggleApproveMint(accounts[2].address);
      expect(
        await minter.allowedToMintFor(accounts[2].address, accounts[1].address)
      ).to.equal(true);

      await minter.connect(accounts[1]).toggleApproveMint(accounts[2].address);
      expect(
        await minter.allowedToMintFor(accounts[2].address, accounts[1].address)
      ).to.equal(false);
    });

    // Test minting on behalf of another user
    it("test_mintFor_function", async () => {
      await gauges[0]
        .connect(accounts[1])
        .deposit(ten_to_the_17, accounts[1].address, false);

      await ethers.provider.send("evm_increaseTime", [month]);

      await minter.connect(accounts[1]).toggleApproveMint(accounts[2].address);
      expect(
        await minter.allowedToMintFor(accounts[2].address, accounts[1].address)
      ).to.equal(true);

      await minter
        .connect(accounts[2])
        .mintFor(threeGauges[0], accounts[1].address);

      let expected = await gauges[0].integrateFraction(accounts[1].address);
      expect(expected.gt(BigNumber.from("0"))).to.be.equal(true);
      expect(await token.balanceOf(accounts[1].address)).to.equal(expected);
      expect(await minter.minted(accounts[1].address, threeGauges[0])).to.equal(
        expected
      );
    });

    // Test mintFor function when not approved
    it("test_mintForFail_function", async () => {
      await gauges[0]
        .connect(accounts[1])
        .deposit(ten_to_the_17, accounts[1].address, false);

      await ethers.provider.send("evm_increaseTime", [month]);

      expect(
        await minter.allowedToMintFor(accounts[2].address, accounts[1].address)
      ).to.equal(false);

      await minter
        .connect(accounts[2])
        .mintFor(threeGauges[0], accounts[1].address);

      expect(await token.balanceOf(accounts[1].address)).to.equal(0);
      expect(await minter.minted(accounts[1].address, threeGauges[0])).to.equal(
        0
      );
    });
  });
});
