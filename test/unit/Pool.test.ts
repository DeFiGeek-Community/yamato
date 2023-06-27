import { ethers } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { Signer, BigNumber, Wallet } from "ethers";
import { Pool, Yamato, Pool__factory } from "../../typechain";
import { getFakeProxy, getProxy } from "../../src/testUtil";

chai.use(smock.matchers);

describe("contract Pool", function () {
  let pool: Pool;
  let accounts;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    let mockYamato = await getFakeProxy<Yamato>("Yamato");
    mockYamato.permitDeps.returns(false);
    pool = await getProxy<Pool, Pool__factory>("Pool", [mockYamato.address]);
  });

  describe("receive() from EOA", function () {
    it(`should be failed`, async function () {
      await expect(
        accounts[0].sendTransaction({
          to: pool.address,
          value: BigNumber.from(1e18 + ""),
        })
      ).to.be.revertedWith("You are not Yamato contract.");
    });
  });
});
