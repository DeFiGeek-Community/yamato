import { BigNumber } from "ethers";
import { ethers } from "hardhat";

class Constants {
  static DAY = BigNumber.from(86400);
  static WEEK = BigNumber.from(86400 * 7);
  static MONTH = BigNumber.from(86400 * 30);
  static YEAR = BigNumber.from(86400 * 365);

  static hour = 3600;
  static day = 86400;
  static week = 86400 * 7;
  static month = 86400 * 30;
  static year = 86400 * 365;

  static INITIAL_SUPPLY = BigNumber.from(450000000);

  static ZERO_ADDRESS = ethers.constants.AddressZero;

  static ten_to_the_24 = BigNumber.from("1000000000000000000000000");
  static ten_to_the_21 = BigNumber.from("1000000000000000000000");
  static ten_to_the_20 = BigNumber.from("100000000000000000000");
  static ten_to_the_19 = BigNumber.from("10000000000000000000");
  static ten_to_the_18 = BigNumber.from("1000000000000000000");
  static ten_to_the_17 = BigNumber.from("100000000000000000");
  static ten_to_the_16 = BigNumber.from("10000000000000000");
  static zero = BigNumber.from("0");
  static MAX_UINT256 = ethers.constants.MaxUint256;
}

export default Constants;
