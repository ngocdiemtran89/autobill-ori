/**
 * ============================================================
 *  ORI ACADEMY — BOT TELEGRAM CẢNH BÁO HỌC VIÊN
 * ============================================================
 *  Gắn vào file Google Sheet "ORI_QuanLy_HocVien".
 *
 *  CÀI ĐẶT (làm 1 lần):
 *   1. Mở file trên Google Sheets ▸ Extensions ▸ Apps Script.
 *   2. Dán toàn bộ file này, thay BOT_TOKEN và CHAT_ID bên dưới.
 *   3. Chạy hàm  kiemTraKetNoi()  ▸ cấp quyền ▸ kiểm tra Telegram nhận được tin test.
 *   4. Chạy hàm  caiDatTrigger()  1 lần để bật 2 lịch tự động.
 *
 *  BOT GỬI 2 LOẠI TIN:
 *   • TỨC THÌ  — ai chạm đúng 2 buổi vắng trong tháng → nhắn ngay (mỗi HV chỉ 1 lần).
 *   • THỨ 2, 8h — 1 tin gồm 3 danh sách: rủi ro CAO / sắp hết hạn ≤30 ngày / vắng ≥2.
 *                 KHÔNG có gì để báo thì bot IM LẶNG.
 * ============================================================
 */

// ====================== CẤU HÌNH ============================
var BOT_TOKEN = "DAN_TOKEN_BOT_VAO_DAY";   // lấy từ @BotFather
var CHAT_ID   = "DAN_CHAT_ID_VAO_DAY";     // ID nhóm/cá nhân nhận tin (lấy từ @userinfobot)

var SHEET_HV  = "HỌC VIÊN";
var SHEET_LOG = "LOG VẮNG";

// Vị trí cột trong sheet HỌC VIÊN (1 = A). Đổi nếu bạn chèn thêm cột.
var HV = { start: 4, ma: 1, ten: 2, sdt: 3, trangThai: 14, vang: 15, ngayConLai: 17, mucRuiRo: 19 };
// Vị trí cột trong LOG VẮNG (do Google Form tạo): C = ngày buổi học, D = học viên vắng
var LOG = { ngay: 3, hocVienVang: 4 };
// ===========================================================


/** Gửi 1 tin nhắn Telegram (Markdown). */
function guiTelegram(text) {
  if (BOT_TOKEN.indexOf("DAN_") === 0 || CHAT_ID.indexOf("DAN_") === 0) {
    throw new Error("Chưa điền BOT_TOKEN / CHAT_ID trong phần CẤU HÌNH.");
  }
  var url = "https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage";
  var res = UrlFetchApp.fetch(url, {
    method: "post",
    muteHttpExceptions: true,
    payload: { chat_id: CHAT_ID, text: text, parse_mode: "Markdown", disable_web_page_preview: "true" }
  });
  var code = res.getResponseCode();
  if (code !== 200) Logger.log("Lỗi Telegram " + code + ": " + res.getContentText());
  return code;
}

/** Test kết nối — chạy tay 1 lần sau khi điền token. */
function kiemTraKetNoi() {
  var n = guiTelegram("✅ *ORI Bot đã kết nối thành công!*\nTừ giờ tôi sẽ canh học viên có nguy cơ nghỉ giúp bạn.");
  SpreadsheetApp.getActive().toast(n === 200 ? "Đã gửi tin test — kiểm tra Telegram." : "Lỗi, xem Logs.", "ORI Bot");
}

/** Cài 2 trigger tự động — chạy tay 1 lần. */
function caiDatTrigger() {
  var ss = SpreadsheetApp.getActive();
  // xóa trigger cũ để tránh trùng
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === "baoCaoThuHai" || f === "kiemTraVangTucThi") ScriptApp.deleteTrigger(t);
  });
  // 1) Báo cáo sáng thứ 2, 8h
  ScriptApp.newTrigger("baoCaoThuHai").timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).nearMinute(0).create();
  // 2) Cảnh báo tức thì khi có phản hồi Form
  ScriptApp.newTrigger("kiemTraVangTucThi").forSpreadsheet(ss).onFormSubmit().create();
  ss.toast("Đã bật: báo cáo T2 8h + cảnh báo vắng tức thì.", "ORI Bot", 6);
}


/** Đọc HỌC VIÊN → map { MÃ: {ten, sdt} }. */
function docMapHocVien() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_HV);
  var last = sh.getLastRow();
  var map = {};
  if (last < HV.start) return map;
  var rows = sh.getRange(HV.start, 1, last - HV.start + 1, HV.mucRuiRo).getValues();
  rows.forEach(function (r) {
    var ma = String(r[HV.ma - 1]).trim();
    var ten = String(r[HV.ten - 1]).trim();
    if (ma && ten) map[ma] = { ten: ten, sdt: String(r[HV.sdt - 1]).trim() };
  });
  return map;
}

/** Đếm số buổi vắng THÁNG NÀY của 1 mã HV (đọc trực tiếp LOG VẮNG). */
function demVangThangNay(ma) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_LOG);
  if (!sh) return 0;
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var data = sh.getRange(2, 1, last - 1, LOG.hocVienVang).getValues();
  var now = new Date(), thang = now.getMonth(), nam = now.getFullYear();
  var dem = 0;
  data.forEach(function (r) {
    var ngay = r[LOG.ngay - 1];
    var ds = String(r[LOG.hocVienVang - 1]);
    if (ngay instanceof Date && ngay.getMonth() === thang && ngay.getFullYear() === nam
        && ds.indexOf(ma) !== -1) dem++;
  });
  return dem;
}

/** TỨC THÌ: chạy mỗi khi giáo viên gửi Form điểm danh. */
function kiemTraVangTucThi(e) {
  var text = "";
  try {
    // lấy đúng ô "Học viên vắng" từ phản hồi
    if (e && e.namedValues) {
      Object.keys(e.namedValues).forEach(function (k) {
        if (k.indexOf("vắng") !== -1 || k.toLowerCase().indexOf("vang") !== -1) text += " " + e.namedValues[k].join(" ");
      });
    }
    if (!text && e && e.values) text = e.values.join(" ");
  } catch (err) { text = ""; }

  var codes = (text.match(/ORI\d{3}/g) || []);
  if (!codes.length) return;
  var uniq = codes.filter(function (v, i) { return codes.indexOf(v) === i; });
  var map = docMapHocVien();

  uniq.forEach(function (ma) {
    var soVang = demVangThangNay(ma);
    if (soVang === 2) {           // đúng 2 → bắn 1 lần duy nhất
      var hv = map[ma] || { ten: ma, sdt: "" };
      guiTelegram(
        "⚠️ *CẢNH BÁO VẮNG* — mốc 2 buổi/tháng\n" +
        "👤 " + hv.ten + "  (`" + ma + "`)\n" +
        (hv.sdt ? "📞 " + hv.sdt + "\n" : "") +
        "📉 Đã vắng *2 buổi* tháng này. Gọi hỏi thăm ngay trước khi thành thói quen."
      );
    }
  });
}

/** THỨ 2 8h: 1 tin gồm 3 danh sách; im lặng nếu rỗng. */
function baoCaoThuHai() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_HV);
  var last = sh.getLastRow();
  if (last < HV.start) return;
  var rows = sh.getRange(HV.start, 1, last - HV.start + 1, HV.mucRuiRo).getValues();

  var cao = [], hetHan = [], vang = [];
  rows.forEach(function (r) {
    var ten = String(r[HV.ten - 1]).trim();
    if (!ten) return;
    var sdt  = String(r[HV.sdt - 1]).trim();
    var tt   = String(r[HV.trangThai - 1]).trim();
    var sv   = Number(r[HV.vang - 1]) || 0;
    var conl = r[HV.ngayConLai - 1];
    var rui  = String(r[HV.mucRuiRo - 1]).trim();
    var nhan = ten + (sdt ? " (" + sdt + ")" : "");

    if (rui === "CAO") cao.push("• " + nhan);
    if (tt === "Đang học" && conl !== "" && !isNaN(conl) && conl >= 0 && conl <= 30)
      hetHan.push("• " + nhan + " — còn " + Math.round(conl) + " ngày");
    if (sv >= 2) vang.push("• " + nhan + " — vắng " + sv + " buổi");
  });

  if (!cao.length && !hetHan.length && !vang.length) return;   // IM LẶNG

  var msg = "☕ *BÁO CÁO ĐẦU TUẦN — ORI ACADEMY*\n";
  if (cao.length)    msg += "\n🔴 *RỦI RO CAO (" + cao.length + ") — gọi hôm nay:*\n" + cao.join("\n") + "\n";
  if (hetHan.length) msg += "\n⏰ *SẮP HẾT HẠN ≤30 NGÀY (" + hetHan.length + ") — mời tái ký:*\n" + hetHan.join("\n") + "\n";
  if (vang.length)   msg += "\n📉 *VẮNG NHIỀU ≥2 BUỔI (" + vang.length + "):*\n" + vang.join("\n") + "\n";
  msg += "\n_Nguồn: file quản lý học viên. Cập nhật realtime._";
  guiTelegram(msg);
}
