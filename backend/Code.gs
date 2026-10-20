/**
 * Petty Cash Management System - Google Apps Script Backend
 * 
 * Instructions:
 * 1. Open your Google Sheet ("Petty Cash")
 * 2. Extensions > Apps Script
 * 3. Replace all code with this file and save.
 * 4. Select "setup" function and click Run. Grant permissions.
 * 5. Deploy > New deployment > Web app:
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy the Web app URL and use it in the app settings.
 */

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Setup Sheet
  let setupSheet = ss.getSheetByName("Setup");
  if (!setupSheet) {
    setupSheet = ss.insertSheet("Setup");
    setupSheet.appendRow(["Setting", "Value", "Description"]);
    setupSheet.appendRow(["Currency", "IQD", "Currency code (e.g. IQD, USD, EUR)"]);
    setupSheet.appendRow(["Categories", "Tarik, Pulk, Midea", "Comma-separated expense categories"]);
    setupSheet.appendRow(["ReceiptEmail", Session.getActiveUser().getEmail(), "Email address to receive receipt copies"]);
    setupSheet.appendRow(["DriveFolderId", "", "Google Drive folder ID for receipts"]);
    setupSheet.appendRow(["ManagerKey", Utilities.getUuid(), "Secret access key for Manager"]);
    setupSheet.appendRow(["UserKey", Utilities.getUuid().slice(0, 12), "Access key for Expense User"]);
    setupSheet.getRange("A1:C1").setFontWeight("bold").setBackground("#dff1e8");
    setupSheet.autoResizeColumns(1, 3);
  }

  // 2. Drive Folder
  const folderName = "Petty Cash Receipts";
  const existingFolders = DriveApp.getFoldersByName(folderName);
  let folder;
  if (existingFolders.hasNext()) {
    folder = existingFolders.next();
  } else {
    folder = DriveApp.createFolder(folderName);
  }
  
  // Update DriveFolderId in Setup
  const data = setupSheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === "DriveFolderId") {
      setupSheet.getRange(i + 1, 2).setValue(folder.getId());
      break;
    }
  }

  // 3. Received Sheet (Company -> Manager)
  let recvSheet = ss.getSheetByName("Received");
  if (!recvSheet) {
    recvSheet = ss.insertSheet("Received");
    recvSheet.appendRow(["ID", "Date", "Amount", "Note", "Recorded By", "Timestamp"]);
    recvSheet.getRange("A1:F1").setFontWeight("bold").setBackground("#dff1e8");
    recvSheet.autoResizeColumns(1, 6);
  }

  // 4. Paid Sheet (Manager <-> User)
  let paidSheet = ss.getSheetByName("Paid");
  if (!paidSheet) {
    paidSheet = ss.insertSheet("Paid");
    paidSheet.appendRow(["ID", "Date", "Amount", "Note", "Recorded By", "Timestamp"]);
    paidSheet.getRange("A1:F1").setFontWeight("bold").setBackground("#dff1e8");
    paidSheet.autoResizeColumns(1, 6);
  }

  // 5. Expenses Sheet
  let expSheet = ss.getSheetByName("Expenses");
  if (!expSheet) {
    expSheet = ss.insertSheet("Expenses");
    expSheet.appendRow(["ID", "Date", "Voucher", "Category", "Amount", "Description", "Note", "Pages", "Receipt URL", "Recorded By", "Status", "Delete Reason", "Timestamp"]);
    expSheet.getRange("A1:M1").setFontWeight("bold").setBackground("#dff1e8");
    expSheet.autoResizeColumns(1, 13);
  }

  // Remove default Sheet1 if empty
  const sheet1 = ss.getSheetByName("Sheet1");
  if (sheet1 && ss.getSheets().length > 1) {
    try { ss.deleteSheet(sheet1); } catch (e) {}
  }
}

function getSettings_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Setup");
  const rows = sheet.getDataRange().getValues();
  const config = {};
  for (let i = 1; i < rows.length; i++) {
    config[String(rows[i][0]).trim()] = String(rows[i][1]).trim();
  }
  return config;
}

function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    const req = JSON.parse(raw);
    const key = req.key;
    const action = req.action;

    const config = getSettings_();
    let role = "";
    if (key && key === config.ManagerKey) {
      role = "manager";
    } else if (key && key === config.UserKey) {
      role = "user";
    } else {
      return jsonResponse_({ ok: false, error: "Wrong access key. Check settings." });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "state") {
      const cats = (config.Categories || "Tarik, Pulk, Midea").split(",").map(s => s.trim()).filter(Boolean);
      const cur = config.Currency || "IQD";

      // Read Received
      const recvSheet = ss.getSheetByName("Received");
      const recvData = recvSheet ? recvSheet.getDataRange().getValues() : [];
      const received = [];
      for (let i = 1; i < recvData.length; i++) {
        if (!recvData[i][0]) continue;
        received.push({
          id: recvData[i][0],
          date: String(recvData[i][1]).slice(0, 10),
          amount: Number(recvData[i][2]) || 0,
          note: recvData[i][3] || "",
          at: recvData[i][5] || ""
        });
      }

      // Read Paid
      const paidSheet = ss.getSheetByName("Paid");
      const paidData = paidSheet ? paidSheet.getDataRange().getValues() : [];
      const paid = [];
      for (let i = 1; i < paidData.length; i++) {
        if (!paidData[i][0]) continue;
        paid.push({
          id: paidData[i][0],
          date: String(paidData[i][1]).slice(0, 10),
          amount: Number(paidData[i][2]) || 0,
          note: paidData[i][3] || "",
          at: paidData[i][5] || ""
        });
      }

      // Read Expenses
      const expSheet = ss.getSheetByName("Expenses");
      const expData = expSheet ? expSheet.getDataRange().getValues() : [];
      const expenses = [];
      for (let i = 1; i < expData.length; i++) {
        if (!expData[i][0]) continue;
        expenses.push({
          id: expData[i][0],
          date: String(expData[i][1]).slice(0, 10),
          voucher: String(expData[i][2] || ""),
          category: String(expData[i][3] || ""),
          amount: Number(expData[i][4]) || 0,
          description: String(expData[i][5] || ""),
          note: String(expData[i][6] || ""),
          pages: Number(expData[i][7]) || 1,
          webUrl: String(expData[i][8] || ""),
          by: String(expData[i][9] || ""),
          status: String(expData[i][10] || "Active"),
          reason: String(expData[i][11] || ""),
          at: String(expData[i][12] || "")
        });
      }

      return jsonResponse_({
        ok: true,
        role: role,
        currency: cur,
        categories: cats,
        received: received,
        paid: paid,
        expenses: expenses
      });
    }

    if (action === "addExpense") {
      let fileUrl = "";
      if (req.file && req.file.base64) {
        const folderId = config.DriveFolderId;
        const folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
        const bytes = Utilities.base64Decode(req.file.base64);
        const fileName = `${req.date || "expense"}_${req.voucher || "voucher"}_${req.category || "cat"}.pdf`;
        const blob = Utilities.newBlob(bytes, "application/pdf", fileName);
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        fileUrl = file.getUrl();

        // Optional email
        if (config.ReceiptEmail) {
          try {
            MailApp.sendEmail({
              to: config.ReceiptEmail,
              subject: `[Petty Cash] ${req.category} Voucher ${req.voucher} (${req.amount} ${config.Currency || "IQD"})`,
              body: `New petty cash expense submitted:\n\nCategory: ${req.category}\nVoucher: ${req.voucher}\nAmount: ${req.amount} ${config.Currency || "IQD"}\nDate: ${req.date}\nDescription: ${req.description}\nNote: ${req.note || "None"}\nBy: ${req.by}\nReceipt: ${fileUrl}`,
              attachments: [blob]
            });
          } catch (mailErr) {
            console.warn("Mail sending failed:", mailErr);
          }
        }
      }

      const expSheet = ss.getSheetByName("Expenses");
      const now = new Date().toISOString();
      expSheet.appendRow([
        req.id,
        req.date,
        req.voucher,
        req.category,
        req.amount,
        req.description,
        req.note || "",
        req.pages || 1,
        fileUrl,
        req.by || "User",
        "Active",
        "",
        now
      ]);

      return jsonResponse_({ ok: true, url: fileUrl, emailed: true });
    }

    if (action === "addCash") {
      if (role !== "manager") {
        return jsonResponse_({ ok: false, error: "Only the manager can record cash." });
      }

      const now = new Date().toISOString();
      const type = req.type; // "recv", "paid", "back"
      const amt = Number(req.amount) || 0;

      if (type === "recv") {
        const recvSheet = ss.getSheetByName("Received");
        recvSheet.appendRow([req.id, req.date, amt, req.note || "", req.by || "Manager", now]);
      } else if (type === "paid") {
        const paidSheet = ss.getSheetByName("Paid");
        paidSheet.appendRow([req.id, req.date, amt, req.note || "", req.by || "Manager", now]);
      } else if (type === "back") {
        const paidSheet = ss.getSheetByName("Paid");
        paidSheet.appendRow([req.id, req.date, -amt, (req.note ? req.note + " (Taken back)" : "Taken back"), req.by || "Manager", now]);
      }

      return jsonResponse_({ ok: true });
    }

    if (action === "requestDelete") {
      const expSheet = ss.getSheetByName("Expenses");
      const rows = expSheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === req.id) {
          expSheet.getRange(i + 1, 11).setValue("Deletion requested");
          expSheet.getRange(i + 1, 12).setValue(req.reason || "");
          return jsonResponse_({ ok: true });
        }
      }
      return jsonResponse_({ ok: false, error: "Expense not found" });
    }

    if (action === "decideDelete") {
      if (role !== "manager") {
        return jsonResponse_({ ok: false, error: "Only the manager can decide deletions." });
      }
      const expSheet = ss.getSheetByName("Expenses");
      const rows = expSheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === req.id) {
          expSheet.getRange(i + 1, 11).setValue(req.approve ? "Deleted" : "Active");
          return jsonResponse_({ ok: true });
        }
      }
      return jsonResponse_({ ok: false, error: "Expense not found" });
    }

    if (action === "keys") {
      if (role !== "manager") {
        return jsonResponse_({ ok: false, error: "Only the manager can view keys." });
      }
      return jsonResponse_({ ok: true, userKey: config.UserKey });
    }

    if (action === "rotateUserKey") {
      if (role !== "manager") {
        return jsonResponse_({ ok: false, error: "Only the manager can rotate keys." });
      }
      const newKey = Utilities.getUuid().slice(0, 12);
      const setupSheet = ss.getSheetByName("Setup");
      const rows = setupSheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === "UserKey") {
          setupSheet.getRange(i + 1, 2).setValue(newKey);
          break;
        }
      }
      return jsonResponse_({ ok: true, userKey: newKey });
    }

    return jsonResponse_({ ok: false, error: "Unknown action" });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.toString() });
  }
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
