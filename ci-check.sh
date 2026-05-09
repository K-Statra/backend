#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }
step() { echo -e "\n${YELLOW}▶ $1${NC}"; }

step "Prettier"
npm run format && npx prettier --check "src/**/*.ts" "test/**/*.ts" || fail "Prettier 실패 — npm run format 으로 수정하세요"
pass "Prettier"

step "ESLint"
npm run lint:check || fail "ESLint 실패"
pass "ESLint"

step "Unit 테스트"
npm test -- --passWithNoTests || fail "Unit 테스트 실패"
pass "Unit 테스트"

step "E2E 테스트 (mock)"
npm run test:e2e || fail "E2E 테스트 실패"
pass "E2E 테스트 (mock)"

step "E2E 테스트 (실제)"
npm run test:e2e:testnet && npm run test:e2e:rlusd-testnet || fail "E2E 테스트 실패"
pass "E2E 테스트 (실제)"

echo -e "\n${GREEN}✓ 모든 검사 통과!"
