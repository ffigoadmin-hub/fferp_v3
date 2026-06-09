import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Clock, 
  AlertTriangle,
  Zap,
  ExternalLink,
  Timer,
  Leaf,
  Building2,
  ArrowRight,
  User,
  CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useClientEscalations } from '@/hooks/useClientEscalations';
import { useHourlyCriticals } from '@/hooks/useHourlyCriticals';
import { 
  getTimeRemaining, 
  formatTimeRemaining,
  getTimeOverdue,
  ClientEscalation,
  HourlyCritical
} from '@/types/workflows';
import { format } from 'date-fns';

function TimeOverdue({ createdAt }: { createdAt: string }) {
  const [overdue, setOverdue] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const created = new Date(createdAt).getTime();
      setOverdue(Date.now() - created);
    }, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const hours = Math.floor(overdue / (1000 * 60 * 60));
  const minutes = Math.floor((overdue % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((overdue % (1000 * 60)) / 1000);

  return (
    <span className="font-mono text-destructive font-bold">
      {hours > 0 && `${hours}h `}{minutes}m {seconds}s
    </span>
  );
}

// Widget 1: Hourly Slot Escalations (From NSM Workflow)
export function CEOEscalationsWidget() {
  const { ceoEscalations, gmEscalations, isLoading } = useClientEscalations();

  // Tickets forwarded by GM OR auto-escalated to CEO
  const ceoLevelTickets = ceoEscalations;
  const gmPendingTickets = gmEscalations;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-500" />
            Hourly Slot Escalations
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          Loading...
        </CardContent>
      </Card>
    );
  }

  const allEscalations = [...ceoLevelTickets, ...gmPendingTickets];

  return (
    <Card className={ceoLevelTickets.length > 0 ? 'border-orange-500' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-500" />
            Hourly Slot Escalations
          </div>
          {ceoLevelTickets.length > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {ceoLevelTickets.length} Pending
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {allEscalations.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500" />
            <p className="text-sm text-muted-foreground">No escalations at CEO level</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {allEscalations.map((esc) => (
              <motion.div
                key={esc.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-3 rounded-lg border ${esc.status === 'escalated_ceo' ? 'bg-destructive/10 border-destructive' : 'bg-orange-500/10 border-orange-500/50'}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono">#{esc.ticket_number}</span>
                    {(esc.department as string) === 'Agri Operations' || (esc.department as string) === 'agri' ? (
                      <Leaf className="w-4 h-4 text-green-500" />
                    ) : (
                      <Building2 className="w-4 h-4 text-blue-500" />
                    )}
                    <Badge variant={esc.status === 'escalated_ceo' ? 'destructive' : 'secondary'} className="text-xs">
                      {esc.status === 'escalated_ceo' ? 'CEO Level' : 'GM Pending'}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(esc.created_at), 'HH:mm')}
                  </div>
                </div>

                <h4 className="font-medium text-sm mb-1">{esc.issue_title}</h4>
                
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {esc.client_name}
                  </span>
                  <span>Responsible: <strong>{esc.current_owner.toUpperCase()}</strong></span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs">
                    Time Open: <TimeOverdue createdAt={esc.created_at} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Widget 2: Critical Blasts (From Data Workflow)
export function CEOCriticalBlastsWidget() {
  const { breachedCriticals, isLoading } = useHourlyCriticals();
  const [flashState, setFlashState] = useState(true);

  // Flash animation for breached items
  useEffect(() => {
    if (breachedCriticals.length > 0) {
      const interval = setInterval(() => {
        setFlashState(prev => !prev);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [breachedCriticals.length]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-destructive" />
            Critical Blasts
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          Loading...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={breachedCriticals.length > 0 ? 'border-destructive bg-destructive/5' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className={`w-5 h-5 ${breachedCriticals.length > 0 ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`} />
            Critical Blasts
          </div>
          {breachedCriticals.length > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {breachedCriticals.length} ACTIVE
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {breachedCriticals.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500" />
            <p className="text-sm text-muted-foreground">No breached criticals</p>
            <p className="text-xs text-muted-foreground">All SLAs are being met</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {breachedCriticals.map((crit) => (
              <motion.div
                key={crit.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1,
                  backgroundColor: flashState ? 'hsl(var(--destructive) / 0.2)' : 'hsl(var(--destructive) / 0.1)'
                }}
                transition={{ backgroundColor: { duration: 0.5 } }}
                className="p-3 rounded-lg border border-destructive"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono">#{crit.ticket_number}</span>
                    {(crit.department as string) === 'Agri Operations' || (crit.department as string) === 'agri' ? (
                      <Leaf className="w-4 h-4 text-green-500" />
                    ) : (
                      <Building2 className="w-4 h-4 text-blue-500" />
                    )}
                    <Badge variant="destructive" className="text-xs">
                      {crit.issue_type}
                    </Badge>
                  </div>
                  <Zap className="w-4 h-4 text-destructive animate-pulse" />
                </div>

                <h4 className="font-medium text-sm mb-2 text-destructive">{crit.issue_title}</h4>

                <a 
                  href={crit.proof_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mb-2"
                >
                  <ExternalLink className="w-3 h-3" />
                  View Proof
                </a>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Time Overdue:</span>
                  <span className="font-mono text-destructive font-bold">
                    <TimeOverdue createdAt={crit.resolve_deadline} />
                  </span>
                </div>

                {crit.blast_triggered_at && (
                  <div className="mt-2 pt-2 border-t border-destructive/30 text-xs text-destructive">
                    <Zap className="w-3 h-3 inline mr-1" />
                    Blast triggered at {format(new Date(crit.blast_triggered_at), 'HH:mm:ss')}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Combined widget for CEO Dashboard
export function CEOWorkflowWidgets() {
  return (
    <div className="grid grid-cols-2 gap-6">
      <CEOEscalationsWidget />
      <CEOCriticalBlastsWidget />
    </div>
  );
}
