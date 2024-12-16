#!/bin/bash

echo "========================================"
echo "Running v1.5-check-localTest script"
echo "========================================"
npx hardhat run upgrade/batches/v1.5-check-localTest.ts --network localhost

echo "========================================"
echo "Running v2-update-check CUSD script"
echo "========================================"
sed -i '' 's/^CURRENCY=.*/CURRENCY=CUSD/' .env
npx hardhat run upgrade/batches/v2-update-check.ts --network localhost

echo "========================================"
echo "Running v2-update-check CEUR script"
echo "========================================"
sed -i '' 's/^CURRENCY=.*/CURRENCY=CEUR/' .env
npx hardhat run upgrade/batches/v2-update-check.ts --network localhost