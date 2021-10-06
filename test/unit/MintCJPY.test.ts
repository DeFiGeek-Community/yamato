import { ethers } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { Signer, BigNumber } from "ethers";
import { toERC20 } from "../param/helper";
import {
  CjpyOS,
  CJPY,
  Yamato,
  PriceFeed,
  PriorityRegistry,
  Pool,
  CjpyOS__factory,
  CJPY__factory,
  Yamato__factory,
} from "../../typechain";

chai.use(smock.matchers);
chai.use(solidity);

describe("MintCJPY :: contract Yamato", () => {
  let CJPY: CJPY;
  let mockFeed: FakeContract<PriceFeed>;
  let mockPool: FakeContract<Pool>;
  let mockPriorityRegistry: FakeContract<PriorityRegistry>;
  let CjpyOS: CjpyOS;
  let Yamato: Yamato;
  let accounts: Signer[];
  let ownerAddress: string;
  let userAddress: string;
  let PRICE: BigNumber;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    ownerAddress = await accounts[0].getAddress();
    userAddress = await accounts[1].getAddress();
    mockFeed = await smock.fake<PriceFeed>("PriceFeed");
    mockPool = await smock.fake<Pool>("Pool");
    mockPriorityRegistry = await smock.fake<PriorityRegistry>("PriorityRegistry");

    CJPY = await (<CJPY__factory>(
      await ethers.getContractFactory("CJPY")
    )).deploy();
  

    PRICE = BigNumber.from(260000).mul(1e18+"");
    mockFeed.fetchPrice.returns(PRICE);
    CjpyOS = await (<CjpyOS__factory>(
      await ethers.getContractFactory("CjpyOS")
    )).deploy(
      CJPY.address,
      mockFeed.address
      // governance=deployer
    );

    const PledgeLib = (
      await (await ethers.getContractFactory("PledgeLib")).deploy()
    ).address;
  
    Yamato = await (<Yamato__factory>(
      await ethers.getContractFactory("Yamato", {
        libraries: { PledgeLib }
      })
    )).deploy(
      CjpyOS.address
    );

    mockPool.depositRedemptionReserve.returns(0);
    mockPriorityRegistry.upsert.returns(0);
    mockPriorityRegistry.yamato.returns(Yamato.address);
        
    await (await Yamato.setPool(mockPool.address)).wait()
    await (await Yamato.setPriorityRegistry(mockPriorityRegistry.address)).wait()
    await (await CjpyOS.addYamato(Yamato.address)).wait()
    await (await CJPY.setCurrencyOS(CjpyOS.address)).wait()
});

  describe("borrow()", function () {
    it(`should mint CJPY`, async function () {
        const MCR = BigNumber.from(110)
        const toCollateralize = 1;
        const toBorrow = PRICE.mul(toCollateralize).mul(100).div(MCR).div(1e18+"");
        await Yamato.deposit({ value: toERC20(toCollateralize + "") });
        await Yamato.borrow(toERC20(toBorrow + ""));
  

        const eoaBalance = await CJPY.balanceOf(await accounts[0].getAddress());
        expect(eoaBalance).to.eq("189090400000000000000000")

        const caBalance = await CJPY.balanceOf(mockPool.address);
        expect(caBalance).to.eq("47272600000000000000000")

        expect(eoaBalance.add(caBalance)).to.eq(toBorrow.mul(1e18+""))

    });
  });
});

