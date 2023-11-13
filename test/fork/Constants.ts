import { BigNumber } from "ethers";

class Constants {
  static DAY = BigNumber.from(86400);
  static WEEK = BigNumber.from(86400 * 7);
  static MONTH = BigNumber.from(86400 * 30);
  static YEAR = BigNumber.from(86400 * 365);

  static day = 86400;
  static week = 86400 * 7;
  static month = 86400 * 30;
  static year = 86400 * 365;

  static TYPE_WEIGHTS: BigNumber[] = [
    BigNumber.from(5).mul(BigNumber.from(10).pow(17)),
    BigNumber.from(2).mul(BigNumber.from(10).pow(18)),
  ];
  static GAUGE_WEIGHTS: BigNumber[] = [
    BigNumber.from(2).mul(BigNumber.from(10).pow(18)),
    BigNumber.from(10).pow(18),
    BigNumber.from(5).mul(BigNumber.from(10).pow(17)),
  ];

  static symbol = "Token";
  static decimal = 18;
  static INITIAL_SUPPLY = BigNumber.from("1303030303000000000000000000");

  static ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  static ten_to_the_24 = BigNumber.from("1000000000000000000000000");
  static ten_to_the_21 = BigNumber.from("1000000000000000000000");
  static ten_to_the_20 = BigNumber.from("100000000000000000000");
  static ten_to_the_19 = BigNumber.from("10000000000000000000");
  static ten_to_the_18 = BigNumber.from("1000000000000000000");
  static ten_to_the_17 = BigNumber.from("100000000000000000");
  static ten_to_the_16 = BigNumber.from("10000000000000000");
  static ten_to_the_9 = BigNumber.from("1000000000");
  static a = BigNumber.from("2");
  static b = BigNumber.from("5");
  static zero = BigNumber.from("0");
  static MAX_UINT256 = BigNumber.from(
    "115792089237316195423570985008687907853269984665640564039457584007913129639935"
  );

  static GAUGE_TYPES = [
    BigNumber.from("1"),
    BigNumber.from("1"),
    BigNumber.from("2"),
  ];
}

export default Constants;
