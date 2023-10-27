import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { EVMUtils, GaugeControllerTestSetup } from "../helper";

describe("Minter", function () {
  let setup: GaugeControllerTestSetup;
  let evm: EVMUtils;
  let snapshotId: string;

  before(async () => {
    setup = new GaugeControllerTestSetup();
    await setup.setup();
    await setup.addType();
    await setup.addGauge();
    await setup.createLP();
  });

  beforeEach(async () => {
    evm = new EVMUtils();
    snapshotId = await evm.snapshot();
  });

  afterEach(async () => {
    await evm.restore(snapshotId);
  });

  describe("Minter Behavior", function () {

    // Test basic mint functionality
    it("test mint", async () => {
      await setup.three_gauges_contracts[0].connect(setup.accounts[1]).deposit(setup.ten_to_the_17, setup.accountsAddress[1]);

      await ethers.provider.send("evm_increaseTime", [setup.MONTH.toNumber()]);

      await setup.minter.connect(setup.accounts[1]).mint(setup.three_gauges[0]); //gauge_address, msg.sender, mint
      let expected = await setup.three_gauges_contracts[0].integrateFraction(setup.accountsAddress[1]);

      expect(expected.gt(BigNumber.from("0"))).to.be.equal(true);
      expect(await setup.token.balanceOf(setup.accountsAddress[1])).to.equal(expected);
      expect(await setup.minter.minted(setup.accountsAddress[1], setup.three_gauges[0])).to.equal(expected);
    });

    // Test minting immediately after setup
    it("test mint immediate", async () => {
      await setup.three_gauges_contracts[0].connect(setup.accounts[1]).deposit(setup.ten_to_the_18, setup.accountsAddress[1]);

      let t0 = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
      let moment = t0.add(setup.WEEK).div(setup.WEEK).mul(setup.WEEK).add("5");
      await ethers.provider.send("evm_setNextBlockTimestamp", [moment.toNumber()]);

      //mint
      expect(await setup.minter.minted(setup.accountsAddress[1], setup.three_gauges[0])).to.equal("0");
      await setup.minter.connect(setup.accounts[1]).mint(setup.three_gauges[0]);

      //check
      let balance = await setup.token.balanceOf(setup.accountsAddress[1]);
      expect(await setup.minter.minted(setup.accountsAddress[1], setup.three_gauges[0])).to.equal(balance);
    });

    // Test multiple mint operations on the same gauge
    it("test mint multiple same gauge", async () => {
      await setup.three_gauges_contracts[0].connect(setup.accounts[1]).deposit(setup.ten_to_the_18, setup.accountsAddress[1]);
      await ethers.provider.send("evm_increaseTime", [setup.MONTH.toNumber()]);
      await setup.minter.connect(setup.accounts[1]).mint(setup.three_gauges[0]);
      let balance = await setup.token.balanceOf(setup.accountsAddress[1]);
      await ethers.provider.send("evm_increaseTime", [setup.MONTH.toNumber()]);
      await setup.minter.connect(setup.accounts[1]).mint(setup.three_gauges[0]);
      let expected = await setup.three_gauges_contracts[0].integrateFraction(setup.accountsAddress[1]);
      let final_balance = await setup.token.balanceOf(setup.accountsAddress[1]);

      expect(final_balance.gt(balance)).to.be.equal(true); //2nd mint success
      expect(final_balance).to.equal(expected); //2nd mint works fine
      expect(await setup.minter.minted(setup.accountsAddress[1], setup.three_gauges[0])).to.equal(expected); //tracks fine
    });

    // Test minting across multiple gauges
    it("test mint multiple gauges", async () => {
      //setup
      await setup.three_gauges_contracts[0].connect(setup.accounts[1]).deposit(setup.ten_to_the_17, setup.accountsAddress[1]);
      await setup.three_gauges_contracts[1].connect(setup.accounts[1]).deposit(setup.ten_to_the_17, setup.accountsAddress[1]);
      await setup.three_gauges_contracts[2].connect(setup.accounts[1]).deposit(setup.ten_to_the_17, setup.accountsAddress[1]);

      await ethers.provider.send("evm_increaseTime", [setup.MONTH.toNumber()]);

      //mint
      for (let i = 0; i < 3; i++) {
        await setup.minter.connect(setup.accounts[1]).mint(setup.three_gauges[i]);
      }

      //check
      let total_minted = BigNumber.from("0");

      for (let i = 0; i < 3; i++) {
        let gauge = setup.three_gauges_contracts[i];
        let minted = await setup.minter.minted(setup.accountsAddress[1], gauge.address);
        expect(minted).to.equal(await gauge.integrateFraction(setup.accountsAddress[1]));
        total_minted = total_minted.add(minted);
      }

      expect(await setup.token.balanceOf(setup.accountsAddress[1])).to.equal(total_minted);
    });

    // Test minting after withdrawing
    it("test mint after withdraw", async () => {
      await setup.three_gauges_contracts[0].connect(setup.accounts[1]).deposit(setup.ten_to_the_18, setup.accountsAddress[1]);

      await ethers.provider.send("evm_increaseTime", [setup.WEEK.mul(BigNumber.from("2")).toNumber()]);

      await setup.three_gauges_contracts[0].connect(setup.accounts[1]).withdraw(setup.ten_to_the_18);
      await setup.minter.connect(setup.accounts[1]).mint(setup.three_gauges[0]);

      expect((await setup.token.balanceOf(setup.accountsAddress[1])).gt(BigNumber.from("0"))).to.equal(true);
    });

    // Test multiple mints after withdrawing
    it("test mint multiple after withdraw", async () => {
      await setup.three_gauges_contracts[0].connect(setup.accounts[1]).deposit(setup.ten_to_the_18, setup.accountsAddress[1]);

      await ethers.provider.send("evm_increaseTime", [10]);
      await setup.three_gauges_contracts[0].connect(setup.accounts[1]).withdraw(setup.ten_to_the_18);
      await setup.minter.connect(setup.accounts[1]).mint(setup.three_gauges[0]);

      let balance = await setup.token.balanceOf(setup.accountsAddress[1]);

      await ethers.provider.send("evm_increaseTime", [10]);
      await setup.minter.connect(setup.accounts[1]).mint(setup.three_gauges[0]);

      expect(await setup.token.balanceOf(setup.accountsAddress[1])).to.equal(balance);
    });

    // Test mint without any deposit
    it("test no deposit", async () => {
      await setup.minter.connect(setup.accounts[1]).mint(setup.three_gauges[0]);
      expect(await setup.token.balanceOf(setup.accountsAddress[1])).to.equal(setup.zero);
      expect(await setup.minter.minted(setup.accountsAddress[1], setup.three_gauges[0])).to.equal(setup.zero);
    });

    // Test minting with the wrong gauge
    it("test mint wrong gauge", async () => {
      await setup.three_gauges_contracts[0].connect(setup.accounts[1]).deposit(setup.ten_to_the_18, setup.accountsAddress[1]);

      await ethers.provider.send("evm_increaseTime", [setup.MONTH.toNumber()]);
      await setup.minter.connect(setup.accounts[1]).mint(setup.three_gauges[1]);

      //check
      expect(await setup.token.balanceOf(setup.accountsAddress[1])).to.equal(setup.zero);
      expect(await setup.minter.minted(setup.accountsAddress[1], setup.three_gauges[0])).to.equal(setup.zero);
      expect(await setup.minter.minted(setup.accountsAddress[1], setup.three_gauges[1])).to.equal(setup.zero);
    });

    // Test minting with an invalid gauge address
    it("test mint not a gauge", async () => {
      await expect(setup.minter.mint(setup.accountsAddress[1])).to.revertedWith("dev: gauge is not added");
    });

    // Test minting before inflation begins
    it("test mint before inflation begins", async () => {
      await setup.three_gauges_contracts[0].connect(setup.accounts[1]).deposit(setup.ten_to_the_18, setup.accountsAddress[1]);
      expect(await setup.token.miningEpoch()).to.equal(BigNumber.from("-1"));

      await setup.minter.connect(setup.accounts[1]).mint(setup.three_gauges[0]);
      expect(await setup.token.balanceOf(setup.accountsAddress[1])).to.equal(BigNumber.from("0"));
      expect(await setup.minter.minted(setup.accountsAddress[1], setup.three_gauges[0])).to.equal(setup.zero);
    });

    // Test mintMany function with multiple gauges
    it("test mintMany function multiple gauges", async () => {
      //setup
      await setup.three_gauges_contracts[0].connect(setup.accounts[1]).deposit(setup.ten_to_the_17, setup.accountsAddress[1]);
      await setup.three_gauges_contracts[1].connect(setup.accounts[1]).deposit(setup.ten_to_the_17, setup.accountsAddress[1]);
      await setup.three_gauges_contracts[2].connect(setup.accounts[1]).deposit(setup.ten_to_the_17, setup.accountsAddress[1]);

      await ethers.provider.send("evm_increaseTime", [setup.MONTH.toNumber()]);

      let addresses = [
        setup.three_gauges[0],
        setup.three_gauges[1],
        setup.three_gauges[2],
        setup.ZERO_ADDRESS,
        setup.ZERO_ADDRESS,
        setup.ZERO_ADDRESS,
        setup.ZERO_ADDRESS,
        setup.ZERO_ADDRESS,
      ];
      await setup.minter.connect(setup.accounts[1]).mintMany(addresses);

      //check
      let total_minted = BigNumber.from("0");

      for (let i = 0; i < 3; i++) {
        let gauge = setup.three_gauges_contracts[i];
        let minted = await setup.minter.minted(setup.accountsAddress[1], gauge.address);
        expect(minted).to.equal(await gauge.integrateFraction(setup.accountsAddress[1]));
        total_minted = total_minted.add(minted);
      }

      expect(await setup.token.balanceOf(setup.accountsAddress[1])).to.equal(total_minted);
    });

    // Test toggling of the mint approval function
    it("test toggleApproveMint function", async () => {
      await setup.minter.connect(setup.accounts[1]).toggleApproveMint(setup.accountsAddress[2]);
      expect(await setup.minter.allowedToMintFor(setup.accountsAddress[2], setup.accountsAddress[1])).to.equal(true);

      await setup.minter.connect(setup.accounts[1]).toggleApproveMint(setup.accountsAddress[2]);
      expect(await setup.minter.allowedToMintFor(setup.accountsAddress[2], setup.accountsAddress[1])).to.equal(false);
    });

    // Test minting on behalf of another user
    it("test mintFor function", async () => {
      await setup.three_gauges_contracts[0].connect(setup.accounts[1]).deposit(setup.ten_to_the_17, setup.accountsAddress[1]);

      await ethers.provider.send("evm_increaseTime", [setup.MONTH.toNumber()]);

      await setup.minter.connect(setup.accounts[1]).toggleApproveMint(setup.accountsAddress[2]);
      expect(await setup.minter.allowedToMintFor(setup.accountsAddress[2], setup.accountsAddress[1])).to.equal(true);

      await setup.minter.connect(setup.accounts[2]).mintFor(setup.three_gauges[0], setup.accountsAddress[1]);

      let expected = await setup.three_gauges_contracts[0].integrateFraction(setup.accountsAddress[1]);
      expect(expected.gt(BigNumber.from("0"))).to.be.equal(true);
      expect(await setup.token.balanceOf(setup.accountsAddress[1])).to.equal(expected);
      expect(await setup.minter.minted(setup.accountsAddress[1], setup.three_gauges[0])).to.equal(expected);
    });

    // Test mintFor function when not approved
    it("test mintForFail function", async () => {
      await setup.three_gauges_contracts[0].connect(setup.accounts[1]).deposit(setup.ten_to_the_17, setup.accountsAddress[1]);

      await ethers.provider.send("evm_increaseTime", [setup.MONTH.toNumber()]);

      expect(await setup.minter.allowedToMintFor(setup.accountsAddress[2], setup.accountsAddress[1])).to.equal(false);

      await setup.minter.connect(setup.accounts[2]).mintFor(setup.three_gauges[0], setup.accountsAddress[1]);

      expect(await setup.token.balanceOf(setup.accountsAddress[1])).to.equal(0);
      expect(await setup.minter.minted(setup.accountsAddress[1], setup.three_gauges[0])).to.equal(0);
    });
  });
});
