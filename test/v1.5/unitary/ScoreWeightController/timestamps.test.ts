import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber } from "ethers";
import {
  takeSnapshot,
  SnapshotRestorer,
} from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import {
  YmtVesting,
  YMT,
  VeYMT,
  ScoreWeightControllerV2,
  ScoreRegistry,
  YmtVesting__factory,
  YMT__factory,
  VeYMT__factory,
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
  let mockScoreRegistry;
  let scoreWeightController: ScoreWeightControllerV2;
  let accounts: SignerWithAddress[];
  let snapshot: SnapshotRestorer;

  const week = Constants.week;
  const year = Constants.year;
  const WEIGHTS = Constants.WEIGHTS;

  before(async function () {
    accounts = await ethers.getSigners();

    mockScoreRegistry = await getFakeProxy<ScoreRegistry>(
      contractVersion["ScoreRegistry"]
    );
    YmtVesting = await (<YmtVesting__factory>(
      await ethers.getContractFactory("YmtVesting")
    )).deploy();

    YMT = await (<YMT__factory>await ethers.getContractFactory("YMT")).deploy(
      YmtVesting.address
    );

    veYMT = await (<VeYMT__factory>(
      await ethers.getContractFactory("veYMT")
    )).deploy(YMT.address);

    scoreWeightController = await getProxy<
      ScoreWeightControllerV2,
      ScoreWeightControllerV2__factory
    >("ScoreWeightController", [YMT.address, veYMT.address]);
    scoreWeightController = await upgradeProxy(
      scoreWeightController.address,
      "ScoreWeightControllerV2",
      undefined,
      {
        call: { fn: "initializeV2" },
      }
    );
    await scoreWeightController.addScore(mockScoreRegistry.address, WEIGHTS[0]);
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  describe("scoreWeightController Timestamps", function () {
    it("test_timestamps", async function () {
      const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
      const expectedTime = Math.floor((currentTime + week) / week) * week;
      expect(await scoreWeightController.timeTotal()).to.equal(expectedTime);

      for (let i = 0; i < 5; i++) {
        await ethers.provider.send("evm_increaseTime", [
          Math.floor(1.1 * year),
        ]);

        await scoreWeightController.checkpoint();

        const newCurrentTime = (await ethers.provider.getBlock("latest"))
          .timestamp;
        const newExpectedTime =
          Math.floor((newCurrentTime + week) / week) * week;
        expect(await scoreWeightController.timeTotal()).to.equal(
          newExpectedTime
        );
      }
    });
  });
});
