## 実行順序

```
npx hardhat run scripts/exportYamatoActionEvents.ts
npx hardhat run scripts/processBlockchainEvents.ts
npx hardhat run scripts/blockPriceDataExporter.ts
npx hardhat run scripts/calculateEventScores.ts
npx hardhat run scripts/calculateTokenDistributions.ts
```

##各ファイル

### `exportYamatoActionEvents.ts`

このスクリプトは、Yamato プロトコルのスマートコントラクトから特定のアクションイベントを取得し、
それぞれのイベントタイプごとに JSON ファイルに保存します。取得されるイベントには、預金、借入、返済、引き出し、
償還、メタ償還、スイープが含まれます。これらのイベントは、後続の処理や分析のために使用されます。

### `processBlockchainEvents.ts`

このスクリプトは、ブロックチェーン上の特定のイベントを処理し、それらを整理して JSON ファイルに出力します。
具体的には、Yamato プロトコルのスマートコントラクトから、預金、借入、返済、引き出し、償還などのイベントを取得し、
それらをユーザーごとに整理しています。最終的には、これらのイベントを`extractedEvents.json`に保存します。

### `blockPriceDataExporter.ts`

このスクリプトは、ブロック番号ごとに最後の良好な価格データをフェッチし、それを`priceData.json`に保存します。
価格データは、イベントデータの処理やスコア計算に使用されます。

### `calculateEventScores.ts`

`extractedEvents.json`と`priceData.json`からデータを読み込み、各イベントに対してスコアを計算します。計算には、担保価値、借入額、価格データを使用し、各イベントの ICR（担保率）と CJPY（借入額の JPY 換算値）を基にスコアを算出します。計算されたスコアは、`processedEvents.json`に保存されます。

### `calculateTokenDistributions.ts`

`processedEvents.json`からイベントスコアデータを読み込み、それらのスコアに基づいてトークンの配布量を計算します。各参加者に配布されるトークンの量は、その参加者のイベントスコアの全体に占める割合に基づいています。計算されたトークン配布量は、`TokenDistributions.json`に保存されます。
