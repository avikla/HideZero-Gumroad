# Hide Zeros Plugin — Google Sheets Add-on Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a paid, license-gated Google Sheets GAS add-on with a custom menu to hide and show zeros on the active sheet by manipulating cell number formats non-destructively.

**Architecture:** Five `.gs` files with single responsibilities (Config, License, ZeroFormatter, Menu) plus manifest. License check calls an external HTTP endpoint stored in Script Properties. Zero hiding uses a 4-section custom number format with an empty zero-section — underlying cell values are never changed. Single batched `getNumberFormats()` / `setNumberFormats()` API call pair for performance.

**Tech Stack:** Google Apps Script (V8 runtime), UrlFetchApp, SpreadsheetApp, PropertiesService, clasp CLI

**License server stack:** GAS Web App (second script project) + Gumroad License Key API for verification (no subscriber DB needed — Gumroad is the source of truth)

**Fail policy:** Fail-open — server errors and network failures allow the user through. Only an explicit `activeSubscriber: false` response blocks execution.

---

## File Map

| File | Responsibility |
|------|---------------|
| `projects/HideZero-Gumroad/appsscript.json` | GAS manifest — scopes, timezone, runtime |
| `projects/HideZero-Gumroad/.clasp.json` | Stub — scriptId filled in after `clasp create` or container-bind |
| `projects/HideZero-Gumroad/.gitignore` | Exclude `.clasp.json`, tokens |
| `projects/HideZero-Gumroad/Config.gs` | `getLicenseApiUrl_()` + `setupConfig()` one-time setup |
| `projects/HideZero-Gumroad/License.gs` | `checkLicense_()` — HTTP license gate |
| `projects/HideZero-Gumroad/ZeroFormatter.gs` | Core format helpers + `hideZerosOnSheet_()` + `showZerosOnSheet_()` + test functions |
| `projects/HideZero-Gumroad/Menu.gs` | `onOpen()` custom menu + `hideZeros()` / `showZeros()` public entry points |
| `projects/HideZero-Gumroad/CLAUDE.md` | Project context for Claude Code |
| `projects/license-server/` | Separate GAS Web App project — license endpoint + subscriber Sheet |

---

## License Server Architecture (separate GAS project)

Deploy a second GAS project as a **Web App** that acts as the HTTP license endpoint. It verifies the user's Gumroad license key directly against the **Gumroad License Key API** — no subscriber database needed. Gumroad is the source of truth.

### How it works

Each Gumroad buyer gets a unique license key in their receipt email. The first time a user runs the plugin, they paste their license key into an Apps Script prompt. The plugin stores it in `DocumentProperties` (per-spreadsheet) and sends it to the license server on every run.

```
projects/license-server/
  appsscript.json      — Web App manifest (execute as: Me, access: Anyone)
  Code.gs              — doGet(e): verify license key via Gumroad API, return JSON
```

**Gumroad License Key API call (made by the license server):**
```
POST https://api.gumroad.com/v2/licenses/verify
Body: product_permalink=YOUR_PERMALINK&license_key=USER_KEY&increment_uses_count=false
Response: { "success": true, "purchase": { "email": "...", "refunded": false, "chargebacked": false } }
```

**doGet response to plugin:** `{ "activeSubscriber": true }` or `{ "activeSubscriber": false }`

**Logic:** `activeSubscriber = success && !purchase.refunded && !purchase.chargebacked`

**Gumroad Gumroad product permalink:** set once in the license server's Script Properties as `GUMROAD_PRODUCT_PERMALINK`.

### Plugin-side license key flow

`Config.gs` gains two new helpers:
- `getLicenseKey_()` — reads from `DocumentProperties` (persists per spreadsheet)
- `promptForLicenseKey_()` — shows a one-time input dialog, saves the key

`checkLicense_()` in `License.gs`:
1. Try to get stored license key from DocumentProperties
2. If missing, call `promptForLicenseKey_()` to ask the user once
3. Send `?licenseKey=KEY` to the license server instead of `?email=EMAIL`

**Checkout URL pattern (pre-fills user email from GAS session):**
```
https://gumroad.com/l/PRODUCT_PERMALINK?email=USER_EMAIL
```

Build this server **after** the plugin is working end-to-end. For initial testing, use a simple stub Web App that always returns `{ "activeSubscriber": true }`.

---

## Task 0: Create Project Folder and Move Plan File

- [ ] **Step 1: Create the project directory**

```powershell
New-Item -ItemType Directory -Path "projects\HideZero-Gumroad"
```

- [ ] **Step 2: Copy plan file into the project folder**

```powershell
Copy-Item "C:\Users\Avi\.claude\plans\create-a-a-plugin-sleepy-star.md" `
  "projects\HideZero-Gumroad\PLAN.md"
```

- [ ] **Step 3: Commit the empty scaffold + plan**

```bash
git add projects/HideZero-Gumroad/PLAN.md
git commit -m "feat(HideZero-Gumroad): init project folder with plan"
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `projects/HideZero-Gumroad/appsscript.json`
- Create: `projects/HideZero-Gumroad/.clasp.json`
- Create: `projects/HideZero-Gumroad/.gitignore`

- [ ] **Step 1: Create `appsscript.json`**

```json
{
  "timeZone": "Asia/Jerusalem",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets.currentonly",
    "https://www.googleapis.com/auth/script.external_request"
  ]
}
```

- [ ] **Step 2: Create `.clasp.json` stub**

```json
{
  "scriptId": "FILL_IN_AFTER_CLASP_CREATE",
  "rootDir": ""
}
```

- [ ] **Step 3: Create `.gitignore`**

```
.clasp.json
.clasprc.json
credentials.json
token.json
.env
node_modules/
.DS_Store
Thumbs.db
```

- [ ] **Step 4: Commit**

```bash
git add projects/HideZero-Gumroad/
git commit -m "feat(HideZero-Gumroad): scaffold project structure"
```

---

## Task 2: Config.gs

**Files:**
- Create: `projects/HideZero-Gumroad/Config.gs`

- [ ] **Step 1: Create `Config.gs`**

```javascript
// ============================================================
// Config.gs — Script Properties helpers and one-time setup
// ============================================================

/**
 * Returns the license server endpoint URL from Script Properties.
 * Throws if not configured — run setupConfig() first.
 */
function getLicenseApiUrl_() {
  var url = PropertiesService.getScriptProperties().getProperty('LICENSE_API_URL');
  if (!url) throw new Error('LICENSE_API_URL not set. Run setupConfig() first.');
  return url;
}

/**
 * Returns the stored Gumroad license key for this spreadsheet, or null if not yet set.
 * Stored in DocumentProperties so it persists per spreadsheet (not per user/script).
 * @returns {string|null}
 */
function getLicenseKey_() {
  return PropertiesService.getDocumentProperties().getProperty('GUMROAD_LICENSE_KEY');
}

/**
 * Prompts the user to enter their Gumroad license key via a UI dialog.
 * Saves it to DocumentProperties if provided.
 * @returns {string|null} The entered key, or null if cancelled.
 */
function promptForLicenseKey_() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.prompt(
    'Enter License Key',
    'Paste your Hide Zeros license key from your Gumroad receipt email:',
    ui.ButtonSet.OK_CANCEL
  );
  if (result.getSelectedButton() !== ui.Button.OK) return null;
  var key = result.getResponseText().trim();
  if (!key) return null;
  PropertiesService.getDocumentProperties().setProperty('GUMROAD_LICENSE_KEY', key);
  Logger.log('[OK] License key saved to DocumentProperties.');
  return key;
}

/**
 * Run ONCE from the Apps Script editor to store the license server URL.
 * Steps:
 *   1. Replace the placeholder URL below with your real GAS Web App endpoint
 *   2. Run > setupConfig from the editor and authorize
 *   3. Delete the URL value from this function and re-push
 */
function setupConfig() {
  PropertiesService.getScriptProperties().setProperties({
    'LICENSE_API_URL': 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'
  });
  Logger.log('[OK] LICENSE_API_URL saved. Remove the value from setupConfig() and re-push.');
}
```

- [ ] **Step 2: Commit**

```bash
git add projects/HideZero-Gumroad/Config.gs
git commit -m "feat(hide-zeros): add Config.gs with Script Properties helper"
```

---

## Task 3: License.gs

**Files:**
- Create: `projects/HideZero-Gumroad/License.gs`

- [ ] **Step 1: Create `License.gs`**

```javascript
// ============================================================
// License.gs — Gumroad license key verification
// ============================================================

/**
 * Checks whether the current user has a valid Gumroad license key.
 * On first run, prompts the user to enter their key (from Gumroad receipt email).
 * Fail-open: server errors and network failures allow the user through.
 * Only an explicit activeSubscriber:false blocks execution.
 *
 * @returns {boolean}
 */
function checkLicense_() {
  var ui = SpreadsheetApp.getUi();

  // 1. Get or prompt for the license key
  var licenseKey = getLicenseKey_();
  if (!licenseKey) {
    licenseKey = promptForLicenseKey_();
    if (!licenseKey) {
      // User cancelled the prompt — show purchase link
      var email = Session.getActiveUser().getEmail();
      var purchaseUrl = 'https://gumroad.com/l/hidezero'
        + (email ? '?email=' + encodeURIComponent(email) : '');
      ui.alert(
        'License Key Required',
        'Hide Zeros requires a license key.\n\nPurchase one at:\n' + purchaseUrl
          + '\n\nThen click the menu item again and paste your key.',
        ui.ButtonSet.OK
      );
      return false;
    }
  }

  // 2. Get license server URL
  var apiUrl;
  try {
    apiUrl = getLicenseApiUrl_();
  } catch (e) {
    Logger.log('[WARN] License config missing — failing open: ' + e.message);
    return true;
  }

  // 3. Call the license server
  var response;
  try {
    response = UrlFetchApp.fetch(
      apiUrl + '?licenseKey=' + encodeURIComponent(licenseKey),
      { muteHttpExceptions: true }
    );
  } catch (e) {
    // Fail-open: allow if server is unreachable
    Logger.log('[WARN] License server unreachable — failing open: ' + e.message);
    return true;
  }

  var code = response.getResponseCode();
  if (code !== 200) {
    Logger.log('[WARN] License server returned HTTP ' + code + ' — failing open');
    return true;
  }

  var result;
  try {
    result = JSON.parse(response.getContentText());
  } catch (e) {
    Logger.log('[WARN] License response parse error — failing open: ' + e.message);
    return true;
  }

  if (!result.activeSubscriber) {
    Logger.log('[ERR] License check failed — key invalid or refunded');
    // Clear the stored key so user can re-enter on next attempt
    PropertiesService.getDocumentProperties().deleteProperty('GUMROAD_LICENSE_KEY');
    var email = Session.getActiveUser().getEmail();
    var purchaseUrl = 'https://gumroad.com/l/hidezero'
      + (email ? '?email=' + encodeURIComponent(email) : '');
    ui.alert(
      'Invalid License Key',
      'The license key entered is not valid or has been refunded.\n\n'
        + 'Please check your Gumroad receipt email for the correct key, '
        + 'or purchase at:\n' + purchaseUrl,
      ui.ButtonSet.OK
    );
    return false;
  }

  Logger.log('[OK] License verified');
  return true;
}
```

- [ ] **Step 2: Commit**

```bash
git add projects/HideZero-Gumroad/License.gs
git commit -m "feat(hide-zeros): add License.gs with HTTP subscription check"
```

---

## Task 4: ZeroFormatter.gs — Core Logic

**Files:**
- Create: `projects/HideZero-Gumroad/ZeroFormatter.gs`

**Key format knowledge:**
- GAS number formats have 4 sections: `positive;negative;zero;text`
- Hiding zeros = leave the zero section (3rd) empty: `fmt;-fmt;;@`
- `General` and `@` cannot be used in multi-section formats — normalise to `"0"` first
- Detect our formats: split by `;` gives 4 parts, parts[2] is `""`, parts[3] is `"@"`
- Restore: take parts[0] of the stored hide format

- [ ] **Step 1: Write the failing test functions first** (in `ZeroFormatter.gs`)

```javascript
// ============================================================
// ZeroFormatter.gs — Number format manipulation for zero hiding
// ============================================================

// ---- UNIT TESTS (run from Apps Script editor) ----

function testNormaliseFormat_() {
  var cases = [
    ['General', '0'],
    ['@',       '0'],
    ['',        '0'],
    ['0.00',    '0.00'],
    ['#,##0',   '#,##0'],
  ];
  var pass = 0, fail = 0;
  cases.forEach(function(c) {
    var got = normaliseFormat_(c[0]);
    if (got === c[1]) {
      Logger.log('[PASS] normaliseFormat_("' + c[0] + '") = "' + got + '"'); pass++;
    } else {
      Logger.log('[FAIL] normaliseFormat_("' + c[0] + '") expected "' + c[1] + '", got "' + got + '"'); fail++;
    }
  });
  Logger.log('testNormaliseFormat_: ' + pass + ' passed, ' + fail + ' failed');
}

function testBuildHideFormat_() {
  var cases = [
    ['0',      '0;-0;;@'],
    ['0.00',   '0.00;-0.00;;@'],
    ['#,##0',  '#,##0;-#,##0;;@'],
  ];
  var pass = 0, fail = 0;
  cases.forEach(function(c) {
    var got = buildHideFormat_(c[0]);
    if (got === c[1]) {
      Logger.log('[PASS] buildHideFormat_("' + c[0] + '") = "' + got + '"'); pass++;
    } else {
      Logger.log('[FAIL] buildHideFormat_("' + c[0] + '") expected "' + c[1] + '", got "' + got + '"'); fail++;
    }
  });
  Logger.log('testBuildHideFormat_: ' + pass + ' passed, ' + fail + ' failed');
}

function testIsHiddenZeroFormat_() {
  var trueCases  = ['0;-0;;@', '0.00;-0.00;;@', '#,##0;-#,##0;;@'];
  var falseCases = ['General', '@', '0.00', '0;-0;0;@', '0;-0;@', '0;-0;;Text'];
  var pass = 0, fail = 0;
  trueCases.forEach(function(f) {
    if (isHiddenZeroFormat_(f)) {
      Logger.log('[PASS] isHiddenZeroFormat_("' + f + '") = true'); pass++;
    } else {
      Logger.log('[FAIL] isHiddenZeroFormat_("' + f + '") expected true'); fail++;
    }
  });
  falseCases.forEach(function(f) {
    if (!isHiddenZeroFormat_(f)) {
      Logger.log('[PASS] isHiddenZeroFormat_("' + f + '") = false'); pass++;
    } else {
      Logger.log('[FAIL] isHiddenZeroFormat_("' + f + '") expected false'); fail++;
    }
  });
  Logger.log('testIsHiddenZeroFormat_: ' + pass + ' passed, ' + fail + ' failed');
}

function testRestoreFormat_() {
  var cases = [
    ['0;-0;;@',         '0'],
    ['0.00;-0.00;;@',   '0.00'],
    ['#,##0;-#,##0;;@', '#,##0'],
  ];
  var pass = 0, fail = 0;
  cases.forEach(function(c) {
    var got = restoreFormat_(c[0]);
    if (got === c[1]) {
      Logger.log('[PASS] restoreFormat_("' + c[0] + '") = "' + got + '"'); pass++;
    } else {
      Logger.log('[FAIL] restoreFormat_("' + c[0] + '") expected "' + c[1] + '", got "' + got + '"'); fail++;
    }
  });
  Logger.log('testRestoreFormat_: ' + pass + ' passed, ' + fail + ' failed');
}

function testRoundTrip_() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var testRange = sheet.getRange('A1:C3');
  testRange.setNumberFormat('General');
  sheet.getRange('B2').setNumberFormat('0.00');
  sheet.getRange('C3').setNumberFormat('#,##0');

  hideZerosOnSheet_();
  var afterHide = testRange.getNumberFormats();
  var allHidden = isHiddenZeroFormat_(afterHide[0][0]) &&
                  isHiddenZeroFormat_(afterHide[1][1]) &&
                  isHiddenZeroFormat_(afterHide[2][2]);
  Logger.log(allHidden ? '[PASS] All cells have hide format' : '[FAIL] Missing hide format after hide');

  showZerosOnSheet_();
  var afterShow = testRange.getNumberFormats();
  // Note: General normalises to '0' — this is expected and documented
  var restored = afterShow[0][0] === '0' && afterShow[1][1] === '0.00' && afterShow[2][2] === '#,##0';
  Logger.log(restored ? '[PASS] Formats correctly restored' : '[FAIL] Restore mismatch: ' +
    'A1=' + afterShow[0][0] + ' B2=' + afterShow[1][1] + ' C3=' + afterShow[2][2]);
}

function runAllUnitTests() {
  testNormaliseFormat_();
  testBuildHideFormat_();
  testIsHiddenZeroFormat_();
  testRestoreFormat_();
  Logger.log('=== Unit tests complete (run testRoundTrip_() separately — needs active sheet) ===');
}
```

- [ ] **Step 2: Run test functions** — in the GAS editor, select `runAllUnitTests` from the function dropdown and click Run. All tests will show `[FAIL]` because the functions are not defined yet. Verify you see `[FAIL]` lines in the Execution log.

- [ ] **Step 3: Implement the helper functions** (add below the test functions in the same file)

```javascript
// ---- IMPLEMENTATION ----

/**
 * Normalise a raw GAS format string so it can be used as a format section.
 * "General" and "@" are replaced with "0"; empty strings too.
 * @param {string} fmt
 * @returns {string}
 */
function normaliseFormat_(fmt) {
  if (!fmt || fmt === 'General' || fmt === '@') return '0';
  return fmt;
}

/**
 * Build the zero-hiding format from a normalised format string.
 * Result: "fmt;-fmt;;@"  (positive; negative; zero=blank; text)
 * @param {string} normFmt
 * @returns {string}
 */
function buildHideFormat_(normFmt) {
  return normFmt + ';-' + normFmt + ';;@';
}

/**
 * Return true if a format string was produced by buildHideFormat_.
 * Detection: 4 sections, 3rd is empty, 4th is "@".
 * @param {string} fmt
 * @returns {boolean}
 */
function isHiddenZeroFormat_(fmt) {
  var parts = fmt.split(';');
  return parts.length === 4 && parts[2] === '' && parts[3] === '@';
}

/**
 * Extract the original positive format from a hide-zero format string.
 * @param {string} fmt
 * @returns {string}
 */
function restoreFormat_(fmt) {
  return fmt.split(';')[0];
}

/**
 * Apply zero-hiding formats to all cells in the active sheet's data range.
 * Cells already in hide format are skipped. Single batched API call.
 */
function hideZerosOnSheet_() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var range = sheet.getDataRange();
  var formats = range.getNumberFormats();

  var modified = false;
  for (var r = 0; r < formats.length; r++) {
    for (var c = 0; c < formats[r].length; c++) {
      var fmt = formats[r][c];
      if (isHiddenZeroFormat_(fmt)) continue;
      formats[r][c] = buildHideFormat_(normaliseFormat_(fmt));
      modified = true;
    }
  }

  if (modified) {
    range.setNumberFormats(formats);
    Logger.log('[OK] hideZerosOnSheet_: applied to ' + range.getA1Notation());
  } else {
    Logger.log('[OK] hideZerosOnSheet_: no cells needed updating');
  }
}

/**
 * Restore original formats for all cells that have a hide-zero format applied.
 * Other cells are untouched. Single batched API call.
 */
function showZerosOnSheet_() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var range = sheet.getDataRange();
  var formats = range.getNumberFormats();

  var modified = false;
  for (var r = 0; r < formats.length; r++) {
    for (var c = 0; c < formats[r].length; c++) {
      var fmt = formats[r][c];
      if (!isHiddenZeroFormat_(fmt)) continue;
      formats[r][c] = restoreFormat_(fmt);
      modified = true;
    }
  }

  if (modified) {
    range.setNumberFormats(formats);
    Logger.log('[OK] showZerosOnSheet_: restored formats in ' + range.getA1Notation());
  } else {
    Logger.log('[OK] showZerosOnSheet_: no cells had hidden-zero format applied');
  }
}
```

- [ ] **Step 4: Run unit tests again** — select `runAllUnitTests` and Run. All lines in Execution log should show `[PASS]`.

- [ ] **Step 5: Commit**

```bash
git add projects/HideZero-Gumroad/ZeroFormatter.gs
git commit -m "feat(hide-zeros): add ZeroFormatter with hide/show logic and unit tests"
```

---

## Task 5: Menu.gs — Custom Menu and Entry Points

**Files:**
- Create: `projects/HideZero-Gumroad/Menu.gs`

- [ ] **Step 1: Create `Menu.gs`**

```javascript
// ============================================================
// Menu.gs — Custom menu and public entry points
// ============================================================

/**
 * Called automatically by GAS when the spreadsheet is opened.
 * Adds the "Hide Zeros" custom menu.
 *
 * During development (container-bound script): appears as a top-level menu.
 * When deployed as an Editor Add-on: GAS places it under Extensions automatically.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Hide Zeros')
    .addItem('Hide Zeros on This Sheet', 'hideZeros')
    .addItem('Show Zeros on This Sheet', 'showZeros')
    .addToUi();
}

/**
 * Public entry point: hides zeros on the active sheet.
 * Runs license check first — aborts silently if not subscribed.
 */
function hideZeros() {
  Logger.log('hideZeros() triggered');
  if (!checkLicense_()) return;
  try {
    hideZerosOnSheet_();
    Logger.log('[OK] hideZeros() complete');
  } catch (e) {
    Logger.log('[ERR] hideZeros() failed: ' + e.message);
    SpreadsheetApp.getUi().alert(
      'Error',
      'An error occurred while hiding zeros: ' + e.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * Public entry point: restores zeros on the active sheet.
 * Runs license check first — aborts silently if not subscribed.
 */
function showZeros() {
  Logger.log('showZeros() triggered');
  if (!checkLicense_()) return;
  try {
    showZerosOnSheet_();
    Logger.log('[OK] showZeros() complete');
  } catch (e) {
    Logger.log('[ERR] showZeros() failed: ' + e.message);
    SpreadsheetApp.getUi().alert(
      'Error',
      'An error occurred while showing zeros: ' + e.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add projects/HideZero-Gumroad/Menu.gs
git commit -m "feat(hide-zeros): add Menu.gs with onOpen and public entry points"
```

---

## Task 6: CLAUDE.md

**Files:**
- Create: `projects/HideZero-Gumroad/CLAUDE.md`

- [ ] **Step 1: Create `CLAUDE.md`**

```markdown
# Hide Zeros Plugin — Project Context

## Overview
Google Apps Script add-on for Google Sheets. Hides/shows zeros on the active sheet by manipulating cell number formats non-destructively. License-gated via external HTTP endpoint.

## Files
- `Config.gs` — getLicenseApiUrl_() + setupConfig() one-time setup
- `License.gs` — checkLicense_() verifies subscription via HTTP
- `ZeroFormatter.gs` — core format helpers, hideZerosOnSheet_(), showZerosOnSheet_(), test functions
- `Menu.gs` — onOpen() custom menu, hideZeros() / showZeros() public entry points
- `appsscript.json` — GAS manifest

## Deployment
Pushed via `clasp push`. `.clasp.json` is gitignored.

## Key Design Decisions
- Format pattern: `fmt;-fmt;;@` (4 sections, empty zero section = zeros blank)
- Detection: split by `;`, length=4, section[2]='', section[3]='@'
- `General` and `@` normalise to `0` before format construction
- Restore: extract section[0] from the stored hide format
- `General` → restored as `0` (not `General`) — unavoidable, visually identical
- Batch API: one getNumberFormats() + setNumberFormats() call each way
- License URL in Script Properties as `LICENSE_API_URL` — never hardcoded
- Private functions end with `_`
- Logging: `[OK]`, `[WARN]`, `[ERR]` prefixes

## Setup (first time only)
1. `clasp create --title "Hide Zeros Plugin"` or bind to existing sheet
2. Update `.clasp.json` with real scriptId
3. `clasp push`
4. In GAS editor: fill in real URL in setupConfig(), run it, then delete the URL and re-push
5. Reload the bound spreadsheet and authorize
```

- [ ] **Step 2: Commit**

```bash
git add projects/HideZero-Gumroad/CLAUDE.md
git commit -m "docs(hide-zeros): add CLAUDE.md project context"
```

---

## Task 7: GAS Project Setup and First Push

- [ ] **Step 1: Create or bind the GAS project**

**Option A — New standalone script (then bind to a sheet manually):**
```powershell
cd "projects\hide-zeros-plugin"
clasp create --title "Hide Zeros Plugin"
```

**Option B — Bind to an existing spreadsheet (recommended for testing):**
1. Open target Google Sheet → Extensions → Apps Script
2. Copy Script ID from URL: `https://script.google.com/macros/d/SCRIPT_ID/edit`
3. Edit `.clasp.json`:
```json
{ "scriptId": "PASTE_SCRIPT_ID_HERE", "rootDir": "" }
```

- [ ] **Step 2: Push all files**

```powershell
clasp push
```

Expected output: lists all `.gs` files and `appsscript.json` with `└─ <filename>`.

- [ ] **Step 3: Configure the license URL**

1. In `.clasp.json` rootDir's `Config.gs`, fill in your real LICENSE_API_URL in `setupConfig()`
2. Push: `clasp push`
3. In the GAS editor (open via `clasp open`): select `setupConfig` → Run → authorize when prompted
4. Check Execution log: should see `[OK] LICENSE_API_URL saved.`
5. Delete the URL value from `setupConfig()` in `Config.gs`, leaving it as an empty string placeholder
6. `clasp push` again

- [ ] **Step 4: Authorize scopes**

1. Reload the bound Google Sheet
2. A "Hide Zeros" menu should appear after authorization
3. Accept the authorization dialog for `spreadsheets.currentonly` and `script.external_request`

---

## Task 8: End-to-End Verification

- [ ] **Test A — Unit tests pass**

In GAS editor, select `runAllUnitTests` → Run.
Expected: all lines in Execution log show `[PASS]`. Final line: `=== Unit tests complete ===`

- [ ] **Test B — Round-trip test**

In GAS editor, select `testRoundTrip_` → Run.
Expected: two `[PASS]` lines — one for hide, one for show.

- [ ] **Test C — Menu presence**

Reload the spreadsheet.
Expected: "Hide Zeros" appears in the menu bar. Sub-items: "Hide Zeros on This Sheet" and "Show Zeros on This Sheet".

- [ ] **Test D — Hide zeros (UI)**

1. Put `0`, `1`, `0.5`, `0` in A1:D1
2. Set B1 format to `0.00` via Format → Number → Custom
3. Click Hide Zeros → Hide Zeros on This Sheet
4. Expected: A1 and D1 are blank; B1 and C1 still show `1` and `0.5`
5. Click A1 → Format → Number → Custom: should show `0;-0;;@`
6. Click B1 → Format → Number → Custom: should show `0.00;-0.00;;@`

- [ ] **Test E — Show zeros (UI)**

With D from above still in effect:
1. Click Hide Zeros → Show Zeros on This Sheet
2. Expected: `0` reappears in A1 and D1
3. A1 custom format: `0` (note: was `General` — normalised to `0`, which is visually identical)
4. B1 custom format: `0.00`

- [ ] **Test F — Idempotency**

Run Hide Zeros twice on the same sheet.
Expected: second run shows no change; Execution log shows `no cells needed updating`.

- [ ] **Test G — License gate: not subscribed**

Temporarily configure license endpoint to return `{ "activeSubscriber": false }`.
Click any menu item.
Expected: alert "Subscription Required" appears; formatter does not run.

- [ ] **Test H — License gate: server unreachable (fail-open)**

Set `LICENSE_API_URL` in Script Properties to `https://999.999.999.999/check`.
Click any menu item.
Expected: no alert — the operation proceeds normally. Execution log shows `[WARN] License server unreachable — failing open`.

---

## Known Constraints & Notes

- **`General` → `0` after round-trip:** Unavoidable — `General` cannot be used in multi-section formats. Visually identical in practice.
- **Menu placement:** During development (container-bound), the menu is top-level. When deployed as an Editor Add-on via Google Workspace Marketplace, GAS places it under Extensions automatically — no code change needed.
- **`spreadsheets.currentonly` scope:** Restricts the script to the bound spreadsheet. If you later need cross-spreadsheet access, switch to `https://www.googleapis.com/auth/spreadsheets`.
- **Large sheets:** `getDataRange()` covers all data cells. Very large sheets (50k+ cells) may be slow but will not fail. A future optimization could chunk by range.
