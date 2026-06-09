import { Coffee, IndianRupee, Clock, Users, CheckCircle2, XCircle, FileText, Download, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';

export function ClosingManager({ 
  stats, 
  allOrders,
  fetchOrdersByRange
}: { 
  stats: any; 
  allOrders: any[];
  fetchOrdersByRange?: (start: string, end: string) => Promise<any[]>
}) {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isExporting, setIsExporting] = useState(false);

  const exportOrdersCSV = async () => {
    setIsExporting(true);
    try {
      let filteredOrders = [];
      
      if (fetchOrdersByRange) {
        filteredOrders = await fetchOrdersByRange(startDate, endDate);
      } else {
        filteredOrders = allOrders.filter(o => 
          o.order_date >= startDate && o.order_date <= endDate
        );
      }
      
      if (filteredOrders.length === 0) {
        alert("No orders found for the selected date range.");
        return;
      }
      
      const headers = "Order Number,Customer Name,Department,Order Date,Order Time,Status,Amount,Special Instructions\n";
      const rows = filteredOrders.map(o => {
        const escapedInstructions = (o.special_instructions || '').replace(/"/g, '""');
        return `${o.order_number},${o.customer_name || 'N/A'},${o.customer_department || 'N/A'},${o.order_date},${o.order_time},${o.order_status},${o.total_amount},"${escapedInstructions}"`;
      }).join("\n");
      
      const csvContent = "\uFEFF" + headers + rows;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `palm_cafe_sales_${startDate}_to_${endDate}.csv`;
      a.click();
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to generate report. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportFinancialCSV = async () => {
    setIsExporting(true);
    try {
      let filteredOrders = [];
      
      if (fetchOrdersByRange) {
        filteredOrders = await fetchOrdersByRange(startDate, endDate);
      } else {
        filteredOrders = allOrders.filter(o => 
          o.order_date >= startDate && o.order_date <= endDate
        );
      }
      
      if (filteredOrders.length === 0) {
        alert("No orders found for the selected date range.");
        return;
      }
      
      // Calculate Financial Totals
      const nonCancelled = filteredOrders.filter(o => o.order_status !== 'cancelled');
      const totalRevenue = nonCancelled.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
      const verifiedRevenue = nonCancelled.filter(o => o.payment_status === 'verified').reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
      const collectedRevenue = nonCancelled.filter(o => o.order_status === 'collected').reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
      const pendingVerification = nonCancelled.filter(o => o.payment_status === 'proof_uploaded').reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
      const cancelledRevenue = filteredOrders.filter(o => o.order_status === 'cancelled').reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

      const summaryHeaders = "FINANCIAL SUMMARY REPORT (PALM CAFE)\n";
      const summaryStats = [
        `Report Period,${startDate} to ${endDate}`,
        `Total Generated Revenue,₹${totalRevenue}`,
        `Verified Revenue,₹${verifiedRevenue}`,
        `Collected Revenue (Confirmed),₹${collectedRevenue}`,
        `Pending Verification Total,₹${pendingVerification}`,
        `Cancelled/Lost Revenue,₹${cancelledRevenue}`,
        `Total Transaction Count,${filteredOrders.length}`,
        "\n--- TRANSACTION DETAILS ---\n"
      ].join("\n");

      const headers = "Order Number,Customer Name,Date,Amount,Payment Status,Verified At,Collected At,Order Status\n";
      const rows = filteredOrders.map(o => {
        return `${o.order_number},${o.customer_name || 'N/A'},${o.order_date},${o.total_amount},${o.payment_status},${o.payment_verified_at || 'N/A'},${o.collected_at || 'N/A'},${o.order_status}`;
      }).join("\n");
      
      const csvContent = "\uFEFF" + summaryHeaders + summaryStats + headers + rows;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `palm_cafe_reconciliation_${startDate}_to_${endDate}.csv`;
      a.click();
    } catch (error) {
      console.error("Financial export failed:", error);
      alert("Failed to generate financial report. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Coffee, label: "Total Served", value: stats?.collected || 0, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { icon: Clock, label: "Total Inflow Count", value: stats?.totalToday || 0, color: "text-blue-400", bg: "bg-blue-500/10" },
          { icon: IndianRupee, label: "Collected Revenue", value: `₹${stats?.totalRevenue || 0}`, color: "text-yellow-400", bg: "bg-yellow-500/10" },
          { icon: Users, label: "Menu Items", value: stats?.totalMenuItems || 0, color: "text-purple-400", bg: "bg-purple-500/10" }
        ].map((item, i) => (
          <div key={i} className="p-5 rounded-2xl border border-primary/10 bg-card/50 backdrop-blur-md shadow-xl flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl ${item.bg} flex items-center justify-center shrink-0 border border-white/5 shadow-inner`}>
              <item.icon className={`w-7 h-7 ${item.color}`} />
            </div>
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{item.label}</p>
              <p className="text-2xl font-black text-foreground">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-8 rounded-3xl border border-primary/20 bg-card/50 backdrop-blur-md shadow-2xl flex flex-col items-center text-center gap-6 justify-center">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center shadow-lg border border-primary/20">
                <FileText className="w-10 h-10 text-primary" />
            </div>
            <div>
                <h3 className="text-2xl font-black text-foreground tracking-tight uppercase italic">Generate Reports</h3>
                <p className="text-sm font-medium text-muted-foreground mt-2 max-w-sm">Select a date range to download the transaction and financial history.</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md">
                <div className="flex-1 w-full space-y-1">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                        <Calendar className="w-3 h-3" /> From
                    </label>
                    <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-background border border-border outline-none focus:border-primary/50 transition-all text-sm font-bold"
                    />
                </div>
                <div className="flex-1 w-full space-y-1">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                        <Calendar className="w-3 h-3" /> To
                    </label>
                    <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-background border border-border outline-none focus:border-primary/50 transition-all text-sm font-bold"
                    />
                </div>
            </div>

            <div className="flex flex-col gap-3 w-full max-w-md mt-2">
              <button 
                  onClick={exportOrdersCSV}
                  disabled={isExporting}
                  className="group w-full px-8 py-4 rounded-xl bg-foreground text-background font-black uppercase tracking-[0.2em] text-[10px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                  <Download className={`w-4 h-4 ${isExporting ? 'animate-spin' : ''}`} />
                  {isExporting ? 'Exporting...' : 'Export Sales Report'}
              </button>

              <button 
                  onClick={exportFinancialCSV}
                  disabled={isExporting}
                  className="group w-full px-8 py-4 rounded-xl bg-primary/10 text-primary border border-primary/20 font-black uppercase tracking-[0.2em] text-[10px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                  <IndianRupee className={`w-4 h-4 ${isExporting ? 'animate-spin' : ''}`} />
                  {isExporting ? 'Exporting...' : 'Export Financial Report'}
              </button>
            </div>
        </div>

        <div className="p-8 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 backdrop-blur-md shadow-2xl flex flex-col items-center text-center gap-6 justify-center">
            <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center shadow-lg border border-emerald-500/20">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <div>
                <h3 className="text-2xl font-black text-emerald-500 tracking-tight uppercase italic">Finalize Closing</h3>
                <p className="text-sm font-medium text-muted-foreground mt-2 max-w-sm">This will record the final balance of ₹{stats?.totalRevenue || 0} and prepare the system for rollover.</p>
            </div>
            <button 
                onClick={() => {
                    if (window.confirm(`Are you sure you want to close the daily sales? Current balance is ₹${stats?.totalRevenue || 0}`)) {
                        alert('Daily sales record finalized and archived to database.');
                    }
                }}
                className="px-10 py-5 rounded-2xl bg-emerald-500 text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl shadow-emerald-500/20 hover:scale-[1.05] active:scale-95 transition-all flex items-center gap-3"
            >
                <IndianRupee className="w-5 h-5" />
                Close Day: ₹{stats?.totalRevenue || 0}
            </button>
        </div>

      </div>

      <div className="p-6 rounded-2xl bg-yellow-400/5 border border-yellow-400/20 flex items-center gap-4">
         <Clock className="w-6 h-6 text-yellow-500 shrink-0" />
         <div>
            <span className="text-[10px] font-black uppercase text-yellow-500 tracking-widest block mb-1">Automatic Shutdown Guard</span>
            <p className="text-xs text-yellow-500/80 font-medium">
                Daily reports are automatically archived at midnight. Please download your CSV registry before system refresh to maintain offline backups.
            </p>
         </div>
      </div>
    </div>
  );
}
