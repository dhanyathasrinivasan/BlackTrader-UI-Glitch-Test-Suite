const path = require('path');
const fs = require('fs');

// Read .env from parent directory if available
let envConfig = {};
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#') && line.includes('=')) {
            const [k, v] = line.split('=', 2);
            envConfig[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
        }
    });
}

module.exports = {
    baseUrl: envConfig.PLATFORM_BASE_URL || 'https://lpadmin.blackfx.com',
    clientEmail: envConfig.ADMIN_USERNAME || 'dhanya@mailinator.com',
    clientPassword: envConfig.ADMIN_PASSWORD || 'test1234',
    adminEmail: envConfig.BLACKADMIN_EMAIL || 'lpadmin@blacktrader.com',
    adminPassword: envConfig.BLACKADMIN_PASSWORD || 'Raj1234!',
    // Cross-platform Chrome auto-discovery
    chromePath: (() => {
        const candidates = [
            envConfig.CHROME_PATH,
            process.env.CHROME_PATH,
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser'
        ].filter(Boolean);
        return candidates.find(p => fs.existsSync(p)) || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    })(),
    viewport: {
        width: 1920,
        height: 1080
    },
    paths: {
        screenshots: path.resolve(__dirname, 'screenshots'),
        reports: path.resolve(__dirname, 'reports'),
        htmlReport: path.resolve(__dirname, 'reports/ui_navigation_report.html')
    }
};

