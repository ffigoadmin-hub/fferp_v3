import { format } from 'date-fns';

// HTML escape function to prevent XSS
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

function openPrintPreview(htmlContent: string) {
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank', 'noopener,noreferrer');

  if (!printWindow) {
    URL.revokeObjectURL(url);
    return;
  }

  printWindow.addEventListener('load', () => {
    try {
      printWindow.focus();
      printWindow.print();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }, { once: true });
}

// CSV Export
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  headers: { key: keyof T; label: string }[]
) {
  if (data.length === 0) return;

  const csvHeaders = headers.map(h => h.label).join(',');
  const csvRows = data.map(row =>
    headers.map(h => {
      const value = row[h.key];
      // Escape commas and quotes
      const stringValue = value?.toString() || '';
      if (stringValue.includes(',') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',')
  );

  const csvContent = [csvHeaders, ...csvRows].join('\n');
  downloadFile(csvContent, `${filename}.csv`, 'text/csv');
}

// PDF Export (simple HTML to PDF approach)
export function exportToPDF<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  title: string,
  headers: { key: keyof T; label: string }[]
) {
  if (data.length === 0) return;

  const tableRows = data.map(row =>
    `<tr>${headers.map(h => `<td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(String(row[h.key] ?? ''))}</td>`).join('')}</tr>`
  ).join('');

  const escapedTitle = escapeHtml(title);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${escapedTitle}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #1a365d; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #1a365d; color: white; padding: 12px 8px; text-align: left; }
        td { padding: 8px; border: 1px solid #ddd; }
        tr:nth-child(even) { background: #f9f9f9; }
        .footer { margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <h1>${escapedTitle}</h1>
      <p>Generated on: ${format(new Date(), 'PPPp')}</p>
      <table>
        <thead>
          <tr>${headers.map(h => `<th>${escapeHtml(h.label)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      <div class="footer">
        <p>IGO GROUP - India's Leading Farming Conglomerate</p>
      </div>
    </body>
    </html>
  `;

  openPrintPreview(htmlContent);
}

// Payment Voucher Export
export function generateVoucher(payment: any) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Voucher - ${escapeHtml(String(payment.payment_number || payment.id))}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
        .voucher-container { max-width: 800px; margin: 0 auto; border: 2px solid #1a365d; padding: 30px; border-radius: 8px; position: relative; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
        .logo-section h1 { color: #1a365d; margin: 0; font-size: 28px; letter-spacing: 1px; }
        .logo-section p { margin: 5px 0 0 0; color: #666; font-size: 14px; }
        .voucher-title { text-align: right; }
        .voucher-title h2 { margin: 0; color: #1a365d; font-size: 24px; text-transform: uppercase; }
        .voucher-title p { margin: 5px 0 0 0; font-weight: bold; color: #e53e3e; }
        
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px; }
        .section-title { font-size: 12px; text-transform: uppercase; color: #1a365d; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 10px; }
        .detail-item { margin-bottom: 15px; }
        .detail-label { font-size: 11px; color: #888; text-transform: uppercase; }
        .detail-value { font-size: 16px; font-weight: 500; color: #2d3748; }
        
        .amount-section { background: #f7fafc; padding: 20px; border-radius: 6px; border: 1px solid #edf2f7; margin-bottom: 40px; display: flex; justify-content: space-between; align-items: center; }
        .amount-label { font-size: 18px; color: #1a365d; font-weight: bold; }
        .amount-value { font-size: 32px; color: #1a365d; font-weight: 800; }
        
        .utr-badge { background: #ebf8ff; color: #2b6cb0; padding: 10px 20px; border-radius: 4px; border: 1px solid #bee3f8; display: inline-block; margin-bottom: 40px; }
        .utr-label { font-size: 10px; text-transform: uppercase; font-weight: bold; margin-bottom: 2px; }
        .utr-value { font-family: monospace; font-size: 18px; font-weight: bold; }
        
        .footer { border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #718096; display: flex; justify-content: space-between; }
        .signature-box { text-align: center; width: 200px; }
        .signature-line { border-top: 1px solid #333; margin-top: 40px; padding-top: 5px; }
        
        @media print {
          body { padding: 0; }
          .voucher-container { border: 1px solid #ccc; }
          .amount-section { background: #eee !important; -webkit-print-color-adjust: exact; }
          .utr-badge { background: #f0f0f0 !important; -webkit-print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="voucher-container">
        <div class="header">
          <div class="logo-section">
            <h1>IGO GROUP</h1>
            <p>India's Leading Farming Conglomerate</p>
          </div>
          <div class="voucher-title">
            <h2>Payment Voucher</h2>
            <p>#PAY-${String(payment.payment_number || 0).padStart(6, '0')}</p>
            ${payment.is_transport_payment ? '<span style="font-size: 10px; background: #c6f6d5; color: #22543d; padding: 2px 8px; border-radius: 99px;">TRANSPORT</span>' : ''}
          </div>
        </div>

        <div class="details-grid">
          <div>
            <div class="section-title">Beneficiary Details</div>
            <div class="detail-item">
              <div class="detail-label">Beneficiary / Payee</div>
              <div class="detail-value">${escapeHtml(payment.vendor_name)}</div>
            </div>
            ${payment.payment_method === 'bank_transfer' || !payment.payment_method ? `
            <div class="detail-item">
              <div class="detail-label">Bank Account Number</div>
              <div class="detail-value">${escapeHtml(payment.vendor_account_number || 'N/A')}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">IFSC Code</div>
              <div class="detail-value">${escapeHtml(payment.vendor_ifsc_code || 'N/A')}</div>
            </div>
            ` : `
            <div class="detail-item">
              <div class="detail-label">UPI ID / Payment Method</div>
              <div class="detail-value text-uppercase">${escapeHtml(payment.payment_method?.toUpperCase())}: ${escapeHtml(payment.upi_id || payment.vendor_account_number || 'N/A')}</div>
            </div>
            `}
          </div>
          <div>
            <div class="section-title">Payment Information</div>
            <div class="detail-item">
              <div class="detail-label">Payment Date</div>
              <div class="detail-value">${payment.paid_at ? format(new Date(payment.paid_at), 'dd MMM yyyy') : 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Status</div>
              <div class="detail-value" style="color: ${payment.status === 'completed' ? '#38a169' : '#e53e3e'}">${escapeHtml(payment.status?.toUpperCase() || 'N/A')}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Department</div>
              <div class="detail-value">${escapeHtml(payment.department || 'N/A')}</div>
            </div>
          </div>
        </div>

        ${payment.detailed_description ? `
        <div style="margin-bottom: 30px;">
          <div class="section-title">Breakdown / Detailed Purpose</div>
          <div style="font-size: 13px; background: #fdfdfd; padding: 15px; border: 1px solid #eee; border-radius: 4px; white-space: pre-wrap;">${escapeHtml(payment.detailed_description)}</div>
        </div>
        ` : `
        <div style="margin-bottom: 30px;">
          <div class="section-title">Payment Purpose</div>
          <div style="font-size: 14px; color: #2d3748;">${escapeHtml(payment.purpose)}</div>
        </div>
        `}

        ${payment.splits && payment.splits.length > 0 ? `
        <div style="margin-bottom: 30px;">
          <div class="section-title">Split Payment Distribution</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead style="background: #f7fafc;">
              <tr>
                <th style="border: 1px solid #edf2f7; padding: 8px; text-align: left;">Beneficiary</th>
                <th style="border: 1px solid #edf2f7; padding: 8px; text-align: left;">Payment Method</th>
                <th style="border: 1px solid #edf2f7; padding: 8px; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${payment.splits.map((s: any) => `
                <tr>
                  <td style="border: 1px solid #edf2f7; padding: 8px;">
                    <div style="font-weight: bold;">${escapeHtml(s.payee_name)}</div>
                    <div style="color: #666; font-size: 10px;">${escapeHtml(s.account_number || s.upi_id || '')}</div>
                  </td>
                  <td style="border: 1px solid #edf2f7; padding: 8px; text-transform: uppercase;">${escapeHtml(s.payment_method?.replace('_', ' ') || 'BANK')}</td>
                  <td style="border: 1px solid #edf2f7; padding: 8px; text-align: right; font-weight: bold;">₹${Number(s.amount).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        <div class="utr-badge">
          <div class="utr-label">Transaction Reference (UTR)</div>
          <div class="utr-value">${escapeHtml(String(payment.utr_number || 'PROCESSING'))}</div>
        </div>

        <div class="amount-section">
          <div class="amount-label">TOTAL AMOUNT PAID</div>
          <div class="amount-value">₹${Number(payment.amount).toLocaleString()}</div>
        </div>

        <div class="footer">
          <div class="info-box">
            <p>This is a computer-generated voucher and does not require a physical signature.</p>
            <p>Generated on: ${format(new Date(), 'PPPp')}</p>
          </div>
          <div class="signature-box">
            <div class="signature-line">Accounts Department</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  openPrintPreview(htmlContent);
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(url);
}

// Excel Export
export function exportToExcel(
  data: any[],
  filename: string,
  headers: { key: string; label: string }[]
) {
  if (data.length === 0) return;
  void (async () => {
    const XLSX = await import('xlsx');

    // Transform data to use labels as keys for Excel headers
    const transformedData = data.map(item => {
      const newItem: Record<string, any> = {};
      headers.forEach(h => {
        newItem[h.label] = item[h.key] ?? 'N/A';
      });
      return newItem;
    });

    const worksheet = XLSX.utils.json_to_sheet(transformedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

    // Set column widths for better detailed visibility (e.g. for long text)
    const wscols = headers.map(h => ({ wch: h.label.length > 20 ? 40 : 20 }));
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `${filename}.xlsx`);
  })().catch((error) => {
    console.error('Excel export failed:', error);
  });
}
