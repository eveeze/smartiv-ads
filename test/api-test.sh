#!/usr/bin/env bash
# =============================================================================
# SmartIV Ads — Automated API Endpoint Test Suite
# Usage: bash test/api-test.sh [BASE_URL]
# Example: bash test/api-test.sh http://localhost:3000
# Dependencies: curl, jq
# =============================================================================
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
PASS=0
FAIL=0
SKIP=0
TOTAL=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Helpers ──────────────────────────────────────────────────────────────────
assert_status() {
  local label="$1" expected="$2" actual="$3"
  TOTAL=$((TOTAL + 1))
  if [ "$actual" -eq "$expected" ]; then
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}✓${NC} ${label} (${actual})"
  else
    FAIL=$((FAIL + 1))
    echo -e "  ${RED}✗${NC} ${label} — expected ${expected}, got ${actual}"
  fi
}

skip_test() {
  local label="$1"
  TOTAL=$((TOTAL + 1))
  SKIP=$((SKIP + 1))
  echo -e "  ${YELLOW}⊘${NC} ${label} (SKIPPED)"
}

section() {
  echo ""
  echo -e "${CYAN}━━━ $1 ━━━${NC}"
}

# ── JSON response helpers ────────────────────────────────────────────────────
# Perform a request and capture both status code and body
req() {
  local method="$1" url="$2"
  shift 2
  local tmpfile=$(mktemp)
  local status
  status=$(curl -s -o "$tmpfile" -w "%{http_code}" -X "$method" "${BASE_URL}${url}" "$@")
  echo "$status"
  cat "$tmpfile"
  rm -f "$tmpfile"
}

# Simpler version: just get status code
get_status() {
  local method="$1" url="$2"
  shift 2
  curl -s -o /dev/null -w "%{http_code}" -X "$method" "${BASE_URL}${url}" "$@"
}

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   SmartIV Ads — Automated API Test Suite         ║${NC}"
echo -e "${BOLD}║   Target: ${BASE_URL}                      ${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"

# ═══════════════════════════════════════════════════════════════════════════════
# 0. HEALTH CHECK
# ═══════════════════════════════════════════════════════════════════════════════
section "Health Check"

STATUS=$(get_status GET "/api")
assert_status "GET / — API root" 200 "$STATUS"

# ═══════════════════════════════════════════════════════════════════════════════
# 1. AUTH MODULE
# ═══════════════════════════════════════════════════════════════════════════════
section "Auth Module"

# 1.1 Register — duplicate email (should be 400 if admin already seeded)
STATUS=$(get_status POST "/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@smartiv.com","password":"password123","name":"Dup Admin"}')
assert_status "POST /auth/register — duplicate email" 400 "$STATUS"

# 1.2 Register — new user
RAND=$RANDOM
STATUS=$(get_status POST "/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"testuser${RAND}@test.com\",\"password\":\"password123\",\"name\":\"Test User ${RAND}\"}")
# Could be 201 (new) or 400 (if exists from previous run — both acceptable)
if [ "$STATUS" -eq 201 ] || [ "$STATUS" -eq 400 ]; then
  TOTAL=$((TOTAL + 1)); PASS=$((PASS + 1))
  echo -e "  ${GREEN}✓${NC} POST /auth/register — new user (${STATUS})"
else
  TOTAL=$((TOTAL + 1)); FAIL=$((FAIL + 1))
  echo -e "  ${RED}✗${NC} POST /auth/register — expected 201|400, got ${STATUS}"
fi

# 1.3 Login — Admin
ADMIN_RESP=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@smartiv.com","password":"password123"}')
ADMIN_TOKEN=$(echo "$ADMIN_RESP" | jq -r '.data.accessToken // empty')
if [ -n "$ADMIN_TOKEN" ]; then
  TOTAL=$((TOTAL + 1)); PASS=$((PASS + 1))
  echo -e "  ${GREEN}✓${NC} POST /auth/login — Admin OK (token received)"
else
  TOTAL=$((TOTAL + 1)); FAIL=$((FAIL + 1))
  echo -e "  ${RED}✗${NC} POST /auth/login — Admin FAILED (no token)"
  echo "    Response: $ADMIN_RESP"
fi

# 1.4 Login — Advertiser
ADV_RESP=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"client@grandbrand.com","password":"password123"}')
ADV_TOKEN=$(echo "$ADV_RESP" | jq -r '.data.accessToken // empty')
if [ -n "$ADV_TOKEN" ]; then
  TOTAL=$((TOTAL + 1)); PASS=$((PASS + 1))
  echo -e "  ${GREEN}✓${NC} POST /auth/login — Advertiser OK"
else
  TOTAL=$((TOTAL + 1)); FAIL=$((FAIL + 1))
  echo -e "  ${RED}✗${NC} POST /auth/login — Advertiser FAILED"
fi

# 1.5 Login — wrong password
STATUS=$(get_status POST "/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@smartiv.com","password":"wrongpassword"}')
assert_status "POST /auth/login — wrong password" 401 "$STATUS"

# 1.6 Login — nonexistent user
STATUS=$(get_status POST "/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@nowhere.com","password":"whatever"}')
assert_status "POST /auth/login — nonexistent email" 401 "$STATUS"

# 1.7 GET /auth/me — with valid token
STATUS=$(get_status GET "/api/auth/me" -H "Authorization: Bearer $ADMIN_TOKEN")
assert_status "GET /auth/me — authenticated" 200 "$STATUS"

# 1.8 GET /auth/me — no token
STATUS=$(get_status GET "/api/auth/me")
assert_status "GET /auth/me — no token (401)" 401 "$STATUS"

# 1.9 Forgot password — nonexistent email (should still return 200 for security)
STATUS=$(get_status POST "/api/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@test.com"}')
assert_status "POST /auth/forgot-password — nonexistent email (silent 200)" 200 "$STATUS"

# 1.10 Reset password — invalid token
STATUS=$(get_status POST "/api/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d '{"token":"invalid_token_here","newPassword":"newpass123"}')
assert_status "POST /auth/reset-password — invalid token (400)" 400 "$STATUS"

# ═══════════════════════════════════════════════════════════════════════════════
# 2. USERS MODULE (Admin Only)
# ═══════════════════════════════════════════════════════════════════════════════
section "Users Module"

# 2.1 List all users (Admin)
STATUS=$(get_status GET "/api/users?page=1&take=10" -H "Authorization: Bearer $ADMIN_TOKEN")
assert_status "GET /users — list (admin)" 200 "$STATUS"

# 2.2 List users — unauthorized (advertiser)
STATUS=$(get_status GET "/api/users" -H "Authorization: Bearer $ADV_TOKEN")
assert_status "GET /users — forbidden for advertiser (403)" 403 "$STATUS"

# 2.3 Get user by ID
FIRST_USER_ID=$(curl -s -X GET "${BASE_URL}/api/users?page=1&take=1" -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.data.data[0].id // 1')
STATUS=$(get_status GET "/api/users/${FIRST_USER_ID}" -H "Authorization: Bearer $ADMIN_TOKEN")
assert_status "GET /users/${FIRST_USER_ID} — admin detail" 200 "$STATUS"

# 2.4 Update profile (advertiser)
STATUS=$(get_status PATCH "/api/users/profile" \
  -H "Authorization: Bearer $ADV_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Brand Name"}')
assert_status "PATCH /users/profile — advertiser update" 200 "$STATUS"

# ═══════════════════════════════════════════════════════════════════════════════
# 3. INVENTORY MODULE
# ═══════════════════════════════════════════════════════════════════════════════
section "Inventory Module — Properties"

# 3.1 List properties (paginated)
STATUS=$(get_status GET "/api/inventory/properties?page=1&take=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
assert_status "GET /inventory/properties — list" 200 "$STATUS"

# 3.2 Properties list (lightweight)
STATUS=$(get_status GET "/api/inventory/properties/list" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
assert_status "GET /inventory/properties/list — dropdown list" 200 "$STATUS"

# 3.3 Get property by ID
FIRST_PROP_ID=$(curl -s -X GET "${BASE_URL}/api/inventory/properties?page=1&take=1" -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.data.data[0].id // 1')
STATUS=$(get_status GET "/api/inventory/properties/${FIRST_PROP_ID}" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
assert_status "GET /inventory/properties/${FIRST_PROP_ID} — detail" 200 "$STATUS"

# 3.4 Property not found
STATUS=$(get_status GET "/api/inventory/properties/99999" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
assert_status "GET /inventory/properties/99999 — not found (404)" 404 "$STATUS"

# 3.5 Unauthorized access
STATUS=$(get_status GET "/api/inventory/properties" )
assert_status "GET /inventory/properties — no auth (401)" 401 "$STATUS"

section "Inventory Module — Screens"

# 3.6 List screens
STATUS=$(get_status GET "/api/inventory/screens?page=1&take=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
assert_status "GET /inventory/screens — list" 200 "$STATUS"

# 3.7 Screens list (lightweight)
STATUS=$(get_status GET "/api/inventory/screens/list" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
assert_status "GET /inventory/screens/list — dropdown" 200 "$STATUS"

# 3.8 Screen by ID
FIRST_SCREEN_ID=$(curl -s -X GET "${BASE_URL}/api/inventory/screens?page=1&take=1" -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.data.data[0].id // 1')
STATUS=$(get_status GET "/api/inventory/screens/${FIRST_SCREEN_ID}" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
assert_status "GET /inventory/screens/${FIRST_SCREEN_ID} — detail" 200 "$STATUS"

# 3.9 Screen not found
STATUS=$(get_status GET "/api/inventory/screens/99999" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
assert_status "GET /inventory/screens/99999 — not found (404)" 404 "$STATUS"

section "Inventory Module — Rate Cards"

# 3.10 List rate cards
STATUS=$(get_status GET "/api/inventory/rate-cards" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
assert_status "GET /inventory/rate-cards — list" 200 "$STATUS"

section "Inventory Module — Categories & Blocklist"

# 3.11 List categories
STATUS=$(get_status GET "/api/inventory/categories" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
assert_status "GET /inventory/categories — list" 200 "$STATUS"

# 3.12 Get blocklist for property
STATUS=$(get_status GET "/api/inventory/properties/${FIRST_PROP_ID:-1}/blocklist" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
assert_status "GET /inventory/properties/${FIRST_PROP_ID:-1}/blocklist" 200 "$STATUS"

# 3.13 Check availability
STATUS=$(get_status GET "/api/inventory/properties/${FIRST_PROP_ID:-1}/availability" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
assert_status "GET /inventory/properties/${FIRST_PROP_ID:-1}/availability" 200 "$STATUS"

# ═══════════════════════════════════════════════════════════════════════════════
# 4. MEDIA MODULE
# ═══════════════════════════════════════════════════════════════════════════════
section "Media Module"

# 4.1 List media (advertiser)
STATUS=$(get_status GET "/api/media" -H "Authorization: Bearer $ADV_TOKEN")
assert_status "GET /media — advertiser list" 200 "$STATUS"

# 4.2 List media with tag search
STATUS=$(get_status GET "/api/media?search=promo" -H "Authorization: Bearer $ADV_TOKEN")
assert_status "GET /media?search=promo — tag filter" 200 "$STATUS"

# 4.3 Pending media (admin)
STATUS=$(get_status GET "/api/media/pending" -H "Authorization: Bearer $ADMIN_TOKEN")
assert_status "GET /media/pending — admin" 200 "$STATUS"

# 4.4 Pending media — forbidden for advertiser
STATUS=$(get_status GET "/api/media/pending" -H "Authorization: Bearer $ADV_TOKEN")
assert_status "GET /media/pending — forbidden (403)" 403 "$STATUS"

# 4.5 Get tags
STATUS=$(get_status GET "/api/media/tags" -H "Authorization: Bearer $ADV_TOKEN")
assert_status "GET /media/tags — autocomplete" 200 "$STATUS"

# 4.6 Media not found
STATUS=$(get_status GET "/api/media/99999" -H "Authorization: Bearer $ADV_TOKEN")
assert_status "GET /media/99999 — not found (404)" 404 "$STATUS"

# 4.7 Upload without file (should 400)
STATUS=$(get_status POST "/api/media/upload" -H "Authorization: Bearer $ADV_TOKEN")
assert_status "POST /media/upload — no file (400)" 400 "$STATUS"

# 4.8 List media — no auth (401)
STATUS=$(get_status GET "/api/media")
assert_status "GET /media — no auth (401)" 401 "$STATUS"

# ═══════════════════════════════════════════════════════════════════════════════
# 5. CAMPAIGNS MODULE
# ═══════════════════════════════════════════════════════════════════════════════
section "Campaigns Module"

# 5.1 List campaigns (advertiser)
STATUS=$(get_status GET "/api/campaigns?page=1&take=10" \
  -H "Authorization: Bearer $ADV_TOKEN")
assert_status "GET /campaigns — advertiser list" 200 "$STATUS"

# 5.2 List campaigns (admin)
STATUS=$(get_status GET "/api/campaigns?page=1&take=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
assert_status "GET /campaigns — admin list" 200 "$STATUS"

# 5.3 Pending campaigns (admin)
STATUS=$(get_status GET "/api/campaigns/pending?page=1&take=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
assert_status "GET /campaigns/pending — admin" 200 "$STATUS"

# 5.4 Campaign not found
STATUS=$(get_status GET "/api/campaigns/99999" -H "Authorization: Bearer $ADV_TOKEN")
assert_status "GET /campaigns/99999 — not found (404)" 404 "$STATUS"

# 5.5 Campaign — no auth
STATUS=$(get_status GET "/api/campaigns")
assert_status "GET /campaigns — no auth (401)" 401 "$STATUS"

# 5.6 Create campaign — missing required fields (400)
STATUS=$(get_status POST "/api/campaigns" \
  -H "Authorization: Bearer $ADV_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')
assert_status "POST /campaigns — empty body (400)" 400 "$STATUS"

# 5.7 Create campaign — nonexistent media (404)
STATUS=$(get_status POST "/api/campaigns" \
  -H "Authorization: Bearer $ADV_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","mediaId":99999,"propertyId":1,"targetSlot":"SCREENSAVER","durationPackage":"WEEKLY","startDate":"2027-01-01","saveAsDraft":true}')
assert_status "POST /campaigns — invalid mediaId (404)" 404 "$STATUS"

# 5.8 Delete non-existent campaign
STATUS=$(get_status DELETE "/api/campaigns/99999" -H "Authorization: Bearer $ADV_TOKEN")
assert_status "DELETE /campaigns/99999 — not found (404)" 404 "$STATUS"

# 5.9 Cancel non-existent campaign
STATUS=$(get_status PATCH "/api/campaigns/99999/cancel" -H "Authorization: Bearer $ADV_TOKEN")
assert_status "PATCH /campaigns/99999/cancel — not found (404)" 404 "$STATUS"

# 5.10 Review — forbidden for advertiser
STATUS=$(get_status PATCH "/api/campaigns/1/review" \
  -H "Authorization: Bearer $ADV_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"approved":true}')
assert_status "PATCH /campaigns/1/review — forbidden (403)" 403 "$STATUS"

# ═══════════════════════════════════════════════════════════════════════════════
# 6. FINANCE MODULE
# ═══════════════════════════════════════════════════════════════════════════════
section "Finance Module"

# 6.1 Get wallet
STATUS=$(get_status GET "/api/finance/wallet" -H "Authorization: Bearer $ADV_TOKEN")
assert_status "GET /finance/wallet — advertiser" 200 "$STATUS"

# 6.2 Calculate cost
STATUS=$(get_status POST "/api/finance/calculate-cost" \
  -H "Authorization: Bearer $ADV_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"propertyId":'${FIRST_PROP_ID:-1}',"targetSlot":"SCREENSAVER","durationPackage":"WEEKLY","startDate":"2027-01-01"}')
# Could be 200 or 201
if [ "$(get_status POST "/api/finance/calculate-cost" \
  -H "Authorization: Bearer $ADV_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"propertyId":'${FIRST_PROP_ID:-1}',"targetSlot":"SCREENSAVER","durationPackage":"WEEKLY","startDate":"2027-01-01"}')" -le 201 ]; then
  TOTAL=$((TOTAL + 1)); PASS=$((PASS + 1))
  echo -e "  ${GREEN}✓${NC} POST /finance/calculate-cost — OK"
else
  TOTAL=$((TOTAL + 1)); FAIL=$((FAIL + 1))
  echo -e "  ${RED}✗${NC} POST /finance/calculate-cost — FAILED"
fi

# 6.3 Topup — bad amount
STATUS=$(get_status POST "/api/finance/topup" \
  -H "Authorization: Bearer $ADV_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount":-1}')
assert_status "POST /finance/topup — invalid amount (400)" 400 "$STATUS"

# 6.4 Withdrawal request — no auth
STATUS=$(get_status POST "/api/finance/withdrawal")
assert_status "POST /finance/withdrawal — no auth (401)" 401 "$STATUS"

# 6.5 Admin transactions (admin)
STATUS=$(get_status GET "/api/finance/admin/transactions?page=1&take=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
assert_status "GET /finance/admin/transactions — admin" 200 "$STATUS"

# 6.6 Admin transactions — forbidden for advertiser
STATUS=$(get_status GET "/api/finance/admin/transactions" \
  -H "Authorization: Bearer $ADV_TOKEN")
assert_status "GET /finance/admin/transactions — forbidden (403)" 403 "$STATUS"

# 6.7 Pending withdrawals (admin)
STATUS=$(get_status GET "/api/finance/admin/withdrawals" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
assert_status "GET /finance/admin/withdrawals — admin" 200 "$STATUS"

# 6.8 Webhook — skip because Midtrans validation cannot be mocked locally
skip_test "POST /api/finance/webhook/midtrans — (Skipped, requires real Midtrans)"

# 6.9 Publisher report — forbidden for advertiser
STATUS=$(get_status GET "/api/finance/publisher/report" \
  -H "Authorization: Bearer $ADV_TOKEN")
assert_status "GET /finance/publisher/report — forbidden (403)" 403 "$STATUS"

# ═══════════════════════════════════════════════════════════════════════════════
# 7. ANALYTICS MODULE
# ═══════════════════════════════════════════════════════════════════════════════
section "Analytics Module"

# 7.1 Advertiser summary
STATUS=$(get_status GET "/api/analytics/advertiser/summary" \
  -H "Authorization: Bearer $ADV_TOKEN")
assert_status "GET /analytics/advertiser/summary — advertiser" 200 "$STATUS"

# 7.2 Admin summary
STATUS=$(get_status GET "/api/analytics/admin/summary" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
assert_status "GET /analytics/admin/summary — admin" 200 "$STATUS"

# 7.3 Admin summary — forbidden for advertiser
STATUS=$(get_status GET "/api/analytics/admin/summary" \
  -H "Authorization: Bearer $ADV_TOKEN")
assert_status "GET /analytics/admin/summary — forbidden (403)" 403 "$STATUS"

# 7.4 Advertiser summary — no auth
STATUS=$(get_status GET "/api/analytics/advertiser/summary")
assert_status "GET /analytics/advertiser/summary — no auth (401)" 401 "$STATUS"

# ═══════════════════════════════════════════════════════════════════════════════
# 8. DASHBOARD MODULE (Operator)
# ═══════════════════════════════════════════════════════════════════════════════
section "Dashboard Module"

# Try to login as operator
OPR_RESP=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"operator@grandindonesia.com","password":"password123"}')
OPR_TOKEN=$(echo "$OPR_RESP" | jq -r '.data.accessToken // empty')

if [ -n "$OPR_TOKEN" ]; then
  # 8.1 Operator dashboard
  STATUS=$(get_status GET "/api/dashboard/operator" -H "Authorization: Bearer $OPR_TOKEN")
  assert_status "GET /dashboard/operator — operator" 200 "$STATUS"

  # 8.2 Property schedule
  STATUS=$(get_status GET "/api/schedule/property" -H "Authorization: Bearer $OPR_TOKEN")
  assert_status "GET /schedule/property — operator" 200 "$STATUS"

  # 8.3 My property profile
  STATUS=$(get_status GET "/api/properties/my-profile" -H "Authorization: Bearer $OPR_TOKEN")
  assert_status "GET /properties/my-profile — operator" 200 "$STATUS"

  # 8.4 Operator screens
  STATUS=$(get_status GET "/api/inventory/operator/screens?page=1&take=5" \
    -H "Authorization: Bearer $OPR_TOKEN")
  assert_status "GET /inventory/operator/screens — operator" 200 "$STATUS"
else
  skip_test "Dashboard tests — operator login failed"
  skip_test "Schedule tests — operator login failed"
  skip_test "Profile tests — operator login failed"
  skip_test "Operator screens — operator login failed"
fi

# 8.5 Dashboard — forbidden for advertiser
STATUS=$(get_status GET "/api/dashboard/operator" -H "Authorization: Bearer $ADV_TOKEN")
assert_status "GET /dashboard/operator — forbidden for advertiser (403)" 403 "$STATUS"

# ═══════════════════════════════════════════════════════════════════════════════
# 9. PLAYER MODULE (requires X-Device-ID or screen token)
# ═══════════════════════════════════════════════════════════════════════════════
section "Player Module"

# 9.1 Heartbeat — no auth (should 401 or 403)
STATUS=$(get_status POST "/api/player/heartbeat" \
  -H "Content-Type: application/json" \
  -d '{"cpuTemp":45}')
TOTAL=$((TOTAL + 1))
if [ "$STATUS" -eq 401 ] || [ "$STATUS" -eq 403 ]; then
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}✓${NC} POST /player/heartbeat — no device auth (${STATUS})"
else
  FAIL=$((FAIL + 1))
  echo -e "  ${RED}✗${NC} POST /player/heartbeat — expected 401|403, got ${STATUS}"
fi

# 9.2 Get config — no auth
STATUS=$(get_status GET "/api/player/config")
TOTAL=$((TOTAL + 1))
if [ "$STATUS" -eq 401 ] || [ "$STATUS" -eq 403 ]; then
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}✓${NC} GET /player/config — no device auth (${STATUS})"
else
  FAIL=$((FAIL + 1))
  echo -e "  ${RED}✗${NC} GET /player/config — expected 401|403, got ${STATUS}"
fi

# 9.3 Get playlist — no auth
STATUS=$(get_status GET "/api/player/playlist?slot=SCREENSAVER")
TOTAL=$((TOTAL + 1))
if [ "$STATUS" -eq 401 ] || [ "$STATUS" -eq 403 ]; then
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}✓${NC} GET /player/playlist — no device auth (${STATUS})"
else
  FAIL=$((FAIL + 1))
  echo -e "  ${RED}✗${NC} GET /player/playlist — expected 401|403, got ${STATUS}"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 10. TELEMETRY MODULE
# ═══════════════════════════════════════════════════════════════════════════════
section "Telemetry Module"

# 10.1 Impression — no auth
STATUS=$(get_status POST "/api/telemetry/impression" \
  -H "Content-Type: application/json" \
  -d '{"impressions":[]}')
TOTAL=$((TOTAL + 1))
if [ "$STATUS" -eq 401 ] || [ "$STATUS" -eq 403 ]; then
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}✓${NC} POST /telemetry/impression — no device auth (${STATUS})"
else
  FAIL=$((FAIL + 1))
  echo -e "  ${RED}✗${NC} POST /telemetry/impression — expected 401|403, got ${STATUS}"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║               TEST RESULTS SUMMARY               ║${NC}"
echo -e "${BOLD}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}║${NC}  Total:   ${TOTAL}                                     ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}  ${GREEN}Passed:  ${PASS}${NC}                                     ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}  ${RED}Failed:  ${FAIL}${NC}                                     ${BOLD}║${NC}"
echo -e "${BOLD}║${NC}  ${YELLOW}Skipped: ${SKIP}${NC}                                     ${BOLD}║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}❌ SOME TESTS FAILED${NC}"
  exit 1
else
  echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
  exit 0
fi
