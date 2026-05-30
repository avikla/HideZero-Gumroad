// ============================================================
// Config.gs — Script Properties helpers and one-time setup
// ============================================================

var VERSION = '1.1';

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
 * Deletes the stored Gumroad license key from DocumentProperties.
 * Called by checkLicense_() on invalid key and by manageLicenseKey() on key reset.
 */
function clearLicenseKey_() {
  PropertiesService.getDocumentProperties().deleteProperty('GUMROAD_LICENSE_KEY');
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
    'LICENSE_API_URL': 'https://script.google.com/macros/s/AKfycbxrH1KXOnxZF2D-P38yNsROnEe4C6SqFWLeUJR6nahC6WPk1SGvMI6YlthBGbyFOBT7/exec'
  });
  Logger.log('[OK] LICENSE_API_URL saved. Remove the value from setupConfig() and re-push.');
}
