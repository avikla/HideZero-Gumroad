# HideZero-Gumroad — Project Context

## Overview

Google Apps Script add-on for Google Sheets. Hides/shows zeros on the active sheet by manipulating cell number formats non-destructively. License-gated via Gumroad license key verification through an external GAS Web App.

## Product

- **Gumroad product URL:** https://hidezero.gumroad.com/l/hidezero
- **Price:** $4.90 USD (one-time)
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
| `site/` | Homepage, privacy policy, terms of service, and support page (source of truth — auto-synced to `docs/` via GitHub Actions) |
| `site/index.html` | Homepage with hero, features, how-it-works, CTA |
| `site/privacy.html` | Privacy Policy |
| `site/terms.html` | Terms of Service |
| `site/support.html` | Support page (email CTA + FAQ) |
| `site/theme.md` | Design system source of truth — palette tokens, logo/favicon usage |
| `site/logo.png` | Nav logo lockup (icon + wordmark), 480×170 |
| `site/favicon.png` | Favicon, 128×128, cropped from the icon mark only |
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
- **Terms of service:** https://hidezero.meteor.co.il/terms.html
- **Support page:** https://hidezero.meteor.co.il/support.html
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

## Website Design System

Full token table and origin notes live in `site/theme.md` — this is the summary.

All inner pages (privacy, terms, support) share the same design as the homepage:
- **Hero:** `linear-gradient(135deg, #22343a 0%, #34505a 55%, #4f8890 100%)`, compact (56px top padding vs 72px on homepage)
- **Nav bar:** dark slate-teal strip (`#22343a`) with a white chip wrapping `logo.png`, linking to `/`
- **Badge pill:** `rgba(255,255,255,.15)` background, `#cfe8ea` text
- **Section headings:** `#34505a`, uppercase, `letter-spacing: .06em`
- **Body text:** `#444`, `line-height: 1.75`
- **Footer:** shared across all 4 pages — links to Home, Privacy, Terms, Support + Google trademark disclaimer
- CSS is inlined per-page (no shared stylesheet)
- Palette derived from `Images/HideZero new logo.png` (teal/slate icon + wordmark, replaced the original green theme in 2026-07)

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
- **License key storage:** `UserProperties` (per user, works across all their spreadsheets)
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
