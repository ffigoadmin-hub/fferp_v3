import { supabase } from '@/integrations/supabase/client';

export async function printPurchaseOrder(poId: string): Promise<void> {
  const { data: po, error } = await supabase
    .from('purchase_orders')
    .select(`
      id, po_number, order_date, status, total_amount, notes,
      vendor:vendors(name, account_number, ifsc_code, bank_name, gst_number, phone, contact_person, address),
      hub:hubs(name),
      items:purchase_order_items(id, item_name, quantity, unit, unit_price, total_price)
    `)
    .eq('id', poId)
    .single();

  if (error || !po) throw new Error(error?.message || 'Purchase order not found');

  const vendor = (po as any).vendor ?? {};
  const hub    = (po as any).hub    ?? {};
  const items: any[] = (po as any).items ?? [];

  const fmtDate = (d: string) => {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };
  const fmtINR = (n: number) =>
    '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const subTotal   = items.reduce((s, i) => s + Number(i.total_price || 0), 0);
  const grandTotal = Number(po.total_amount) || subTotal;
  const hubName    = hub?.name ? hub.name.toUpperCase() : 'FARMERS FACTORY';

  const itemRows = items.length === 0
    ? `<tr><td colspan="5" style="text-align:center;color:#aaa;padding:18px;">No items</td></tr>`
    : items.map((item, idx) => `
        <tr style="border-bottom:1px solid #ebebeb;">
          <td style="padding:11px 14px;color:#555;">${idx + 1}</td>
          <td style="padding:11px 14px;">
            <strong style="font-size:13px;color:#111;">${item.item_name || '—'}</strong>
          </td>
          <td style="padding:11px 14px;text-align:right;">
            <div style="font-size:13px;font-weight:700;color:#111;">${Number(item.quantity)}</div>
            <div style="font-size:10px;color:#888;margin-top:2px;">${item.unit || ''}</div>
          </td>
          <td style="padding:11px 14px;text-align:right;font-size:13px;color:#333;">${fmtINR(item.unit_price)}</td>
          <td style="padding:11px 14px;text-align:right;font-size:13px;font-weight:700;color:#111;">${fmtINR(item.total_price)}</td>
        </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${po.po_number}</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 13px;
      color: #1a1a1a;
      background: #fff;
      padding: 40px 48px 90px 48px;
    }

    /* ── Top header ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 22px;
    }
    .company-name  { font-size: 17px; font-weight: 900; color: #111; letter-spacing: -0.3px; }
    .company-sub   { font-size: 11px; color: #888; margin-top: 3px; }
    .po-title      { text-align: right; }
    .po-title-text { font-size: 26px; font-weight: 900; color: #111; letter-spacing: -1px; text-transform: uppercase; }
    .po-number     { font-size: 13px; color: #666; margin-top: 5px; font-family: 'Courier New', monospace; }

    /* ── Divider ── */
    .divider { border: none; border-top: 1.5px solid #e0e0e0; margin: 0 0 22px 0; }

    /* ── Info grid ── */
    .info-grid { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 28px; }
    .info-left  { flex: 1; }
    .info-right { text-align: right; }
    .info-block { margin-bottom: 16px; }
    .info-label {
      font-size: 9.5px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.9px; color: #aaa; margin-bottom: 4px;
    }
    .info-value       { font-size: 13px; font-weight: 700; color: #111; line-height: 1.5; }
    .info-value-light { font-size: 12px; color: #555; line-height: 1.5; }

    /* ── Items table ── */
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #1a1a1a; }
    thead th {
      padding: 11px 14px; color: #fff; font-size: 11px;
      font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; text-align: left;
    }
    thead th.right { text-align: right; }
    tbody tr:last-child { border-bottom: none; }

    /* ── Totals ── */
    .totals { margin-top: 0; border-top: 1.5px solid #ddd; }
    .total-row {
      display: flex; justify-content: flex-end; align-items: center;
      padding: 9px 14px; border-bottom: 1px solid #f2f2f2; gap: 80px;
    }
    .total-row .tl { font-size: 12px; color: #666; min-width: 100px; text-align: right; }
    .total-row .tv { font-size: 13px; font-weight: 700; color: #111; min-width: 120px; text-align: right; }
    .total-row.grand { border-top: 2px solid #ccc; border-bottom: none; padding-top: 12px; }
    .total-row.grand .tl { font-size: 14px; font-weight: 900; color: #111; }
    .total-row.grand .tv { font-size: 15px; font-weight: 900; color: #111; }

    /* ── Signature ── */
    .signature { margin-top: 52px; display: flex; justify-content: flex-end; }
    .sig-line  { width: 220px; border-bottom: 1px solid #444; height: 32px; margin-bottom: 6px; }
    .sig-label { font-size: 11px; color: #666; text-align: center; }

    /* ── Footer ── */
    .page-footer {
      position: fixed; bottom: 22px; left: 48px; right: 48px;
      display: flex; justify-content: space-between;
      font-size: 10px; color: #bbb;
      border-top: 1px solid #eee; padding-top: 6px;
    }
  </style>
</head>
<body>

  <div class="header">
    <div>
      <div class="company-name">${hubName}</div>
      <div class="company-sub">Tamil Nadu, India</div>
    </div>
    <div class="po-title">
      <div class="po-title-text">Purchase Order</div>
      <div class="po-number"># ${po.po_number}</div>
    </div>
  </div>

  <hr class="divider"/>

  <div class="info-grid">
    <div class="info-left">
      <div class="info-block">
        <div class="info-label">Vendor Address</div>
        <div class="info-value">${vendor.name || '—'}</div>
        ${vendor.address    ? `<div class="info-value-light">${vendor.address}</div>` : ''}
        ${vendor.phone      ? `<div class="info-value-light">Ph: ${vendor.phone}</div>` : ''}
        ${vendor.gst_number ? `<div class="info-value-light">GST: ${vendor.gst_number}</div>` : ''}
      </div>
      <div class="info-block">
        <div class="info-label">Deliver To</div>
        <div class="info-value-light">Farmers Factory</div>
        <div class="info-value-light">Tamil Nadu, India</div>
      </div>
    </div>
    <div class="info-right">
      <div class="info-block">
        <div class="info-label">Date</div>
        <div class="info-value">${fmtDate(po.order_date)}</div>
      </div>
      <div class="info-block">
        <div class="info-label">Ref #</div>
        <div class="info-value">${po.po_number}</div>
      </div>
      <div class="info-block">
        <div class="info-label">Status</div>
        <div class="info-value" style="text-transform:capitalize;">${po.status}</div>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:40px;">#</th>
        <th>Item &amp; Description</th>
        <th class="right" style="width:100px;">Qty</th>
        <th class="right" style="width:120px;">Rate</th>
        <th class="right" style="width:130px;">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals">
    <div class="total-row">
      <span class="tl">Sub Total</span>
      <span class="tv">${fmtINR(subTotal)}</span>
    </div>
    <div class="total-row grand">
      <span class="tl">Total</span>
      <span class="tv">${fmtINR(grandTotal)}</span>
    </div>
  </div>

  <div class="signature">
    <div>
      <div class="sig-line"></div>
      <div class="sig-label">Authorized Signature</div>
    </div>
  </div>

  <div class="page-footer">
    <span>Farmers Factory — ${hubName}</span>
    <span>Page 1</span>
  </div>

  <script>
    window.onload = function() {
      window.print();
      window.onafterprint = function() { window.close(); };
    };
  </script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=794,height=1123,scrollbars=yes');
  if (!win) throw new Error('Popup blocked — please allow popups for this site.');
  win.document.write(html);
  win.document.close();
}
