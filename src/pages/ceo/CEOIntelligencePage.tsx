import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, AlertTriangle, DollarSign, Clock, Building, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { useCEOIntelligence } from '@/hooks/useCEOIntelligence';

export default function CEOIntelligencePage() {
  const {
    paymentTrends,
    departmentScores,
    vendorConcentration,
    urgencyStats,
    overallStats,
    isLoading,
  } = useCEOIntelligence();

  const formatCurrency = (value: number) => {
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-xl bg-authority-ceo/20 flex items-center justify-center">
          <BarChart3 className="w-7 h-7 text-authority-ceo" />
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-1">Intelligence Dashboard</h1>
          <p className="text-muted-foreground">Real-time metrics & command intelligence</p>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="authority-card"
        >
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-5 h-5 text-primary" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Today's Paid</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(overallStats.todayApproved)}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="authority-card"
        >
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-status-late" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Monthly Burn</span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(overallStats.monthlyBurn)}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="authority-card"
        >
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-primary" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Pending CEO Approval</span>
          </div>
          <p className="text-3xl font-bold">{overallStats.pendingApprovals}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="authority-card"
        >
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-5 h-5 text-status-missed" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Admin Rejections</span>
          </div>
          <p className="text-3xl font-bold">{overallStats.adminRejections}</p>
          <p className="text-xs text-muted-foreground mt-1">This month</p>
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Payment Trends */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="authority-card"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Payment Trends (This Month)
          </h3>
          <div className="h-64">
            {paymentTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => formatCurrency(v)} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [formatCurrency(value), 'Amount']}
                  />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No payment data available
              </div>
            )}
          </div>
        </motion.div>

        {/* Vendor Concentration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="authority-card"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Vendor Concentration
          </h3>
          <div className="flex items-center">
            <div className="h-64 flex-1">
              {vendorConcentration.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={vendorConcentration}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {vendorConcentration.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [`${value}%`, 'Share']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No vendor data available
                </div>
              )}
            </div>
            <div className="space-y-2 ml-4">
              {vendorConcentration.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm truncate max-w-[100px]">{item.name}</span>
                  <span className="text-sm text-muted-foreground">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Discipline Scores */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="authority-card"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Department Discipline Scores
          </h3>
          <div className="space-y-4">
            {departmentScores.length > 0 ? (
              departmentScores.map((dept) => (
                <div key={dept.department} className="flex items-center gap-4">
                  <div className="flex items-center gap-2 w-32">
                    <Building className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium truncate">{dept.department}</span>
                  </div>
                  <div className="flex-1 h-3 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        dept.avgScore >= 80 ? 'bg-status-live' :
                        dept.avgScore >= 60 ? 'bg-status-late' : 'bg-status-missed'
                      }`}
                      style={{ width: `${dept.avgScore}%` }}
                    />
                  </div>
                  <span className={`text-sm font-bold w-12 text-right ${
                    dept.avgScore >= 80 ? 'text-status-live' :
                    dept.avgScore >= 60 ? 'text-status-late' : 'text-status-missed'
                  }`}>
                    {dept.avgScore}
                  </span>
                  <span className="text-xs text-muted-foreground w-20">
                    {dept.employeeCount} {dept.employeeCount === 1 ? 'employee' : 'employees'}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No department scores available
              </div>
            )}
          </div>
        </motion.div>

        {/* Urgency Abuse Ranking */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="authority-card"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Urgency Pattern Analysis
          </h3>
          <div className="space-y-4">
            {urgencyStats.length > 0 ? (
              urgencyStats.map((person, index) => (
                <div key={person.name} className="flex items-center gap-4 p-3 rounded-lg bg-muted/20">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    index === 0 ? 'bg-status-missed/20 text-status-missed' :
                    index === 1 ? 'bg-status-late/20 text-status-late' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium">{person.name}</p>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-status-missed">🔴 {person.emergency} emergency</span>
                      <span className="text-status-late">🟡 {person.important} important</span>
                      <span className="text-status-live">🟢 {person.normal} normal</span>
                    </div>
                  </div>
                  <span className={`text-lg font-bold ${
                    person.emergency > person.normal ? 'text-status-missed' : 'text-muted-foreground'
                  }`}>
                    {((person as any).ratio || 0).toFixed(0)}%
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No urgency data available
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            High emergency ratio may indicate abuse
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
