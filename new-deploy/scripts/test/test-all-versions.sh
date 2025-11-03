#!/bin/bash

# Yamato全バージョンテストスクリプト
# v1.0/v1.5, v2.0 (CUSD), v2.0 (CEUR) の各バージョンでテストを実行します

set -e

NETWORK=${1:-localhost}

echo "============================================================"
echo "🧪 Yamato All Versions Test Suite"
echo "============================================================"
echo ""
echo "Network: $NETWORK"
echo ""

# v1.0/v1.5 (CJPY) テスト
echo "============================================================"
echo "📦 Test 1: v1.0/v1.5 (CJPY)"
echo "============================================================"
if npx hardhat run scripts/test/test-yamato-basic-operations.ts --network $NETWORK 2>&1 | tee /tmp/test-cjpy.log; then
    echo "✅ v1.0/v1.5 (CJPY) test PASSED"
else
    echo "❌ v1.0/v1.5 (CJPY) test FAILED"
    exit 1
fi

echo ""
echo "============================================================"
echo "📦 Test 2: v2.0 (CUSD)"
echo "============================================================"
if CURRENCY=CUSD npx hardhat run scripts/test/test-yamato-basic-operations.ts --network $NETWORK 2>&1 | tee /tmp/test-cusd.log; then
    echo "✅ v2.0 (CUSD) test PASSED"
else
    echo "❌ v2.0 (CUSD) test FAILED"
    exit 1
fi

echo ""
echo "============================================================"
echo "📦 Test 3: v2.0 (CEUR)"
echo "============================================================"
if CURRENCY=CEUR npx hardhat run scripts/test/test-yamato-basic-operations.ts --network $NETWORK 2>&1 | tee /tmp/test-ceur.log; then
    echo "✅ v2.0 (CEUR) test PASSED"
else
    echo "❌ v2.0 (CEUR) test FAILED (may need to deploy CEUR contracts first)"
    echo "   Run: CURRENCY=CEUR npx hardhat run scripts/deploy/v2/deploy-all-ceur.ts --network $NETWORK"
    exit 1
fi

echo ""
echo "============================================================"
echo "🎉 All Tests PASSED!"
echo "============================================================"
echo ""
echo "Summary:"
echo "  ✅ v1.0/v1.5 (CJPY): PASSED"
echo "  ✅ v2.0 (CUSD): PASSED"
echo "  ✅ v2.0 (CEUR): PASSED"
echo ""

