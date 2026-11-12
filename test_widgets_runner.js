/**
 * =============================================================================
 * BLACKTRADER WIDGET PICKER & LIFECYCLE AUTOMATION SUITE
 * =============================================================================
 * Tests:
 * 1. Left categories filter validation (All, Trading, Markets, Productivity, Accounts)
 * 2. Categorization accuracy and filter leakage check
 * 3. Complete Open / Close lifecycle for all 20 widgets
 * 4. Screenshot evidence capture for every category and every widget
 * 5. Generates interactive HTML report: reports/ui_widgets_report.html
 * =============================================================================
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const config = require('./config.js');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Specification of expected categorization
const EXPECTED_CATEGORIES = {
    'All': [
        'Watchlist', 'Chart', 'Trades', 'Coder', 'Algo', 'Backtest', 'Screener',
        'Drawing Tools', 'Orders', 'Positions', 'Funds', 'Trade History',
        'Trade Statistics', 'Logs', 'Copy trading', 'MAM', 'PAMM', 'Referrals',
        'Wallet', 'Alerts'
    ],
    'Trading': [
        'Watchlist', 'Chart', 'Trades', 'Coder', 'Algo', 'Backtest',
        'Drawing Tools', 'Orders', 'Positions'
    ],
    'Markets': [
        'Screener', 'Funds', 'Trade History', 'Trade Statistics'
    ],
    'Productivity': [
        'Logs', 'Alerts'
    ],
    'Accounts': [
        'Copy trading', 'MAM', 'PAMM', 'Referrals', 'Wallet'
    ]
};

async function runWidgetsSuite() {
    console.log('='.repeat(80));
    console.log('STARTING BLACKTRADER WIDGET CATEGORIZATION & OPEN/CLOSE TEST SUITE');
    console.log(`Target: ${config.baseUrl}`);
    console.log(`Viewport: ${config.viewport.width}x${config.viewport.height}`);
    console.log('='.repeat(80));

    const testResults = {
        categories: [],
        widgets: [],
        consoleErrors: [],
        startTime: new Date().toISOString()
    };

    const browser = await puppeteer.launch({
        executablePath: config.chromePath,
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            `--window-size=${config.viewport.width},${config.viewport.height}`
        ]
    });

    const page = await browser.newPage();
    await page.setViewport(config.viewport);

    // Track console & page errors
    page.on('console', msg => {
        if (msg.type() === 'error') {
            testResults.consoleErrors.push({ type: 'Console Error', text: msg.text() });
        }
    });
    page.on('pageerror', err => {
        testResults.consoleErrors.push({ type: 'JS Runtime Error', text: err.toString() });
    });

    try {
        // --- AUTHENTICATION & DASHBOARD MOUNT ---
        console.log('\n--- AUTHENTICATING AND MOUNTING DASHBOARD ---');
        await page.goto(`${config.baseUrl}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
        await sleep(1500);

        await page.type('input[type="email"]', config.clientEmail);
        await page.type('input[type="password"]', config.clientPassword);
        const submitBtn = await page.$('button[type="submit"]');
        if (submitBtn) await submitBtn.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        await page.goto(`${config.baseUrl}/dashboard`, { waitUntil: 'networkidle2' });

        const iframeEl = await page.waitForSelector('iframe', { timeout: 20000 });
        const frame = await iframeEl.contentFrame();
        await sleep(4000);
        console.log('[+] Trading terminal frame loaded.');

        // --- PHASE 1: CATEGORY NAVIGATION & FILTERING AUDIT ---
        console.log('\n--- PHASE 1: TESTING LEFT CATEGORY FILTERING ---');
        
        // Open picker drawer
        const addBtn = await frame.$('button[title="Add widget"]');
        if (!addBtn) throw new Error('Add widget button not found in top navigation bar.');
        await addBtn.click();
        await sleep(800);

        const categoryNames = Object.keys(EXPECTED_CATEGORIES);

        for (const catName of categoryNames) {
            process.stdout.write(`[*] Testing Category [${catName}]... `);
            const expectedItems = EXPECTED_CATEGORIES[catName];

            // Click category button
            const clicked = await frame.evaluate((cName) => {
                const btn = Array.from(document.querySelectorAll('.tw-pcats button.tw-pcat')).find(b => (b.textContent || '').trim() === cName);
                if (btn) {
                    btn.click();
                    return true;
                }
                return false;
            }, catName);

            await sleep(400);

            // Screenshot of category
            const ssPath = path.join(config.paths.screenshots, `cat_${catName.toLowerCase()}.png`);
            await page.screenshot({ path: ssPath });

            // Extract visible items and check active class
            const catState = await frame.evaluate((cName) => {
                const btn = Array.from(document.querySelectorAll('.tw-pcats button.tw-pcat')).find(b => (b.textContent || '').trim() === cName);
                const isActive = btn ? btn.classList.contains('on') : false;
                const items = Array.from(document.querySelectorAll('.tw-plist button.tw-pw')).map(b => {
                    const clone = b.cloneNode(true);
                    const hint = clone.querySelector('.tw-pw-hint');
                    if (hint) hint.remove();
                    return clone.textContent.trim();
                });
                return { isActive, items };
            }, catName);

            // Check if items match expected
            const matchCount = catState.items.filter(item => expectedItems.includes(item)).length;
            const isPerfectMatch = matchCount === expectedItems.length && catState.items.length === expectedItems.length;

            if (catState.isActive && isPerfectMatch) {
                console.log(`[PASS] (${catState.items.length}/${expectedItems.length} items verified)`);
                testResults.categories.push({
                    category: catName,
                    status: 'PASS',
                    activeStateVerified: true,
                    expectedCount: expectedItems.length,
                    actualCount: catState.items.length,
                    items: catState.items,
                    screenshot: ssPath,
                    observation: `Category correctly filters to all ${expectedItems.length} designated widgets with no leakage.`
                });
            } else {
                console.log(`[WARN] Mismatch or not active. Found: ${catState.items.length}, Expected: ${expectedItems.length}`);
                testResults.categories.push({
                    category: catName,
                    status: 'WARN',
                    activeStateVerified: catState.isActive,
                    expectedCount: expectedItems.length,
                    actualCount: catState.items.length,
                    items: catState.items,
                    screenshot: ssPath,
                    observation: `Found ${catState.items.length} items (expected ${expectedItems.length}).`
                });
            }
        }

        // Ensure drawer closed after Phase 1
        await frame.evaluate(() => {
            const picker = document.querySelector('.tw-picker');
            if (picker) {
                const veil = document.querySelector('.drawer-veil');
                if (veil) veil.click();
                else {
                    const btn = document.querySelector('button[title="Add widget"]');
                    if (btn) btn.click();
                }
            }
        });
        await sleep(500);

        // --- PHASE 2: WIDGET OPEN / CLOSE LIFECYCLE AUDIT ---
        console.log('\n--- PHASE 2: TESTING OPEN & CLOSE LIFECYCLE FOR ALL 20 WIDGETS ---');
        const allWidgetsToTest = EXPECTED_CATEGORIES['All'];

        for (const widgetName of allWidgetsToTest) {
            process.stdout.write(`[*] Testing Widget [${widgetName}]... `);

            // Record pre-mount panel count
            const preCount = await frame.evaluate(() => document.querySelectorAll('.tw-panel').length);

            // 1. Open picker drawer if not open
            await frame.evaluate(() => {
                const picker = document.querySelector('.tw-picker');
                if (!picker) {
                    const btn = document.querySelector('button[title="Add widget"]');
                    if (btn) btn.click();
                }
            });
            await sleep(600);

            // Switch to "All" category to guarantee visibility
            await frame.evaluate(() => {
                const allBtn = Array.from(document.querySelectorAll('.tw-pcats button.tw-pcat')).find(b => (b.textContent || '').trim() === 'All');
                if (allBtn) allBtn.click();
            });
            await sleep(300);

            // 2. Check widget button state
            const btnInfo = await frame.evaluate((wName) => {
                const btn = Array.from(document.querySelectorAll('.tw-plist button.tw-pw')).find(b => (b.textContent || '').includes(wName));
                if (!btn) return { exists: false };
                return {
                    exists: true,
                    isDisabled: btn.classList.contains('tw-pw-off'),
                    title: btn.getAttribute('title') || '',
                    hasOpenHint: !!btn.querySelector('.tw-pw-hint')
                };
            }, widgetName);

            if (!btnInfo.exists) {
                console.log('[FAIL: Button not found in picker]');
                testResults.widgets.push({
                    widget: widgetName,
                    status: 'FAIL',
                    observation: 'Widget button not present in picker drawer.',
                    screenshot: null
                });
                // Close drawer if open
                await frame.evaluate(() => {
                    const veil = document.querySelector('.drawer-veil');
                    if (veil) veil.click();
                });
                continue;
            }

            // If widget is Chart (single-instance enforced by design)
            if (btnInfo.isDisabled && widgetName === 'Chart') {
                console.log('[PASS: Single-Instance Enforced]');
                const ssChart = path.join(config.paths.screenshots, 'widget_chart_single_instance.png');
                await page.screenshot({ path: ssChart });
                testResults.widgets.push({
                    widget: widgetName,
                    status: 'PASS',
                    mountType: 'Single-Instance Canvas',
                    openStatus: 'Pre-mounted & Protected',
                    closeStatus: 'Protected Core Window',
                    observation: `Enforces single-instance rule: "${btnInfo.title}".`,
                    screenshot: ssChart
                });
                // Close drawer cleanly
                await frame.evaluate(() => {
                    const veil = document.querySelector('.drawer-veil');
                    if (veil) veil.click();
                    else {
                        const btn = document.querySelector('button[title="Add widget"]');
                        if (btn) btn.click();
                    }
                });
                await sleep(400);
                continue;
            }

            // 3. Click to open widget
            const t0 = Date.now();
            await frame.evaluate((wName) => {
                const btn = Array.from(document.querySelectorAll('.tw-plist button.tw-pw')).find(b => (b.textContent || '').includes(wName));
                if (btn) btn.click();
            }, widgetName);

            await sleep(1000);
            const openLatency = Date.now() - t0;

            // 4. Verify widget panel mounted as the newest panel
            const mountInfo = await frame.evaluate((wName, initialCount) => {
                const panels = Array.from(document.querySelectorAll('.tw-panel'));
                const isNewPanelAdded = panels.length > initialCount;
                const lastPanel = panels[panels.length - 1];
                const h = lastPanel ? lastPanel.querySelector('.tw-ph, .tw-tab') : null;
                const matches = h && (h.textContent || '').toLowerCase().includes(wName.toLowerCase());
                const closeBtn = lastPanel ? lastPanel.querySelector('.tw-ph-x, .tw-tab-x') : null;

                return {
                    mounted: isNewPanelAdded,
                    type: 'Workspace Panel',
                    hasCloseBtn: !!closeBtn,
                    headerText: h ? h.innerText.replace(/\n/g, ' ') : ''
                };
            }, widgetName, preCount);

            const safeFileName = widgetName.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const ssOpen = path.join(config.paths.screenshots, `widget_${safeFileName}_open.png`);
            await page.screenshot({ path: ssOpen });

            if (!mountInfo.mounted) {
                console.log('[FAIL: Did not mount]');
                testResults.widgets.push({
                    widget: widgetName,
                    status: 'FAIL',
                    mountType: 'None',
                    openStatus: 'Failed to mount',
                    closeStatus: 'N/A',
                    observation: 'Widget did not create a new workspace panel.',
                    screenshot: ssOpen
                });
                continue;
            }

            // 5. Close widget via close button on the newly added panel
            const closeResult = await frame.evaluate((initialCount) => {
                const panels = Array.from(document.querySelectorAll('.tw-panel'));
                if (panels.length > initialCount) {
                    const lastPanel = panels[panels.length - 1];
                    const x = lastPanel.querySelector('.tw-ph-x, .tw-tab-x');
                    if (x) {
                        x.click();
                        return { closed: true, method: 'Close button (✕)' };
                    }
                }
                return { closed: false };
            }, preCount);

            await sleep(600);

            // 6. Verify unmounted (panel count returned to preCount)
            const unmountedCheck = await frame.evaluate((initialCount) => {
                const panels = document.querySelectorAll('.tw-panel');
                return panels.length === initialCount;
            }, preCount);

            if (mountInfo.mounted && closeResult.closed && unmountedCheck) {
                console.log(`[PASS] (Opened in ${openLatency}ms -> Closed cleanly)`);
                testResults.widgets.push({
                    widget: widgetName,
                    status: 'PASS',
                    mountType: mountInfo.type,
                    openStatus: `Mounted (${openLatency}ms)`,
                    closeStatus: `Closed via ${closeResult.method}`,
                    observation: `Cleanly mounted as right workspace panel and unmounted with zero remnants.`,
                    screenshot: ssOpen
                });
            } else {
                console.log(`[WARN: Close imperfect: closed=${closeResult.closed}, unmounted=${unmountedCheck}]`);
                testResults.widgets.push({
                    widget: widgetName,
                    status: 'WARN',
                    mountType: mountInfo.type,
                    openStatus: 'Mounted',
                    closeStatus: closeResult.closed ? 'Close clicked but DOM retained' : 'Close button failed',
                    observation: `Close verification warning.`,
                    screenshot: ssOpen
                });
            }
        }

    } catch (err) {
        console.error('\n[FATAL SUITE ERROR]:', err);
    } finally {
        await browser.close();
        console.log('\n[+] Browser closed cleanly.');
    }

    // --- PHASE 3: GENERATE HTML REPORT ---
    console.log('\n================================================================================');
    console.log('GENERATING WIDGET CATEGORIZATION & LIFECYCLE REPORT');
    const reportHtmlPath = path.resolve(__dirname, 'reports/ui_widgets_report.html');
    generateWidgetsHtmlReport(testResults, reportHtmlPath);
    console.log(`[+] Report generated: file://${reportHtmlPath}`);
    console.log('================================================================================');
}

function generateWidgetsHtmlReport(data, outputPath) {
    const totalCategories = data.categories.length;
    const passedCategories = data.categories.filter(c => c.status === 'PASS').length;
    const totalWidgets = data.widgets.length;
    const passedWidgets = data.widgets.filter(w => w.status === 'PASS').length;
    const failedWidgets = data.widgets.filter(w => w.status === 'FAIL').length;
    const consoleErrorsCount = data.consoleErrors.length;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BlackTrader Widget Categorization & Lifecycle Test Report</title>
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
        td { padding: 12px 14px; border-bottom: 1px solid var(--border-color); vertical-align: top; }
        tr:hover { background: var(--bg-hover); }

        .badge { padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; display: inline-block; }
        .badge-pass { background: rgba(16, 185, 129, 0.15); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.3); }
        .badge-fail { background: rgba(239, 68, 68, 0.15); color: #F87171; border: 1px solid rgba(239, 68, 68, 0.3); }
        .badge-warn { background: rgba(245, 158, 11, 0.15); color: #FBBF24; border: 1px solid rgba(245, 158, 11, 0.3); }
        .cat-tag { background: #1E293B; color: #94A3B8; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
        .widget-pill { background: #0E121A; border: 1px solid #262C3A; color: #E2E8F0; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin: 2px; display: inline-block; }

        .screenshot-link { color: #38BDF8; text-decoration: none; font-weight: 600; }
        .screenshot-link:hover { text-decoration: underline; }
        code { background: #0E121A; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px; }
    </style>
</head>
<body>

    <div class="header">
        <div>
            <h1>BlackTrader Widget Categorization & Lifecycle Test Report</h1>
            <p style="color: var(--text-secondary); font-size: 13px; margin-top: 4px;">
                Feature: <strong>Widget Picker Drawer (.tw-picker)</strong> | Viewport: <strong>1920x1080</strong> | Executed: <strong>${data.startTime}</strong>
            </p>
        </div>
        <div class="badge-tag">Full Verification Suite</div>
    </div>

    <div class="kpi-grid">
        <div class="kpi-card">
            <div class="kpi-title">Categories Verified</div>
            <div class="kpi-value text-green">${passedCategories} / ${totalCategories}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-title">Total Widgets Audited</div>
            <div class="kpi-value text-blue">${totalWidgets}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-title">Open & Close Passed</div>
            <div class="kpi-value text-green">${passedWidgets}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-title">Failed / Orphan Panes</div>
            <div class="kpi-value ${failedWidgets > 0 ? 'text-red' : 'text-green'}">${failedWidgets}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-title">Console JS Errors</div>
            <div class="kpi-value ${consoleErrorsCount > 0 ? 'text-yellow' : 'text-green'}">${consoleErrorsCount}</div>
        </div>
    </div>

    <div class="section-title">1. Left Category Filter Verification Matrix</div>
    <div class="card" style="padding: 0; overflow-x: auto;">
        <table>
            <thead>
                <tr>
                    <th style="width: 50px;">#</th>
                    <th style="width: 140px;">Category</th>
                    <th style="width: 90px;">Active State</th>
                    <th style="width: 120px;">Widgets Count</th>
                    <th>Rendered Widgets List</th>
                    <th style="width: 100px;">Status</th>
                    <th style="width: 160px;">Screenshot</th>
                </tr>
            </thead>
            <tbody>
                ${data.categories.map((c, idx) => `
                <tr>
                    <td><strong>#${idx + 1}</strong></td>
                    <td><span class="cat-tag">${c.category}</span></td>
                    <td><span class="badge ${c.activeStateVerified ? 'badge-pass' : 'badge-fail'}">${c.activeStateVerified ? 'Active (.on)' : 'Inactive'}</span></td>
                    <td><strong>${c.actualCount}</strong> (expected ${c.expectedCount})</td>
                    <td>${c.items.map(it => `<span class="widget-pill">${it}</span>`).join(' ')}</td>
                    <td><span class="badge ${c.status === 'PASS' ? 'badge-pass' : 'badge-warn'}">${c.status}</span></td>
                    <td><a href="../screenshots/${path.basename(c.screenshot)}" target="_blank" class="screenshot-link">📷 View Viewport</a></td>
                </tr>`).join('')}
            </tbody>
        </table>
    </div>

    <div class="section-title">2. Complete Widget Open & Close Lifecycle Audit (20 Widgets)</div>
    <div class="card" style="padding: 0; overflow-x: auto;">
        <table>
            <thead>
                <tr>
                    <th style="width: 50px;">#</th>
                    <th style="width: 160px;">Widget Name</th>
                    <th style="width: 150px;">Mount Type</th>
                    <th style="width: 150px;">Open Lifecycle</th>
                    <th style="width: 180px;">Close Lifecycle</th>
                    <th style="width: 90px;">Status</th>
                    <th>Observations & Remnant Check</th>
                    <th style="width: 160px;">Screenshot</th>
                </tr>
            </thead>
            <tbody>
                ${data.widgets.map((w, idx) => `
                <tr>
                    <td><strong>#${idx + 1}</strong></td>
                    <td><strong>${w.widget}</strong></td>
                    <td><code>${w.mountType}</code></td>
                    <td>${w.openStatus}</td>
                    <td>${w.closeStatus}</td>
                    <td><span class="badge ${w.status === 'PASS' ? 'badge-pass' : (w.status === 'WARN' ? 'badge-warn' : 'badge-fail')}">${w.status}</span></td>
                    <td>${w.observation}</td>
                    <td>${w.screenshot ? `<a href="../screenshots/${path.basename(w.screenshot)}" target="_blank" class="screenshot-link">📷 View Panel</a>` : '-'}</td>
                </tr>`).join('')}
            </tbody>
        </table>
    </div>

</body>
</html>`;

    fs.writeFileSync(outputPath, html, 'utf8');
}

runWidgetsSuite();
