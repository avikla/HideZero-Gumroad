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
      var email = '';
      try { email = Session.getActiveUser().getEmail(); } catch(e) {}
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
    clearLicenseKey_();
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

/**
 * Silent license check — no UI alerts, no key deletion.
 * Used by the homepage card and manageLicenseKey() to query status non-destructively.
 * @returns {{ valid: boolean, reason?: 'no_key'|'key_invalid'|'server_error' }}
 */
function checkLicenseSilent_() {
  var licenseKey = getLicenseKey_();
  if (!licenseKey) return { valid: false, reason: 'no_key' };

  var apiUrl;
  try { apiUrl = getLicenseApiUrl_(); } catch (e) { return { valid: false, reason: 'server_error' }; }

  var response;
  try {
    response = UrlFetchApp.fetch(apiUrl + '?licenseKey=' + encodeURIComponent(licenseKey), { muteHttpExceptions: true });
  } catch (e) { return { valid: false, reason: 'server_error' }; }

  if (response.getResponseCode() !== 200) return { valid: false, reason: 'server_error' };

  var result;
  try { result = JSON.parse(response.getContentText()); } catch (e) { return { valid: false, reason: 'server_error' }; }

  return result.activeSubscriber ? { valid: true } : { valid: false, reason: 'key_invalid' };
}
