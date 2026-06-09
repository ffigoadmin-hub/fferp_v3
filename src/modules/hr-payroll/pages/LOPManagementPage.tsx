import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLOPEntries, LOPStatus } from '@/hooks/useLOPEntries';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Plus, Loader2, AlertTriangle, Clock, CheckCircle, XCircle, FileSpreadsheet } from 'lucide-react';
import { PayrollExportWidget } from '@/components/PayrollExportWidget';
import LOPExportWidget from '@/components/admin/LOPExportWidget';

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
}

export default function LOPManagementPage() {
  const { entries, isLoading, isSaving, addEntry, deleteEntry, getLOPValue } = useLOPEntries();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [activeTab, setActiveTab] = useState('all');

  // Form states
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [lopType, setLopType] = useState<'1_day' | '0.5_day' | '0.25_day' | '0.1_day'>('1_day');
  const [reason, setReason] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [lopDate, setLopDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    const fetchEmployees = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, email, department')
        .order('name');
      setEmployees(data || []);
    };
    fetchEmployees();
  }, []);

  const handleSubmit = async () => {
    if (!selectedEmployee || !reason || !evidenceUrl) return;

    // Manual LOPs raised by HR require Admin approval
    // HR -> Admin -> CEO (for reversal deletion only)
    const result = await addEntry({
      employee_id: selectedEmployee,
      lop_type: lopType,
      reason,
      evidence_url: evidenceUrl,
      lop_date: lopDate,
      // Status will be handled by hook based on role, or we can explicit set pending_admin
      // But passing 'hr' role logic is better
      source: 'manual_hr',
    }, 'hr');

    if (result.success) {
      setDialogOpen(false);
      setSelectedEmployee('');
      setReason('');
      setEvidenceUrl('');
      setLopDate(format(new Date(), 'yyyy-MM-dd'));
    }
  };

  const getLOPTypeLabel = (type: string) => {
    switch (type) {
      case '1_day': return '1 Day';
      case '0.5_day': return '0.5 Day';
      case '0.25_day': return '0.25 Day';
      case '0.1_day': return '0.1 Day';
      default: return type;
    }
  };

  const getLOPTypeBadge = (type: string) => {
    switch (type) {
      case '1_day': return 'destructive';
      case '0.25_day': return 'outline';
      default: return 'default';
    }
  };

  const getStatusBadge = (status: LOPStatus) => {
    switch (status) {
      case 'pending_admin':
        return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> Pending Admin</Badge>;
      case 'pending_ceo':
        return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> Pending CEO</Badge>;
      case 'approved':
        return <Badge className="gap-1 bg-status-live"><CheckCircle className="w-3 h-3" /> Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredEntries = entries.filter(e => {
    const matchesMonth = e.lop_date.startsWith(selectedMonth);
    const matchesTab = activeTab === 'all' || e.status === activeTab;
    return matchesMonth && matchesTab;
  });

  // Stats by status
  const pendingAdminCount = entries.filter(e => e.status === 'pending_admin' && e.lop_date.startsWith(selectedMonth)).length;
  const pendingCeoCount = entries.filter(e => e.status === 'pending_ceo' && e.lop_date.startsWith(selectedMonth)).length;
  const approvedCount = entries.filter(e => e.status === 'approved' && e.lop_date.startsWith(selectedMonth)).length;
  const rejectedCount = entries.filter(e => e.status === 'rejected' && e.lop_date.startsWith(selectedMonth)).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">LOP Management</h1>
          <p className="text-muted-foreground">Loss of Pay entries with Admin approval workflow</p>
        </div>

        <div className="flex items-center gap-3">
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-40"
          />

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add LOP Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add LOP Entry</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div>
                  <Label>Select Employee *</Label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose employee..." />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} ({emp.department})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>LOP Date *</Label>
                  <Input
                    type="date"
                    value={lopDate}
                    onChange={(e) => setLopDate(e.target.value)}
                  />
                </div>

                <div>
                  <Label>LOP Type *</Label>
                  <Select value={lopType} onValueChange={(v: any) => setLopType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1_day">1 Day (Full Day)</SelectItem>
                      <SelectItem value="0.5_day">0.5 Day (Half Day)</SelectItem>
                      <SelectItem value="0.25_day">0.25 Day (Quarter Day)</SelectItem>
                      <SelectItem value="0.1_day">0.1 Day (Minor Penalty)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Reason *</Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why is this LOP being deducted?"
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Evidence URL *</Label>
                  <Input
                    value={evidenceUrl}
                    onChange={(e) => setEvidenceUrl(e.target.value)}
                    placeholder="Link to proof/evidence document"
                  />
                </div>

                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-700 dark:text-amber-400">
                  <p className="font-medium">⚠️ This LOP entry will require approval:</p>
                  <p className="text-xs mt-1">HR Submit → Admin Verify</p>
                </div>

                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={!selectedEmployee || !reason || !evidenceUrl || isSaving}
                >
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Record LOP Entry
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:border-primary/50" onClick={() => setActiveTab('pending_admin')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" /> Pending Admin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-status-late">{pendingAdminCount}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50" onClick={() => setActiveTab('pending_ceo')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" /> Pending CEO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-status-late">{pendingCeoCount}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50" onClick={() => setActiveTab('approved')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-status-live">{approvedCount}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50" onClick={() => setActiveTab('rejected')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className="w-4 h-4" /> Rejected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-status-missed">{rejectedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for filtering */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All Entries</TabsTrigger>
          <TabsTrigger value="pending_admin">Pending Admin</TabsTrigger>
          <TabsTrigger value="pending_ceo">Pending CEO</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {/* Entries Table */}
          <Card>
            <CardHeader>
              <CardTitle>LOP Entries - {format(new Date(selectedMonth + '-01'), 'MMMM yyyy')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell>{format(new Date(entry.lop_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{entry.employee_name}</p>
                          <p className="text-xs text-muted-foreground">{entry.employee_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getLOPTypeBadge(entry.lop_type) as any}>
                          {getLOPTypeLabel(entry.lop_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">{getLOPValue(entry.lop_type)}</TableCell>
                      <TableCell>{getStatusBadge(entry.status)}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={entry.reason}>
                        {entry.reason}
                        {entry.rejection_reason && (
                          <p className="text-xs text-destructive mt-1">Rejected: {entry.rejection_reason}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">View Only</span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredEntries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No LOP entries found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payroll Export Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PayrollExportWidget />
        <LOPExportWidget />
      </div>
    </div>
  );
}
