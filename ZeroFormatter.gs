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

  // Test sheet-level functions (thin wrappers)
  hideZerosOnSheet_();
  var afterHide = testRange.getNumberFormats();
  var allHidden = isHiddenZeroFormat_(afterHide[0][0]) &&
                  isHiddenZeroFormat_(afterHide[1][1]) &&
                  isHiddenZeroFormat_(afterHide[2][2]);
  Logger.log(allHidden ? '[PASS] Sheet-level: all cells have hide format' : '[FAIL] Sheet-level: missing hide format after hide');

  showZerosOnSheet_();
  var afterShow = testRange.getNumberFormats();
  // Note: General normalises to '0' after round-trip — expected and documented
  var restored = afterShow[0][0] === '0' && afterShow[1][1] === '0.00' && afterShow[2][2] === '#,##0';
  Logger.log(restored ? '[PASS] Sheet-level: formats correctly restored' : '[FAIL] Sheet-level: restore mismatch: ' +
    'A1=' + afterShow[0][0] + ' B2=' + afterShow[1][1] + ' C3=' + afterShow[2][2]);

  // Test range-level helpers directly (v1.1)
  testRange.setNumberFormat('General');
  sheet.getRange('B2').setNumberFormat('0.00');
  var subRange = sheet.getRange('A1:B2');
  var didHide = hideZerosInRange_(subRange);
  Logger.log(didHide ? '[PASS] Range-level: hideZerosInRange_ returned true' : '[FAIL] Range-level: hideZerosInRange_ returned false unexpectedly');
  var subFormats = subRange.getNumberFormats();
  var subHidden = isHiddenZeroFormat_(subFormats[0][0]) && isHiddenZeroFormat_(subFormats[1][1]);
  Logger.log(subHidden ? '[PASS] Range-level: targeted cells have hide format' : '[FAIL] Range-level: targeted cells missing hide format');

  var didShow = showZerosInRange_(subRange);
  Logger.log(didShow ? '[PASS] Range-level: showZerosInRange_ returned true' : '[FAIL] Range-level: showZerosInRange_ returned false unexpectedly');
  var subRestored = subRange.getNumberFormats();
  var rangeRestored = subRestored[0][0] === '0' && subRestored[1][1] === '0.00';
  Logger.log(rangeRestored ? '[PASS] Range-level: formats correctly restored' : '[FAIL] Range-level: restore mismatch');
}

function runAllUnitTests() {
  testNormaliseFormat_();
  testBuildHideFormat_();
  testIsHiddenZeroFormat_();
  testRestoreFormat_();
  Logger.log('=== Unit tests complete (run testRoundTrip_() separately — needs active sheet) ===');
}

// ---- IMPLEMENTATION ----

/**
 * Normalise a raw GAS format string so it can be used as a format section.
 * "General" and "@" cannot appear in multi-section formats — replace with "0".
 * @param {string} fmt
 * @returns {string}
 */
function normaliseFormat_(fmt) {
  if (!fmt || fmt === 'General' || fmt === '@') return '0';
  return fmt;
}

/**
 * Build the zero-hiding 4-section format: positive;negative;zero=blank;text.
 * @param {string} normFmt  Already-normalised format string
 * @returns {string}
 */
function buildHideFormat_(normFmt) {
  return normFmt + ';-' + normFmt + ';;@';
}

/**
 * Return true if a format string was produced by buildHideFormat_.
 * Detects 4 sections where the 3rd is empty and the 4th is "@".
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
 * Apply zero-hiding formats to every cell in the given Range.
 * Cells already in hide format are skipped.
 * @param {GoogleAppsScript.Spreadsheet.Range} range
 * @returns {boolean} true if any cell was modified
 */
function hideZerosInRange_(range) {
  var formats = range.getNumberFormats();
  var modified = false;
  for (var r = 0; r < formats.length; r++) {
    for (var c = 0; c < formats[r].length; c++) {
      if (isHiddenZeroFormat_(formats[r][c])) continue;
      formats[r][c] = buildHideFormat_(normaliseFormat_(formats[r][c]));
      modified = true;
    }
  }
  if (modified) range.setNumberFormats(formats);
  return modified;
}

/**
 * Restore original formats for cells with a hide-zero format in the given Range.
 * Other cells are left untouched.
 * @param {GoogleAppsScript.Spreadsheet.Range} range
 * @returns {boolean} true if any cell was modified
 */
function showZerosInRange_(range) {
  var formats = range.getNumberFormats();
  var modified = false;
  for (var r = 0; r < formats.length; r++) {
    for (var c = 0; c < formats[r].length; c++) {
      if (!isHiddenZeroFormat_(formats[r][c])) continue;
      formats[r][c] = restoreFormat_(formats[r][c]);
      modified = true;
    }
  }
  if (modified) range.setNumberFormats(formats);
  return modified;
}

/** Thin wrapper — hides zeros on the entire active sheet's data range. */
function hideZerosOnSheet_() {
  return hideZerosInRange_(SpreadsheetApp.getActiveSheet().getDataRange());
}

/** Thin wrapper — restores zeros on the entire active sheet's data range. */
function showZerosOnSheet_() {
  return showZerosInRange_(SpreadsheetApp.getActiveSheet().getDataRange());
}
