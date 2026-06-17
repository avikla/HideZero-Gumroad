# HideZero-Gumroad — Project Context

## Overview

Google Apps Script add-on for Google Sheets. Hides/shows zeros on the active sheet by manipulating cell number formats non-destructively. License-gated via Gumroad license key verification through an external GAS Web App.

## Product

- **Gumroad product URL:** https://hidezero.gumroad.com/l/hidezero
- **Gumroad product permalink:** `hidezero`

## Version

Current version: **v1.1** (pushed to Apps Script 2026-06-09)

## Files

| File | Role |
|------|------|
| `Config.gs` | `getLicenseApiUrl_()`, `getLicenseKey_()`, `promptForLicenseKey_()`, `clearLicenseKey_()`, `setupConfig()`, `VERSION` |
| `License.gs` | `checkLicense_()` — prompts for key on first run; `checkLicenseSilent_()` — returns `{valid, reason}`, no UI |
| `ZeroFormatter.gs` | Core format helpers + `hideZerosOnSheet_()` / `showZerosOnSheet_()` (thin wrappers) + `hideZerosInRange_()` / `showZerosInRange_()` (return bool) + unit tests |
| `Menu.gs` | `onOpen()` menu, sheet-level + selection-level entry points, `manageLicenseKey()`, `showHomepage()` card + card callbacks |
| `appsscript.json` | GAS manifest — scopes, urlFetchWhitelist, addOns.sheets, V8 runtime |
| `PLAN.md` | Full implementation plan |
| `site/` | Homepage + privacy policy (source of truth — auto-synced to `docs/` via GitHub Actions) |
| `docs/` | Deployed to GitHub Pages at hidezero.meteor.co.il (auto-synced from `site/` on every push) |
| `.github/workflows/deploy-site.yml` | GitHub Actions: copies `site/` → `docs/`, deploys to GitHub Pages |
| `CNAME` | DNS record: hidezero.meteor.co.il |

## Marketplace

- **Status:** Approved and published on Google Workspace Marketplace 2026-06-17
- **Marketplace URL:** https://workspace.google.com/marketplace/app/hidezero_for_google_sheets/114517382322
- **OAuth approved:** 2026-06-15 — all scopes verified (userinfo.email, spreadsheets.currentonly, script.external_request, userinfo.profile)
- **Visibility:** Public
- **Deployment ID:** `AKfycbwVcoqBOka9w9JnTClmOxKB1wpswwlm7hByIuXKFf3NdXY5Z0n_47T0OiZUtIcoSMQv`
- **Script ID:** `1byEEuX7MjxRMUaEKoJHXt0gE2J9eF23diyP_NiXSH5RnS9mROKLtsulK`
- **Homepage:** https://hidezero.meteor.co.il
- **Privacy policy:** https://hidezero.meteor.co.il/privacy.html
- **GCP project number:** `114517382322`
- **Draft tester:** avi.klayman@gmail.com

## Website

- **Live URL:** https://hidezero.meteor.co.il (CNAME in this repo)
- **Hosted:** GitHub Pages (`docs/` folder)
- **Source of truth:** `site/` folder — edit HTML/CSS here
- **Auto-deployment:** GitHub Actions automatically:
  1. Copies `site/` → `docs/` on every push
  2. Deploys `docs/` to GitHub Pages
- **Workflow:** Just edit `site/`, commit, and push — that's it! No manual copy step needed.

## Deployment

### GAS Add-on

```powershell
cd "C:\Users\Avi\Desktop\Backup to cloud\Follow-up Actual\Claude Code\projects\HideZero-Gumroad"
clasp push
```

`.clasp.json` is gitignored. Fill in `scriptId` after `clasp create` or container-bind.

### Website (GitHub Pages)

No manual deployment needed — GitHub Actions handles it automatically on every push.

**GitHub Pages Configuration (already set up):**
- Source: `docs/` folder
- Domain: `hidezero.meteor.co.il` (via CNAME)
- Deployment: Automatic on push (via `.github/workflows/deploy-site.yml`)

## Key Design Decisions

- **Format pattern:** `fmt;-fmt;;@` — 4-section GAS number format, empty 3rd section hides zeros
- **Detection:** `split(';').length === 4 && parts[2] === '' && parts[3] === '@'`
- **`General` / `@`** normalise to `'0'` before format construction (cannot appear in multi-section formats)
- **`General` → `0` after round-trip:** unavoidable; visually identical
- **Batch API:** single `getNumberFormats()` + `setNumberFormats()` call each way — one API roundtrip
- **License key storage:** `DocumentProperties` (per spreadsheet, not per user/script)
- **License server URL:** `Script Properties` as `LICENSE_API_URL` — never hardcoded
- **Fail policy:** fail-open on server errors; only explicit `activeSubscriber: false` blocks
- **Private functions** end with `_`
- **Logging:** `[OK]`, `[WARN]`, `[ERR]` prefixes

## License Server (separate GAS project — build after plugin works)

The license server is a GAS Web App that proxies to the Gumroad License Key API:

```
POST https://api.gumroad.com/v2/licenses/verify
Body: product_permalink=hidezero&license_key=USER_KEY&increment_uses_count=false
```

Returns `{ "activeSubscriber": true/false }` to the plugin.

## First-Time Setup

1. Bind to a Google Sheet: Extensions → Apps Script → copy Script ID
2. Update `.clasp.json` with real `scriptId`
3. `clasp push`
4. In GAS editor: fill real URL into `setupConfig()`, run it, delete the URL, re-push
5. Reload the sheet and authorize the two OAuth scopes
