const fs = require('fs');
const path = require('path');

function generateHtmlReport(testResults, config) {
    const totalTests = testResults.tests.length;
    const passedTests = testResults.tests.filter(t => t.status === 'PASS').length;
    const failedTests = testResults.tests.filter(t => t.status === 'FAIL').length;
    const warnTests = testResults.tests.filter(t => t.status === 'WARN').length;
    const consoleErrorsCount = testResults.consoleErrors.length;
    const networkErrorsCount = testResults.networkErrors.length;

    let rowsHtml = '';
    testResults.tests.forEach((t, i) => {
        const badgeClass = t.status === 'PASS' ? 'badge-pass' : (t.status === 'FAIL' ? 'badge-fail' : 'badge-warn');
        let screenshotHtml = '-';
        if (t.screenshot) {
            const relPath = path.relative(path.dirname(config.paths.htmlReport), t.screenshot);
            screenshotHtml = `<a href="${relPath}" target="_blank" class="screenshot-link">📷 View (${path.basename(t.screenshot)})</a>`;
        }
        rowsHtml += `
        <tr>
            <td><strong>#${i + 1}</strong></td>
            <td><span class="zone-badge">${t.zone}</span></td>
            <td><strong>${t.element}</strong></td>
            <td><code>${t.selector || 'DOM Query'}</code></td>
            <td>${t.action}</td>
            <td><span class="badge ${badgeClass}">${t.status}</span></td>
            <td>${t.observation || 'Action completed successfully.'}</td>
            <td>${screenshotHtml}</td>
        </tr>`;
    });

    let consoleHtml = '';
    if (testResults.consoleErrors.length === 0) {
        consoleHtml = '<tr><td colspan="3" style="text-align:center; color: #10B981;">No unhandled JavaScript runtime errors detected.</td></tr>';
    } else {
        testResults.consoleErrors.forEach((e, idx) => {
            consoleHtml += `
            <tr>
                <td>${idx + 1}</td>
                <td><span class="badge badge-fail">${e.type}</span></td>
                <td><code>${e.text}</code></td>
            </tr>`;
        });
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BlackTrader UI Navigation & Button Test Report</title>
    <style>
        :root {
            --bg-main: #0B0E14;
            --bg-card: #151921;
            --bg-hover: #1E232F;
            --border-color: #262C3A;
            --text-primary: #F3F4F6;
            --text-secondary: #9CA3AF;
            --accent-blue: #3B82F6;
            --accent-green: #10B981;
            --accent-red: #EF4444;
            --accent-yellow: #F59E0B;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background: var(--bg-main); color: var(--text-primary); padding: 28px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border-color); }
        .header h1 { font-size: 24px; font-weight: 700; color: #fff; }
        .badge-tag { background: #1E293B; color: #38BDF8; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; border: 1px solid #0284C7; }

        .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 28px; }
        .kpi-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; padding: 18px; }
        .kpi-title { font-size: 11px; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 6px; font-weight: 600; letter-spacing: 0.5px; }
        .kpi-value { font-size: 24px; font-weight: 700; color: #fff; }
        .text-green { color: var(--accent-green) !important; }
        .text-red { color: var(--accent-red) !important; }
        .text-yellow { color: var(--accent-yellow) !important; }
        .text-blue { color: var(--accent-blue) !important; }

        .section-title { font-size: 18px; font-weight: 600; margin: 28px 0 14px 0; color: #E5E7EB; }
        .card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; padding: 20px; margin-bottom: 28px; }

        table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
        th { background: #0E121A; color: var(--text-secondary); padding: 12px 14px; text-transform: uppercase; font-size: 11px; font-weight: 600; border-bottom: 1px solid var(--border-color); }
        td { padding: 12px 14px; border-bottom: 1px solid var(--border-color); }
        tr:hover { background: var(--bg-hover); }

        .badge { padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; display: inline-block; }
        .badge-pass { background: rgba(16, 185, 129, 0.15); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.3); }
        .badge-fail { background: rgba(239, 68, 68, 0.15); color: #F87171; border: 1px solid rgba(239, 68, 68, 0.3); }
        .badge-warn { background: rgba(245, 158, 11, 0.15); color: #FBBF24; border: 1px solid rgba(245, 158, 11, 0.3); }
        .zone-badge { background: #1E293B; color: #94A3B8; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; }

        .screenshot-link { color: #38BDF8; text-decoration: none; font-weight: 600; }
        .screenshot-link:hover { text-decoration: underline; }
        code { background: #0E121A; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px; }
    </style>
</head>
<body>

    <div class="header">
        <div>
            <h1>BlackTrader UI Navigation & Button Test Report</h1>
            <p style="color: var(--text-secondary); font-size: 13px; margin-top: 4px;">
                Platform: <strong>${config.baseUrl}</strong> | Viewport: <strong>${config.viewport.width}x${config.viewport.height}</strong> | Mode: Headless Chrome
            </p>
        </div>
        <div class="badge-tag">Automated Test Execution</div>
    </div>

    <div class="kpi-grid">
        <div class="kpi-card">
            <div class="kpi-title">Total Elements Tested</div>
            <div class="kpi-value text-blue">${totalTests}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-title">Passed Controls</div>
            <div class="kpi-value text-green">${passedTests}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-title">Failed / Dead Clicks</div>
            <div class="kpi-value text-red">${failedTests}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-title">Warnings / Latency</div>
            <div class="kpi-value text-yellow">${warnTests}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-title">Console JS Errors</div>
            <div class="kpi-value ${consoleErrorsCount > 0 ? 'text-red' : 'text-green'}">${consoleErrorsCount}</div>
        </div>
    </div>

    <div class="section-title">Interactive Elements & Navigation Execution Log</div>
    <div class="card" style="padding: 0; overflow-x: auto;">
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Zone</th>
                    <th>Element Tested</th>
                    <th>DOM Selector / Target</th>
                    <th>Action</th>
                    <th>Status</th>
                    <th>Observation / Result</th>
                    <th>Screenshot</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>
    </div>

    <div class="section-title">Browser Runtime Console Errors (${consoleErrorsCount})</div>
    <div class="card" style="padding: 0; overflow-x: auto;">
        <table>
            <thead>
                <tr>
                    <th style="width: 50px;">#</th>
                    <th style="width: 120px;">Type</th>
                    <th>Error Message</th>
                </tr>
            </thead>
            <tbody>
                ${consoleHtml}
            </tbody>
        </table>
    </div>

</body>
</html>`;

    fs.mkdirSync(path.dirname(config.paths.htmlReport), { recursive: true });
    fs.writeFileSync(config.paths.htmlReport, html, 'utf8');
    return config.paths.htmlReport;
}

module.exports = { generateHtmlReport };

