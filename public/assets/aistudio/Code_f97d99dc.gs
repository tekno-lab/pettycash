/**
 * Petty cash back end for the expense app.
 * Paste this whole file into Extensions > Apps Script of the Google Sheet,
 * run setup() once, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone).
 */
var NOTIFY_DEFAULT = "bawar.yaseen@pulkcompany.com";
var S = { setup: "Setup", recv: "Received", paid: "Paid to user", exp: "Expenses", audit: "Audit", sum: "Summary", cat: "By category" };
var EXP_HEAD = ["ID", "Date", "Voucher", "Category", "Amount", "Description", "Note", "Receipt", "Pages", "By", "Submitted at", "Status", "Deletion reason", "Decided at"];

/* ---------------- one-time setup ---------------- */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var get = function (n) { return ss.getSheetByName(n) || ss.insertSheet(n); };

  var st = get(S.setup);
  if (!String(st.getRange("B6").getValue() || "")) {      // first run only: keep existing keys when re-run
    st.getRange("A1").setValue("Petty cash settings").setFontWeight("bold").setFontSize(14);
    st.getRange(3, 1, 6, 2).setValues([
      ["Currency", "IQD"],
      ["Categories (comma separated)", "Tarik,Pulk,Midea"],
      ["Email receipts to", NOTIFY_DEFAULT],
      ["Manager key", key_()],
      ["Expense user key", key_()],
      ["Receipts folder ID", DriveApp.createFolder("Petty Cash Receipts").getId()]
    ]);
    st.getRange("A10").setValue("Keep this sheet private. The two keys act like passwords. Never share the manager key.");
    st.setColumnWidth(1, 220); st.setColumnWidth(2, 420);
  }

  head_(get(S.recv), ["ID", "Date", "Amount", "From / note", "By", "At"], 2);
  head_(get(S.paid), ["ID", "Date", "Amount", "Note", "By", "At"], 2);
  var ex = head_(get(S.exp), EXP_HEAD, 2);
  ["A2:A", "C2:C", "F2:G", "J2:J", "M2:M"].forEach(function (a) { ex.getRange(a).setNumberFormat("@"); });   // plain text: stops formulas and keeps leading zeros
  ex.getRange("K2:K").setNumberFormat("yyyy-mm-dd hh:mm"); ex.getRange("N2:N").setNumberFormat("yyyy-mm-dd hh:mm");
  ex.getRange("L2:L").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["Active", "Deletion requested", "Deleted"], true).build());
  var au = head_(get(S.audit), ["At", "Who", "Action", "Entry ID", "Detail"], 0);
  au.getRange("A2:A").setNumberFormat("yyyy-mm-dd hh:mm:ss");

  var sm = get(S.sum);
  sm.getRange("A1").setValue("Petty cash summary").setFontWeight("bold").setFontSize(14);
  sm.getRange(3, 1, 7, 2).setValues([
    ["Received from the company", "=SUM('Received'!C2:C)"],
    ["Paid to the user (net)", "=SUM('Paid to user'!C2:C)"],
    ["Cash left with the manager", "=B3-B4"],
    ["Spent by the user (entries awaiting deletion still count)", "=SUMIFS(Expenses!E2:E,Expenses!L2:L,\"<>Deleted\")"],
    ["Balance held by the user", "=B4-B6"],
    ["", ""],
    ["Deletion requests waiting", "=COUNTIF(Expenses!L2:L,\"Deletion requested\")"]
  ]);
  sm.getRange("A5:B5").setFontWeight("bold"); sm.getRange("A7:B7").setFontWeight("bold");
  sm.setColumnWidth(1, 360); sm.setColumnWidth(2, 140);

  var cats = cfg_().categories, ct = get(S.cat);
  ct.clear();
  ct.getRange("A1").setValue("Spending by category (deleted entries excluded)").setFontWeight("bold").setFontSize(14);
  ct.getRange(3, 1, 1, 3).setValues([["Category", "Entries", "Total"]]).setFontWeight("bold");
  cats.forEach(function (c, i) {
    var r = 4 + i;
    ct.getRange(r, 1).setValue(c);
    ct.getRange(r, 2).setFormula("=COUNTIFS(Expenses!$D$2:$D,A" + r + ",Expenses!$L$2:$L,\"<>Deleted\")");
    ct.getRange(r, 3).setFormula("=SUMIFS(Expenses!$E$2:$E,Expenses!$D$2:$D,A" + r + ",Expenses!$L$2:$L,\"<>Deleted\")");
  });
  var top = 6 + cats.length;
  ct.getRange(top, 1).setValue("By month").setFontWeight("bold");
  ct.getRange(top + 1, 1).setValue("Month starting").setFontWeight("bold");
  cats.forEach(function (c, j) { ct.getRange(top + 1, 2 + j).setValue(c).setFontWeight("bold"); });
  ct.getRange(top + 1, 2 + cats.length).setValue("Total").setFontWeight("bold");
  for (var m = 0; m < 12; m++) {
    var r2 = top + 2 + m;
    ct.getRange(r2, 1).setFormula(m === 0 ? "=DATE(YEAR(TODAY()),1,1)" : "=EDATE(A" + (r2 - 1) + ",1)").setNumberFormat("yyyy-mm");
    cats.forEach(function (c, j) {
      var col = String.fromCharCode(66 + j);
      ct.getRange(r2, 2 + j).setFormula("=SUMIFS(Expenses!$E$2:$E,Expenses!$D$2:$D," + col + "$" + (top + 1) + ",Expenses!$B$2:$B,\">=\"&$A" + r2 + ",Expenses!$B$2:$B,\"<\"&EDATE($A" + r2 + ",1),Expenses!$L$2:$L,\"<>Deleted\")");
    });
    var last = String.fromCharCode(65 + cats.length);
    ct.getRange(r2, 2 + cats.length).setFormula("=SUM(B" + r2 + ":" + last + r2 + ")");
  }
  ct.setColumnWidth(1, 150);

  var d = ss.getSheetByName("Sheet1");
  if (d && ss.getSheets().length > 1 && d.getLastRow() === 0) ss.deleteSheet(d);
  MailApp.getRemainingDailyQuota();      // makes Google ask for mail permission now, not later
  ss.toast("Setup done. The two access keys are on the Setup sheet.", "Petty cash", 10);
}

function head_(sh, headers, dateCol) {
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#0b6b4f").setFontColor("#ffffff");
    sh.setFrozenRows(1);
  }
  if (dateCol) sh.getRange(2, dateCol, 4999, 1).setNumberFormat("yyyy-mm-dd");
  return sh;
}

/* ---------------- web app ---------------- */
function doGet() { return json_({ ok: true, service: "petty cash" }); }

function doPost(e) {
  var out;
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var c = cfg_(), role = null;
    if (req.key && req.key === c.managerKey) role = "manager";
    else if (req.key && req.key === c.userKey) role = "user";
    if (!role) return json_({ ok: false, error: "Wrong access key." });
    var h = HANDLERS[req.action];
    if (!h) return json_({ ok: false, error: "Unknown action." });
    if (h.roles.indexOf(role) < 0) return json_({ ok: false, error: "This account isn't allowed to do that." });
    out = h.write ? locked_(function () { return h.fn(req, role); }) : h.fn(req, role);
  } catch (err) { out = { ok: false, error: String((err && err.message) || err) }; }
  return json_(out);
}

var HANDLERS = {
  state: { roles: ["manager", "user"], write: false, fn: state_ },
  addExpense: { roles: ["user"], write: true, fn: addExpense_ },
  requestDelete: { roles: ["user"], write: true, fn: requestDelete_ },
  decideDelete: { roles: ["manager"], write: true, fn: decideDelete_ },
  addCash: { roles: ["manager"], write: true, fn: addCash_ },
  keys: { roles: ["manager"], write: false, fn: function () { return { ok: true, userKey: cfg_().userKey }; } },
  rotateUserKey: { roles: ["manager"], write: true, fn: rotateUserKey_ }
};

function state_(q, role) {
  var c = cfg_();
  var res = {
    ok: true, role: role, currency: c.currency, categories: c.categories, at: new Date().toISOString(),
    paid: rows_(sh_("paid")).map(function (r, i) { return cash_(r, i, "p"); }),
    expenses: rows_(sh_("exp")).map(exp_)
  };
  if (role === "manager") res.received = rows_(sh_("recv")).map(function (r, i) { return cash_(r, i, "r"); });
  return res;
}

function addExpense_(q, role) {
  var c = cfg_(), d = String(q.date || ""), amount = Number(q.amount), cat = String(q.category || ""), voucher = String(q.voucher || "").trim(), id = String(q.id || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("Bad date.");
  if (!(amount > 0)) throw new Error("Bad amount.");
  if (c.categories.indexOf(cat) < 0) throw new Error("Unknown category.");
  if (!voucher) throw new Error("Voucher number is missing.");
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(id)) throw new Error("Bad entry id.");
  if (!q.file || !q.file.base64) throw new Error("A receipt is required.");
  var sh = sh_("exp"), hit = findRow_(sh, id);
  if (hit) return { ok: true, dup: true, url: String(sh.getRange(hit, 8).getValue() || "") };

  var name = d + "_" + cat + "-" + clean_(voucher) + "_" + amount + "_" + id.slice(-5) + ".pdf";
  var blob = Utilities.newBlob(Utilities.base64Decode(q.file.base64), "application/pdf", name);
  var url = sub_(DriveApp.getFolderById(c.folderId), d.slice(0, 7)).createFile(blob).getUrl();
  var by = txt_(q.by || "User", 80);
  sh.appendRow([id, Utilities.parseDate(d, tz_(), "yyyy-MM-dd"), voucher, cat, amount, txt_(q.description, 500), txt_(q.note, 500), url, Number(q.pages) || 0, by, new Date(), "Active", "", ""]);
  log_(role, "expense added", id, cat + " " + voucher + " " + amount);

  var emailed = false;
  try {
    MailApp.sendEmail({
      to: c.notify,
      subject: "Expense " + cat + " #" + voucher + " - " + amount + " " + c.currency + " - " + d,
      body: ["Category: " + cat, "Voucher: " + voucher, "Amount: " + amount + " " + c.currency, "Date: " + d, "Description: " + txt_(q.description, 500),
        "Note: " + txt_(q.note, 500), "Submitted by: " + by, "Entry ID: " + id, "Receipt in Drive: " + url].join("\n"),
      attachments: [blob]
    });
    emailed = true;
  } catch (err) { log_(role, "email failed", id, String(err)); }
  return { ok: true, url: url, emailed: emailed };
}

function requestDelete_(q, role) {
  var reason = txt_(q.reason, 300);
  if (reason.length < 2) throw new Error("Please give a short reason.");
  var sh = sh_("exp"), r = findRow_(sh, String(q.id || ""));
  if (!r) throw new Error("Entry not found.");
  var st = String(sh.getRange(r, 12).getValue() || "Active");
  if (st !== "Active") return { ok: true, status: st };
  sh.getRange(r, 12, 1, 3).setValues([["Deletion requested", reason, ""]]);
  log_(role, "deletion requested", q.id, reason);
  return { ok: true, status: "Deletion requested" };
}

function decideDelete_(q, role) {
  var sh = sh_("exp"), r = findRow_(sh, String(q.id || ""));
  if (!r) throw new Error("Entry not found.");
  var st = String(sh.getRange(r, 12).getValue() || "Active");
  if (st !== "Deletion requested") throw new Error("This entry has no pending deletion request.");
  if (q.approve) sh.getRange(r, 12).setValue("Deleted"), sh.getRange(r, 14).setValue(new Date());
  else sh.getRange(r, 12, 1, 3).setValues([["Active", "", new Date()]]);
  log_(role, q.approve ? "deletion approved" : "deletion rejected", q.id, "");
  return { ok: true, status: q.approve ? "Deleted" : "Active" };
}

function addCash_(q, role) {
  var d = String(q.date || ""), amount = Number(q.amount), type = String(q.type || ""), id = String(q.id || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("Bad date.");
  if (!(amount > 0)) throw new Error("Bad amount.");
  if (["recv", "paid", "back"].indexOf(type) < 0) throw new Error("Unknown cash type.");
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(id)) throw new Error("Bad entry id.");
  var sh = sh_(type === "recv" ? "recv" : "paid");
  if (findRow_(sh, id)) return { ok: true, dup: true };
  sh.appendRow([id, Utilities.parseDate(d, tz_(), "yyyy-MM-dd"), type === "back" ? -amount : amount, txt_(q.note, 300), txt_(q.by || "Manager", 80), new Date()]);
  log_(role, type === "recv" ? "received from company" : type === "paid" ? "paid to user" : "taken back from user", id, amount + " " + d);
  return { ok: true };
}

function rotateUserKey_(q, role) {
  var k = key_();
  sh_("setup").getRange("B7").setValue(k);
  log_(role, "user key changed", "", "");
  return { ok: true, userKey: k };
}

/* ---------------- helpers ---------------- */
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function locked_(fn) { var l = LockService.getScriptLock(); l.waitLock(20000); try { return fn(); } finally { l.releaseLock(); } }
function sh_(k) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(S[k]); }
function tz_() { return SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(); }
function key_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ""); }
function txt_(v, n) { return String(v == null ? "" : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, n || 200); }
function clean_(s) { return String(s).replace(/[\\\/:*?"<>|#%\s]+/g, "-").slice(0, 40); }
function cfg_() {
  var v = sh_("setup").getRange("B3:B8").getValues().map(function (r) { return String(r[0]).trim(); });
  return { currency: v[0] || "IQD", categories: v[1].split(",").map(function (x) { return x.trim(); }).filter(String), notify: v[2], managerKey: v[3], userKey: v[4], folderId: v[5] };
}
function rows_(sh) {
  var n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, sh.getLastColumn()).getValues().filter(function (r) { return r.some(function (c) { return c !== ""; }); });
}
function findRow_(sh, id) {
  var n = sh.getLastRow(); if (n < 2) return 0;
  var ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return i + 2;
  return 0;
}
function sub_(parent, name) { var it = parent.getFoldersByName(name); return it.hasNext() ? it.next() : parent.createFolder(name); }
function log_(who, action, id, detail) { sh_("audit").appendRow([new Date(), who, action, String(id || ""), String(detail || "")]); }
function dstr_(v) { return v instanceof Date ? Utilities.formatDate(v, tz_(), "yyyy-MM-dd") : String(v == null ? "" : v).slice(0, 10); }
function tstr_(v) { return v instanceof Date ? v.toISOString() : String(v == null ? "" : v); }
function cash_(r, i, k) { return { id: String(r[0] || k + (i + 2)), date: dstr_(r[1]), amount: Number(r[2]) || 0, note: String(r[3] || ""), by: String(r[4] || ""), at: tstr_(r[5]) }; }
function exp_(r, i) {
  return { id: String(r[0] || "x" + (i + 2)), date: dstr_(r[1]), voucher: String(r[2]), category: String(r[3]), amount: Number(r[4]) || 0, description: String(r[5] || ""), note: String(r[6] || ""),
    webUrl: String(r[7] || ""), pages: Number(r[8]) || 0, by: String(r[9] || ""), at: tstr_(r[10]), status: String(r[11] || "Active"), reason: String(r[12] || "") };
}
