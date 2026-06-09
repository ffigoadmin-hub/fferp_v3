import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Download, Filter, Save, Layers, Play, Calendar, Table as TableIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomReportBuilder() {
  const [reportType, setReportType] = useState('sales');
  const [columns, setColumns] = useState<string[]>(['order_number', 'order_date', 'customer_name', 'net_amount']);
  const [dateRange, setDateRange] = useState('this_month');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const AVAILABLE_COLUMNS: Record<string, { id: string, label: string }[]> = {
    sales: [
      { id: 'order_number', label: 'Order Number' },
      { id: 'order_date', label: 'Date' },
      { id: 'customer_name', label: 'Customer Name' },
      { id: 'hub_name', label: 'Hub' },
      { id: 'net_amount', label: 'Net Amount' },
      { id: 'payment_mode', label: 'Payment Mode' },
      { id: 'status', label: 'Status' }
    ],
    purchases: [
      { id: 'po_number', label: 'PO Number' },
      { id: 'po_date', label: 'Date' },
      { id: 'vendor_name', label: 'Vendor' },
      { id: 'hub_name', label: 'Hub' },
      { id: 'total_amount', label: 'Amount' },
      { id: 'status', label: 'Status' }
    ],
    inventory: [
      { id: 'product_name', label: 'Product' },
      { id: 'hub_name', label: 'Hub' },
      { id: 'current_stock', label: 'Current Stock' },
      { id: 'grade_a_kg', label: 'Grade A (kg)' },
      { id: 'last_updated', label: 'Last Updated' }
    ]
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      if (reportType === 'sales') {
        const { data, error } = await supabase
          .from('sales_orders')
          .select('order_number, order_date, net_amount, payment_mode, status, customer:customers(shop_name), hub:hubs(name)')
          .order('order_date', { ascending: false })
          .limit(100);

        if (error) throw error;

        const shaped = data.map(d => ({
          order_number: d.order_number,
          order_date: d.order_date,
          customer_name: (d.customer as any)?.shop_name || 'N/A',
          hub_name: (d.hub as any)?.name || 'N/A',
          net_amount: d.net_amount,
          payment_mode: d.payment_mode,
          status: d.status
        }));

        setPreviewData(shaped);
        toast.success('Sales report generated');
      } else if (reportType === 'purchases') {
        const { data, error } = await supabase
          .from('purchase_orders')
          .select('po_number, po_date, total_amount, status, vendor:vendors(name), hub:hubs(name)')
          .order('po_date', { ascending: false })
          .limit(100);

        if (error) throw error;

        const shaped = data.map(d => ({
          po_number: d.po_number,
          po_date: (d as any).po_date,
          vendor_name: (d.vendor as any)?.name || 'N/A',
          hub_name: (d.hub as any)?.name || 'N/A',
          total_amount: d.total_amount,
          status: d.status
        }));

        setPreviewData(shaped);
        toast.success('Purchases report generated');
      } else if (reportType === 'inventory') {
        const { data, error } = await supabase
          .from('inventory_items')
          .select('quantity_kg, last_updated, product:products(name), hub:hubs(name)')
          .limit(100);

        if (error) throw error;

        const shaped = data.map(d => ({
          product_name: (d.product as any)?.name || 'N/A',
          hub_name: (d.hub as any)?.name || 'N/A',
          current_stock: (d as any).quantity_kg,
          grade_a_kg: 'N/A',
          last_updated: new Date((d as any).last_updated).toLocaleString()
        }));

        setPreviewData(shaped);
        toast.success('Inventory report generated');
      }
    } catch (err) {
      toast.error('Failed to generate report');
    } finally {
      setIsLoading(false);
    }
  };

  const exportCSV = () => {
    if (previewData.length === 0) return;

    const headers = columns.map(colId =>
      AVAILABLE_COLUMNS[reportType].find(c => c.id === colId)?.label || colId
    );

    const csvRows = previewData.map(row =>
      columns.map(colId => {
        let cell = row[colId] === null || row[colId] === undefined ? '' : row[colId].toString();
        if (cell.includes(',') || cell.includes('"')) {
          cell = `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    );

    const csvString = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportType}_report.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleColumn = (colId: string) => {
    if (columns.includes(colId)) {
      setColumns(columns.filter(c => c !== colId));
    } else {
      setColumns([...columns, colId]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Custom Report Builder</h1>
          <p className="text-sm text-gray-500">Design, pivot, and export specific data views</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Save className="h-4 w-4" /> Save Template
          </button>
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            <Play className="h-4 w-4" /> {isLoading ? 'Generating...' : 'Generate Preview'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Layers className="h-4 w-4 text-green-600" /> Data Source
            </h3>
            <select
              value={reportType}
              onChange={e => {
                setReportType(e.target.value);
                setColumns(AVAILABLE_COLUMNS[e.target.value].map(c => c.id).slice(0, 4));
              }}
              className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none focus:border-green-500"
            >
              <option value="sales">Sales & Revenue</option>
              <option value="purchases">Purchases & Vendors</option>
              <option value="inventory">Inventory & QC</option>
            </select>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" /> Date Range
            </h3>
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none focus:border-green-500"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Range...</option>
            </select>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Filter className="h-4 w-4 text-amber-600" /> Columns
            </h3>
            <div className="space-y-2">
              {AVAILABLE_COLUMNS[reportType].map(col => (
                <label key={col.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={columns.includes(col.id)}
                    onChange={() => toggleColumn(col.id)}
                    className="rounded text-green-600 focus:ring-green-500"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm h-full min-h-[500px] flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <TableIcon className="h-5 w-5 text-gray-400" /> Live Preview (Top 50)
              </h2>
              {previewData.length > 0 && (
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg hover:bg-green-100"
                >
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </button>
              )}
            </div>

            <div className="flex-1 p-0 overflow-auto">
              {previewData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <TableIcon className="h-12 w-12 mb-3 text-gray-200" />
                  <p>Select columns and click Generate Preview</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {columns.map(colId => (
                        <th key={colId} className="px-4 py-3 font-semibold text-gray-800 border-b">
                          {AVAILABLE_COLUMNS[reportType].find(c => c.id === colId)?.label || colId}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewData.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {columns.map(colId => (
                          <td key={colId} className="px-4 py-2">
                            {row[colId]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
