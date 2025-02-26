#!/bin/bash

echo "========================================"
echo "Running v1.5-check-localTest script"
echo "========================================"
npx hardhat run upgrade/batches/v1.5-check-localTest.ts --network localhost
