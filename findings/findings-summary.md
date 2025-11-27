# Findings Summary: flock.js Policy Discrepancies

**Date**: November 26, 2025
**Target**: Lovable.dev deployed applications
**Script**: `~flock.js` (21,296 bytes)
**SHA256**: `a86e084b4f82709814be6c15fd6305daa783fda87ad95402da9a4d3a1dd6d748`

---

## Overview

This document identifies discrepancies between Lovable's published policies and the technical behavior of `flock.js`, a script injected into all deployed Lovable applications.

---

## Finding 1: Undisclosed Cookie

### Policy Statement (Cookie Policy, June 27, 2025)

The Cookie Policy lists the following Lovable first-party cookies:

| Cookie Name | Duration | Purpose |
|-------------|----------|---------|
| `_tt_enable_cookie` | 3 months | Cookie consent preferences |
| `__mh_tt_s` | 13 months | User interaction tracking |
| `_ttp` | 3 months | Site performance analysis |
| `lovable-preview-mode` | Session | App preview functionality |
| `react-resizable-panels:layout` | Session | IDE panel layout preferences |
| `ttcsid` | 3 months | Session management |
| `ttcsid_*` | 3 months | Extended session tracking |

### Technical Reality

flock.js sets a `session-id` cookie that is **not listed** in the Cookie Policy:

```javascript
function(a) {
    let e = `session-id=${a}; Max-Age=1800; path=/; secure`;
    A && (e += `; domain=${A}`);
    document.cookie = e
}
```

**Cookie attributes**:
- Name: `session-id`
- Value: UUID v4 (e.g., `d40f5030-de9d-4787-904a-abbcf6027ab2`)
- Duration: 30 minutes (`Max-Age=1800`)
- Scope: Site-wide (`path=/`)
- Security: HTTPS only (`secure`)

### Discrepancy

The `session-id` cookie is set on visitors to deployed Lovable applications but is not disclosed in the Cookie Policy.

---

## Finding 2: Undisclosed Sub-processor (Tinybird)

### Policy Statement (Sub-processors List, May 2025)

The Sub-processors List includes:

**Cloud Infrastructure**: AWS, GCP
**Application Hosting**: Modal.com
**AI/ML**: OpenAI, Anthropic, Google Gemini
**Database & Auth**: Supabase, ClickHouse
**Other**: GitHub, Cloudflare, PostHog, Sentry

### Technical Reality

flock.js is configured to send data to Tinybird (`api.tinybird.co`):

```javascript
let i = "analytics_events";  // Tinybird datasource name

// Endpoint selection logic
if (o) {
    t = o;  // data-proxy-url (Lovable uses "/~api/analytics")
} else if (n) {
    t = `${n}/api/tracking`;
} else if (s) {
    t = `${s}/v0/events?name=${i}&token=${c}`;
} else {
    t = `https://api.tinybird.co/v0/events?name=${i}&token=${c}`;
}
```

The script references:
- Tinybird API endpoint: `api.tinybird.co`
- Tinybird datasource: `analytics_events`
- Tinybird event path: `/v0/events`

Lovable proxies requests through `/~api/analytics` to reach Tinybird.

### Discrepancy

Tinybird is not listed as a sub-processor despite receiving analytics data from deployed applications.

---

## Finding 3: Undisclosed Script Injection

### Policy Statement (Privacy Policy, September 29, 2025)

The Privacy Policy describes data collection:

> "When you interact with the Services, we automatically collect technical data such as IP address, browser type, operating system, device identifiers, pages visited, timestamps, and error logs."

The Cookie Policy mentions third-party scripts:

> "Based on the scripts loaded on our platform, we use the following third-party services..."

Lists: Google Analytics, Facebook/Meta, Reddit, PostHog, TikTok

### Technical Reality

flock.js is injected into every deployed Lovable application:

```html
<script defer src="/~flock.js" data-proxy-url="/~api/analytics"></script>
```

The script:
- Is not a listed third-party service
- Uses a tilde (`~`) prefix to create a non-standard route
- Is injected at build time without developer configuration
- Tracks end users of deployed applications

### Discrepancy

flock.js is not disclosed as a tracking mechanism. The Privacy Policy and Cookie Policy do not mention:
- The existence of flock.js
- That deployed applications include tracking code
- The `~` prefix route pattern
- That end-user data is collected via this script

---

## Finding 4: Undisclosed Browser API Modification

### Policy Statement

No policy document mentions modification of browser APIs.

### Technical Reality

flock.js wraps the native `history.pushState` method:

```javascript
const M = window.history;
if (M.pushState) {
    const P = M.pushState;  // Store original
    M.pushState = function() {
        P.apply(this, arguments);  // Call original
        y()  // Track navigation
    };
    window.addEventListener("popstate", y)
}
```

**Effect**: Every SPA navigation triggers a tracking event.

**Detection**:
```javascript
// Browser console
history.pushState.toString()
// Returns: "function(){P.apply(this,arguments),y()}"
// Native would return: "function pushState() { [native code] }"
```

### Discrepancy

The modification of `history.pushState` is not disclosed in any policy document.

---

## Finding 5: Proxy Endpoint Obscures Data Destination

### Technical Implementation

flock.js sends data to `/~api/analytics`:

```javascript
o = document.currentScript.getAttribute("data-proxy-url");
// Lovable sets: data-proxy-url="/~api/analytics"
```

This endpoint proxies requests to Tinybird, making the actual data destination non-obvious to:
- Developers inspecting network requests
- Users reviewing cookie/privacy disclosures
- Security auditors examining traffic

### Discrepancy

The proxy pattern obscures that data flows to an undisclosed third party (Tinybird).

---

## Data Collected by flock.js

Each page view sends:

```json
{
    "timestamp": "2025-11-26T12:34:56.789Z",
    "action": "page_hit",
    "version": "1",
    "session_id": "uuid-v4-session-id",
    "payload": {
        "user-agent": "Mozilla/5.0...",
        "locale": "en-US",
        "location": "US",
        "referrer": "https://previous-page.com",
        "pathname": "/current-path",
        "href": "https://app.lovable.app/current-path"
    }
}
```

**Data points**:
- Session identifier (UUID)
- Full user-agent string
- Language/locale
- Country (derived from timezone)
- Referrer URL
- Current page URL

---

## Summary Table

| Finding | Policy | Reality |
|---------|--------|---------|
| `session-id` cookie | Not listed | Set on all deployed app visitors |
| Tinybird sub-processor | Not listed | Receives analytics data |
| flock.js script | Not disclosed | Injected into all deployments |
| history.pushState modification | Not disclosed | Wrapped for navigation tracking |
| Data destination | Not clear | Proxied through `/~api/analytics` to Tinybird |

---

## Reproduction Steps

1. Visit any deployed Lovable application (e.g., `https://[app].lovable.app`)
2. Open browser DevTools (F12)
3. **Network tab**: Observe request to `/~flock.js`
4. **Network tab**: Observe POST requests to `/~api/analytics`
5. **Console**: Run `document.cookie` - observe `session-id`
6. **Console**: Run `history.pushState.toString()` - observe non-native function

---

## References

- flock.js source: `final-report/flock.js`
- Technical analysis: `final-report/flock-js-analysis.md`
- Cookie Policy: `final-report/cookie.md`
- Privacy Policy: `final-report/privacy-policy.md`
- Sub-processors List: `final-report/sub-processors.md`
- Data Processing Agreement: `final-report/dpa.md`
