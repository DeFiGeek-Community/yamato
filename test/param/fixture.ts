import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { FakeContract, smock } from "@defi-wonderland/smock";
import { v1_5 } from "./version";
import { ScoreRegistry, ScoreRegistry__factory } from "../../typechain";
import Constants from "../v1.5/Constants";

export const FIXTURES = {
  yamato: {
    totalColl: ethers.utils.parseEther("1011"),
    totalDebt: ethers.utils.parseEther("212543613"),
  },
  priceFeed: {
    price: ethers.utils.parseEther("300000"),
  },
  ymt: {
    rate: ethers.utils.parseEther("55000000").div(Constants.YEAR).div(5),
    futureEpochTimeWrite: Constants.YEAR,
  },
  pledge: {
    coll: ethers.utils.parseEther("1"),
    debt: ethers.utils.parseEther("200000"),
    isCreated: true,
    owner: Constants.ZERO_ADDRESS,
    priority: 13000,
    ICR: 13500,
  },
  veYMT: {
    balance: ethers.utils.parseEther("100"),
    totalSupply: ethers.utils.parseEther("1000"),
  },
  YEAR: Constants.YEAR,
  WEEK: Constants.WEEK,
  DAY: Constants.DAY,
};

// Helper function to dynamically mock all contracts
export const mockV1_5Fixture = async () => {
  const mocks: Record<string, FakeContract> = {};

  for (const contractName of Object.keys(v1_5)) {
    mocks[contractName] = await smock.fake(v1_5[contractName]);
  }

  return mocks;
};

export async function deployScoreRegistry(): Promise<ScoreRegistry> {
  const Library = await ethers.getContractFactory(v1_5.PledgeLib);
  const library = await Library.deploy();
  await library.deployed();

  const ScoreRegistryFactory = (await ethers.getContractFactory(
    v1_5.ScoreRegistry,
    {
      libraries: {
        PledgeLib: library.address,
      },
    }
  )) as ScoreRegistry__factory;

  // Deploy ScoreRegistry contract
  const scoreRegistry = await ScoreRegistryFactory.deploy();
  await scoreRegistry.deployed();

  return scoreRegistry;
}

export async function initializeScoreRegistryWithMock(
  scoreRegistry: ScoreRegistry,
  mocks: Record<string, FakeContract>
) {
  mocks.YmtMinter.YMT.returns(mocks.YMT.address);
  mocks.YmtMinter.scoreWeightController.returns(
    mocks.ScoreWeightController.address
  );
  mocks.ScoreWeightController.veYMT.returns(mocks.veYMT.address);
  mocks.YMT.rate.returns(FIXTURES.ymt.rate);
  mocks.YMT.futureEpochTimeWrite.returns(
    (await time.latest()) + Constants.YEAR.toNumber() // RATE_REDUCTION_TIME: YEAR
  );

  await scoreRegistry.initialize(mocks.YmtMinter.address, mocks.Yamato.address);
}
