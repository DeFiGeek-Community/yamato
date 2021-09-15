import { ethers } from 'hardhat'
import { smockit, smoddit, isMockContract, MockContract } from 'optimism/packages/smock';

const { waffleJest } = require("@ethereum-waffle/jest");
expect.extend(waffleJest);
const betterexpect = (<any>expect); // TODO: better typing for waffleJest
import { getSharedSigners, getSharedProvider, toERC20 } from "@test/param/helper";
import { Yamato, Pool } from '../../typechain'; 

/* Parameterized Test (Testcases are ind /test/parameterizedSpecs.ts) */
describe("Smock for Pool", function() {
  it(`succeeds to make a mock`, async function() {
    const spec = await ethers.getContractFactory('Pool')
    const mock = await smockit(spec)
    betterexpect(isMockContract(mock)).toBe(true);
  });
});

describe("Pool", function() {
  let yamato: Yamato;
  let pool: Pool;
  let mockCjpyOS: MockContract;

  beforeEach(async () => {
    const spec = await ethers.getContractFactory('CjpyOS')
    mockCjpyOS = await smockit(spec)

    pool = await (await ethers.getContractFactory('Pool')).deploy() as Pool;
    yamato = await (await ethers.getContractFactory('Yamato')).deploy(
      pool.address,
      mockCjpyOS.address
    ) as Yamato;
  });

  describe('getStates()', () => {
    let accounts;

    beforeEach(async () => {
      accounts = await getSharedSigners();
    })

    it('should return correct values', async () => {
      const beforeValues = await pool.getStates();

      betterexpect(beforeValues[0]).toEqBN(0);
      betterexpect(beforeValues[1]).toEqBN(0);

      await yamato.deposit({value:toERC20(10+"")});
      // await yamato.connect(accounts[0]).borrow(toERC20(5+""));
      // await pool.connect(provider).accumulateDividendReserve(5);
      const afterValues = await pool.getStates();

      betterexpect(afterValues[0]).toEqBN(10);
      betterexpect(afterValues[1]).toEqBN(1);
      betterexpect(afterValues[2]).toEqBN(5);
      betterexpect(afterValues[3]).toEqBN(10);
    })
  })
});