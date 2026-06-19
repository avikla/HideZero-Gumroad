// ============================================================
// Menu.gs — Custom menu, public entry points, and homepage card
// ============================================================

/**
 * Called automatically by GAS when the spreadsheet is opened.
 * Adds the versioned "Hide Zeros" custom menu.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Hide Zeros v' + VERSION)
    .addItem('Hide Zeros on This Sheet', 'hideZeros')
    .addItem('Show Zeros on This Sheet', 'showZeros')
    .addSeparator()
    .addItem('Hide Zeros in Selection', 'hideZerosInSelection')
    .addItem('Show Zeros in Selection', 'showZerosInSelection')
    .addSeparator()
    .addItem('Manage License Key', 'manageLicenseKey')
    .addToUi();
}

// ---- Sheet-level entry points ----

/**
 * Public entry point: hides zeros on the active sheet.
 */
function hideZeros() {
  if (!checkLicense_()) return;
  var modified = hideZerosOnSheet_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast(modified ? 'Zeros hidden on this sheet' : 'Nothing to change', 'HideZero', modified ? 3 : 2);
}

/**
 * Public entry point: shows zeros on the active sheet.
 */
function showZeros() {
  if (!checkLicense_()) return;
  var modified = showZerosOnSheet_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast(modified ? 'Zeros restored on this sheet' : 'Nothing to change', 'HideZero', modified ? 3 : 2);
}

// ---- Selection-level entry points ----

/**
 * Public entry point: hides zeros in the current selection (supports multi-range).
 */
function hideZerosInSelection() {
  if (!checkLicense_()) return;
  var ranges = SpreadsheetApp.getActiveSheet().getActiveRangeList().getRanges();
  var anyModified = false;
  ranges.forEach(function(range) {
    if (hideZerosInRange_(range)) anyModified = true;
  });
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast(anyModified ? 'Zeros hidden in selection' : 'Nothing to change', 'HideZero', anyModified ? 3 : 2);
}

/**
 * Public entry point: shows zeros in the current selection (supports multi-range).
 */
function showZerosInSelection() {
  if (!checkLicense_()) return;
  var ranges = SpreadsheetApp.getActiveSheet().getActiveRangeList().getRanges();
  var anyModified = false;
  ranges.forEach(function(range) {
    if (showZerosInRange_(range)) anyModified = true;
  });
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast(anyModified ? 'Zeros restored in selection' : 'Nothing to change', 'HideZero', anyModified ? 3 : 2);
}

// ---- License management ----

/**
 * Prompts the user to replace or enter their license key.
 * If a key is already stored, shows a masked confirmation before clearing.
 * Uses checkLicenseSilent_() to validate the new key, then shows one result alert.
 */
function manageLicenseKey() {
  var ui = SpreadsheetApp.getUi();
  var existing = getLicenseKey_();

  if (existing) {
    var masked = existing.substring(0, 4) + '****';
    var confirm = ui.alert(
      'Manage License Key',
      'Your current key is ' + masked + '.\n\nReplace it with a new key?',
      ui.ButtonSet.YES_NO
    );
    if (confirm !== ui.Button.YES) return;
    clearLicenseKey_();
  }

  var newKey = promptForLicenseKey_();
  if (!newKey) return;

  var status = checkLicenseSilent_();
  if (status.valid) {
    ui.alert('License Key Saved', 'Your license key is valid and active.', ui.ButtonSet.OK);
  } else if (status.reason === 'key_invalid') {
    ui.alert('Invalid Key', 'The key was saved but could not be verified. Check your Gumroad receipt email for the correct key.', ui.ButtonSet.OK);
  } else {
    ui.alert('Key Saved', 'Your license key was saved. Verification will happen on next use (server temporarily unreachable).', ui.ButtonSet.OK);
  }
}

// ---- Homepage card ----

/**
 * Homepage trigger for the Workspace Add-on framework.
 * Shows license status (from DocumentProperties only — no HTTP on load)
 * plus buttons to verify, update, or purchase.
 */
function showHomepage() {
  var key = getLicenseKey_();
  var masked = key ? key.substring(0, 4) + '****' : null;

  var section = CardService.newCardSection();

  section.addWidget(
    CardService.newKeyValue()
      .setTopLabel('License Key')
      .setContent(masked || 'No key stored')
  );

  if (key) {
    section.addWidget(
      CardService.newButtonSet()
        .addButton(
          CardService.newTextButton()
            .setText('Hide Zeros on Sheet')
            .setOnClickAction(CardService.newAction().setFunctionName('hideZerosFromCard'))
        )
        .addButton(
          CardService.newTextButton()
            .setText('Show Zeros on Sheet')
            .setOnClickAction(CardService.newAction().setFunctionName('showZerosFromCard'))
        )
    );
    section.addWidget(
      CardService.newButtonSet()
        .addButton(
          CardService.newTextButton()
            .setText('Hide Zeros in Selection')
            .setOnClickAction(CardService.newAction().setFunctionName('hideZerosInSelectionFromCard'))
        )
        .addButton(
          CardService.newTextButton()
            .setText('Show Zeros in Selection')
            .setOnClickAction(CardService.newAction().setFunctionName('showZerosInSelectionFromCard'))
        )
    );
  }

  section.addWidget(
    CardService.newButtonSet()
      .addButton(
        CardService.newTextButton()
          .setText('Verify License')
          .setOnClickAction(CardService.newAction().setFunctionName('verifyLicenseFromCard'))
      )
      .addButton(
        CardService.newTextButton()
          .setText('Set / Update Key')
          .setOnClickAction(CardService.newAction().setFunctionName('setLicenseKeyFromCard'))
      )
  );

  if (!key) {
    section.addWidget(
      CardService.newTextButton()
        .setText('Purchase a License')
        .setOpenLink(CardService.newOpenLink().setUrl('https://hidezero.gumroad.com/l/hidezero'))
    );
  }

  return CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle('HideZero')
        .setSubtitle('v' + VERSION)
    )
    .addSection(section)
    .build();
}

/**
 * Card button callback: prompts for a new license key, then refreshes the card.
 */
function setLicenseKeyFromCard() {
  promptForLicenseKey_();
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(showHomepage()))
    .build();
}

/**
 * Card button callback: verifies the stored key via HTTP, then refreshes the card
 * with the result. Shows a "Clear & Re-enter" button if the key is invalid.
 */
function verifyLicenseFromCard() {
  var status = checkLicenseSilent_();

  var section = CardService.newCardSection();

  if (status.valid) {
    section.addWidget(CardService.newTextParagraph().setText('<b>Status:</b> Active'));
  } else if (status.reason === 'no_key') {
    section.addWidget(CardService.newTextParagraph().setText('<b>Status:</b> No key stored'));
  } else if (status.reason === 'key_invalid') {
    section.addWidget(CardService.newTextParagraph().setText('<b>Status:</b> Invalid or refunded key'));
    section.addWidget(
      CardService.newTextButton()
        .setText('Clear & Re-enter Key')
        .setOnClickAction(CardService.newAction().setFunctionName('clearAndReenterKeyFromCard'))
    );
  } else {
    section.addWidget(CardService.newTextParagraph().setText('<b>Status:</b> Server unreachable — try again later'));
  }

  section.addWidget(
    CardService.newTextButton()
      .setText('Back')
      .setOnClickAction(CardService.newAction().setFunctionName('showHomepage'))
  );

  var card = CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle('HideZero')
        .setSubtitle('License Status')
    )
    .addSection(section)
    .build();

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(card))
    .build();
}

/**
 * Card button callback: clears stored key then prompts for a new one.
 */
function clearAndReenterKeyFromCard() {
  clearLicenseKey_();
  promptForLicenseKey_();
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(showHomepage()))
    .build();
}

/**
 * Card button callback: hides zeros on the active sheet.
 */
function hideZerosFromCard() {
  if (!checkLicense_()) return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('License required.'))
    .build();
  var modified = hideZerosOnSheet_();
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(modified ? 'Zeros hidden on this sheet.' : 'Nothing to change.'))
    .build();
}

/**
 * Card button callback: shows zeros on the active sheet.
 */
function showZerosFromCard() {
  if (!checkLicense_()) return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('License required.'))
    .build();
  var modified = showZerosOnSheet_();
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(modified ? 'Zeros restored on this sheet.' : 'Nothing to change.'))
    .build();
}

/**
 * Card button callback: hides zeros in the current selection.
 */
function hideZerosInSelectionFromCard() {
  if (!checkLicense_()) return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('License required.'))
    .build();
  var ranges = SpreadsheetApp.getActiveSheet().getActiveRangeList().getRanges();
  var anyModified = false;
  ranges.forEach(function(range) { if (hideZerosInRange_(range)) anyModified = true; });
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(anyModified ? 'Zeros hidden in selection.' : 'Nothing to change.'))
    .build();
}

/**
 * Card button callback: shows zeros in the current selection.
 */
function showZerosInSelectionFromCard() {
  if (!checkLicense_()) return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('License required.'))
    .build();
  var ranges = SpreadsheetApp.getActiveSheet().getActiveRangeList().getRanges();
  var anyModified = false;
  ranges.forEach(function(range) { if (showZerosInRange_(range)) anyModified = true; });
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(anyModified ? 'Zeros restored in selection.' : 'Nothing to change.'))
    .build();
}
