# BlackTrader UI Navigation, Widgets & Glitch Test Suite

Automated visual and interactive test harness for **BlackTrader / BlackFX** (`https://lpadmin.blackfx.com/dashboard` and `/blackadmin`).

This suite is completely separated from the PAMM test engine and focuses exclusively on front-end UI reliability, button responsiveness, dropdown popovers, modal interactions, widget management, drag-and-drop mechanics, and console runtime error detection.

---

## 1. Directory Structure

```text
ui_test_suite/
├── config.js                   # Target URL, credentials, viewport, cross-platform Chrome path
├── package.json                # Dependencies (puppeteer-core) & npm scripts
├── test_navigation_runner.js   # 1. UI Navigation, buttons, dropdowns & dock period filters
├── test_widgets_runner.js      # 2. Add Widget drawer, categories & 20 widgets lifecycle
├── test_drag_drop_runner.js    # 3. Full drag & drop engine (tab dock & split tile areas)
│
├── reporters/
│   └── html_reporter.js        # Generates interactive HTML defect reports
│
├── screenshots/                # Captured evidence per button, widget & drag interaction
│   ├── 01_terminal_workspace.png
│   ├── 02b_add_widget_drawer.png
│   ├── 12_history_filter_today.png
│   ├── widget_algo_open.png
│   ├── drag_drop_coder_tab_dock.png
│   └── ...
│
└── reports/
    ├── ui_navigation_report.html # Navigation & button interactive report
    ├── ui_widgets_report.html    # Widget categorization & lifecycle report
    └── ui_drag_drop_report.html  # Full drag & drop execution report
```

---

## 2. Test Suites Overview

### Suite 1: Navigation, Dropdowns & Controls (`test_navigation_runner.js`)
* **Header Bar:** Account Switcher (`Default`), Add Widget Button, Profile Avatar Menu (`D`).
* **Watchlist Panel:** Watchlist presets (`W1`..`W5`), Columns dropdown, Sort order (`Original`), Note button.
* **Workspace Tabs:** PAMM Hub integration and Chart workspace restoration.
* **Chart Toolbar:** Timeframe dropdown (`1 Min`), Indicators dialog.
* **Trades Dock:** Dock tabs (`Positions`, `Pending`, `Orders`, `History`, `Funds`).
* **Period Filters:** `TODAY`, `WEEK`, `MONTH`, `ALL` (context-aware DOM mounting).
* **Admin Backoffice:** `/blackadmin` authentication, members directory & pagination audit.

### Suite 2: Widget Drawer & Categorization (`test_widgets_runner.js`)
* **Left Categories:** `All` (20), `Trading` (9), `Markets` (4), `Productivity` (2), `Accounts` (5).
* **Leakage Check:** Verifies zero cross-category leakage.
* **Lifecycle Audit:** Tests all 20 widgets opening into right workspace panels and closing cleanly via `✕` with zero layout corruption.

### Suite 3: Drag & Drop Engine (`test_drag_drop_runner.js`)
* **Drag Feedback:** Tests `.tw-dragchip` coordinate tracking and `.tw-ghost` live blueprint preview.
* **Drop Zones:** Tests **Tab Dock Zone** (docking as a tab in panel header) and **Split Panel Zone** (splitting tiles on seams).
* **Reversion:** Verifies clean unmounting without orphan elements.

---

## 3. How to Run

### Installation (First Time Only)
Ensure Node.js (v18+) is installed, then install dependencies:
```bash
cd ui_test_suite
npm install
```

### Running the Tests

* **Run Navigation & Button Tests:**
  ```bash
  npm run test:nav
  # OR: node test_navigation_runner.js
  ```

* **Run Widget Categorization & Lifecycle Tests:**
  ```bash
  npm run test:widgets
  # OR: node test_widgets_runner.js
  ```

* **Run Drag & Drop Suite:**
  ```bash
  npm run test:dragdrop
  # OR: node test_drag_drop_runner.js
  ```

* **Run All Suites Consecutively:**
  ```bash
  npm run test:all
  ```

---

## 4. Viewing Interactive Reports in Browser

On macOS:
```bash
open -a "Google Chrome" reports/ui_navigation_report.html
open -a "Google Chrome" reports/ui_widgets_report.html
open -a "Google Chrome" reports/ui_drag_drop_report.html
```
