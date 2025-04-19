import { ethers } from "hardhat";

async function advanceTime(seconds: number) {
  // evm_increaseTimeで時間を進める
  await ethers.provider.send("evm_increaseTime", [seconds]);
  // evm_mineで新しいブロックを生成
  await ethers.provider.send("evm_mine", []);
}

function timeUnitsToSeconds(
  days: number,
  hours: number,
  minutes: number,
  seconds: number
): number {
  return days * 24 * 60 * 60 + hours * 60 * 60 + minutes * 60 + seconds;
}

async function getCurrentBlockchainTime() {
  const blockNumber = await ethers.provider.getBlockNumber();
  const block = await ethers.provider.getBlock(blockNumber);
  return block.timestamp;
}

async function main() {
  const days = 100;
  const hours = 0;
  const minutes = 0;
  const seconds = 0;

  const totalSeconds = timeUnitsToSeconds(days, hours, minutes, seconds);
  await advanceTime(totalSeconds);

  const newTime = await getCurrentBlockchainTime();
  console.log(
    `Advanced time by ${days} days, ${hours} hours, ${minutes} minutes, and ${seconds} seconds`
  );
  console.log(`New blockchain time: ${new Date(newTime * 1000).toISOString()}`);
}

// スクリプトを実行
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


// npx hardhat run scripts/test/advanceTime.ts --network localhost