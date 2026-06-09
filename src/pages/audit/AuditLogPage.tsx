import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileSearch, Clock, User, Filter, ChevronDown, ChevronUp, Trash2, Loader2, Handshake } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useAuditLogs, AuditLogEntry } from '@/hooks/useAuditLogs';
import { useAuth } from '@/contexts/AuthContext';

const actionColors: Record<string, { bg: string; text: string }> = {
  CEO_APPROVED: { bg: 'bg-status-live/20', text: 'text-status-live' },
  CEO_HOLD: { bg: 'bg-authority-ceo/20', text: 'text-authority-ceo' },
  ADMIN_APPROVED: { bg: 'bg-status-live/20', text: 'text-status-live' },
  ADMIN_REJECTED: { bg: 'bg-status-missed/20', text: 'text-status-missed' },
  PAYMENT_EXECUTED: { bg: 'bg-status-live/20', text: 'text-status-live' },
  ATTENDANCE_MARKED: { bg: 'bg-authority-hr/20', text: 'text-authority-hr' },
  DAY_START_SUBMITTED: { bg: 'bg-primary/20', text: 'text-primary' },
  HOURLY_REPORT_LATE: { bg: 'bg-status-late/20', text: 'text-status-late' },
  EOD_SUBMITTED: { bg: 'bg-primary/20', text: 'text-primary' },
  USER_CREATED: { bg: 'bg-primary/20', text: 'text-primary' },
  USER_DELETED: { bg: 'bg-status-missed/20', text: 'text-status-missed' },
  USER_UPDATED: { bg: 'bg-status-late/20', text: 'text-status-late' },
  PROJECT_CREATED: { bg: 'bg-primary/20', text: 'text-primary' },
  PROJECT_UPDATED: { bg: 'bg-status-late/20', text: 'text-status-late' },
  BUDGET_FROZEN: { bg: 'bg-authority-ceo/20', text: 'text-authority-ceo' },
};

export function AuditLogPage() {
  const { user } = useAuth();
  const { logs, isLoading, isDeleting, deleteLog } = useAuditLogs();
  const [filterAction, setFilterAction] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [deletingLog, setDeletingLog] = useState<AuditLogEntry | null>(null);

  const isAdmin = user?.role === 'admin';

  const filteredLogs = logs.filter(log => {
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    const matchesSearch = searchQuery === '' || 
      log.record_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.performed_by_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAction && matchesSearch;
  });

  const uniqueActions = [...new Set(logs.map(l => l.action))];

  // JV Payment Detection: checks after_state for jv-related data
  const isJvLog = (log: AuditLogEntry): boolean => {
    try {
      const state = typeof log.after_state === 'string' ? JSON.parse(log.after_state) : log.after_state;
      if (!state) return false;
      if (state.is_jv_payment === true) return true;
      const dept = (state.department || '').toLowerCase();
      if (dept.includes('jv')) return true;
      return false;
    } catch {
      return false;
    }
  };

  const handleDelete = async () => {
    if (!deletingLog) return;
    await deleteLog(deletingLog.id);
    setDeletingLog(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
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
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
            <FileSearch className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-1">Audit Log</h1>
            <p className="text-muted-foreground">Complete forensic trail of all actions</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by ID or user..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-64"
        />
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {uniqueActions.map(action => (
              <SelectItem key={action} value={action}>{action.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filteredLogs.length} entries</span>
      </div>

      {/* Logs List */}
      <div className="space-y-3">
        {filteredLogs.map((log, index) => {
          const actionStyle = actionColors[log.action] || { bg: 'bg-muted/30', text: 'text-muted-foreground' };
          const isExpanded = expandedLog === log.id;

          return (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              className={cn(
                'authority-card',
                isJvLog(log) && 'border-l-4 border-l-amber-500 bg-amber-500/[0.03]'
              )}
            >
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedLog(isExpanded ? null : log.id)}
              >
                <div className="flex items-center gap-4">
                  {/* Timestamp */}
                  <div className="text-center min-w-[80px]">
                    <p className="font-mono text-sm font-semibold">
                      {format(new Date(log.created_at), 'HH:mm')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), 'dd MMM')}
                    </p>
                  </div>

                  <div className="h-10 w-px bg-border" />

                  {/* Action Badge */}
                  <span className={cn(
                    'px-3 py-1 rounded text-xs font-semibold uppercase tracking-wider',
                    actionStyle.bg, actionStyle.text
                  )}>
                    {log.action.replace(/_/g, ' ')}
                  </span>

                  {/* JV Payment Badge */}
                  {isJvLog(log) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 text-[10px] font-bold uppercase tracking-widest">
                      <Handshake className="w-3 h-3" />
                      JV Payment
                    </span>
                  )}

                  {/* Record Info */}
                  <div>
                    <p className="font-medium">{log.record_type}</p>
                    <p className="text-sm text-muted-foreground font-mono">{log.record_id || 'N/A'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Performed By */}
                  <div className="text-right">
                    <p className="text-sm font-medium flex items-center gap-1 justify-end">
                      <User className="w-3 h-3" />
                      {log.performed_by_name || 'System'}
                    </p>
                    <p className="text-xs text-muted-foreground uppercase">{log.performed_by_role || 'system'}</p>
                  </div>

                  {/* Admin Delete Button */}
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingLog(log);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 pt-4 border-t border-border"
                >
                  <div className="grid grid-cols-2 gap-4">
                    {log.before_state && (
                      <div className="p-3 rounded-lg bg-muted/30">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Before</p>
                        <pre className="text-sm font-mono overflow-auto max-h-32">
                          {typeof log.before_state === 'string' 
                            ? log.before_state 
                            : JSON.stringify(log.before_state, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.after_state && (
                      <div className="p-3 rounded-lg bg-muted/30">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">After</p>
                        <pre className="text-sm font-mono overflow-auto max-h-32">
                          {typeof log.after_state === 'string' 
                            ? log.after_state 
                            : JSON.stringify(log.after_state, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                  {log.remarks && (
                    <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Remarks</p>
                      <p className="text-sm">{log.remarks}</p>
                    </div>
                  )}
                  <div className="mt-3 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Full timestamp: {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}

        {filteredLogs.length === 0 && (
          <div className="authority-card text-center py-12">
            <FileSearch className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-semibold">No Logs Found</p>
            <p className="text-muted-foreground">
              {logs.length === 0 
                ? 'No audit entries recorded yet. Actions will be logged as they occur.'
                : 'No audit entries match your filter'}
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingLog} onOpenChange={(open) => !open && setDeletingLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Delete Audit Log Entry
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this audit log entry? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deletingLog && (
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="font-medium">{deletingLog.action.replace(/_/g, ' ')}</p>
              <p className="text-sm text-muted-foreground">
                {deletingLog.record_type} • {format(new Date(deletingLog.created_at), 'dd MMM yyyy HH:mm')}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingLog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
