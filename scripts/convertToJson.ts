const fs = require("fs");
const path = require("path");

// JSONファイルのパス
const jsonFilePath = path.join(__dirname, "events/TokenDistributions.json");
// 出力するCSVファイルのパス
const csvFilePath = path.join(__dirname, "events/Yamato_v1_distributions.csv");

// JSONファイルを読み込む
const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, "utf8"));
const distributions = jsonData.distributions;

// CSVのヘッダー
let csvContent = "address,scorePercentage,distributedTokens\n";

// 各配布データをCSV形式に変換
distributions.forEach((distribution) => {
  const { address, scorePercentage, distributedTokens } = distribution;
  // scorePercentageを8桁の小数点以下でフォーマットし、指数表記を避ける
  const formattedScorePercentage = Number(scorePercentage).toFixed(12);
  // distributedTokensも必要に応じてフォーマット可能
  const formattedDistributedTokens = Number(distributedTokens);
  csvContent += `${address},${formattedScorePercentage},${formattedDistributedTokens}\n`;
});

// CSVファイルを書き出す
fs.writeFileSync(csvFilePath, csvContent);

console.log(`CSVファイルが正常に生成されました: ${csvFilePath}`);
