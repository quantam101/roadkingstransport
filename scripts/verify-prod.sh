#!/usr/bin/env bash
set -euo pipefail

CANONICAL="https://roadkingstransport.us"
HOST_NONWWW="roadkingstransport.us"
HOST_WWW="www.roadkingstransport.us"

fail() { echo "FAIL: $1"; exit 1; }
ok() { echo "OK: $1"; }

print_redirect_trace () {
  local url="$1"
  echo "---- Redirect trace for $url ----"
  curl -sS -I -L "$url" | awk '
    /^HTTP\// { print }
    tolower($1)=="location:" { print }
  '
  echo "--------------------------------"
}

check_redirect () {
  local from="$1"
  local expected_prefix="$2"

  # Follow redirects and capture final URL
  local final
  final="$(curl -sS -L -o /dev/null -w "%{url_effective}" "$from")"

  if [[ -z "$final" ]]; then
    echo "FAIL: No final URL for $from"
    print_redirect_trace "$from"
    exit 1
  fi

  if [[ "$final" != "$expected_prefix"* ]]; then
    echo "FAIL: Bad redirect chain"
    echo "  From:     $from"
    echo "  Expected: $expected_prefix..."
    echo "  Final:    $final"
    print_redirect_trace "$from"
    exit 1
  fi

  echo "OK: Redirect $from -> $final"
}

# 1) Redirect checks
check_redirect "http://$HOST_NONWWW" "$CANONICAL"
check_redirect "http://$HOST_WWW"    "$CANONICAL"
check_redirect "https://$HOST_WWW"   "$CANONICAL"

# 2) Header checks on final 200
headers="$(curl -sI "$CANONICAL" | tr -d '\r')"
echo "$headers" | grep -qi "^strict-transport-security:" || fail "Missing HSTS"
echo "$headers" | grep -qi "^content-security-policy:"   || fail "Missing CSP"
echo "$headers" | grep -qi "^x-frame-options:"           || fail "Missing X-Frame-Options"
echo "$headers" | grep -qi "^x-content-type-options:"    || fail "Missing X-Content-Type-Options"
echo "$headers" | grep -qi "^referrer-policy:"           || fail "Missing Referrer-Policy"
echo "$headers" | grep -qi "^permissions-policy:"        || fail "Missing Permissions-Policy"
ok "Security headers present"

# 3) Basic health check
code="$(curl -s -o /dev/null -w "%{http_code}" "$CANONICAL")"
[[ "$code" == "200" ]] || fail "Homepage not 200 (got $code)"
ok "Homepage returns 200"

# 4) SEO files
robots_code="$(curl -s -o /dev/null -w "%{http_code}" "$CANONICAL/robots.txt")"
[[ "$robots_code" == "200" ]] || fail "robots.txt missing"
sitemap_code="$(curl -s -o /dev/null -w "%{http_code}" "$CANONICAL/sitemap.xml")"
[[ "$sitemap_code" == "200" ]] || fail "sitemap.xml missing"
ok "robots.txt + sitemap.xml present"

echo "ALL CHECKS PASSED"
