import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { RecentSalesOrdersWidget } from '@/components/RecentSalesOrdersWidget';
import { useAuth } from '@/contexts/AuthContext';

export default function SalesOrdersPage() {
  const { user } = useAuth();
  const isManagement = ['ceo', 'gm', 'admin', 'director', 'nsm'].includes((user as any)?.role ?? '');
  const hubId = isManagement ? null : ((user as any)?.hub_id ?? null);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">Sales Orders</h1>
          <p className="text-[13px] text-slate-500">All orders placed by the sales team</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/sales/orders" className="btn-zoho-secondary text-sm">Full List →</Link>
          <Link to="/sales/new-order" className="btn-zoho-primary flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> New Order
          </Link>
        </div>
      </div>

      <RecentSalesOrdersWidget
        title="All Sales Orders"
        limit={50}
        hubId={hubId}
      />
    </div>
  );
}
