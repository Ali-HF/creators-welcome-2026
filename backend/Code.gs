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
      + '<div style="font-family: Arial, sans-serif; background-color: #0f172a; color: #ffffff; padding: 30px; border-radius: 12px; max-width: 500px; margin: 0 auto;">'
      + '  <div style="background-color: #6d28d9; padding: 15px; text-align: center; border-radius: 8px;">'
      + '    <h1 style="margin: 0; font-size: 22px; color: #ffffff;">CREATORS WELCOME 2026</h1>'
      + '    <p style="margin: 5px 0 0 0; color: #f3e8ff; font-size: 13px;">OFFICIAL EVENT ADMISSION PASS</p>'
      + '  </div>'
      + '  <div style="padding: 20px; text-align: center;">'
      + '    <h2 style="color: #ffffff; margin-bottom: 5px;">' + name + '</h2>'
      + '    <p style="color: #10b981; font-family: monospace; font-size: 16px; font-weight: bold; margin-top: 0;">#' + rollNo + '</p>'
      + '    <p style="font-size: 14px; color: #cbd5e1;">Pass ID: <strong style="color: #10b981;">' + passId + '</strong></p>'
      + '    <p style="font-size: 13px; color: #94a3b8;">Venue: Grand Imperial | Date: 20 SEP 2026 | 01:00 PM - 05:00 PM</p>'
      + (qrBlob ? '<img src="cid:qrImage" width="200" height="200" style="margin: 15px 0; border: 4px solid #ffffff; border-radius: 8px;" />' : '')
      + '    <p style="font-size: 12px; color: #64748b;">Present this email or QR Code at the gate for admission.</p>'
      + '  </div>'
      + '</div>';

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
    headerRange.setBackground("#4c1d95");
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
