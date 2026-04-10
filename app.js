// ==========================================
// ORI ACADEMY - INVOICE IMAGE GENERATOR
// With Autofill from Google Sheet
// ==========================================

// Google Sheet ID (from user's actual sheet)
const SHEET_ID = '19hkkfwrK0elsf6p0WGpyesbA-lexQqHI81nPXkq4GAg';

// Student database (loaded from sheet or paste)
let studentDB = [];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  // Set today's date
  const today = new Date();
  document.getElementById('invoiceDate').value = today.toISOString().split('T')[0];

  // Auto-generate invoice number
  generateInvoiceNumber();

  // Load saved center info from localStorage
  loadCenterInfo();

  // Auto-save center info on change
  ['centerName', 'centerPhone', 'centerEmail', 'centerAddress'].forEach(id => {
    document.getElementById(id).addEventListener('blur', saveCenterInfo);
  });

  // CCCD validation
  const cccdInput = document.getElementById('studentCCCD');
  cccdInput.addEventListener('input', () => {
    validateCCCD(cccdInput);
  });

  // Phone autofill
  const phoneInput = document.getElementById('studentPhone');
  phoneInput.addEventListener('input', () => onPhoneInput(phoneInput));
  phoneInput.addEventListener('focus', () => onPhoneInput(phoneInput));
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.phone-input-wrapper')) {
      document.getElementById('phoneSuggestions').style.display = 'none';
    }
  });

  // Auto-scale preview
  updatePreviewScale();
  window.addEventListener('resize', updatePreviewScale);

  // Try auto-load from Google Sheet
  loadFromGoogleSheet();
});

function updatePreviewScale() {
  const wrapper = document.getElementById('invoicePreviewWrapper');
  if (!wrapper) return;
  const availableWidth = wrapper.clientWidth - 40;
  const scale = Math.min(1, availableWidth / 800);
  document.getElementById('invoicePreview').style.setProperty('--preview-scale', scale);
}

// ===== LOAD DATA FROM GOOGLE SHEET =====
async function loadFromGoogleSheet() {
  const btn = document.getElementById('btnLoadSheet');
  const status = document.getElementById('dataStatus');
  btn.classList.add('loading');
  btn.innerHTML = '<span>⏳</span> Đang tải...';
  status.textContent = 'Đang tải...';
  status.className = 'data-status';

  try {
    // Load ChoHoc sheet
    const choHocData = await fetchSheetData('ChoHoc');
    // Load HocVien sheet
    const hocVienData = await fetchSheetData('HocVien');

    // Merge data — prioritize HocVien, fallback ChoHoc
    studentDB = [];
    const phoneSet = new Set();

    // Add HocVien data first
    if (hocVienData.length > 0) {
      hocVienData.forEach(row => {
        const phone = normalizePhone(row['SĐT'] || row['SDT'] || '');
        if (phone) {
          phoneSet.add(phone);
          studentDB.push({
            phone,
            name: row['Họ Tên'] || row['Ho Ten'] || '',
            cccd: row['CCCD'] || '',
            email: row['Email'] || '',
            source: 'HocVien',
            nhuCau: '',
            phanLoai: row['Phân loại'] || row['Phan loai'] || '',
          });
        }
      });
    }

    // Add ChoHoc data (if phone not already from HocVien)
    if (choHocData.length > 0) {
      choHocData.forEach(row => {
        const phone = normalizePhone(row['SĐT'] || row['SDT'] || '');
        if (phone && !phoneSet.has(phone)) {
          phoneSet.add(phone);
          studentDB.push({
            phone,
            name: row['Họ Tên'] || row['Ho Ten'] || '',
            cccd: row['CCCD'] || '',
            email: row['Email'] || '',
            source: 'ChoHoc',
            nhuCau: row['Nhu cầu'] || row['Nhu cau'] || '',
            phanLoai: row['Phân loại'] || row['Phan loai'] || '',
          });
        }
      });
    }

    if (studentDB.length > 0) {
      status.textContent = `✅ ${studentDB.length} học viên`;
      status.className = 'data-status loaded';
      document.getElementById('autofillBadge').style.display = 'inline';
      showDataPreview();
      showToast(`✅ Đã tải ${studentDB.length} học viên từ Google Sheet`);
    } else {
      status.textContent = 'Không có dữ liệu';
      showToast('⚠️ Sheet không có dữ liệu hoặc chưa public. Thử "Dán từ Excel"', 'error');
    }
  } catch (err) {
    console.error('Load error:', err);
    status.textContent = 'Lỗi tải';
    showToast('⚠️ Không tải được. Hãy dùng "Dán từ Excel" thay thế.', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.innerHTML = '<span>📡</span> Tải từ Google Sheet';
  }
}

async function fetchSheetData(sheetName) {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&headers=1`;
    const res = await fetch(url);
    const text = await res.text();

    // Parse the JSONP-like response
    const jsonStr = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);?/);
    if (!jsonStr) return [];

    const json = JSON.parse(jsonStr[1]);
    let cols = json.table.cols.map(c => c.label || '');
    const rows = json.table.rows || [];

    if (rows.length === 0) return [];

    // If parsedNumHeaders is 0, the first row is actually the header
    const hasEmptyLabels = cols.every(c => !c);
    if (hasEmptyLabels && rows.length > 0) {
      // Use first row as headers
      cols = rows[0].c.map(cell => cell ? String(cell.v || '') : '');
      // Return remaining rows as data
      return rows.slice(1).map(row => {
        const obj = {};
        row.c.forEach((cell, i) => {
          if (cols[i]) {
            obj[cols[i]] = cell ? (cell.v != null ? String(cell.v) : '') : '';
          }
        });
        return obj;
      });
    }

    // Normal case: labels are populated
    return rows.map(row => {
      const obj = {};
      row.c.forEach((cell, i) => {
        if (cols[i]) {
          obj[cols[i]] = cell ? (cell.v != null ? String(cell.v) : '') : '';
        }
      });
      return obj;
    });
  } catch (e) {
    console.warn(`Failed to fetch ${sheetName}:`, e);
    return [];
  }
}

// ===== PASTE IMPORT =====
function togglePasteArea() {
  const area = document.getElementById('pasteArea');
  area.style.display = area.style.display === 'none' ? 'block' : 'none';
  if (area.style.display === 'block') {
    document.getElementById('pasteInput').focus();
  }
}

function importPastedData() {
  const raw = document.getElementById('pasteInput').value.trim();
  if (!raw) {
    showToast('⚠️ Chưa dán dữ liệu!', 'error');
    return;
  }

  const lines = raw.split('\n').map(l => l.split('\t'));
  if (lines.length < 2) {
    showToast('⚠️ Cần ít nhất 1 dòng header + 1 dòng dữ liệu', 'error');
    return;
  }

  const headers = lines[0].map(h => h.trim());
  const phoneCol = headers.findIndex(h => h.match(/SĐT|SDT|Điện thoại|Phone/i));
  const nameCol = headers.findIndex(h => h.match(/Họ Tên|Ho Ten|Tên|Name/i));
  const cccdCol = headers.findIndex(h => h.match(/CCCD/i));
  const emailCol = headers.findIndex(h => h.match(/Email/i));
  const nhuCauCol = headers.findIndex(h => h.match(/Nhu cầu|Nhu cau/i));

  if (phoneCol < 0 || nameCol < 0) {
    showToast('⚠️ Không tìm thấy cột "SĐT" hoặc "Họ Tên" trong header', 'error');
    return;
  }

  studentDB = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    const phone = normalizePhone(row[phoneCol] || '');
    const name = (row[nameCol] || '').trim();
    if (!phone && !name) continue;

    studentDB.push({
      phone,
      name,
      cccd: cccdCol >= 0 ? (row[cccdCol] || '').trim() : '',
      email: emailCol >= 0 ? (row[emailCol] || '').trim() : '',
      nhuCau: nhuCauCol >= 0 ? (row[nhuCauCol] || '').trim() : '',
      source: 'Paste',
    });
  }

  if (studentDB.length > 0) {
    const status = document.getElementById('dataStatus');
    status.textContent = `✅ ${studentDB.length} học viên`;
    status.className = 'data-status loaded';
    document.getElementById('autofillBadge').style.display = 'inline';
    document.getElementById('pasteArea').style.display = 'none';
    showDataPreview();
    showToast(`✅ Đã nhập ${studentDB.length} học viên từ dữ liệu dán`);
  } else {
    showToast('⚠️ Không tìm thấy dữ liệu hợp lệ', 'error');
  }
}

function showDataPreview() {
  const preview = document.getElementById('dataPreview');
  if (studentDB.length === 0) {
    preview.style.display = 'none';
    return;
  }

  const rows = studentDB.slice(0, 5).map(s =>
    `<tr><td>${s.phone}</td><td>${s.name}</td><td>${s.cccd || '—'}</td><td>${s.email || '—'}</td></tr>`
  ).join('');

  preview.innerHTML = `
    <table>
      <tr><th>SĐT</th><th>Họ Tên</th><th>CCCD</th><th>Email</th></tr>
      ${rows}
    </table>
    ${studentDB.length > 5 ? `<p style="margin-top:6px;opacity:0.6;">...và ${studentDB.length - 5} học viên khác</p>` : ''}
  `;
  preview.style.display = 'block';
}

// ===== PHONE AUTOFILL =====
function normalizePhone(phone) {
  return String(phone).replace(/[^\d]/g, '').replace(/^84/, '0');
}

function onPhoneInput(input) {
  const val = normalizePhone(input.value);
  const sugBox = document.getElementById('phoneSuggestions');

  if (!val || val.length < 3 || studentDB.length === 0) {
    sugBox.style.display = 'none';
    return;
  }

  // Search matches
  const matches = studentDB.filter(s => s.phone.includes(val));

  if (matches.length === 0) {
    sugBox.style.display = 'none';
    return;
  }

  // Exact match → auto-fill immediately
  if (matches.length === 1 && matches[0].phone === val) {
    fillStudentData(matches[0]);
    sugBox.style.display = 'none';
    return;
  }

  // Show suggestions
  sugBox.innerHTML = matches.slice(0, 8).map((s, i) => `
    <div class="suggestion-item" onclick="selectSuggestion(${i})" data-index="${i}">
      <div>
        <div class="suggestion-name">${escapeHtml(s.name)}</div>
        <div class="suggestion-meta">${s.nhuCau || s.phanLoai || s.source}</div>
      </div>
      <div class="suggestion-phone">${s.phone}</div>
    </div>
  `).join('');

  // Store matches for selection
  sugBox._matches = matches.slice(0, 8);
  sugBox.style.display = 'block';
}

function selectSuggestion(index) {
  const sugBox = document.getElementById('phoneSuggestions');
  const match = sugBox._matches[index];
  if (match) {
    document.getElementById('studentPhone').value = match.phone;
    fillStudentData(match);
    sugBox.style.display = 'none';
  }
}

function fillStudentData(student) {
  const fields = {
    studentName: student.name,
    studentCCCD: student.cccd,
    studentEmail: student.email,
  };

  Object.entries(fields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el && value) {
      el.value = value;
      el.classList.add('just-filled');
      setTimeout(() => el.classList.remove('just-filled'), 800);
    }
  });

  // Visual feedback on phone input
  const phoneInput = document.getElementById('studentPhone');
  phoneInput.classList.add('autofilled');
  setTimeout(() => phoneInput.classList.remove('autofilled'), 2000);

  showToast(`✅ Đã điền thông tin: ${student.name}`);
}

// ===== CCCD VALIDATION =====
function validateCCCD(input) {
  const val = input.value.trim();
  const errorEl = input.parentElement.querySelector('.cccd-error');

  // Create error element if not exists
  if (!errorEl) {
    const err = document.createElement('div');
    err.className = 'cccd-error';
    err.textContent = 'CCCD phải gồm đúng 12 chữ số';
    input.parentElement.appendChild(err);
  }

  const errDiv = input.parentElement.querySelector('.cccd-error');

  if (val === '') {
    input.classList.remove('invalid');
    errDiv.classList.remove('show');
    return true;
  }

  const isValid = /^\d{12}$/.test(val);
  if (!isValid) {
    input.classList.add('invalid');
    errDiv.classList.add('show');
  } else {
    input.classList.remove('invalid');
    errDiv.classList.remove('show');
  }
  return isValid;
}

// ===== FORMAT MONEY =====
function formatMoney(input) {
  let val = input.value.replace(/[^\d]/g, '');
  if (val) {
    input.value = Number(val).toLocaleString('vi-VN');
  }
}

function parseMoney(str) {
  if (!str) return 0;
  return parseInt(String(str).replace(/[^\d]/g, '')) || 0;
}

function formatVND(num) {
  if (!num || isNaN(num)) return '0';
  return Number(num).toLocaleString('vi-VN');
}

// ===== ITEM MANAGEMENT =====
function addItem() {
  const container = document.getElementById('itemsContainer');
  const index = container.children.length;
  const div = document.createElement('div');
  div.className = 'item-row';
  div.dataset.index = index;
  div.innerHTML = `
    <div class="form-grid">
      <div class="form-group" style="grid-column: 1 / -1;">
        <label>Nội dung</label>
        <input type="text" class="item-desc" placeholder="VD: Phí giáo trình">
      </div>
      <div class="form-group">
        <label>Số tiền (VNĐ)</label>
        <input type="text" class="item-amount" placeholder="500,000" oninput="formatMoney(this)">
      </div>
      <div class="form-group">
        <label>&nbsp;</label>
        <button class="btn-remove-item" onclick="removeItem(this)" title="Xóa dòng">✕</button>
      </div>
    </div>
  `;
  container.appendChild(div);
  // Focus new input
  div.querySelector('.item-desc').focus();
}

function removeItem(btn) {
  const container = document.getElementById('itemsContainer');
  if (container.children.length <= 1) return; // Keep at least 1
  btn.closest('.item-row').remove();
}

// ===== NUMBER TO VIETNAMESE WORDS =====
function numberToWords(number) {
  if (!number || number === 0) return 'Không đồng';

  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const groups = ['', 'nghìn', 'triệu', 'tỷ'];

  number = Math.round(number);
  let result = '';
  let groupIndex = 0;

  while (number > 0) {
    const group = number % 1000;
    if (group > 0) {
      result = convertGroup(group, units) + ' ' + groups[groupIndex] + ' ' + result;
    }
    number = Math.floor(number / 1000);
    groupIndex++;
  }

  result = result.trim();
  return result.charAt(0).toUpperCase() + result.slice(1) + ' đồng';
}

function convertGroup(number, units) {
  const hundreds = Math.floor(number / 100);
  const tens = Math.floor((number % 100) / 10);
  const ones = number % 10;
  let result = '';

  if (hundreds > 0) result += units[hundreds] + ' trăm';

  if (tens > 0) {
    if (tens === 1) {
      result += ' mười';
    } else {
      result += ' ' + units[tens] + ' mươi';
    }
    if (ones === 1 && tens > 1) {
      result += ' mốt';
    } else if (ones === 5 && tens > 0) {
      result += ' lăm';
    } else if (ones > 0) {
      result += ' ' + units[ones];
    }
  } else if (ones > 0) {
    if (hundreds > 0) result += ' lẻ';
    result += ' ' + units[ones];
  }

  return result.trim();
}

// ===== FORMAT DATE =====
function formatDateVN(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// ===== COLLECT FORM DATA =====
function collectData() {
  // Items
  const items = [];
  document.querySelectorAll('.item-row').forEach(row => {
    const desc = row.querySelector('.item-desc').value.trim();
    const amount = parseMoney(row.querySelector('.item-amount').value);
    if (desc || amount) {
      items.push({ description: desc || 'Dịch vụ', amount });
    }
  });

  const subtotal = items.reduce((s, it) => s + it.amount, 0);
  const discount = parseMoney(document.getElementById('discount').value);
  const total = Math.max(0, subtotal - discount);

  return {
    center: {
      name: document.getElementById('centerName').value || 'ORI ACADEMY',
      phone: document.getElementById('centerPhone').value,
      email: document.getElementById('centerEmail').value,
      address: document.getElementById('centerAddress').value,
    },
    student: {
      name: document.getElementById('studentName').value || '',
      phone: document.getElementById('studentPhone').value || '',
      cccd: document.getElementById('studentCCCD').value || '',
      email: document.getElementById('studentEmail').value || '',
    },
    invoice: {
      number: document.getElementById('invoiceNumber').value || 'HD-0001',
      date: document.getElementById('invoiceDate').value,
      dateVN: formatDateVN(document.getElementById('invoiceDate').value),
      paymentMethod: document.getElementById('paymentMethod').value,
      note: document.getElementById('invoiceNote').value || '',
    },
    items,
    subtotal,
    discount,
    total,
    totalWords: numberToWords(total),
  };
}

// ===== BUILD INVOICE HTML =====
function buildInvoiceHTML(data) {
  const itemsHTML = data.items.map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(it.description)}</td>
      <td>${formatVND(it.amount)} đ</td>
      <td>${formatVND(it.amount)} đ</td>
    </tr>
  `).join('');

  const discountHTML = data.discount > 0 ? `
    <div class="inv-total-row">
      <span>Giảm giá:</span>
      <span>-${formatVND(data.discount)} đ</span>
    </div>
  ` : '';

  const noteHTML = data.invoice.note ? `
    <div class="inv-note">
      📝 <strong>Ghi chú:</strong> ${escapeHtml(data.invoice.note)}
    </div>
  ` : '';

  return `
    <div class="inv">
      <div class="inv-header">
        <div class="inv-company">
          <h1>🎓 ${escapeHtml(data.center.name)}</h1>
          ${data.center.address ? `<p>📍 ${escapeHtml(data.center.address)}</p>` : ''}
          ${data.center.phone ? `<p>📱 ${escapeHtml(data.center.phone)}</p>` : ''}
          ${data.center.email ? `<p>📧 ${escapeHtml(data.center.email)}</p>` : ''}
        </div>
        <div class="inv-title">
          <h2>HÓA ĐƠN</h2>
          <span class="inv-number">Số: ${escapeHtml(data.invoice.number)}</span>
        </div>
      </div>

      <div class="inv-body">
        <div class="inv-info-grid">
          <div class="inv-info-box">
            <h3>Thông tin học viên</h3>
            <div class="inv-info-row">
              <span class="inv-info-label">Họ tên:</span>
              <span class="inv-info-value">${escapeHtml(data.student.name) || '—'}</span>
            </div>
            <div class="inv-info-row">
              <span class="inv-info-label">SĐT:</span>
              <span class="inv-info-value">${escapeHtml(data.student.phone) || '—'}</span>
            </div>
            <div class="inv-info-row">
              <span class="inv-info-label">CCCD:</span>
              <span class="inv-info-value">${escapeHtml(data.student.cccd) || '—'}</span>
            </div>
            <div class="inv-info-row">
              <span class="inv-info-label">Email:</span>
              <span class="inv-info-value">${escapeHtml(data.student.email) || '—'}</span>
            </div>
          </div>
          <div class="inv-info-box">
            <h3>Thông tin hóa đơn</h3>
            <div class="inv-info-row">
              <span class="inv-info-label">Ngày xuất:</span>
              <span class="inv-info-value">${data.invoice.dateVN}</span>
            </div>
            <div class="inv-info-row">
              <span class="inv-info-label">Số HĐ:</span>
              <span class="inv-info-value">${escapeHtml(data.invoice.number)}</span>
            </div>
            <div class="inv-info-row">
              <span class="inv-info-label">Hình thức TT:</span>
              <span class="inv-info-value">${escapeHtml(data.invoice.paymentMethod)}</span>
            </div>
          </div>
        </div>

        <table class="inv-table">
          <thead>
            <tr>
              <th style="width:50px;">STT</th>
              <th>Nội dung</th>
              <th style="width:140px;">Đơn giá</th>
              <th style="width:140px;">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>

        <div class="inv-total-section">
          <div class="inv-total-box">
            <div class="inv-total-row">
              <span>Tạm tính:</span>
              <span>${formatVND(data.subtotal)} đ</span>
            </div>
            ${discountHTML}
            <div class="inv-total-row grand">
              <span>TỔNG CỘNG:</span>
              <span>${formatVND(data.total)} đ</span>
            </div>
          </div>
        </div>

        <div class="inv-words">
          <strong>Bằng chữ:</strong> ${escapeHtml(data.totalWords)}
        </div>

        ${noteHTML}

        <div class="inv-footer">
          <div class="inv-sig">
            <div class="sig-title">Người nộp tiền</div>
            <div class="sig-date">${data.invoice.dateVN}</div>
            <div class="sig-name">${escapeHtml(data.student.name) || '_______________'}</div>
          </div>
          <div class="inv-sig">
            <div class="sig-title">Người thu tiền</div>
            <div class="sig-date">${data.invoice.dateVN}</div>
            <div class="sig-name">${escapeHtml(data.center.name)}</div>
          </div>
        </div>
      </div>

      <div class="inv-watermark">
        ${escapeHtml(data.center.name)} • Hóa đơn được tạo tự động • ${data.invoice.dateVN}
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== RENDER PREVIEW =====
function renderPreview() {
  // Validate CCCD
  const cccdInput = document.getElementById('studentCCCD');
  if (cccdInput.value && !validateCCCD(cccdInput)) {
    cccdInput.focus();
    showToast('⚠️ CCCD phải đúng 12 chữ số!', 'error');
    return;
  }

  const data = collectData();

  if (!data.student.name) {
    document.getElementById('studentName').focus();
    showToast('⚠️ Vui lòng nhập họ tên học viên!', 'error');
    return;
  }

  const html = buildInvoiceHTML(data);

  // Render in preview
  const preview = document.getElementById('invoicePreview');
  preview.innerHTML = html;

  // Also render in hidden export div
  const exportDiv = document.getElementById('invoiceExport');
  exportDiv.innerHTML = html;

  showToast('✅ Đã tạo hóa đơn! Nhấn "Tải ảnh PNG" để lưu.');
}

// ===== DOWNLOAD AS IMAGE =====
async function downloadInvoice() {
  const exportDiv = document.getElementById('invoiceExport');

  if (!exportDiv.innerHTML || exportDiv.querySelector('.invoice-empty')) {
    renderPreview();
    // Wait for render
    await new Promise(r => setTimeout(r, 100));
  }

  if (!exportDiv.innerHTML || !exportDiv.querySelector('.inv')) {
    showToast('⚠️ Vui lòng nhấn "Xem trước" trước!', 'error');
    return;
  }

  // Move to visible area temporarily
  exportDiv.style.position = 'fixed';
  exportDiv.style.left = '0';
  exportDiv.style.top = '0';
  exportDiv.style.zIndex = '-1';
  exportDiv.style.opacity = '0.01';

  try {
    showToast('⏳ Đang tạo ảnh...');

    const canvas = await html2canvas(exportDiv.querySelector('.inv'), {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 800,
      windowWidth: 800,
    });

    // Download
    const link = document.createElement('a');
    const data = collectData();
    const fileName = `HoaDon_${data.student.name.replace(/\s+/g, '_') || 'ORI'}_${data.invoice.number}.png`;
    link.download = fileName;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();

    showToast(`✅ Đã tải: ${fileName}`);
  } catch (err) {
    console.error('Export error:', err);
    showToast('❌ Lỗi xuất ảnh: ' + err.message, 'error');
  } finally {
    // Hide again
    exportDiv.style.position = 'absolute';
    exportDiv.style.left = '-9999px';
    exportDiv.style.opacity = '1';
  }
}

// ===== TOAST NOTIFICATION =====
function showToast(message, type = 'success') {
  // Remove existing
  document.querySelectorAll('.toast').forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = 'toast';
  if (type === 'error') {
    toast.style.background = '#ef4444';
    toast.style.boxShadow = '0 4px 20px rgba(239, 68, 68, 0.4)';
  }
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ===== LOCALSTORAGE — CENTER INFO =====
function saveCenterInfo() {
  const info = {
    name: document.getElementById('centerName').value,
    phone: document.getElementById('centerPhone').value,
    email: document.getElementById('centerEmail').value,
    address: document.getElementById('centerAddress').value,
  };
  localStorage.setItem('ori_center_info', JSON.stringify(info));
  const hint = document.getElementById('centerSaveHint');
  hint.textContent = '✅ Đã lưu';
  hint.className = 'save-hint saved';
  setTimeout(() => { hint.textContent = ''; hint.className = 'save-hint'; }, 2000);
}

function loadCenterInfo() {
  const saved = localStorage.getItem('ori_center_info');
  if (saved) {
    try {
      const info = JSON.parse(saved);
      if (info.name) document.getElementById('centerName').value = info.name;
      if (info.phone) document.getElementById('centerPhone').value = info.phone;
      if (info.email) document.getElementById('centerEmail').value = info.email;
      if (info.address) document.getElementById('centerAddress').value = info.address;
      const hint = document.getElementById('centerSaveHint');
      hint.textContent = '💾 Đã nhớ từ lần trước';
      hint.className = 'save-hint saved';
      setTimeout(() => { hint.textContent = ''; hint.className = 'save-hint'; }, 3000);
    } catch (e) {}
  }
}

// ===== GENERATE INVOICE NUMBER =====
function generateInvoiceNumber() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  document.getElementById('invoiceNumber').value = `HD${year}${month}-${seq}`;
}

// ===== RESET FORM =====
function resetForm() {
  // Clear student info
  document.getElementById('studentPhone').value = '';
  document.getElementById('studentName').value = '';
  document.getElementById('studentCCCD').value = '';
  document.getElementById('studentEmail').value = '';

  // Clear payment items — keep 1 empty row
  const container = document.getElementById('itemsContainer');
  container.innerHTML = `
    <div class="item-row" data-index="0">
      <div class="form-grid">
        <div class="form-group" style="grid-column: 1 / -1;">
          <label>Nội dung</label>
          <input type="text" class="item-desc" placeholder="VD: Học phí TOEIC Basic (24 buổi)">
        </div>
        <div class="form-group">
          <label>Số tiền (VNĐ)</label>
          <input type="text" class="item-amount" placeholder="3,000,000" oninput="formatMoney(this)">
        </div>
        <div class="form-group">
          <label>&nbsp;</label>
          <button class="btn-remove-item" onclick="removeItem(this)" title="Xóa dòng">✕</button>
        </div>
      </div>
    </div>
  `;

  // Reset discount, note
  document.getElementById('discount').value = '0';
  document.getElementById('invoiceNote').value = '';

  // New invoice number & date
  generateInvoiceNumber();
  document.getElementById('invoiceDate').value = new Date().toISOString().split('T')[0];

  // Clear preview
  document.getElementById('invoicePreview').innerHTML = `
    <div class="invoice-empty">
      <span>👆</span>
      <p>Điền thông tin bên trái<br>rồi nhấn <strong>"Xem trước"</strong></p>
    </div>
  `;
  document.getElementById('invoiceExport').innerHTML = '';

  // Focus phone input
  document.getElementById('studentPhone').focus();

  showToast('🔄 Đã reset — sẵn sàng xuất bill mới!');
}
