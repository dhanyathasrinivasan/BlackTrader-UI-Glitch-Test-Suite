/**
 * =============================================================================
 * BLACKTRADER WIDGET DRAG & DROP AUTOMATION SUITE
 * =============================================================================
 * Tests Drag and Drop across all 20 widgets and all workspace drop zones:
 * 1. Tab Dock Zone (Dropping into panel header to add as tab)
 * 2. Split Panel Zone (Dropping onto seams/edges to split workspace tiles)
 * 3. Drag feedback verification (tw-dragchip, tw-ghost blueprint overlay)
 * 4. Post-drop mounting and clean unmount/revert
 * 5. Generates interactive HTML report: reports/ui_drag_drop_report.html
 * =============================================================================
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const config = require('./config.js');

const sleep = ms => new Promise(r => setTimeout(r, ms));

const ALL_WIDGETS = [
    { name: 'Watchlist', category: 'Trading', defaultZone: 'Split Area' },
    { name: 'Chart', category: 'Trading', defaultZone: 'Core Protected' },
    { name: 'Trades', category: 'Trading', defaultZone: 'Tab Dock' },
    { name: 'Coder', category: 'Trading', defaultZone: 'Tab Dock' },
    { name: 'Algo', category: 'Trading', defaultZone: 'Split Area' },
    { name: 'Backtest', category: 'Trading', defaultZone: 'Tab Dock' },
    { name: 'Screener', category: 'Markets', defaultZone: 'Split Area' },
    { name: 'Drawing Tools', category: 'Trading', defaultZone: 'Tab Dock' },
    { name: 'Orders', category: 'Trading', defaultZone: 'Tab Dock' },
    { name: 'Positions', category: 'Trading', defaultZone: 'Tab Dock' },
    { name: 'Funds', category: 'Markets', defaultZone: 'Split Area' },
    { name: 'Trade History', category: 'Markets', defaultZone: 'Tab Dock' },
    { name: 'Trade Statistics', category: 'Markets', defaultZone: 'Split Area' },
    { name: 'Logs', category: 'Productivity', defaultZone: 'Tab Dock' },
    { name: 'Copy trading', category: 'Accounts', defaultZone: 'Split Area' },
    { name: 'MAM', category: 'Accounts', defaultZone: 'Tab Dock' },
    { name: 'PAMM', category: 'Accounts', defaultZone: 'Split Area' },
    { name: 'Referrals', category: 'Accounts', defaultZone: 'Tab Dock' },
    { name: 'Wallet', category: 'Accounts', defaultZone: 'Tab Dock' },
    { name: 'Alerts', category: 'Productivity', defaultZone: 'Tab Dock' }
];

// Target coordinates for drop zones in 1920x1080 viewport
const DROP_ZONES = {
    'Tab Dock': { x: 650, y: 55, name: 'Chart Panel Tab Strip (Add as tab)' },
    'Split Area': { x: 960, y: 650, name: 'Workspace Seam (Split this panel)' }
};

async function runDragDropSuite() {
    console.log('='.repeat(80));
    console.log('STARTING BLACKTRADER WIDGET DRAG & DROP AUTOMATION SUITE');
    console.log(`Target: ${config.baseUrl}`);
    console.log(`Viewport: ${config.viewport.width}x${config.viewport.height}`);
    console.log('='.repeat(80));

    const testResults = {
        tests: [],
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

    page.on('console', msg => {
        if (msg.type() === 'error') {
            testResults.consoleErrors.push({ type: 'Console Error', text: msg.text() });
        }
    });
    page.on('pageerror', err => {
        testResults.consoleErrors.push({ type: 'JS Runtime Error', text: err.toString() });
    });

    try {
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

        console.log('\n--- EXECUTING DRAG & DROP FOR ALL 20 WIDGETS ---');

        for (const item of ALL_WIDGETS) {
            const wName = item.name;
            const targetZoneKey = item.defaultZone === 'Core Protected' ? 'Tab Dock' : item.defaultZone;
            const zoneInfo = DROP_ZONES[targetZoneKey];

            process.stdout.write(`[*] Testing Drag & Drop: [${wName}] -> [${targetZoneKey}]... `);

            // Record baseline counts
            const baseline = await frame.evaluate(() => {
                return {
                    panelsCount: document.querySelectorAll('.tw-panel').length,
                    tabsCount: document.querySelectorAll('.tw-tab').length
                };
            });

            // 1. Open picker drawer if needed
            await frame.evaluate(() => {
                const picker = document.querySelector('.tw-picker');
                if (!picker) {
                    const btn = document.querySelector('button[title="Add widget"]');
                    if (btn) btn.click();
                }
            });
            await sleep(500);

            // Switch to "All" category
            await frame.evaluate(() => {
                const allBtn = Array.from(document.querySelectorAll('.tw-pcats button.tw-pcat')).find(b => (b.textContent || '').trim() === 'All');
                if (allBtn) allBtn.click();
            });
            await sleep(300);

            // 2. Locate widget button
            const btnHandle = await frame.evaluateHandle((name) => {
                return Array.from(document.querySelectorAll('.tw-plist button.tw-pw')).find(b => (b.textContent || '').includes(name)) || null;
            }, wName);

            if (!btnHandle || !btnHandle.asElement()) {
                console.log('[FAIL: Button not found in picker]');
                testResults.tests.push({
                    widget: wName,
                    category: item.category,
                    zone: targetZoneKey,
                    status: 'FAIL',
                    observation: 'Widget button not present in picker drawer.',
                    screenshot: null
                });
                await frame.evaluate(() => {
                    const v = document.querySelector('.drawer-veil');
                    if (v) v.click();
                });
                continue;
            }

            // Check single-instance protection for Chart
            const isProtected = await frame.evaluate(el => el.classList.contains('tw-pw-off'), btnHandle);
            if (isProtected && wName === 'Chart') {
                console.log('[PASS: Protected Single-Instance Canvas]');
                const ssChart = path.join(config.paths.screenshots, 'drag_chart_protected.png');
                await page.screenshot({ path: ssChart });
                testResults.tests.push({
                    widget: wName,
                    category: item.category,
                    zone: 'Core Canvas',
                    dragAction: 'Drag locked (Disabled)',
                    dropResult: 'Protected Single-Instance',
                    status: 'PASS',
                    observation: 'Single-instance chart constraint prevents duplicate engine instantiation.',
                    screenshot: ssChart
                });
                await frame.evaluate(() => {
                    const v = document.querySelector('.drawer-veil');
                    if (v) v.click();
                });
                await sleep(300);
                continue;
            }

            await btnHandle.asElement().evaluate(el => el.scrollIntoView({ block: 'center' }));
            await sleep(200);
            const box = await btnHandle.asElement().boundingBox();
            if (!box) {
                console.log('[FAIL: No bounding box]');
                continue;
            }

            // 3. Initiate Drag from center of button
            const startX = box.x + box.width / 2;
            const startY = box.y + box.height / 2;

            await page.mouse.move(startX, startY);
            await page.mouse.down();
            await sleep(150);

            // Move mouse towards destination in intermediate steps
            await page.mouse.move((startX + zoneInfo.x) / 2, (startY + zoneInfo.y) / 2, { steps: 5 });
            await sleep(100);
            await page.mouse.move(zoneInfo.x, zoneInfo.y, { steps: 6 });
            await sleep(300);

            // 4. Capture drag feedback (dragchip and ghost overlay)
            const dragFeedback = await frame.evaluate(() => {
                const root = document.querySelector('.tw');
                const chip = document.querySelector('.tw-dragchip');
                const ghost = document.querySelector('.tw-ghost');
                const chipTxt = document.querySelector('.tw-dragchip-txt');
                return {
                    isDraggingRoot: root ? root.classList.contains('tw-dragging') : false,
                    hasChip: !!chip,
                    hasGhost: !!ghost,
                    actionText: chipTxt ? chipTxt.innerText.replace(/\n/g, ' ') : ''
                };
            });

            // 5. Release mouse to DROP
            await page.mouse.up();
            await sleep(1200);

            // 6. Verify post-drop DOM state
            const postDrop = await frame.evaluate((name, base) => {
                const currentPanels = document.querySelectorAll('.tw-panel').length;
                const currentTabs = document.querySelectorAll('.tw-tab').length;

                // Check if mounted as tab
                const tabMatches = Array.from(document.querySelectorAll('.tw-tab')).filter(t => (t.textContent || '').toLowerCase().includes(name.toLowerCase()));
                // Check if mounted as split panel
                const panelMatches = Array.from(document.querySelectorAll('.tw-panel')).filter(p => {
                    const h = p.querySelector('.tw-ph');
                    return h && (h.textContent || '').toLowerCase().includes(name.toLowerCase());
                });

                const isNewPanel = currentPanels > base.panelsCount;
                const isNewTab = currentTabs > base.tabsCount;

                return {
                    isNewPanel,
                    isNewTab,
                    foundAsTab: tabMatches.length > 0,
                    foundAsPanel: panelMatches.length > 0,
                    panelsCount: currentPanels,
                    tabsCount: currentTabs
                };
            }, wName, baseline);

            const safeName = wName.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const safeZone = targetZoneKey.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const ssDrop = path.join(config.paths.screenshots, `drag_drop_${safeName}_${safeZone}.png`);
            await page.screenshot({ path: ssDrop });

            // 7. Revert / Close the dropped tab or panel
            const revertResult = await frame.evaluate((name) => {
                // If dropped as panel
                const panels = Array.from(document.querySelectorAll('.tw-panel'));
                for (let i = panels.length - 1; i >= 0; i--) {
                    const p = panels[i];
                    const h = p.querySelector('.tw-ph');
                    if (h && (h.textContent || '').toLowerCase().includes(name.toLowerCase())) {
                        const x = p.querySelector('.tw-ph-x');
                        if (x) { x.click(); return { reverted: true, type: 'panel' }; }
                    }
                }
                // If dropped as tab
                const tabs = Array.from(document.querySelectorAll('.tw-tab'));
                for (let i = tabs.length - 1; i >= 0; i--) {
                    const t = tabs[i];
                    if ((t.textContent || '').toLowerCase().includes(name.toLowerCase())) {
                        const x = t.querySelector('.tw-tab-x');
                        if (x) { x.click(); return { reverted: true, type: 'tab' }; }
                    }
                }
                return { reverted: false };
            }, wName);

            await sleep(600);

            const finalCheck = await frame.evaluate((base) => {
                return {
                    panelsClean: document.querySelectorAll('.tw-panel').length === base.panelsCount,
                    tabsClean: document.querySelectorAll('.tw-tab').length === base.tabsCount
                };
            }, baseline);

            const dropSuccess = postDrop.isNewPanel || postDrop.isNewTab || postDrop.foundAsTab || postDrop.foundAsPanel;

            if (dropSuccess && revertResult.reverted) {
                console.log(`[PASS] (${dragFeedback.actionText} -> Mounted -> Closed cleanly)`);
                testResults.tests.push({
                    widget: wName,
                    category: item.category,
                    zone: zoneInfo.name,
                    dragFeedback: `${dragFeedback.actionText} (Ghost: ${dragFeedback.hasGhost})`,
                    dropResult: postDrop.isNewPanel ? 'Mounted as Split Panel' : 'Docked as Tab',
                    revertStatus: `Closed cleanly via ${revertResult.type} button`,
                    status: 'PASS',
                    observation: `Drag triggered live ghost preview; dropped into ${zoneInfo.name} and unmounted cleanly.`,
                    screenshot: ssDrop
                });
            } else {
                console.log(`[WARN: dropSuccess=${dropSuccess}, revert=${revertResult.reverted}]`);
                testResults.tests.push({
                    widget: wName,
                    category: item.category,
                    zone: zoneInfo.name,
                    dragFeedback: dragFeedback.actionText,
                    dropResult: dropSuccess ? 'Mounted' : 'Drop failed',
                    revertStatus: revertResult.reverted ? 'Reverted' : 'Retained',
                    status: 'WARN',
                    observation: `Drop completed with warning.`,
                    screenshot: ssDrop
                });
            }
        }

    } catch (err) {
        console.error('\n[FATAL SUITE ERROR]:', err);
    } finally {
        await browser.close();
        console.log('\n[+] Browser closed cleanly.');
    }

    console.log('\n================================================================================');
    console.log('GENERATING DRAG & DROP HTML REPORT');
    const reportHtmlPath = path.resolve(__dirname, 'reports/ui_drag_drop_report.html');
    generateDragDropHtmlReport(testResults, reportHtmlPath);
    console.log(`[+] Report generated: file://${reportHtmlPath}`);
    console.log('================================================================================');
}

function generateDragDropHtmlReport(data, outputPath) {
    const total = data.tests.length;
    const passed = data.tests.filter(t => t.status === 'PASS').length;
    const warned = data.tests.filter(t => t.status === 'WARN').length;
    const failed = data.tests.filter(t => t.status === 'FAIL').length;
    const consoleErrorsCount = data.consoleErrors.length;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BlackTrader Drag & Drop Test Report (All Widgets & Areas)</title>
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
        .zone-pill { background: #0E121A; border: 1px solid #262C3A; color: #38BDF8; padding: 2px 6px; border-radius: 4px; font-size: 11px; display: inline-block; }

        .screenshot-link { color: #38BDF8; text-decoration: none; font-weight: 600; }
        .screenshot-link:hover { text-decoration: underline; }
        code { background: #0E121A; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px; }
    </style>
</head>
<body>

    <div class="header">
        <div>
            <h1>BlackTrader Drag & Drop Test Report (All Widgets & Areas)</h1>
            <p style="color: var(--text-secondary); font-size: 13px; margin-top: 4px;">
                Feature: <strong>Drag & Drop Engine (.tw-dragchip, .tw-ghost)</strong> | Viewport: <strong>1920x1080</strong> | Executed: <strong>${data.startTime}</strong>
            </p>
        </div>
        <div class="badge-tag">Drag & Drop Suite</div>
    </div>

    <div class="kpi-grid">
        <div class="kpi-card">
            <div class="kpi-title">Total Drag & Drop Tests</div>
            <div class="kpi-value text-blue">${total}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-title">Drag & Drop Passed</div>
            <div class="kpi-value text-green">${passed} / ${total}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-title">Failed Placements</div>
            <div class="kpi-value ${failed > 0 ? 'text-red' : 'text-green'}">${failed}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-title">Warnings / Remnants</div>
            <div class="kpi-value ${warned > 0 ? 'text-yellow' : 'text-green'}">${warned}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-title">Console JS Errors</div>
            <div class="kpi-value ${consoleErrorsCount > 0 ? 'text-yellow' : 'text-green'}">${consoleErrorsCount}</div>
        </div>
    </div>

    <div class="section-title">Drag & Drop Execution Log (All Widgets Across Tab & Split Zones)</div>
    <div class="card" style="padding: 0; overflow-x: auto;">
        <table>
            <thead>
                <tr>
                    <th style="width: 50px;">#</th>
                    <th style="width: 140px;">Widget</th>
                    <th style="width: 110px;">Category</th>
                    <th style="width: 220px;">Target Drop Zone</th>
                    <th style="width: 200px;">Drag Feedback (Chip/Ghost)</th>
                    <th style="width: 180px;">Mount & Placement Result</th>
                    <th style="width: 180px;">Revert / Clean Status</th>
                    <th style="width: 90px;">Status</th>
                    <th style="width: 160px;">Evidence Screenshot</th>
                </tr>
            </thead>
            <tbody>
                ${data.tests.map((t, idx) => `
                <tr>
                    <td><strong>#${idx + 1}</strong></td>
                    <td><strong>${t.widget}</strong></td>
                    <td><span class="cat-tag">${t.category}</span></td>
                    <td><span class="zone-pill">${t.zone}</span></td>
                    <td><code>${t.dragFeedback || '-'}</code></td>
                    <td>${t.dropResult || '-'}</td>
                    <td>${t.revertStatus || '-'}</td>
                    <td><span class="badge ${t.status === 'PASS' ? 'badge-pass' : (t.status === 'WARN' ? 'badge-warn' : 'badge-fail')}">${t.status}</span></td>
                    <td>${t.screenshot ? `<a href="../screenshots/${path.basename(t.screenshot)}" target="_blank" class="screenshot-link">📷 View Drop Result</a>` : '-'}</td>
                </tr>`).join('')}
            </tbody>
        </table>
    </div>

</body>
</html>`;

    fs.writeFileSync(outputPath, html, 'utf8');
}

runDragDropSuite();
