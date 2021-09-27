import { ethers } from "hardhat";
import { smock } from "@defi-wonderland/smock";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { getSharedProvider, toERC20 } from "./helper";
import { BalanceLogger } from "../../src/BalanceLogger";

chai.use(smock.matchers);
chai.use(solidity);

describe("BalanceLogger", function () {
  describe(".ltAbsOneBN()", function () {
    let bl: BalanceLogger;
    before(() => {
      bl = new BalanceLogger({}, {}, getSharedProvider(), "foo");
    });
    it("checks 1", () => expect(bl.ltAbsOneBN("1")).to.eq(false));
    it("checks -1", () => expect(bl.ltAbsOneBN("-1")).to.eq(false));
    it("checks 1*10^18", () =>
      expect(bl.ltAbsOneBN(toERC20("1"))).to.eq(false));
    it("checks -1*10^18", () =>
      expect(bl.ltAbsOneBN(toERC20("-1"))).to.eq(false));
    it("checks 0", () => expect(bl.ltAbsOneBN("0")).to.eq(true));
    it("checks 0.0", () => expect(bl.ltAbsOneBN("0.0")).to.eq(true));
    it("checks 0*10^18", () => expect(bl.ltAbsOneBN(toERC20("0"))).to.eq(true));
    it("checks 0.9", () => expect(bl.ltAbsOneBN("0.9")).to.eq(true));
    it("checks 0.9*10^18", () =>
      expect(bl.ltAbsOneBN(toERC20("0.9"))).to.eq(false));
    it("checks -0.9", () => expect(bl.ltAbsOneBN("-0.9")).to.eq(true));
    it("checks -0.9*10^18", () =>
      expect(bl.ltAbsOneBN(toERC20("-0.9"))).to.eq(false));
    it("checks 9007199254740990", () =>
      expect(bl.ltAbsOneBN("9007199254740990")).to.eq(false));
    it("checks 9007199254740991", () =>
      expect(bl.ltAbsOneBN("9007199254740991")).to.eq(false));
    it("checks 300000000532312999532312999", () =>
      expect(bl.ltAbsOneBN("300000000532312999532312999")).to.eq(false));
    it("checks 18159105037311609774740371", () =>
      expect(bl.ltAbsOneBN("18159105037311609774740371")).to.eq(false));
    it("checks -18159105037311609774740371.000000000000001", () =>
      expect(
        bl.ltAbsOneBN("-18159105037311609774740371.000000000000001")
      ).to.eq(false));
    it("checks 115,792,089,237,316,195,423,570,985,008,687,907,853,269,984,‌​665,640,564,039,457", () =>
      expect(
        bl.ltAbsOneBN(
          "115,792,089,237,316,195,423,570,985,008,687,907,853,269,984,‌​665,640,564,039,457".replace(
            /,/,
            ""
          )
        )
      ).to.eq(false));
  });
});
