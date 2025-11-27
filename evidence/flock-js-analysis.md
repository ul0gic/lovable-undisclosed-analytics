# flock.js Technical Analysis

## Overview

| Property | Value |
|----------|-------|
| Filename | `~flock.js` |
| Size | 21,296 bytes |
| SHA256 | `a86e084b4f82709814be6c15fd6305daa783fda87ad95402da9a4d3a1dd6d748` |
| Source | `https://[app].lovable.app/~flock.js` |
| Verified | November 26, 2025 |

This script is injected into deployed Lovable applications. The tilde (`~`) prefix in the route is non-standard.

---

## Script Structure

The script contains two main parts:

1. **Lines 1-288**: Google Web Vitals library (performance metrics)
2. **Lines 289+**: Custom tracking code

---

## Key Code Sections

### 1. Timezone-to-Country Mapping

The script includes a lookup table mapping ~200 IANA timezones to ISO country codes:

```javascript
const a = {
    "Asia/Barnaul": "RU",
    "America/New_York": "US",
    "Europe/London": "GB",
    "Asia/Tokyo": "JP",
    "Australia/Sydney": "AU",
    // ... approximately 200 entries
    "Asia/Calcutta": "IN"
}
```

**Usage**: The user's timezone is read via `Intl.DateTimeFormat().resolvedOptions().timeZone` and mapped to a country code.

---

### 2. Session Cookie Generation

```javascript
const e = "session-id";

function p() {
    return "10000000-1000-4000-8000-100000000000".replace(
        /[018]/g,
        (a => (a ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> a / 4).toString(16))
    )
}
```

**Function**: Generates a UUID v4 session identifier.

**Cookie setting**:
```javascript
function(a) {
    let e = `session-id=${a}; Max-Age=1800; path=/; secure`;
    A && (e += `; domain=${A}`);
    document.cookie = e
}
```

**Cookie attributes**:
- `Max-Age=1800` (30 minutes)
- `path=/` (site-wide)
- `secure` (HTTPS only)
- No `HttpOnly` flag (accessible to JavaScript)
- No explicit `SameSite` (defaults to `Lax`)

---

### 3. Data Collection Function

```javascript
function C() {
    let e, i;
    try {
        const r = Intl.DateTimeFormat().resolvedOptions().timeZone;
        e = a[r];  // Map timezone to country
        i = navigator.languages && navigator.languages.length
            ? navigator.languages[0]
            : navigator.userLanguage || navigator.language || navigator.browserLanguage || "en"
    } catch (a) {}
    return { country: e, locale: i }
}
```

**Collects**:
- Country (derived from timezone)
- Locale (from `navigator.languages`)

---

### 4. Page View Tracking

```javascript
function y() {
    if (window.__nightmare || window.navigator.webdriver || window.Cypress) return;

    const {country: a, locale: e} = C();

    setTimeout(() => {
        v("page_hit", {
            "user-agent": window.navigator.userAgent,
            locale: e,
            location: a,
            referrer: document.referrer,
            pathname: window.location.pathname,
            href: window.location.href
        })
    }, 300)
}
```

**Behavior**:
- Skips execution if automation tools detected (Nightmare.js, Selenium WebDriver, Cypress)
- Waits 300ms before sending
- Sends: user-agent, locale, country, referrer, pathname, full URL

---

### 5. Data Transmission

```javascript
async function v(a, e) {
    f();  // Set/renew session cookie

    // Skip if user-agent > 500 chars
    if ((r = window.navigator.userAgent) && "string" == typeof r && r.length > 500) return;

    // Determine endpoint
    if (o) t = o;  // data-proxy-url attribute
    else if (n) t = `${n}/api/tracking`;
    else if (s) t = `${s}/v0/events?name=${i}&token=${c}`;
    else t = `https://api.tinybird.co/v0/events?name=${i}&token=${c}`;

    // Send via XMLHttpRequest
    const d = new XMLHttpRequest;
    d.open("POST", t, !0);
    d.setRequestHeader("Content-Type", "application/json");
    d.send(JSON.stringify({
        timestamp: (new Date).toISOString(),
        action: a,
        version: "1",
        session_id: u,
        payload: A
    }))
}
```

**Endpoint priority**:
1. `data-proxy-url` attribute (Lovable uses `/~api/analytics`)
2. `data-proxy` + `/api/tracking`
3. `data-host` + Tinybird path
4. Direct to `api.tinybird.co`

---

### 6. Sensitive Data Filtering

```javascript
const S = a => {
    let e = JSON.stringify(a);
    ["username", "user", "user_id", "userid",
     "password", "pass", "pin", "passcode",
     "token", "api_token",
     "email", "address", "phone",
     "sex", "gender",
     "order", "order_id", "orderid",
     "payment", "credit_card"].forEach(a => {
        e = e.replaceAll(
            new RegExp(`("${a}"):(".+?"|\\d+)`, "mgi"),
            '$1:"********"'
        )
    });
    return e
};
```

**Filters these field names** from payloads before transmission:
- User identifiers: username, user, user_id, userid
- Credentials: password, pass, pin, passcode, token, api_token
- Personal info: email, address, phone, sex, gender
- Transaction data: order, order_id, orderid, payment, credit_card

---

### 7. history.pushState Modification

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

**Behavior**:
- Stores reference to native `history.pushState`
- Replaces with wrapper function
- Wrapper calls original, then triggers tracking
- Also listens for `popstate` (back/forward navigation)

**Detection**:
```javascript
// In browser console:
history.pushState.toString()
// Returns: "function(){P.apply(this,arguments),y()}"
// Native would return: "function pushState() { [native code] }"
```

---

### 8. Event Listeners

```javascript
window.addEventListener("hashchange", y);  // Hash navigation
window.addEventListener("popstate", y);    // Back/forward buttons
```

---

### 9. Script Configuration

The script reads configuration from its own `<script>` tag attributes:

```javascript
if (document.currentScript) {
    s = document.currentScript.getAttribute("data-host");
    n = document.currentScript.getAttribute("data-proxy");
    o = document.currentScript.getAttribute("data-proxy-url");  // Lovable uses this
    c = document.currentScript.getAttribute("data-token");
    A = document.currentScript.getAttribute("data-domain");
    // ...
}
```

**Lovable's injection**:
```html
<script defer src="/~flock.js" data-proxy-url="/~api/analytics"></script>
```

---

## Data Payload Structure

Each tracking event sends:

```json
{
    "timestamp": "2025-11-26T12:34:56.789Z",
    "action": "page_hit",
    "version": "1",
    "session_id": "a3f2b1c4-5678-4abc-8def-123456789012",
    "payload": {
        "user-agent": "Mozilla/5.0...",
        "locale": "en-US",
        "location": "US",
        "referrer": "https://google.com",
        "pathname": "/dashboard",
        "href": "https://app.lovable.app/dashboard"
    }
}
```

---

## Web Vitals Integration

If enabled via `data-web-vitals="true"`, the script also collects Google Web Vitals metrics:

- FCP (First Contentful Paint)
- CLS (Cumulative Layout Shift)
- INP (Interaction to Next Paint)
- LCP (Largest Contentful Paint)
- TTFB (Time to First Byte)

---

## Global API Exposure

```javascript
window.Tinybird = {
    trackEvent: v
}
```

Exposes `window.Tinybird.trackEvent()` for custom event tracking.

---

## Summary of Behaviors

| Behavior | Implementation |
|----------|----------------|
| Session tracking | UUID v4 cookie, 30-minute expiry |
| Country detection | Timezone-to-country lookup table |
| User-agent collection | `navigator.userAgent` |
| Language detection | `navigator.languages[0]` |
| URL tracking | `pathname`, `href`, `referrer` |
| SPA navigation tracking | `history.pushState` wrapper |
| Hash navigation tracking | `hashchange` event listener |
| Back/forward tracking | `popstate` event listener |
| Automation detection | Checks for `__nightmare`, `webdriver`, `Cypress` |
| Sensitive data filtering | Regex replacement of 21 field names |
| Analytics endpoint | `/~api/analytics` (proxied) |

---

## Reproduction

To verify these findings:

1. Visit any `*.lovable.app` site
2. Open browser DevTools (F12)
3. Check Network tab for `/~flock.js` request
4. Check Network tab for POST to `/~api/analytics`
5. In Console, run: `history.pushState.toString()`
6. In Console, run: `document.cookie` (look for `session-id`)
