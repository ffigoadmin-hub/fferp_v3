/**
 * Employee Activity Modal
 * Detailed view of employee's hourly plans and reports for management (CEO/Admin/BOI/GM)
 * Uses real-time subscriptions for live updates
 */

import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Clock, ClipboardList, FileText, Camera, User, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmployeeActivity } from '@/hooks/useEmployeeActivity';
import { TIME_SLOTS, findBySlot, formatSlotDisplay } from '@/lib/slotHelpers';
import { Button } from '@/components/ui/button';

interface EmployeeActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string | null;
  employeeName: string;
  selectedDate: Date;
}

export function EmployeeActivityModal({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  selectedDate,
}: EmployeeActivityModalProps) {
  // Use the real-time hook for live updates
  const {
    plans,
    reports,
    selfies,
    eodReport,
    loginTime,
    isLoading,
    refetch
  } = useEmployeeActivity(isOpen ? employeeId : null, selectedDate);

  const getSelfieLabel = (type: string) => {
    switch (type) {
      case 'morning_login': return 'Morning';
      case 'afternoon_break': return 'Afternoon';
      case 'evening_break': return 'Evening';
      default: return type;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5" />
              {employeeName} - Detailed Activity
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
                LIVE
              </Badge>
              <Button variant="ghost" size="icon" onClick={refetch} disabled={isLoading}>
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              </Button>
            </div>
          </DialogTitle>
          <DialogDescription>
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </DialogDescription>
        </DialogHeader>

        {isLoading && !plans.length && !reports.length ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-6">
              {/* Summary Row */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Login Time</span>
                  </div>
                  <p className={cn(
                    "font-mono font-semibold",
                    !loginTime ? "text-status-missed" : "text-foreground"
                  )}>
                    {loginTime || 'NO LOGIN'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 mb-1">
                    <ClipboardList className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Plans</span>
                  </div>
                  <p className="font-semibold">{plans.length}/8</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Reports</span>
                  </div>
                  <p className="font-semibold">{reports.length}/8</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Camera className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Selfies</span>
                  </div>
                  <p className="font-semibold">{selfies.length}/3</p>
                </div>
              </div>

              {/* Hourly Activity Table */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" />
                  Hourly Plans & Reports
                </h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Time Slot</TableHead>
                      <TableHead>Plan Text</TableHead>
                      <TableHead>Report Text</TableHead>
                      <TableHead className="w-[120px] text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {TIME_SLOTS.map((slotId) => {
                      // Use the helper to find matching records
                      const plan = findBySlot(plans, slotId);
                      const report = findBySlot(reports, slotId);

                      return (
                        <TableRow key={slotId}>
                          <TableCell className="font-mono text-sm">
                            {formatSlotDisplay(slotId)}
                          </TableCell>
                          <TableCell>
                            {plan ? (
                              <p className="text-sm">{plan.plan_text}</p>
                            ) : (
                              <span className="text-muted-foreground text-xs">No plan</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {report ? (
                              <p className="text-sm">{report.report_text}</p>
                            ) : (
                              <span className="text-muted-foreground text-xs">No report</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {report ? (
                              report.is_late ? (
                                <Badge variant="destructive" className="text-xs">
                                  Late +{report.delay_minutes}m
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs bg-status-live/10 text-status-live border-status-live/30">
                                  On Time
                                </Badge>
                              )
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Selfies */}
              {selfies.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Captured Selfies
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    {selfies.map((selfie) => (
                      <div key={selfie.id} className="p-3 rounded-lg bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-2">
                          {getSelfieLabel(selfie.selfie_type)}
                        </p>
                        <p className="text-sm font-mono">
                          {format(new Date(selfie.captured_at), 'hh:mm:ss a')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* EOD Report */}
              {eodReport && (
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    End of Day Report
                  </h4>
                  <div className="p-4 rounded-lg bg-muted/30 space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Planned Work</p>
                      <p className="text-sm">{eodReport.planned_work}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Completed Work</p>
                      <p className="text-sm">{eodReport.completed_work}</p>
                    </div>
                    {eodReport.pending_items && (
                      <div>
                        <p className="text-xs text-muted-foreground">Pending Items</p>
                        <p className="text-sm">{eodReport.pending_items}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">Completion</p>
                      <p className="text-sm font-semibold">{eodReport.completion_percentage}%</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
