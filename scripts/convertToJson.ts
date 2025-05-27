import fs from "fs";
import path from "path";

// ---------- 入出力パス ----------
const jsonFilePath = path.join(__dirname, "events/TokenDistributions.json");
const csvFilePath  = path.join(__dirname, "events/Yamato_v1_distributions.csv");

// ---------- JSON 読み込み ----------
const jsonData       = JSON.parse(fs.readFileSync(jsonFilePath, "utf8"));
const distributions  = jsonData.distributions as any[];

// ---------- BigNumber 判定 ----------
function isBigNumberish(v: any): boolean {
  return (
    v &&
    typeof v === "object" &&
    (v.type === "BigNumber" || (v.hex && typeof v.hex === "string"))
  );
}

// ---------- ヘッダー自動生成 ----------
const headers = Object.keys(distributions[0]).filter(
  (key) => !isBigNumberish(distributions[0][key])
);
let csvContent = headers.join(",") + "\n";

// ---------- 本体 ----------
distributions.forEach((dist) => {
  const row = headers
    .map((h) => {
      const val = dist[h];
      if (isBigNumberish(val)) return "";                     // 万一混入時
      if (typeof val === "number") return val.toFixed(12);    // 数値 → 小数12桁
      return String(val);                                     // 文字列などそのまま
    })
    .join(",");
  csvContent += row + "\n";
});

// ---------- 書き出し ----------
fs.writeFileSync(csvFilePath, csvContent);
console.log(`CSVファイルが正常に生成されました: ${csvFilePath}`);
