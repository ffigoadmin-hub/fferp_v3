// @ts-nocheck
// Payroll Management Page
// Complete payroll processing interface with generation, editing, and finalization

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Calendar,
  DollarSign,
  Edit,
  Download,
  Eye,
  Lock,
  Unlock,
  FileText,
} from 'lucide-react';

import {
  Employee,
  PayrollRun,
  PayrollStatus,
  LocationType,
  EmployeeStatus,
  PayrollItemWithEmployee
} from '../../types';
import {
  getPayrollRuns,
  generatePayroll,
  getPayrollItems,
  updatePayrollItem,
  finalizePayroll
} from '../../services/payrollService';
import { downloadBulkPayslips } from '../../services/payslipService';
import { PayrollCalculationService } from '../../services/payrollCalculation';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function PayrollManagementPage() {
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [selectedPayrollRun, setSelectedPayrollRun] = useState<PayrollRun | null>(null);
  const [payrollItems, setPayrollItems] = useState<PayrollItemWithEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPayroll, setIsGeneratingPayroll] = useState(false);
  const [isFinalizingPayroll, setIsFinalizingPayroll] = useState(false);
  const [showGeneratePayrollDialog, setShowGeneratePayrollDialog] = useState(false);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [editingPayrollItem, setEditingPayrollItem] = useState<PayrollItemWithEmployee | null>(null);
  const [showBonusIncentiveModal, setShowBonusIncentiveModal] = useState(false);
  const [bonusIncentiveType, setBonusIncentiveType] = useState<'bonus' | 'incentive'>('bonus');
  const [bonusIncentiveAmount, setBonusIncentiveAmount] = useState(0);

  useEffect(() => {
    loadPayrollRuns();
  }, []);

  const loadPayrollRuns = async () => {
    setIsLoading(true);
    try {
      const result = await getPayrollRuns({});
      if (result.success) {
        setPayrollRuns(result.data || []);
      } else {
        toast.error(result.error || 'Failed to load payroll runs');
      }
    } catch (error) {
      console.error('Error loading payroll runs:', error);
      toast.error('Failed to load payroll runs');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPayrollItems = async (payrollRunId: string) => {
    setIsLoading(true);
    try {
      const result = await getPayrollItems(payrollRunId);
      if (result.success) {
        setPayrollItems(result.data || []);
      } else {
        toast.error(result.error || 'Failed to load payroll items');
      }
    } catch (error) {
      console.error('Error loading payroll items:', error);
      toast.error('Failed to load payroll items');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePayroll = async (month: number, year: number) => {
    setIsGeneratingPayroll(true);
    try {
      const result = await generatePayroll({ month, year });
      if (result.success) {
        toast.success('Payroll generated successfully');
        setShowGeneratePayrollDialog(false);
        loadPayrollRuns();
        if (result.data) {
          setSelectedPayrollRun(result.data);
          loadPayrollItems(result.data.id);
        }
      } else {
        toast.error(result.error || 'Failed to generate payroll');
      }
    } catch (error) {
      console.error('Error generating payroll:', error);
      toast.error('Failed to generate payroll');
    } finally {
      setIsGeneratingPayroll(false);
    }
  };

  const handleFinalizePayroll = async () => {
    if (!selectedPayrollRun) return;
    setIsFinalizingPayroll(true);
    try {
      const result = await finalizePayroll(selectedPayrollRun.id, { finalizedBy: 'current-user' });
      if (result.success) {
        toast.success('Payroll finalized successfully');
        setShowFinalizeDialog(false);
        loadPayrollRuns();
        loadPayrollItems(selectedPayrollRun.id);
      } else {
        toast.error(result.error || 'Failed to finalize payroll');
      }
    } catch (error) {
      console.error('Error finalizing payroll:', error);
      toast.error('Failed to finalize payroll');
    } finally {
      setIsFinalizingPayroll(false);
    }
  };

  const handleDownloadBulkPayslips = async () => {
    if (!selectedPayrollRun) return;
    setIsLoading(true);
    try {
      await downloadBulkPayslips(selectedPayrollRun.id);
      toast.success('Bulk payslip download started');
    } catch (error) {
      console.error('Error downloading bulk payslips:', error);
      toast.error('Failed to download bulk payslips');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePayrollItem = async (payrollItem: PayrollItemWithEmployee) => {
    if (!payrollItem) return;
    setIsLoading(true);
    try {
      const result = await updatePayrollItem(payrollItem.id, {
        lopDays: payrollItem.lopDays,
        bonus: payrollItem.bonus,
        incentive: payrollItem.incentive
      });
      if (result.success) {
        toast.success('Payroll item updated successfully');
        loadPayrollItems(payrollItem.payrollRunId);
      } else {
        toast.error(result.error || 'Failed to update payroll item');
      }
    } catch (error) {
      console.error('Error updating payroll item:', error);
      toast.error('Failed to update payroll item');
    } finally {
      setIsLoading(false);
      setEditingPayrollItem(null);
    }
  };

  const handleAddBonusIncentive = (type: 'bonus' | 'incentive', payrollItem: PayrollItemWithEmployee) => {
    setBonusIncentiveType(type);
    setBonusIncentiveAmount(type === 'bonus' ? payrollItem.bonus : payrollItem.incentive);
    setEditingPayrollItem(payrollItem);
    setShowBonusIncentiveModal(true);
  };

  const handleSaveBonusIncentive = async () => {
    if (!editingPayrollItem) return;
    setIsLoading(true);
    try {
      const updateData = bonusIncentiveType === 'bonus'
        ? { bonus: bonusIncentiveAmount }
        : { incentive: bonusIncentiveAmount };
      const result = await updatePayrollItem(editingPayrollItem.id, updateData);
      if (result.success) {
        toast.success(`${bonusIncentiveType === 'bonus' ? 'Bonus' : 'Incentive'} added successfully`);
        loadPayrollItems(editingPayrollItem.payrollRunId);
      } else {
        toast.error(result.error || `Failed to add ${bonusIncentiveType}`);
      }
    } catch (error) {
      console.error('Error adding bonus/incentive:', error);
      toast.error(`Failed to add ${bonusIncentiveType}`);
    } finally {
      setIsLoading(false);
      setShowBonusIncentiveModal(false);
      setBonusIncentiveAmount(0);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Payroll Management</h1>
            <p className="text-muted-foreground">Generate payroll runs and manage payroll items</p>
          </div>
        </div>

        {/* Payroll Runs List */}
        <Card>
          <CardHeader>
            <CardTitle>Payroll Runs</CardTitle>
            <CardDescription>Select and manage payroll runs</CardDescription>
            <div className="flex justify-between items-center">
              <Button onClick={() => setShowGeneratePayrollDialog(true)}>
                <Calendar className="h-4 w-4 mr-2" />
                Generate Payroll
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Net Pay</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollRuns.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium">
                        {months[run.month - 1]} {run.year}
                      </TableCell>
                      <TableCell>
                        <Badge variant={run.status === 'FINAL' ? 'default' : 'secondary'}>
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{run.totalEmployees}</TableCell>
                      <TableCell>
                        {PayrollCalculationService.formatCurrency(run.totalNetPay)}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedPayrollRun(run);
                              loadPayrollItems(run.id);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {run.status === 'DRAFT' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedPayrollRun(run);
                                setShowFinalizeDialog(true);
                              }}
                            >
                              <Lock className="h-4 w-4" />
                            </Button>
                          )}
                          {run.status === 'FINAL' && (
                            <Button variant="ghost" size="sm" onClick={() => setSelectedPayrollRun(run)}>
                              <Unlock className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Payroll Items */}
        {selectedPayrollRun && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <FileText className="h-5 w-5" />
                Payroll Items - {months[selectedPayrollRun.month - 1]} {selectedPayrollRun.year}
              </CardTitle>
              <CardDescription>Manage payroll items for selected period</CardDescription>
              <div className="flex justify-between items-center">
                <Button onClick={handleDownloadBulkPayslips}>
                  <Download className="h-4 w-4 mr-2" />
                  Download All Payslips
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Base Salary</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>LOP</TableHead>
                      <TableHead>Bonus</TableHead>
                      <TableHead>Incentive</TableHead>
                      <TableHead>Gross</TableHead>
                      <TableHead>TDS</TableHead>
                      <TableHead>Net</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.employee.fullName}</TableCell>
                        <TableCell>
                          {PayrollCalculationService.formatCurrency(item.baseMonthlySalary)}
                        </TableCell>
                        <TableCell>{item.daysInMonth}</TableCell>
                        <TableCell>
                          <Badge variant={item.lopDays > 0 ? 'destructive' : 'secondary'}>
                            {item.lopDays}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-1">
                            <Button variant="ghost" size="sm" onClick={() => handleAddBonusIncentive('bonus', item)}>
                              + Bonus
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleAddBonusIncentive('incentive', item)}>
                              + Incentive
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>{PayrollCalculationService.formatCurrency(item.bonus)}</TableCell>
                        <TableCell>{PayrollCalculationService.formatCurrency(item.incentive)}</TableCell>
                        <TableCell>
                          {PayrollCalculationService.formatCurrency(item.gross)}
                        </TableCell>
                        <TableCell>
                          {PayrollCalculationService.formatCurrency(item.tds)}
                        </TableCell>
                        <TableCell>
                          {PayrollCalculationService.formatCurrency(item.net)}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => setEditingPayrollItem(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Generate Payroll Dialog */}
        <Dialog open={showGeneratePayrollDialog} onOpenChange={setShowGeneratePayrollDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Generate Payroll</DialogTitle>
              <DialogDescription>
                Select month and year to generate payroll for all active employees
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="month">Month</Label>
                  <Select>
                    <SelectTrigger id="month">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((month, index) => (
                        <SelectItem key={index} value={String(index + 1)}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="year">Year</Label>
                  <Input id="year" type="number" placeholder="Enter year" min={2020} max={2100} />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowGeneratePayrollDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const monthEl = document.getElementById('month') as HTMLSelectElement;
                    const yearInput = document.getElementById('year') as HTMLInputElement;
                    if (monthEl && yearInput) {
                      handleGeneratePayroll(parseInt(monthEl.value), parseInt(yearInput.value));
                    }
                  }}
                  disabled={isGeneratingPayroll}
                >
                  {isGeneratingPayroll ? 'Generating...' : 'Generate Payroll'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Finalize Payroll Dialog */}
        <Dialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Finalize Payroll</DialogTitle>
              <DialogDescription>
                Are you sure you want to finalize this payroll? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowFinalizeDialog(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleFinalizePayroll}>
                {isFinalizingPayroll ? 'Finalizing...' : 'Finalize Payroll'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bonus/Incentive Modal */}
        <Dialog open={showBonusIncentiveModal} onOpenChange={setShowBonusIncentiveModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Add {bonusIncentiveType === 'bonus' ? 'Bonus' : 'Incentive'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter amount"
                  value={bonusIncentiveAmount}
                  onChange={(e) => setBonusIncentiveAmount(parseFloat(e.target.value) || 0)}
                  min={0}
                  step={0.01}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowBonusIncentiveModal(false);
                    setBonusIncentiveAmount(0);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveBonusIncentive} disabled={isLoading}>
                  {isLoading ? 'Saving...' : `Add ${bonusIncentiveType}`}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  );
}
