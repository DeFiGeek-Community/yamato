import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { EVMUtils, TestSetup } from "../../helper";

describe("Minter", function () {
  let setup: TestSetup;
  let evm: EVMUtils;
  let snapshotId: string;

  beforeEach(async () => {
    evm = new EVMUtils();
    snapshotId = await evm.snapshot();
    setup = new TestSetup();
    await setup.setup();
    await setup.addType();
    await setup.addGauge();
    await setup.createLP();
  });

  afterEach(async () => {
    await evm.restore(snapshotId);
  });

  describe("Minter Behavior", function () {
    // Test basic mint functionality
    it("test mint", async () => {
      await setup.lg
        .connect(setup.alice)
        .deposit(setup.ten_to_the_17, setup.aliceAddress, false);

      await ethers.provider.send("evm_increaseTime", [setup.MONTH.toNumber()]);

      await setup.minter
        .connect(setup.alice)
        .mint(setup.lg.address); //gauge_address, msg.sender, mint
      let expected = await setup.lg.integrateFraction(
        setup.aliceAddress
      );

      expect(expected.gt(BigNumber.from("0"))).to.be.equal(true);
      expect(await setup.token.balanceOf(setup.aliceAddress)).to.equal(
        expected
      );
      expect(
        await setup.minter.minted(
          setup.aliceAddress,
          setup.lg.address
        )
      ).to.equal(expected);
    });

    // Test minting immediately after setup
    it("test mint immediate", async () => {
      await setup.lg
        .connect(setup.alice)
        .deposit(setup.ten_to_the_18, setup.aliceAddress, false);

      let t0 = BigNumber.from(
        (await ethers.provider.getBlock("latest")).timestamp
      );
      let moment = t0.add(setup.WEEK).div(setup.WEEK).mul(setup.WEEK).add("5");
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        moment.toNumber(),
      ]);

      //mint
      expect(
        await setup.minter.minted(
          setup.aliceAddress,
          setup.lg.address
        )
      ).to.equal("0");
      await setup.minter
        .connect(setup.alice)
        .mint(setup.lg.address);

      //check
      let balance = await setup.token.balanceOf(setup.aliceAddress);
      expect(
        await setup.minter.minted(
          setup.aliceAddress,
          setup.lg.address
        )
      ).to.equal(balance);
    });

    // Test multiple mint operations on the same gauge
    it("test mint multiple same gauge", async () => {
      await setup.lg
        .connect(setup.alice)
        .deposit(setup.ten_to_the_18, setup.aliceAddress, false);
      await ethers.provider.send("evm_increaseTime", [setup.MONTH.toNumber()]);
      await setup.minter
        .connect(setup.alice)
        .mint(setup.lg.address);
      let balance = await setup.token.balanceOf(setup.aliceAddress);
      await ethers.provider.send("evm_increaseTime", [setup.MONTH.toNumber()]);
      await setup.minter
        .connect(setup.alice)
        .mint(setup.lg.address);
      let expected = await setup.lg.integrateFraction(
        setup.aliceAddress
      );
      let final_balance = await setup.token.balanceOf(setup.aliceAddress);

      expect(final_balance.gt(balance)).to.be.equal(true); //2nd mint success
      expect(final_balance).to.equal(expected); //2nd mint works fine
      expect(
        await setup.minter.minted(
          setup.aliceAddress,
          setup.lg.address
        )
      ).to.equal(expected); //tracks fine
    });

    // Test minting across multiple gauges
    it("test mint multiple gauges", async () => {
      //setup
      await setup.lg
        .connect(setup.alice)
        .deposit(setup.ten_to_the_17, setup.aliceAddress, false);
      await setup.gaugesContracts[1]
        .connect(setup.alice)
        .deposit(setup.ten_to_the_17, setup.aliceAddress, false);
      await setup.gaugesContracts[2]
        .connect(setup.alice)
        .deposit(setup.ten_to_the_17, setup.aliceAddress, false);

      await ethers.provider.send("evm_increaseTime", [setup.MONTH.toNumber()]);

      //mint
      for (let i = 0; i < 3; i++) {
        await setup.minter
          .connect(setup.alice)
          .mint(setup.gaugesAddress[i]);
      }

      //check
      let total_minted = BigNumber.from("0");

      for (let i = 0; i < 3; i++) {
        let gauge = setup.gaugesContracts[i];
        let minted = await setup.minter.minted(
          setup.aliceAddress,
          gauge.address
        );
        expect(minted).to.equal(
          await gauge.integrateFraction(setup.aliceAddress)
        );
        total_minted = total_minted.add(minted);
      }

      expect(await setup.token.balanceOf(setup.aliceAddress)).to.equal(
        total_minted
      );
    });

    // Test minting after withdrawing
    it("test mint after withdraw", async () => {
      await setup.lg
        .connect(setup.alice)
        .deposit(setup.ten_to_the_18, setup.aliceAddress, false);

      await ethers.provider.send("evm_increaseTime", [
        setup.WEEK.mul(BigNumber.from("2")).toNumber(),
      ]);

      await setup.lg
        .connect(setup.alice)
        .withdraw(setup.ten_to_the_18, false);
      await setup.minter
        .connect(setup.alice)
        .mint(setup.lg.address);

      expect(
        (await setup.token.balanceOf(setup.aliceAddress)).gt(
          BigNumber.from("0")
        )
      ).to.equal(true);
    });

    // Test multiple mints after withdrawing
    it("test mint multiple after withdraw", async () => {
      await setup.lg
        .connect(setup.alice)
        .deposit(setup.ten_to_the_18, setup.aliceAddress, false);

      await ethers.provider.send("evm_increaseTime", [10]);
      await setup.lg
        .connect(setup.alice)
        .withdraw(setup.ten_to_the_18, false);
      await setup.minter
        .connect(setup.alice)
        .mint(setup.lg.address);

      let balance = await setup.token.balanceOf(setup.aliceAddress);

      await ethers.provider.send("evm_increaseTime", [10]);
      await setup.minter
        .connect(setup.alice)
        .mint(setup.lg.address);

      expect(await setup.token.balanceOf(setup.aliceAddress)).to.equal(
        balance
      );
    });

    // Test mint without any deposit
    it("test no deposit", async () => {
      await setup.minter
        .connect(setup.alice)
        .mint(setup.lg.address);
      expect(await setup.token.balanceOf(setup.aliceAddress)).to.equal(
        setup.zero
      );
      expect(
        await setup.minter.minted(
          setup.aliceAddress,
          setup.lg.address
        )
      ).to.equal(setup.zero);
    });

    // Test minting with the wrong gauge
    it("test mint wrong gauge", async () => {
      await setup.lg
        .connect(setup.alice)
        .deposit(setup.ten_to_the_18, setup.aliceAddress, false);

      await ethers.provider.send("evm_increaseTime", [setup.MONTH.toNumber()]);
      await setup.minter
        .connect(setup.alice)
        .mint(setup.gaugesAddress[1]);

      //check
      expect(await setup.token.balanceOf(setup.aliceAddress)).to.equal(
        setup.zero
      );
      expect(
        await setup.minter.minted(
          setup.aliceAddress,
          setup.lg.address
        )
      ).to.equal(setup.zero);
      expect(
        await setup.minter.minted(
          setup.aliceAddress,
          setup.gaugesAddress[1]
        )
      ).to.equal(setup.zero);
    });

    // Test minting with an invalid gauge address
    it("test mint not a gauge", async () => {
      await expect(setup.minter.mint(setup.aliceAddress)).to.revertedWith(
        "dev: gauge is not added"
      );
    });

    // Test minting before inflation begins
    it("test mint before inflation begins", async () => {
      await setup.lg
        .connect(setup.alice)
        .deposit(setup.ten_to_the_18, setup.aliceAddress, false);
      expect(await setup.token.miningEpoch()).to.equal(BigNumber.from("-1"));

      await setup.minter
        .connect(setup.alice)
        .mint(setup.lg.address);
      expect(await setup.token.balanceOf(setup.aliceAddress)).to.equal(
        BigNumber.from("0")
      );
      expect(
        await setup.minter.minted(
          setup.aliceAddress,
          setup.lg.address
        )
      ).to.equal(setup.zero);
    });

    // Test mintMany function with multiple gauges
    it("test mintMany function multiple gauges", async () => {
      //setup
      await setup.lg
        .connect(setup.alice)
        .deposit(setup.ten_to_the_17, setup.aliceAddress, false);
      await setup.gaugesContracts[1]
        .connect(setup.alice)
        .deposit(setup.ten_to_the_17, setup.aliceAddress, false);
      await setup.gaugesContracts[2]
        .connect(setup.alice)
        .deposit(setup.ten_to_the_17, setup.aliceAddress, false);

      await ethers.provider.send("evm_increaseTime", [setup.MONTH.toNumber()]);

      let addresses = [
        setup.lg.address,
        setup.gaugesAddress[1],
        setup.gaugesAddress[2],
        setup.ZERO_ADDRESS,
        setup.ZERO_ADDRESS,
        setup.ZERO_ADDRESS,
        setup.ZERO_ADDRESS,
        setup.ZERO_ADDRESS,
      ];
      await setup.minter.connect(setup.alice).mintMany(addresses);

      //check
      let total_minted = BigNumber.from("0");

      for (let i = 0; i < 3; i++) {
        let gauge = setup.gaugesContracts[i];
        let minted = await setup.minter.minted(
          setup.aliceAddress,
          gauge.address
        );
        expect(minted).to.equal(
          await gauge.integrateFraction(setup.aliceAddress)
        );
        total_minted = total_minted.add(minted);
      }

      expect(await setup.token.balanceOf(setup.aliceAddress)).to.equal(
        total_minted
      );
    });

    // Test toggling of the mint approval function
    it("test toggleApproveMint function", async () => {
      await setup.minter
        .connect(setup.alice)
        .toggleApproveMint(setup.accountsAddress[2]);
      expect(
        await setup.minter.allowedToMintFor(
          setup.accountsAddress[2],
          setup.aliceAddress
        )
      ).to.equal(true);

      await setup.minter
        .connect(setup.alice)
        .toggleApproveMint(setup.accountsAddress[2]);
      expect(
        await setup.minter.allowedToMintFor(
          setup.accountsAddress[2],
          setup.aliceAddress
        )
      ).to.equal(false);
    });

    // Test minting on behalf of another user
    it("test mintFor function", async () => {
      await setup.lg
        .connect(setup.alice)
        .deposit(setup.ten_to_the_17, setup.aliceAddress, false);

      await ethers.provider.send("evm_increaseTime", [setup.MONTH.toNumber()]);

      await setup.minter
        .connect(setup.alice)
        .toggleApproveMint(setup.accountsAddress[2]);
      expect(
        await setup.minter.allowedToMintFor(
          setup.accountsAddress[2],
          setup.aliceAddress
        )
      ).to.equal(true);

      await setup.minter
        .connect(setup.accounts[2])
        .mintFor(setup.lg.address, setup.aliceAddress);

      let expected = await setup.lg.integrateFraction(
        setup.aliceAddress
      );
      expect(expected.gt(BigNumber.from("0"))).to.be.equal(true);
      expect(await setup.token.balanceOf(setup.aliceAddress)).to.equal(
        expected
      );
      expect(
        await setup.minter.minted(
          setup.aliceAddress,
          setup.lg.address
        )
      ).to.equal(expected);
    });

    // Test mintFor function when not approved
    it("test mintForFail function", async () => {
      await setup.lg
        .connect(setup.alice)
        .deposit(setup.ten_to_the_17, setup.aliceAddress, false);

      await ethers.provider.send("evm_increaseTime", [setup.MONTH.toNumber()]);

      expect(
        await setup.minter.allowedToMintFor(
          setup.accountsAddress[2],
          setup.aliceAddress
        )
      ).to.equal(false);

      await setup.minter
        .connect(setup.accounts[2])
        .mintFor(setup.lg.address, setup.aliceAddress);

      expect(await setup.token.balanceOf(setup.aliceAddress)).to.equal(0);
      expect(
        await setup.minter.minted(
          setup.aliceAddress,
          setup.lg.address
        )
      ).to.equal(0);
    });
  });
});