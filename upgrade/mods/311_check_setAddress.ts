import { ethers } from "ethers";
import { readDeploymentAddress } from "../../src/addressUtil";
import { setNetwork, setProvider, getFoundation } from "../../src/deployUtil";
import { genABI } from "../../src/genABI";

async function main() {
  setNetwork(process.env.NETWORK);
  await setProvider();

  const currency = process.env.CURRENCY;

  // CURRENCYが設定されていない場合は終了
  if (!currency) {
    console.error("CURRENCY environment variable is not set.");
    return;
  }

  const minterName = "YmtMinter";
  const ymtName = "YMT";
  const veYmtName = "veYMT";
  const yamatoName = "Yamato";
  const scoreRegistryName = "ScoreRegistry";
  const scoreWeightControllerName = "ScoreWeightController";
  const feePoolName = "FeePool";
  const PriceFeedSingleName = currency == "CUSD" ? "PriceFeedSingle" : "PriceFeed";
  const currencyOSName = "CurrencyOS";
  const YmtOSName = "YmtOS";
  const yamatoAddress = readDeploymentAddress(
    yamatoName,
    "ERC1967Proxy",
    currency
  );
  const scoreRegistryAddress = readDeploymentAddress(
    scoreRegistryName,
    "ERC1967Proxy",
    currency
  );
  const priceFeedAddress = readDeploymentAddress(
    PriceFeedSingleName,
    "ERC1967Proxy",
    currency
  );
  const currencyOSAddress = readDeploymentAddress(
    currencyOSName,
    "ERC1967Proxy",
    currency
  );

  const scoreWeightControllerAddress = readDeploymentAddress(
    scoreWeightControllerName,
    "ERC1967Proxy"
  );
  const minterProxyAddress = readDeploymentAddress(minterName, "ERC1967Proxy");
  const feePoolAddress = readDeploymentAddress(feePoolName, "ERC1967Proxy");
  const ymtOSAddress = readDeploymentAddress(YmtOSName, "ERC1967Proxy");
  const currencyAddress = readDeploymentAddress(currency, "", currency);
  const ymtAddress = readDeploymentAddress(ymtName);
  const veYmtAddress = readDeploymentAddress(veYmtName);

  const yamatoInstance = new ethers.Contract(
    yamatoAddress,
    genABI(yamatoName + "V4"),
    getFoundation()
  );
  const scoreWeightControllerInstance = new ethers.Contract(
    scoreWeightControllerAddress,
    genABI(scoreWeightControllerName + "V2"),
    getFoundation()
  );
  const scoreRegistryInstance = new ethers.Contract(
    scoreRegistryAddress,
    genABI(scoreRegistryName),
    getFoundation()
  );
  const currencyOSInstance = new ethers.Contract(
    currencyOSAddress,
    genABI(currencyOSName + "V4"),
    getFoundation()
  );
  const ymtOSInstance = new ethers.Contract(
    ymtOSAddress,
    genABI(YmtOSName),
    getFoundation()
  );

  try {
    // コントラクトインスタンスからアドレスを取得
    const scoreRegistryAddressFromYamato = await yamatoInstance.scoreRegistry();
    console.log(
      `Score Registry Address in Yamato: ${scoreRegistryAddressFromYamato}, Expected: ${scoreRegistryAddress}, Match:`,
      scoreRegistryAddressFromYamato === scoreRegistryAddress
    );

    const ymtMinterAddressFromScoreRegistry =
      await scoreRegistryInstance.ymtMinter();
    console.log(
      `YMT Minter Address in Score Registry: ${ymtMinterAddressFromScoreRegistry}, Expected: ${minterProxyAddress}, Match:`,
      ymtMinterAddressFromScoreRegistry === minterProxyAddress
    );

    const scoreWeightControllerAddressFromScoreRegistry =
      await scoreRegistryInstance.scoreWeightController();
    console.log(
      `Score Weight Controller Address in Score Registry: ${scoreWeightControllerAddressFromScoreRegistry}, Expected: ${scoreWeightControllerAddress}, Match:`,
      scoreWeightControllerAddressFromScoreRegistry ===
        scoreWeightControllerAddress
    );

    const yamatoAddressFromScoreRegistry = await scoreRegistryInstance.yamato();
    console.log(
      `Yamato Address in ScoreRegistry: ${yamatoAddressFromScoreRegistry}, Expected: ${yamatoAddress}, Match:`,
      yamatoAddressFromScoreRegistry === yamatoAddress
    );

    const yamatoAddressFromCurrencyOS = await currencyOSInstance.yamatoes(0);
    console.log(
      `Yamato Address in CurrencyOS ${yamatoAddressFromCurrencyOS}, Expected: ${yamatoAddress}, Match:`,
      yamatoAddressFromCurrencyOS === yamatoAddress
    );
    const ymtAddressFromCurrencyOS = await currencyOSInstance.YMT();
    console.log(
      `YMT Address in CurrencyOS: ${ymtAddressFromCurrencyOS}, Expected: ${ymtAddress}, Match:`,
      ymtAddressFromCurrencyOS === ymtAddress
    );

    const veYmtAddressFromCurrencyOS = await currencyOSInstance.veYMT();
    console.log(
      `VeYMT Address in CurrencyOS: ${veYmtAddressFromCurrencyOS}, Expected: ${veYmtAddress}, Match:`,
      veYmtAddressFromCurrencyOS === veYmtAddress
    );

    const ymtMinterAddressFromCurrencyOS = await currencyOSInstance.ymtMinter();
    console.log(
      `YMT Minter Address in CurrencyOS: ${ymtMinterAddressFromCurrencyOS}, Expected: ${minterProxyAddress}, Match:`,
      ymtMinterAddressFromCurrencyOS === minterProxyAddress
    );

    const feePoolAddressFromCurrencyOS = await currencyOSInstance.feePool();
    console.log(
      `Fee Pool Address in CurrencyOS: ${feePoolAddressFromCurrencyOS}, Expected: ${feePoolAddress}, Match:`,
      feePoolAddressFromCurrencyOS === feePoolAddress
    );

    const currencyAddressFromCurrencyOS = await currencyOSInstance.currency();
    console.log(
      `Currency Address in CurrencyOS: ${currencyAddressFromCurrencyOS}, Expected: ${currencyAddress}, Match:`,
      currencyAddressFromCurrencyOS === currencyAddress
    );

    const priceFeedAddressFromCurrencyOS = await currencyOSInstance.priceFeed();
    console.log(
      `Price Feed Address in CurrencyOS: ${priceFeedAddressFromCurrencyOS}, Expected: ${priceFeedAddress}, Match:`,
      priceFeedAddressFromCurrencyOS === priceFeedAddress
    );

    const scoreWeightControllerAddressFromCurrencyOS =
      await currencyOSInstance.scoreWeightController();
    console.log(
      `Score Weight Controller Address in CurrencyOS: ${scoreWeightControllerAddressFromCurrencyOS}, Expected: ${scoreWeightControllerAddress}, Match:`,
      scoreWeightControllerAddressFromCurrencyOS ===
        scoreWeightControllerAddress
    );

    const ymtOSAddressFromCurrencyOS = await currencyOSInstance.ymtOS();
    console.log(
      `YmtOS Address in CurrencyOS: ${ymtOSAddressFromCurrencyOS}, Expected: ${ymtOSAddress}, Match:`,
      ymtOSAddressFromCurrencyOS === ymtOSAddress
    );

    const expectedValue = currency === "CUSD" ? 2 : 3;

    const scoreRegistryAddressFromScoreWeightController =
      await scoreWeightControllerInstance.scores(scoreRegistryAddress);
    console.log(
      `Score Registry Address in Score Weight Controller: ${scoreRegistryAddressFromScoreWeightController}, Expected: ${expectedValue}, Match:`,
      scoreRegistryAddressFromScoreWeightController == expectedValue
    );

    const ymtAddressFromYmtOS = await ymtOSInstance.YMT();
    console.log(
      `YMT Address in YmtOS: ${ymtAddressFromYmtOS}, Expected: ${ymtAddress}, Match:`,
      ymtAddressFromYmtOS == ymtAddress
    );

    const veYMTAddressFromYmtOS = await ymtOSInstance.veYMT();
    console.log(
      `VeYMT Address in YmtOS: ${veYMTAddressFromYmtOS}, Expected: ${veYmtAddress}, Match:`,
      veYMTAddressFromYmtOS == veYmtAddress
    );

    const ymtMinterAddressFromYmtOS = await ymtOSInstance.ymtMinter();
    console.log(
      `YMT Minter Address in YmtOS: ${ymtMinterAddressFromYmtOS}, Expected: ${minterProxyAddress}, Match:`,
      ymtMinterAddressFromYmtOS == minterProxyAddress
    );

    const scoreWeightControllerAddressFromYmtOS =
      await ymtOSInstance.scoreWeightController();
    console.log(
      `Score Weight Controller Address in YmtOS: ${scoreWeightControllerAddressFromYmtOS}, Expected: ${scoreWeightControllerAddress}, Match:`,
      scoreWeightControllerAddressFromYmtOS == scoreWeightControllerAddress
    );

    // アドレスの比較と結果のログ出力
  } catch (error) {
    console.error(`Error verifying addresses:`, error);
  }
}

export default main;
