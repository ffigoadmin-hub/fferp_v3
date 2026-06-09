import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Database,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Leaf,
  Building2,
  Loader2,
  ArrowRight,
  Timer,
  ExternalLink,
  History,
  Tractor,
  RefreshCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DepartmentBadge } from '@/components/DepartmentBadge';
import { useAuth } from '@/contexts/AuthContext';
import { useEscalationEngine } from '@/hooks/useEscalationEngine';
import {
  getTimeRemaining,
  formatMinutesRemaining,
  getResolveSLAStatus,
  isValidProofUrl,
  WorkflowDepartment,
} from '@/types/workflows';
import { format } from 'date-fns';
import { CriticalWizard } from '@/components/datateam/CriticalWizard';

// Critical schema removed (handled in Wizard)

function SLATimer({ deadline, isHourlyCritical = true }: { deadline: string; isHourlyCritical?: boolean }) {
  const [remaining, setRemaining] = useState(getTimeRemaining(deadline));
  useMemo(() => {
    const interval = setInterval(() => setRemaining(getTimeRemaining(deadline)), 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  const status = getResolveSLAStatus(deadline, isHourlyCritical);
  const statusColors = {
    ok: 'text-green-500',
    warning: 'text-yellow-500',
    critical: 'text-orange-500 animate-pulse',
    breached: 'text-destructive animate-pulse font-bold',
  };

  return (
    <div className={`flex items-center gap-2 font-mono ${statusColors[status]}`}>
      <Timer className="w-4 h-4" />
      <span>{remaining > 0 ? formatMinutesRemaining(remaining) : 'BREACHED'}</span>
    </div>
  );
}

export default function DataTeamDashboardPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { user } = useAuth();
  const {
    tickets: unifiedTickets,
    isLoading,
    isSaving,
    createCritical
  } = useEscalationEngine();

  const mySubmissions = useMemo(() =>
    unifiedTickets
      .filter(t => t.type === 'critical' && t.raw.created_by === user?.id)
      .slice(0, 10),
    [unifiedTickets, user]
  );

  const handleWizardSubmit = async (data: any) => {
    const result = await createCritical({
      department: data.department,
      bucket: data.bucket,
      issue_type: data.issue_type,
      issue_title: data.issue_title,
      issue_description: data.issue_description,
      proof_url: data.proof_url,
    });
    if (result.success) {
      setIsDialogOpen(false);
    }
    return result;
  };

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-purple-500/20 flex items-center justify-center"><Database className="w-7 h-7 text-purple-500" /></div>
          <div><h1 className="text-2xl font-bold mb-1">Data Team Dashboard</h1><p className="text-muted-foreground">Hourly Critical Management</p></div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" />Upload Critical</Button></DialogTrigger>
          {isDialogOpen && (
            <CriticalWizard
              onClose={() => setIsDialogOpen(false)}
              onSubmit={handleWizardSubmit}
              isSaving={isSaving}
            />
          )}
        </Dialog>
      </div>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><History className="w-5 h-5" />My Submissions (Last 10)</CardTitle></CardHeader><CardContent>
        {mySubmissions.length === 0 ? <div className="p-8 text-center text-muted-foreground"><Database className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>No submissions yet</p></div> : (
          <Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Type</TableHead><TableHead>Location</TableHead><TableHead>Status</TableHead><TableHead>Proof</TableHead></TableRow></TableHeader><TableBody>
            {mySubmissions.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-xs">{format(new Date(t.raw.created_at), 'dd MMM, HH:mm')}</TableCell>
                <TableCell>{t.raw.issue_type}</TableCell>
                <TableCell className="truncate max-w-[150px]">{t.raw.issue_title}</TableCell>
                <TableCell><Badge className={t.raw.status === 'resolved' ? 'bg-green-500' : t.raw.status === 'breached' ? 'bg-red-600' : 'bg-blue-500'}>{t.raw.status}</Badge></TableCell>
                <TableCell><a href={t.raw.proof_url} target="_blank" rel="noreferrer" className="text-primary hover:underline"><ExternalLink className="w-3 h-3" /></a></TableCell>
              </TableRow>
            ))}
          </TableBody></Table>
        )}
      </CardContent></Card>
    </motion.div>
  );
}
