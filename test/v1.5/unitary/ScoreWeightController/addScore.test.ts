import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber } from "ethers";
import {
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { FakeContract } from "@defi-wonderland/smock";
import {
  YmtVesting,
  YMT,
  VeYMT,
  ScoreWeightController,
  ScoreWeightControllerV2,
  ScoreRegistry,
  YmtVesting__factory,
  YMT__factory,
  VeYMT__factory,
  ScoreWeightController__factory,
  ScoreWeightControllerV2__factory,
} from "../../../../typechain";
import { upgradeProxy } from "../../../../src/upgradeUtil";
import { getFakeProxy, getProxy } from "../../../../src/testUtil";
import { contractVersion } from "../../../param/version";
import Constants from "../../Constants";

describe("scoreWeightController", function () {
  let veYMT: VeYMT;
  let YMT: YMT;
  let YmtVesting: YmtVesting;
  let scoreRegistrys: FakeContract<ScoreRegistry>[];
  let scoreWeightController: ScoreWeightController;
  let scoreWeightControllerV2: ScoreWeightControllerV2;
  let accounts: SignerWithAddress[];
  let snapshot: SnapshotRestorer;

  const WEIGHTS = Constants.WEIGHTS;
  const ten_to_the_18 = Constants.ten_to_the_18;

  before(async function () {
    snapshot = await takeSnapshot();
    accounts = await ethers.getSigners();
    scoreRegistrys = [];

    for (let i = 0; i < 3; i++) {
      const mockScoreRegistryInstance = await getFakeProxy<ScoreRegistry>(
        contractVersion["ScoreRegistry"]
      );
      scoreRegistrys.push(mockScoreRegistryInstance);
    }
    YmtVesting = await (<YmtVesting__factory>(
      await ethers.getContractFactory("YmtVesting")
    )).deploy();

    YMT = await (<YMT__factory>await ethers.getContractFactory("YMT")).deploy(
      YmtVesting.address,
      accounts[0].address
    );

    veYMT = await (<VeYMT__factory>(
      await ethers.getContractFactory("veYMT")
    )).deploy(YMT.address);

    scoreWeightController = await getProxy<
      ScoreWeightController,
      ScoreWeightController__factory
    >("ScoreWeightController", [YMT.address, veYMT.address], 1);
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("scoreWeightController addScore", function () {
    beforeEach(async () => {
      scoreWeightControllerV2 = await upgradeProxy(
        scoreWeightController.address,
        "ScoreWeightControllerV2",
        undefined,
        {
          call: { fn: "initializeV2" },
        }
      );
    });
    it("allows adding a new score successfully", async function () {
      const weight = BigNumber.from(1000);

      await expect(
        scoreWeightControllerV2.addScore(scoreRegistrys[0].address, weight)
      )
        .to.emit(scoreWeightControllerV2, "NewScore")
        .withArgs(scoreRegistrys[0].address, weight);

      const scoreWeight = await scoreWeightControllerV2.getScoreWeight(
        scoreRegistrys[0].address
      );
      expect(scoreWeight).to.equal(weight);
    });

    it("reverts when trying to add a score that already exists", async function () {
      const weight = BigNumber.from(1000);

      // First addition should succeed
      await scoreWeightControllerV2.addScore(scoreRegistrys[0].address, weight);

      // Second addition with the same address should fail
      await expect(
        scoreWeightControllerV2.addScore(scoreRegistrys[0].address, weight)
      ).to.be.revertedWith("cannot add the same gauge twice");
    });
  });
  describe("scoreWeightController updateScore", function () {
    it("updates timing and weight for an existing score successfully", async function () {
      const initialWeight = BigNumber.from(1000);
      const newWeight = BigNumber.from(2000);

      // Add a new score first
      await scoreWeightController.addScore(
        scoreRegistrys[0].address,
        initialWeight
      );

      scoreWeightControllerV2 = await upgradeProxy(
        scoreWeightController.address,
        "ScoreWeightControllerV2",
        undefined,
        {
          call: { fn: "initializeV2" },
        }
      );

      await expect(
        scoreWeightControllerV2.updateScore(
          scoreRegistrys[0].address,
          newWeight
        )
      )
        .to.emit(scoreWeightControllerV2, "ScoreTimingUpdated")
        .withArgs(scoreRegistrys[0].address, newWeight);

      const scoreWeight = await scoreWeightControllerV2.getScoreWeight(
        scoreRegistrys[0].address
      );
      expect(scoreWeight).to.equal(newWeight);
    });

    it("reverts when trying to update a score that does not exist", async function () {
      const weight = BigNumber.from(1000);
      scoreWeightControllerV2 = await upgradeProxy(
        scoreWeightController.address,
        "ScoreWeightControllerV2",
        undefined,
        {
          call: { fn: "initializeV2" },
        }
      );
      // Attempt to update a score that hasn't been added should fail
      await expect(
        scoreWeightControllerV2.updateScore(scoreRegistrys[0].address, weight)
      ).to.be.revertedWith("Score does not exist");
    });

    it("reverts when trying to update a score's timing more than once", async function () {
      const weight = BigNumber.from(1000);
      await scoreWeightControllerV2.addScore(scoreRegistrys[0].address, weight);
      scoreWeightControllerV2 = await upgradeProxy(
        scoreWeightController.address,
        "ScoreWeightControllerV2",
        undefined,
        {
          call: { fn: "initializeV2" },
        }
      );

      await expect(
        scoreWeightControllerV2.updateScore(scoreRegistrys[0].address, weight)
      );
      await expect(
        scoreWeightControllerV2.updateScore(scoreRegistrys[0].address, weight)
      ).to.be.revertedWith("Timing already set for this score");
    });
  });
});
