# HideZero v1.1 — PRD

## Problem Statement

HideZero is a paid Google Sheets add-on that hides zeros by applying a 4-section number format (`fmt;-fmt;;@`) to cells. The v1.0 shipped to the Marketplace on 2026-05-21 operates only on the entire active sheet's data range. Users who want to hide zeros in a specific area (a summary table, a financial model section) must either hide all zeros or none. Additionally, once a license key is stored, there's no user-facing way to update or clear it — the only escape hatch is manually clearing DocumentProperties through the script editor. The homepage sidebar is also a static instruction card with no live information.

## Solution

Extend the menu with two new range modes ("Hide in Selection", "Show in Selection"), add a **Manage License Key** menu item that prompts for a replacement key, and upgrade the homepage sidebar card to show live license status (valid / invalid / not set). These three additions make the tool substantially more useful for power users and reduce support burden from users who need to re-enter a key after a refund/repurchase.

## User Stories

1. As a Sheets user, I want to hide zeros only in my currently selected cells, so that I can suppress zeros in a specific table without affecting the rest of my sheet.
2. As a Sheets user, I want to show zeros only in my currently selected cells, so that I can restore visibility in one region without revealing zeros elsewhere.
3. As a Sheets user, I want both "whole sheet" and "selection" modes available from the same menu, so that I can choose the right scope without hunting for separate add-ons.
4. As a licensed user, I want to update my license key from within the add-on menu, so that I don't need to open the Apps Script editor to change it.
5. As a licensed user, I want to see my current license status in the sidebar, so that I know at a glance whether my subscription is active.
6. As a new user, I want the sidebar to show a purchase link if I have no key entered, so that I can buy a license without googling.
7. As a user with an invalid or refunded key, I want the sidebar to tell me the key is no longer valid, so that I know to re-enter a new one rather than assume the add-on is broken.
8. As a Sheets user, I want the "Hide in Selection" action to skip cells that already have a hidden-zero format applied, so that running it twice doesn't corrupt my formats.
9. As a Sheets user, I want the "Show in Selection" action to only restore cells that HideZero formatted (not other custom formats), so that my existing number formats are protected.
10. As a Sheets user, I want the selection-based operations to work on multi-range selections (Ctrl+Click), so that I can apply to non-contiguous areas in one action.
11. As a Sheets user, I want to see a brief toast or status message after an operation completes, so that I have confirmation the action ran.
12. As a developer/admin, I want a "Manage License Key" menu item that shows the current stored key (masked) and prompts for a new one, so that users can self-serve key resets.
13. As a Sheets user, I want to see the add-on version number in the menu title, so that I know which version I'm running and can reference it in support requests.

## Implementation Decisions

### Module: `ZeroFormatter.gs` — add `hideZerosInRange_()` and `showZerosInRange_()`

Extract the existing loop logic from `hideZerosOnSheet_()` and `showZerosOnSheet_()` into range-based helpers that accept a `Range` argument. The sheet-level functions become thin wrappers calling these new helpers with `sheet.getDataRange()`. This is the core refactor — all other changes are additive.

Interface shape:
- `hideZerosInRange_(range)` — applies zero-hiding formats to the given Range object
- `showZerosInRange_(range)` — restores original formats for hidden-zero cells in the given Range

### Module: `ZeroFormatter.gs` — multi-range support

`SpreadsheetApp.getActiveSheet().getActiveRangeList()` returns a `RangeList` with a `.getRanges()` method. The selection-mode entry points should call `getRanges()` and iterate, calling `hideZerosInRange_()` / `showZerosInRange_()` per range.

### Module: `Menu.gs` — new menu items

Updated menu structure:
```
Hide Zeros
├── Hide Zeros on This Sheet
├── Show Zeros on This Sheet
├── ─────────────────────────
├── Hide Zeros in Selection
├── Show Zeros in Selection
├── ─────────────────────────
└── Manage License Key
```

New public entry points: `hideZerosInSelection()`, `showZerosInSelection()`, `manageLicenseKey()`.

All entry points call `checkLicense_()` first, same as today.

The menu title itself displays the version: `Hide Zeros v1.1` (set as a constant `VERSION` in `Config.gs`, referenced in `onOpen()`).

GAS menu separators: `.addSeparator()` between groups.

### Module: `Config.gs` — `clearLicenseKey_()` helper

Add `clearLicenseKey_()` that deletes `GUMROAD_LICENSE_KEY` from DocumentProperties. Used by the "Manage License Key" flow — clear the old key, then call `promptForLicenseKey_()` to enter the new one.

### Module: `Menu.gs` — `manageLicenseKey()` entry point

Flow:
1. Read current stored key (masked: show first 4 chars + `****`)
2. Show confirmation dialog: "Your current key is `ABCD****`. Replace it?"
3. If confirmed: call `clearLicenseKey_()` then `promptForLicenseKey_()`
4. If new key entered: call `checkLicense_()` immediately to validate it
5. Show success/failure alert

### Module: `Menu.gs` — `showHomepage()` upgrade

The homepage card currently shows static instructions. Upgrade it to show:
- License status section: calls `checkLicenseSilent_()` to get status, then displays "Active", "Invalid", or "Not configured"
- Current masked key (or "None")
- A "Set / Update Key" button that triggers `promptForLicenseKey_()`
- Purchase link if no key is set

### Module: `License.gs` — `checkLicenseSilent_()`

Returns `{ valid: true }` or `{ valid: false, reason: 'key_invalid' | 'server_error' | 'no_key' }`. Used by the homepage card only. Does not delete stored keys or show alerts — those remain the responsibility of the interactive `checkLicense_()` flow.

### Toast notifications

Use `SpreadsheetApp.getActiveSpreadsheet().toast(message, title, timeoutSeconds)` after each successful operation (hide/show) to confirm completion without requiring user dismissal.

## Testing Decisions

**What makes a good test here:** Test the pure format transformation functions (`normaliseFormat_`, `buildHideFormat_`, `isHiddenZeroFormat_`, `restoreFormat_`) as unit tests with explicit expected values — these are pure functions with no GAS dependencies. For the new range helpers, extend `testRoundTrip_()` to exercise multi-range scenarios against a real sheet range. Do not test UI flows (alerts, prompts, cards) — they require human interaction and GAS doesn't support headless UI testing.

**Modules to test:**
- `ZeroFormatter.gs` — existing unit test suite covers pure helpers; extend `testRoundTrip_()` to call `hideZerosInRange_()` and `showZerosInRange_()` directly with an explicit range argument.
- `License.gs` — `checkLicenseSilent_()` can be tested manually from the editor with a known-good and known-bad key.

**Prior art:** Existing `testNormaliseFormat_()`, `testBuildHideFormat_()`, `testIsHiddenZeroFormat_()`, `testRestoreFormat_()` in `ZeroFormatter.gs` — follow the same pattern.

## Out of Scope

- Per-user license keys (current design is per-spreadsheet via DocumentProperties — no change)
- Conditional formatting support
- "Apply to all sheets" feature
- Undo/redo stack (Sheets native undo handles format changes natively)
- Keyboard shortcuts
- Locale-specific number format handling beyond what already exists
- Any changes to the license server (`projects/license-server/Code.gs`)

## Further Notes

- The selection-mode operations use `getActiveRangeList()` which works even when a single range is selected (returns a RangeList of one), unifying single-range and multi-range handling.
- `getActiveRangeList()` is available with the V8 runtime already in use.
- The homepage card upgrade requires `script.external_request` scope when the card loads — already declared in `appsscript.json`.
- `checkLicenseSilent_()` should NOT show UI alerts or delete stored keys; the interactive `checkLicense_()` retains those responsibilities.
