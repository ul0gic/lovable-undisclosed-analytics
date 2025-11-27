/**
 * Lovable flock.js Verification Script
 *
 * Run in browser console on any *.lovable.app site
 * Downloads a JSON report with evidence
 */
(function() {
  console.log('%c🔍 Lovable Tracking Verification', 'font-size: 16px; font-weight: bold; color: #c00');

  const report = {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    findings: {}
  };

  // 1. Check for session-id cookie (UNDISCLOSED in cookie policy)
  console.log('\n%c[1] Checking for undisclosed session-id cookie...', 'font-weight: bold');
  const cookies = document.cookie.split('; ').reduce((acc, c) => {
    const [k, v] = c.split('=');
    acc[k] = v;
    return acc;
  }, {});

  report.findings.sessionCookie = {
    found: 'session-id' in cookies,
    value: cookies['session-id'] || null,
    issue: 'Cookie not listed in Lovable Cookie Policy'
  };

  if (cookies['session-id']) {
    console.log('%c  ✓ FOUND: session-id = ' + cookies['session-id'], 'color: red');
  } else {
    console.log('  ✗ Not found (may need to navigate first)');
  }

  // 2. Check for flock.js script (UNDISCLOSED injection)
  console.log('\n%c[2] Checking for flock.js script injection...', 'font-weight: bold');
  const flockScript = document.querySelector('script[src*="flock"]');

  report.findings.flockScript = {
    found: !!flockScript,
    src: flockScript?.src || null,
    proxyUrl: flockScript?.getAttribute('data-proxy-url') || null,
    issue: 'Script injected without disclosure to developers or users'
  };

  if (flockScript) {
    console.log('%c  ✓ FOUND: ' + flockScript.src, 'color: red');
    console.log('%c  ✓ Proxy URL: ' + flockScript.getAttribute('data-proxy-url'), 'color: red');
  } else {
    console.log('  ✗ Not found');
  }

  // 3. Check for Tinybird reference in flock.js
  console.log('\n%c[3] Checking for undisclosed Tinybird sub-processor...', 'font-weight: bold');

  report.findings.tinybird = {
    issue: 'Tinybird not listed in Sub-processors list',
    note: 'Data sent to /~api/analytics is proxied to api.tinybird.co'
  };

  // Fetch and check flock.js content
  if (flockScript?.src) {
    fetch(flockScript.src)
      .then(r => r.text())
      .then(code => {
        const hasTinybird = code.includes('tinybird') || code.includes('analytics_events');
        report.findings.tinybird.foundInCode = hasTinybird;
        console.log(hasTinybird
          ? '%c  ✓ FOUND: Tinybird references in flock.js'
          : '  ✗ Not found in code', hasTinybird ? 'color: red' : '');
      });
  }

  // 4. Test unauthenticated proxy (key vulnerability)
  console.log('\n%c[4] Testing unauthenticated analytics proxy...', 'font-weight: bold');

  const testPayload = {
    timestamp: new Date().toISOString(),
    action: 'verification_test',
    version: '1',
    session_id: 'security-researcher-test',
    payload: JSON.stringify({ test: true, note: 'This should require authentication' })
  };

  const proxyUrl = window.location.origin + '/~api/analytics';

  fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testPayload)
  })
  .then(r => {
    report.findings.unauthenticatedProxy = {
      vulnerable: r.status === 200,
      status: r.status,
      endpoint: proxyUrl,
      issue: 'Endpoint accepts unauthenticated POST requests - allows analytics injection',
      severity: 'HIGH'
    };

    if (r.status === 200) {
      console.log('%c  ✓ VULNERABLE: Accepted unauthenticated POST (status 200)', 'color: red; font-weight: bold');
    } else {
      console.log('  Status: ' + r.status);
    }
    return r.text();
  })
  .then(body => {
    report.findings.unauthenticatedProxy.response = body;
    if (body === 'Done') {
      console.log('%c  ✓ Response: "Done" - data was accepted without auth', 'color: red');
    }

    // Generate and download report after all checks complete
    setTimeout(downloadReport, 500);
  })
  .catch(e => {
    report.findings.unauthenticatedProxy = { error: e.message };
    setTimeout(downloadReport, 500);
  });

  function downloadReport() {
    // Summary
    console.log('\n%c═══════════════════════════════════════════', 'color: #666');
    console.log('%c SUMMARY', 'font-size: 14px; font-weight: bold');
    console.log('%c═══════════════════════════════════════════', 'color: #666');

    const issues = [];
    if (report.findings.sessionCookie?.found) issues.push('Undisclosed session-id cookie');
    if (report.findings.flockScript?.found) issues.push('Undisclosed flock.js injection');
    if (report.findings.unauthenticatedProxy?.vulnerable) issues.push('Unauthenticated proxy (HIGH)');
    issues.push('Undisclosed sub-processor (Tinybird)');

    console.log('%c Issues Found: ' + issues.length, 'font-weight: bold');
    issues.forEach(i => console.log('%c  • ' + i, 'color: red'));

    report.summary = {
      issuesFound: issues.length,
      issues: issues
    };

    // Download JSON
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lovable-verification-' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('\n%c📥 Report downloaded!', 'color: green; font-weight: bold');
    console.log('Check your Downloads folder for the JSON evidence file.');
  }
})();
