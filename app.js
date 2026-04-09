// ==========================================
// ORI ACADEMY - INVOICE IMAGE GENERATOR
// ==========================================

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  // Set today's date
  const today = new Date();
  document.getElementById('invoiceDate').value = today.toISOString().split('T')[0];

  // Auto-generate invoice number
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  document.getElementById('invoiceNumber').value = `HD${year}${month}-${seq}`;

  // CCCD validation
  const cccdInput = document.getElementById('studentCCCD');
  cccdInput.addEventListener('input', () => {
    validateCCCD(cccdInput);
  });

  // Auto-scale preview
  updatePreviewScale();
  window.addEventListener('resize', updatePreviewScale);
});

function updatePreviewScale() {
  const wrapper = document.getElementById('invoicePreviewWrapper');
  if (!wrapper) return;
  const availableWidth = wrapper.clientWidth - 40; // padding
  const scale = Math.min(1, availableWidth / 800);
  document.getElementById('invoicePreview').style.setProperty('--preview-scale', scale);
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
