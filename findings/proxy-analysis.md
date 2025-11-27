# Proxy Mechanism Analysis

**Date**: November 26, 2025

---

## Overview

Lovable uses a first-party proxy pattern to route analytics data to Tinybird. This analysis examines how the proxy works and its effect on transparency.

---

## Technical Implementation

### Script Injection

The following is injected into every deployed Lovable application:

```html
<script defer src="https://estates-pro.lovable.app/~flock.js"
        data-proxy-url="https://estates-pro.lovable.app/~api/analytics"></script>
```

Key observations:
- Script URL uses the **same domain** as the deployed app
- `data-proxy-url` also uses the **same domain**
- Both use the tilde (`~`) prefix route pattern

### Data Flow

```
[User Browser]
      │
      │ POST https://estates-pro.lovable.app/~api/analytics
      │ (first-party request)
      │
      ▼
[Lovable Infrastructure / Cloudflare]
      │
      │ Forward + inject auth token
      │
      ▼
[Tinybird API: api.tinybird.co]
      │
      │ Response: "Done"
      │
      ▼
[Lovable Infrastructure]
      │
      │ Return response to browser
      │
      ▼
[User Browser receives "Done"]
```

### Evidence: Request/Response Analysis

**Request to proxy endpoint:**
```
POST https://estates-pro.lovable.app/~api/analytics
Content-Type: application/json

{"timestamp":"2025-11-26T12:00:00.000Z","action":"test","version":"1","session_id":"test-123","payload":"{}"}
```

**Response headers:**
```
HTTP/2 200
date: Wed, 26 Nov 2025 23:24:54 GMT
content-type: text/plain; charset=UTF-8
content-length: 4
server: cloudflare
cf-ray: 9a4d24507cd9dd95-STL
```

**Response body:**
```
Done
```

**Direct Tinybird request (for comparison):**
```
POST https://api.tinybird.co/v0/events?name=analytics_events
Content-Type: application/json

{"timestamp":"2025-11-26T12:00:00.000Z","action":"test","version":"1","session_id":"test-123","payload":"{}"}
```

**Response:**
```
HTTP/2 403
server: openresty
content-type: text/plain; charset=utf-8

Invalid token
```

### How the Proxy Works

1. **flock.js sends data to same-origin endpoint**
   - No cross-origin request visible in browser DevTools
   - Appears as first-party traffic

2. **Lovable infrastructure receives the request**
   - Hosted on Cloudflare (`server: cloudflare`)
   - Route pattern: `/~api/analytics`

3. **Server-side forwarding to Tinybird**
   - Injects Tinybird authentication token
   - Forwards payload to `api.tinybird.co/v0/events`
   - Token is never exposed to client

4. **Response proxied back**
   - Tinybird responds with "Done"
   - Proxy returns this to browser

---

## Code Analysis

From flock.js, the endpoint selection logic:

```javascript
// Configuration read from script tag
o = document.currentScript.getAttribute("data-proxy-url");

// In the send function
if (o) {
    t = o;  // Use proxy URL if set (Lovable's approach)
} else if (n) {
    t = `${n}/api/tracking`;
} else if (s) {
    t = `${s}/v0/events?name=${i}&token=${c}`;
} else {
    t = `https://api.tinybird.co/v0/events?name=${i}&token=${c}`;
}
```

When `data-proxy-url` is set (as Lovable does), the direct Tinybird URL is never used client-side.

The datasource name reveals the destination:
```javascript
let i = "analytics_events";  // Tinybird datasource
```

---

## Effect on Transparency

### What Users/Developers See

In browser DevTools Network tab:
- Request to: `https://[app].lovable.app/~api/analytics`
- Origin: Same domain (first-party)
- No indication of Tinybird

### What is Hidden

- Actual data destination (Tinybird)
- Third-party data processor involvement
- Authentication mechanism

### Detection Difficulty

| Method | Result |
|--------|--------|
| Browser DevTools Network | Shows first-party request only |
| Privacy browser extensions | May not flag as third-party tracker |
| Cookie blockers | Cookie is first-party, may not block |
| Ad blockers | Route pattern (`~`) is non-standard, may bypass filter lists |
| DNS-level blocking | Would need to block app's own domain |

---

## Route Pattern: Tilde Prefix (`~`)

The `~` character in URLs is unusual:
- `/~flock.js` - Script URL
- `/~api/analytics` - Data endpoint

This pattern:
1. Is not a standard convention
2. May avoid pattern matching in blocklists
3. Visually distinctive but easy to overlook
4. Suggests intentional differentiation from user routes

---

## Comparison: Direct vs. Proxied

| Aspect | Direct to Tinybird | Via Proxy |
|--------|-------------------|-----------|
| Visible destination | `api.tinybird.co` | `[app].lovable.app` |
| Request type | Cross-origin | Same-origin |
| Auth token exposure | Client-side | Server-side |
| CORS required | Yes | No |
| Blockable by domain | Yes (block tinybird.co) | No (would block own app) |
| Visible in DevTools as 3rd party | Yes | No |

---

## Observations

1. **First-party appearance**: All requests appear to stay within the app's domain

2. **Token concealment**: The Tinybird authentication token is injected server-side and never exposed to the browser

3. **Detection resistance**: The proxy pattern makes it difficult to:
   - Identify third-party data flow
   - Block via domain-based filtering
   - Detect via standard privacy tools

4. **Policy implications**: The proxy obscures that data flows to a sub-processor (Tinybird) that is not listed in Lovable's Sub-processors List

---

## Reproduction

```bash
# Test the proxy endpoint
curl -i -X POST "https://[app].lovable.app/~api/analytics" \
  -H "Content-Type: application/json" \
  -d '{"timestamp":"2025-11-26T00:00:00.000Z","action":"test","version":"1","session_id":"test","payload":"{}"}'

# Compare with direct Tinybird (will fail without token)
curl -i -X POST "https://api.tinybird.co/v0/events?name=analytics_events" \
  -H "Content-Type: application/json" \
  -d '{"timestamp":"2025-11-26T00:00:00.000Z","action":"test","version":"1","session_id":"test","payload":"{}"}'
```

---

## Summary

The proxy mechanism:
1. Routes analytics data through a same-origin endpoint
2. Conceals the actual destination (Tinybird) from browsers and users
3. Injects authentication server-side
4. Makes blocking or detection significantly more difficult
5. Results in Tinybird not being visible as a data processor to end users or developers
