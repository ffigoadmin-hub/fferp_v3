import { motion } from 'framer-motion';
import { BarChart3, IndianRupee, TrendingUp, TrendingDown, Building2, AlertTriangle, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { DEPARTMENTS } from '@/constants/departments';

interface DepartmentStats {
  department: string;
  total_requests: number;
  total_amount: number;
  approved_amount: number;
  pending_amount: number;
  rejected_count: number;
  avg_processing_time: number;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7c43',
];

export function CEODepartmentAnalytics() {
  const { data: departmentStats, isLoading } = useQuery({
    queryKey: ['department-analytics'],
    queryFn: async () => {
      const { data: payments, error } = await supabase
        .from('payment_requests')
        .select(`
          id,
          amount,
          status,
          urgency,
          created_at,
          admin_approved_at,
          ceo_approved_at,
          paid_at,
          requester_id
        `);

      if (error) throw error;

      // Get profiles to map department
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, department');

      const profileMap = new Map(profiles?.map(p => [p.id, p.department]) || []);

      // Aggregate by department
      const deptMap = new Map<string, DepartmentStats>();

      DEPARTMENTS.forEach(d => {
        deptMap.set(d.value, {
          department: d.value,
          total_requests: 0,
          total_amount: 0,
          approved_amount: 0,
          pending_amount: 0,
          rejected_count: 0,
          avg_processing_time: 0,
        });
      });

      payments?.forEach(payment => {
        const dept = profileMap.get(payment.requester_id) || 'General';
        const stats = deptMap.get(dept) || {
          department: dept,
          total_requests: 0,
          total_amount: 0,
          approved_amount: 0,
          pending_amount: 0,
          rejected_count: 0,
          avg_processing_time: 0,
        };

        stats.total_requests++;
        stats.total_amount += Number(payment.amount);

        if (payment.status === 'paid' || payment.status === 'ceo_approved') {
          stats.approved_amount += Number(payment.amount);
        } else if (payment.status === 'pending' || payment.status === 'admin_approved') {
          stats.pending_amount += Number(payment.amount);
        } else if (payment.status === 'rejected') {
          stats.rejected_count++;
        }

        deptMap.set(dept, stats);
      });

      return Array.from(deptMap.values())
        .filter(d => d.total_requests > 0)
        .sort((a, b) => b.total_amount - a.total_amount);
    },
  });

  const { data: statusDistribution } = useQuery({
    queryKey: ['status-distribution'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_requests')
        .select('status');

      if (error) throw error;

      const statusCounts: Record<string, number> = {};
      data?.forEach(p => {
        statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
      });

      return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalAmount = departmentStats?.reduce((sum, d) => sum + d.total_amount, 0) || 0;
  const topDepartment = departmentStats?.[0];

  const chartData = departmentStats?.slice(0, 10).map(d => ({
    name: d.department.length > 12 ? d.department.slice(0, 12) + '...' : d.department,
    amount: d.total_amount / 100000,
    requests: d.total_requests,
  })) || [];

  const pieData = departmentStats?.slice(0, 6).map(d => ({
    name: d.department,
    value: d.total_amount,
  })) || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-xl bg-authority-ceo/20 flex items-center justify-center">
          <BarChart3 className="w-7 h-7 text-authority-ceo" />
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-1">Department Analytics</h1>
          <p className="text-muted-foreground">Payment distribution across departments</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Payment Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-2xl font-bold">
              <IndianRupee className="w-5 h-5" />
              {(totalAmount / 100000).toFixed(2)}L
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Active Departments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <span className="text-2xl font-bold">{departmentStats?.length || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Top Spender</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-status-live" />
              <span className="text-lg font-semibold truncate">{topDepartment?.department || 'N/A'}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              ₹{((topDepartment?.total_amount || 0) / 100000).toFixed(2)}L
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {departmentStats?.reduce((sum, d) => sum + d.total_requests, 0) || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Department-wise Spending (in Lakhs)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`₹${value.toFixed(2)}L`, 'Amount']}
                  />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name.slice(0, 8)}... ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`₹${(value / 100000).toFixed(2)}L`, 'Amount']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Department Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {departmentStats?.map((dept, index) => (
              <div key={dept.department} className="p-4 rounded-lg border bg-card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="font-medium">{dept.department}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">{dept.total_requests} requests</span>
                    <span className="font-semibold">₹{(dept.total_amount / 100000).toFixed(2)}L</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1 text-status-live">
                    <CheckCircle className="w-3 h-3" />
                    Approved: ₹{(dept.approved_amount / 100000).toFixed(2)}L
                  </div>
                  <div className="flex items-center gap-1 text-status-late">
                    <AlertTriangle className="w-3 h-3" />
                    Pending: ₹{(dept.pending_amount / 100000).toFixed(2)}L
                  </div>
                  {dept.rejected_count > 0 && (
                    <div className="flex items-center gap-1 text-status-missed">
                      <TrendingDown className="w-3 h-3" />
                      {dept.rejected_count} rejected
                    </div>
                  )}
                </div>
                <Progress
                  value={(dept.approved_amount / dept.total_amount) * 100}
                  className="mt-2 h-2"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {statusDistribution?.map((status, index) => (
              <div
                key={status.name}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border"
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="capitalize">{status.name.replace('_', ' ')}</span>
                <span className="font-bold">{status.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
