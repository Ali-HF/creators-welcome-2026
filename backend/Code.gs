/**
 * CREATORS WELCOME 2026 - GOOGLE APPS SCRIPT BACKEND
 * 
 * Target Google Sheet Columns:
 * A: Pass ID (#CW26-001)
 * B: Name
 * C: Roll Number
 * D: Amount Paid (PKR)
 * E: Status (unused / used)
 * F: Created Date (ISO)
 * G: Gate Scanned Date (ISO)
 * H: Email
 * I: WhatsApp
 */

var SHEET_NAME = 'Passes';
var DEFAULT_PRICE = 2500;

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var output;
  try {
    var contents = {};
    if (e && e.postData && e.postData.contents) {
      contents = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      contents = e.parameter;
    }

    var action = contents.action || 'getStats';
    var responseData = {};

    if (action === 'generatePass') {
      responseData = generatePass(contents);
    } else if (action === 'checkAndScanPass') {
      responseData = checkAndScanPass(contents);
    } else if (action === 'getStats') {
      responseData = getStats();
    } else if (action === 'getPasses') {
      responseData = getPasses();
    } else if (action === 'prettifySheet') {
      responseData = prettifySheet();
    } else {
      responseData = { success: false, message: 'Invalid action parameter' };
    }

    output = ContentService.createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    output = ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }

  return output;
}

/**
 * Ensures Google Sheet tab exists and returns reference
 */
function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Spreadsheet not found. Please ensure the Apps Script was opened via Extensions -> Apps Script inside your Google Sheet.');
  }

  // Always use the first sheet tab (what the user sees when opening Google Sheets)
  var sheet = ss.getSheets()[0];
  if (sheet.getName() !== SHEET_NAME && sheet.getName().indexOf('Sheet') === 0) {
    try {
      sheet.setName(SHEET_NAME);
    } catch (e) {}
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Pass ID', 'Full Name', 'Roll Number', 'Amount Paid (PKR)', 'Status', 'Created ISO', 'Scanned ISO', 'Email', 'WhatsApp'
    ]);
  }

  return sheet;
}

/**
 * Action 1: generatePass
 * CRITICAL RULE: LockService.getScriptLock() ONLY wraps sheet.appendRow (~50ms).
 * Lock is released BEFORE email sending.
 */
function generatePass(data) {
  // Explicit variable declarations before lock acquisition to prevent ReferenceError
  var passId = '';
  var name = (data.name || 'Anonymous').toString().trim();
  var rollNo = (data.rollNo || '').toString().trim().toUpperCase();
  var amount = Number(data.amount) || DEFAULT_PRICE;
  var email = (data.email || '').toString().trim();
  var whatsapp = (data.whatsapp || '').toString().trim();
  var nowIso = new Date().toISOString();
  var status = 'unused';

  var sheet = getOrCreateSheet();

  // ATOMIC LOCK SECTION FOR SHEET WRITE ONLY
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // 10s wait

    var lastRow = sheet.getLastRow();
    var count = lastRow > 1 ? (lastRow - 1) + 1 : 1;
    passId = '#CW26-' + padNumber(count, 3);

    sheet.appendRow([
      passId,
      name,
      rollNo,
      amount,
      status,
      nowIso,
      '',
      email,
      whatsapp
    ]);

  } catch (lockErr) {
    return { success: false, message: 'Server busy, could not acquire sheet lock. Please retry.' };
  } finally {
    lock.releaseLock(); // RELEASE LOCK IMMEDIATELY BEFORE NETWORK FETCH / EMAIL
  }

  // Soft email dispatch outside lock scope
  var emailSent = false;
  var emailError = '';
  if (email && email.length > 3) {
    var emailResult = sendPassEmail(email, name, rollNo, passId);
    emailSent = emailResult.success;
    emailError = emailResult.error || '';
  }

  return {
    success: true,
    pass: {
      passId: passId,
      name: name,
      rollNo: rollNo,
      amount: amount,
      status: status,
      createdIso: nowIso,
      scannedIso: '',
      email: email,
      whatsapp: whatsapp
    },
    emailSent: emailSent,
    emailError: emailError
  };
}

/**
 * Action 2: checkAndScanPass
 * Atomic validation to prevent double entry
 */
function checkAndScanPass(data) {
  var rawPassId = (data.passId || '').toString().trim().toUpperCase();
  var targetId = rawPassId.indexOf('#') === 0 ? rawPassId : '#' + rawPassId;
  var sheet = getOrCreateSheet();

  var result = {
    success: false,
    state: 'INVALID',
    message: 'Pass ID not found'
  };

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, state: 'INVALID', message: 'No passes in sheet' };
    }

    var values = sheet.getRange(2, 1, lastRow - 1, 9).getValues();

    for (var i = values.length - 1; i >= 0; i--) {
      var rowPassId = (values[i][0] || '').toString().trim().toUpperCase();
      if (rowPassId === targetId) {
        var currentStatus = (values[i][4] || '').toString().toLowerCase();
        var rowName = values[i][1];
        var rowRoll = values[i][2];
        var scannedIso = values[i][6];

        if (currentStatus === 'used') {
          result = {
            success: false,
            state: 'DUPLICATE',
            message: 'ALREADY SCANNED! Scanned previously at ' + (scannedIso ? new Date(scannedIso).toLocaleTimeString() : 'gate'),
            pass: {
              passId: rowPassId,
              name: rowName,
              rollNo: rowRoll,
              status: 'used',
              scannedIso: scannedIso
            }
          };
        } else {
          // Approve & update sheet
          var nowIso = new Date().toISOString();
          var rowIndex = i + 2; // 1-indexed header + 1
          sheet.getRange(rowIndex, 5).setValue('used');
          sheet.getRange(rowIndex, 7).setValue(nowIso);

          result = {
            success: true,
            state: 'APPROVED',
            message: 'ENTRY APPROVED! Welcome to Creators Welcome 2026.',
            pass: {
              passId: rowPassId,
              name: rowName,
              rollNo: rowRoll,
              status: 'used',
              scannedIso: nowIso
            }
          };
        }
        break;
      }
    }

  } catch (err) {
    result = { success: false, state: 'ERROR', message: err.toString() };
  } finally {
    lock.releaseLock();
  }

  return result;
}

/**
 * Action 3: getStats
 */
function getStats() {
  var sheet = getOrCreateSheet();
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return {
      success: true,
      stats: { totalIssued: 0, scannedCount: 0, unusedCount: 0, totalRevenue: 0, admissionPct: 0 }
    };
  }

  var values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  var totalIssued = values.length;
  var scannedCount = 0;
  var totalRevenue = 0;

  for (var i = 0; i < values.length; i++) {
    var status = (values[i][4] || '').toString().toLowerCase();
    var amt = Number(values[i][3]) || DEFAULT_PRICE;
    if (status === 'used') scannedCount++;
    totalRevenue += amt;
  }

  var unusedCount = totalIssued - scannedCount;
  var admissionPct = totalIssued > 0 ? Math.round((scannedCount / totalIssued) * 100) : 0;

  return {
    success: true,
    stats: {
      totalIssued: totalIssued,
      scannedCount: scannedCount,
      unusedCount: unusedCount,
      totalRevenue: totalRevenue,
      admissionPct: admissionPct
    }
  };
}

/**
 * Action 4: getPasses
 */
function getPasses() {
  var sheet = getOrCreateSheet();
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return { success: true, passes: [] };
  }

  var values = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
  var passes = [];

  for (var i = values.length - 1; i >= 0; i--) {
    passes.push({
      passId: values[i][0],
      name: values[i][1],
      rollNo: values[i][2],
      amount: values[i][3],
      status: values[i][4],
      createdIso: values[i][5],
      scannedIso: values[i][6],
      email: values[i][7],
      whatsapp: values[i][8]
    });
  }

  return { success: true, passes: passes };
}

/**
 * Resilient Email Sender
 * Mute HTTP exceptions so network/QR issues never fail pass creation
 */
function sendPassEmail(recipientEmail, name, rollNo, passId) {
  try {
    var qrUrl = 'https://quickchart.io/qr?text=' + encodeURIComponent(passId) + '&size=300&ecLevel=H&margin=2';
    
    // Mute HTTP exceptions for safe fetching
    var qrBlob = null;
    try {
      var qrResponse = UrlFetchApp.fetch(qrUrl, { muteHttpExceptions: true });
      if (qrResponse.getResponseCode() === 200) {
        qrBlob = qrResponse.getBlob().setName('Pass_QR.png');
      }
    } catch (qrErr) {
      Logger.log('QR Blob fetch error soft fail: ' + qrErr);
    }

    var subject = '🎉 Your Admission Pass for CREATORS WELCOME 2026 [' + passId + ']';
    var htmlBody = ''
      + '<!DOCTYPE html>'
      + '<html>'
      + '<head>'
      + '  <meta charset="utf-8">'
      + '  <meta name="viewport" content="width=device-width, initial-scale=1.0">'
      + '</head>'
      + '<body style="margin: 0; padding: 20px 10px; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif;">'
      + '  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">'
      + '    <tr>'
      + '      <td align="center">'
      + '        <table role="presentation" width="100%" style="max-width: 480px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif;" border="0" cellspacing="0" cellpadding="0">'
      + '          <!-- Header Banner -->'
      + '          <tr>'
      + '            <td style="background-color: #111827; padding: 24px 20px; text-align: center;">'
      + '              <table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto;">'
      + '                <tr>'
      + '                  <td style="width: 32px; height: 32px; background-color: #ffffff; color: #111827; border-radius: 50%; text-align: center; font-weight: 800; font-size: 14px; line-height: 32px; vertical-align: middle;">CW</td>'
      + '                  <td style="padding-left: 10px; font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: 0.05em; text-transform: uppercase;">CREATORS WELCOME</td>'
      + '                </tr>'
      + '              </table>'
      + '              <div style="font-size: 11px; font-weight: 700; color: #10b981; letter-spacing: 0.12em; text-transform: uppercase; margin-top: 6px;">OFFICIAL LIVE ADMISSION PASS</div>'
      + '            </td>'
      + '          </tr>'
      + '          '
      + '          <!-- Main Pass Content -->'
      + '          <tr>'
      + '            <td style="padding: 28px 24px; text-align: center;">'
      + '              <!-- Attendee Info -->'
      + '              <div style="font-size: 22px; font-weight: 800; color: #111827; margin-bottom: 4px; letter-spacing: -0.01em;">' + name.toUpperCase() + '</div>'
      + '              <div style="font-family: \'Courier New\', Courier, monospace; font-size: 15px; font-weight: 700; color: #059669; margin-bottom: 20px;">' + (rollNo.indexOf('#') === 0 ? rollNo : '#' + rollNo) + '</div>'
      + '              '
      + '              <!-- QR Frame -->'
      + (qrBlob ? '              <div style="display: inline-block; padding: 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">'
      + '                <img src="cid:qrImage" width="200" height="200" style="display: block; width: 200px; height: 200px; border-radius: 6px;" alt="Entry QR Code" />'
      + '              </div>' : '')
      + '              '
      + '              <!-- Event Meta Details -->'
      + '              <table role="presentation" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px; margin-bottom: 20px;" border="0" cellspacing="0" cellpadding="0">'
      + '                <tr>'
      + '                  <td align="left" style="padding: 4px 8px;">'
      + '                    <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">DATE & TIME</div>'
      + '                    <div style="font-size: 13px; font-weight: 700; color: #111827;">20 SEP 2026 | 01:00 PM</div>'
      + '                  </td>'
      + '                  <td align="right" style="padding: 4px 8px;">'
      + '                    <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">VENUE</div>'
      + '                    <div style="font-size: 13px; font-weight: 700; color: #111827;">GRAND IMPERIAL</div>'
      + '                  </td>'
      + '                </tr>'
      + '              </table>'
      + '              '
      + '              <!-- Pass ID Pill Badge -->'
      + '              <div style="display: inline-block; background-color: #111827; color: #ffffff; font-family: \'Courier New\', Courier, monospace; font-size: 16px; font-weight: 700; padding: 8px 24px; border-radius: 9999px; letter-spacing: 0.05em;">'
      + '                ' + passId + ''
      + '              </div>'
      + '              '
      + '              <!-- Verification Instructions -->'
      + '              <p style="font-size: 12px; color: #64748b; margin-top: 20px; margin-bottom: 0; line-height: 1.5;">'
      + '                Please present this email or QR Code at the entrance gate for fast-track verification.'
      + '              </p>'
      + '            </td>'
      + '          </tr>'
      + '          '
      + '          <!-- Footer -->'
      + '          <tr>'
      + '            <td style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 14px 20px; text-align: center; font-size: 11px; color: #9ca3af;">'
      + '              Creators Welcome 2026 • Official Event Operations & Gate Scanner System'
      + '            </td>'
      + '          </tr>'
      + '        </table>'
      + '      </td>'
      + '    </tr>'
      + '  </table>'
      + '</body>'
      + '</html>';

    var mailOptions = {
      to: recipientEmail,
      subject: subject,
      htmlBody: htmlBody
    };

    if (qrBlob) {
      mailOptions.inlineImages = { qrImage: qrBlob };
    }

    MailApp.sendEmail(mailOptions);
    return { success: true };

  } catch (err) {
    Logger.log('Email delivery soft failure: ' + err.toString());
    return { success: false, error: err.toString() };
  }
}

/**
 * Prettify Google Sheet formatting
 */
function prettifySheet() {
  try {
    var sheet = getOrCreateSheet();
    var lastRow = Math.max(sheet.getLastRow(), 20);

    // Freeze header
    sheet.setFrozenRows(1);

    // Header styling
    var headerRange = sheet.getRange("A1:I1");
    headerRange.setBackground("#111827");
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    headerRange.setHorizontalAlignment("center");

    // Column widths
    sheet.setColumnWidth(1, 130); // Pass ID
    sheet.setColumnWidth(2, 200); // Name
    sheet.setColumnWidth(3, 140); // Roll No
    sheet.setColumnWidth(4, 150); // Amount
    sheet.setColumnWidth(5, 110); // Status
    sheet.setColumnWidth(6, 190); // Created ISO
    sheet.setColumnWidth(7, 190); // Scanned ISO
    sheet.setColumnWidth(8, 220); // Email
    sheet.setColumnWidth(9, 160); // WhatsApp

    return { success: true, message: 'Sheet formatted successfully' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Helper function: Left-pad number with zeros
 */
function padNumber(num, length) {
  var str = (num || 0).toString();
  while (str.length < length) {
    str = '0' + str;
  }
  return str;
}
