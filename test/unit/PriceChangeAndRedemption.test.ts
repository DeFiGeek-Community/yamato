import { ethers } from "hardhat";
import { smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { Signer, BigNumber } from "ethers";
import { toERC20 } from "../param/helper";
import {
  ChainLinkMock,
  TellorCallerMock,
  PriceFeed,
  CjpyOS,
  CJPY,
  Yamato,
  PriorityRegistry,
  Pool,
  ChainLinkMock__factory,
  TellorCallerMock__factory,
  PriceFeed__factory,
  CjpyOS__factory,
  CJPY__factory,
  Yamato__factory,
  Pool__factory,
  PriorityRegistry__factory,
} from "../../typechain";

chai.use(smock.matchers);
chai.use(solidity);

describe("PriceChangeAndRedemption :: contract Yamato", () => {
  let ChainLinkEthUsd: ChainLinkMock;
  let ChainLinkUsdJpy: ChainLinkMock;
  let Tellor: TellorCallerMock;
  let PriceFeed: PriceFeed;
  let CJPY: CJPY;
  let CjpyOS: CjpyOS;
  let Yamato: Yamato;
  let Pool: Pool;
  let PriorityRegistry: PriorityRegistry;
  let accounts: Signer[];
  let ownerAddress: string;
  let userAddress: string;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    ownerAddress = await accounts[0].getAddress();
    userAddress = await accounts[1].getAddress();

    ChainLinkEthUsd = await (<ChainLinkMock__factory>(
      await ethers.getContractFactory("ChainLinkMock")
    )).deploy("ETH/USD");
    ChainLinkUsdJpy = await (<ChainLinkMock__factory>(
      await ethers.getContractFactory("ChainLinkMock")
    )).deploy("JPY/USD");

    await (await ChainLinkEthUsd.connect(accounts[0]).simulatePriceMove({gasLimit: 200000})).wait()
    await (await ChainLinkUsdJpy.connect(accounts[0]).simulatePriceMove({gasLimit: 200000})).wait()
    await (await ChainLinkEthUsd.connect(accounts[0]).simulatePriceMove({gasLimit: 200000})).wait()
    await (await ChainLinkUsdJpy.connect(accounts[0]).simulatePriceMove({gasLimit: 200000})).wait()
  
    Tellor = await (<TellorCallerMock__factory>(
      await ethers.getContractFactory("TellorCallerMock")
    )).deploy();
    

    PriceFeed = await (<PriceFeed__factory>(
      await ethers.getContractFactory("PriceFeed")
    )).deploy(
      ChainLinkEthUsd.address,
      ChainLinkUsdJpy.address,
      Tellor.address
    );


    CJPY = await (<CJPY__factory>(
      await ethers.getContractFactory("CJPY")
    )).deploy();
  

    CjpyOS = await (<CjpyOS__factory>(
      await ethers.getContractFactory("CjpyOS")
    )).deploy(
      CJPY.address,
      PriceFeed.address
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

    Pool = await (<Pool__factory>(
      await ethers.getContractFactory("Pool")
    )).deploy(Yamato.address);
    
    PriorityRegistry = await (<PriorityRegistry__factory>(
      await ethers.getContractFactory("PriorityRegistry", {
        libraries: { PledgeLib },
      })
    )).deploy(Yamato.address);
    
    
    await (await Yamato.setPool(Pool.address)).wait()
    await (await Yamato.setPriorityRegistry(PriorityRegistry.address)).wait()
    await (await CjpyOS.addYamato(Yamato.address)).wait()
    await (await CJPY.setCurrencyOS(CjpyOS.address)).wait()


});

  describe("redeem()", function () {
    let PRICE;
    const MCR = BigNumber.from(110)
    let toCollateralize;
    let toBorrow;
    let redeemer;
    let redeemee;

    beforeEach(async () => {
      redeemer = accounts[0]
      redeemee = accounts[1]
      PRICE = await PriceFeed.lastGoodPrice()
      toCollateralize = 1;
      toBorrow = PRICE.mul(toCollateralize).mul(100).div(MCR).div(1e18+"");

      /* Get redemption budget by her own */
      await Yamato
        .connect(redeemer)
        .deposit({ value: toERC20(toCollateralize*100 + "") });
      await Yamato.connect(redeemer).borrow(toERC20(toBorrow.mul(100) + ""));


      /* Set the only and to-be-lowest ICR */
      await Yamato
        .connect(redeemee)
        .deposit({ value: toERC20(toCollateralize + "") });
      await Yamato.connect(redeemee).borrow(toERC20(toBorrow + ""));


      /* Market Dump */
      await (await ChainLinkEthUsd.setLastPrice("204000000000")).wait()//dec8
      await (await Tellor.setLastPrice("203000000000")).wait()//dec8


      /*
        DO NOT PriceFeed.fetchPrice() to reproduce the bug
      */  

    });


    it(`should redeem a lowest pledge`, async function () {
        let redeemerAddr = await redeemer.getAddress();
        const totalSupplyBefore = await CJPY.totalSupply();
        const eoaCJPYBalanceBefore = await CJPY.balanceOf(redeemerAddr);
        const eoaETHBalanceBefore = await Yamato.provider.getBalance(redeemerAddr);

        /*
          DO NOT PriceFeed.fetchPrice() to reproduce the bug
        */  

        const txReceipt = await (
            await Yamato
            .connect(redeemer)
            .redeem(toERC20(toBorrow.mul(2) + ""), false)
        ).wait()

        const totalSupplyAfter = await CJPY.totalSupply();
        const eoaCJPYBalanceAfter = await CJPY.balanceOf(redeemerAddr);
        const eoaETHBalanceAfter = await Yamato.provider.getBalance(redeemerAddr);

        expect(totalSupplyAfter).to.be.lt(totalSupplyBefore)
        expect(eoaCJPYBalanceAfter).to.be.lt(eoaCJPYBalanceBefore)
        expect(eoaETHBalanceAfter.add(txReceipt.gasUsed)).to.be.gt(eoaETHBalanceBefore)//gas?

    });
  });
});

