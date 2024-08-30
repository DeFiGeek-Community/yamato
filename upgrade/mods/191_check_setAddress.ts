import { ethers } from "ethers";
import { readDeploymentAddress } from "../../src/addressUtil";
import { setNetwork, setProvider, getFoundation } from "../../src/deployUtil";
import { genABI } from "../../src/genABI";

async function main() {
  setNetwork(process.env.NETWORK);
  await setProvider();

  const minterName = "YmtMinter";
  const vestingName = "YmtVesting";
  const ymtName = "YMT";
  const veYmtName = "veYMT";
  const yamatoName = "Yamato";
  const scoreRegistryName = "ScoreRegistry";
  const scoreWeightControllerName = "ScoreWeightController";
  const feePoolName = "FeePool";
  const currencyOSName = "CurrencyOS";
  const yamatoAddress = readDeploymentAddress(yamatoName, "ERC1967Proxy");
  const scoreRegistryAddress = readDeploymentAddress(
    scoreRegistryName,
    "ERC1967Proxy"
  );
  const scoreWeightControllerAddress = readDeploymentAddress(
    scoreWeightControllerName,
    "ERC1967Proxy"
  );
  const minterProxyAddress = readDeploymentAddress(minterName, "ERC1967Proxy");
  const feePoolAddress = readDeploymentAddress(feePoolName, "ERC1967Proxy");
  const currencyOSAddress = readDeploymentAddress(
    currencyOSName,
    "ERC1967Proxy"
  );
  const vestingAddress = readDeploymentAddress(vestingName);
  const ymtAddress = readDeploymentAddress(ymtName);
  const veYmtAddress = readDeploymentAddress(veYmtName);

  const minterInstance = new ethers.Contract(
    minterProxyAddress,
    genABI(minterName),
    getFoundation()
  );

  const vestingInstance = new ethers.Contract(
    vestingAddress,
    genABI(vestingName),
    getFoundation()
  );
  const ymtInstance = new ethers.Contract(
    ymtAddress,
    genABI(ymtName),
    getFoundation()
  );
  const veYmtInstance = new ethers.Contract(
    veYmtAddress,
    genABI(veYmtName),
    getFoundation()
  );
  const yamatoInstance = new ethers.Contract(
    yamatoAddress,
    genABI(yamatoName + "V4"),
    getFoundation()
  );
  const scoreWeightControllerInstance = new ethers.Contract(
    scoreWeightControllerAddress,
    genABI(scoreWeightControllerName),
    getFoundation()
  );
  const scoreRegistryInstance = new ethers.Contract(
    scoreRegistryAddress,
    genABI(scoreRegistryName),
    getFoundation()
  );
  const feePoolInstance = new ethers.Contract(
    feePoolAddress,
    genABI(feePoolName + "V2"),
    getFoundation()
  );
  const currencyOSInstance = new ethers.Contract(
    currencyOSAddress,
    genABI(currencyOSName + "V3"),
    getFoundation()
  );

  try {
    // コントラクトインスタンスからアドレスを取得
    const ymtAddressFromMinter = await minterInstance.YMT();
    console.log(
      `YMT Address Match in Minter:`,
      ymtAddressFromMinter === ymtAddress ? "Yes" : "No"
    );

    const scoreWeightControllerAddressFromMinter =
      await minterInstance.scoreWeightController();
    console.log(
      `Score Weight Controller Address Match in Minter:`,
      scoreWeightControllerAddressFromMinter === scoreWeightControllerAddress
        ? "Yes"
        : "No"
    );

    const ymtAddressFromVesting = await vestingInstance.ymtTokenAddress();
    console.log(
      `YMT Address Match in Vesting:`,
      ymtAddressFromVesting === ymtAddress ? "Yes" : "No"
    );

    const ymtMinterAddressFromYmt = await ymtInstance.ymtMinter();
    console.log(
      `YMT Minter Address Match in YMT:`,
      ymtMinterAddressFromYmt === minterProxyAddress ? "Yes" : "No"
    );

    const scoreRegistryAddressFromYamato = await yamatoInstance.scoreRegistry();
    console.log(
      `Score Registry Address Match in Yamato:`,
      scoreRegistryAddressFromYamato === scoreRegistryAddress ? "Yes" : "No"
    );

    const ymtAddressFromVeYmt = await veYmtInstance.token();
    console.log(
      `YMT Address Match in VeYMT:`,
      ymtAddressFromVeYmt === ymtAddress ? "Yes" : "No"
    );

    const ymtAddressFromScoreWeightController =
      await scoreWeightControllerInstance.YMT();
    console.log(
      `YMT Address Match in Score Weight Controller:`,
      ymtAddressFromScoreWeightController === ymtAddress ? "Yes" : "No"
    );

    const veYmtAddressFromScoreWeightController =
      await scoreWeightControllerInstance.veYMT();
    console.log(
      `VeYMT Address Match in Score Weight Controller:`,
      veYmtAddressFromScoreWeightController === veYmtAddress ? "Yes" : "No"
    );

    const ymtAddressFromScoreRegistry = await scoreRegistryInstance.YMT();
    console.log(
      `YMT Address Match in Score Registry:`,
      ymtAddressFromScoreRegistry === ymtAddress ? "Yes" : "No"
    );

    const veYmtAddressFromScoreRegistry = await scoreRegistryInstance.veYMT();
    console.log(
      `VeYMT Address Match in Score Registry:`,
      veYmtAddressFromScoreRegistry === veYmtAddress ? "Yes" : "No"
    );

    const ymtMinterAddressFromScoreRegistry =
      await scoreRegistryInstance.ymtMinter();
    console.log(
      `YMT Minter Address Match in Score Registry:`,
      ymtMinterAddressFromScoreRegistry === minterProxyAddress ? "Yes" : "No"
    );

    const scoreWeightControllerAddressFromScoreRegistry =
      await scoreRegistryInstance.scoreWeightController();
    console.log(
      `Score Weight Controller Address Match in Score Registry:`,
      scoreWeightControllerAddressFromScoreRegistry ===
        scoreWeightControllerAddress
        ? "Yes"
        : "No"
    );

    const yamatoAddressFromScoreRegistry = await scoreRegistryInstance.yamato();
    console.log(
      `Yamato Address Match in ScoreRegistry:`,
      yamatoAddressFromScoreRegistry === yamatoAddress ? "Yes" : "No"
    );

    const veYmtAddressFromFeePool = await feePoolInstance.veYMT();
    console.log(
      `VeYMT Address Match in Fee Pool:`,
      veYmtAddressFromFeePool === veYmtAddress ? "Yes" : "No"
    );

    const ymtAddressFromCurrencyOS = await currencyOSInstance.YMT();
    console.log(
      `YMT Address Match in CurrencyOS:`,
      ymtAddressFromCurrencyOS === ymtAddress ? "Yes" : "No"
    );

    const veYmtAddressFromCurrencyOS = await currencyOSInstance.veYMT();
    console.log(
      `VeYMT Address Match in CurrencyOS:`,
      veYmtAddressFromCurrencyOS === veYmtAddress ? "Yes" : "No"
    );

    const ymtMinterAddressFromCurrencyOS = await currencyOSInstance.ymtMinter();
    console.log(
      `YMT Minter Address Match in CurrencyOS:`,
      ymtMinterAddressFromCurrencyOS === minterProxyAddress ? "Yes" : "No"
    );

    const scoreWeightControllerAddressFromCurrencyOS =
      await currencyOSInstance.scoreWeightController();
    console.log(
      `Score Weight Controller Address Match in CurrencyOS:`,
      scoreWeightControllerAddressFromCurrencyOS ===
        scoreWeightControllerAddress
        ? "Yes"
        : "No"
    );

    // アドレスの比較と結果のログ出力
  } catch (error) {
    console.error(`Error verifying addresses:`, error);
  }
}

export default main;
