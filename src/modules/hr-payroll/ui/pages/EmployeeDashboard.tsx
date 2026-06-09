// @ts-nocheck
// Employee Dashboard Page
// Employee self-service interface for viewing profile and payroll history

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, Download, User, Calendar, DollarSign, FileText } from 'lucide-react';
import { toast } from 'sonner';

import {
  Employee,
  PayrollItemWithRun,
  PayrollStatus
} from '../../types';
import { getCurrentEmployeeProfile, getMyPayrollHistory } from '../../services/employeeService';
import { downloadPayslip, getPayslipPreview } from '../../services/payslipService';
import { PayrollCalculationService } from '../../services/payrollCalculation';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function EmployeeDashboard() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [payrollHistory, setPayrollHistory] = useState<PayrollItemWithRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollItemWithRun | null>(null);
  const [showPayslipDialog, setShowPayslipDialog] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Load employee profile and payroll history
  useEffect(() => {
    const loadData = async () => {
      try {
        const profileResult = await getCurrentEmployeeProfile();
        if (profileResult.success) {
          setEmployee(profileResult.data);
        } else {
          toast.error(profileResult.error || 'Failed to load employee profile');
        }

        const historyResult = await getMyPayrollHistory({ page: 1, limit: 50 });
        if (historyResult.success) {
          setPayrollHistory(historyResult.data || []);
        } else {
          toast.error(historyResult.error || 'Failed to load payroll history');
        }
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleDownloadPayslip = async (payrollItemId: string) => {
    setIsDownloading(true);
    try {
      await downloadPayslip(payrollItemId);
      toast.success('Payslip downloaded successfully');
    } catch (error) {
      console.error('Error downloading payslip:', error);
      toast.error('Failed to download payslip');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleViewPayslip = async (payrollItem: PayrollItemWithRun) => {
    try {
      const result = await getPayslipPreview(payrollItem.id);
      if (result.success) {
        setSelectedPayslip(payrollItem);
        setShowPayslipDialog(true);
      } else {
        toast.error(result.error || 'Failed to load payslip preview');
      }
    } catch (error) {
      console.error('Error loading payslip preview:', error);
      toast.error('Failed to load payslip preview');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

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
            <h1 className="text-3xl font-bold tracking-tight">Employee Dashboard</h1>
            <p className="text-muted-foreground">View your profile and payroll history</p>
          </div>
        </div>

        {/* Employee Profile Card */}
        {employee && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {employee.fullName.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-semibold">{employee.fullName}</h2>
                  <p className="text-sm text-muted-foreground">{employee.employeeId}</p>
                  <Badge variant={employee.status === 'ACTIVE' ? 'default' : 'secondary'} className="ml-2">
                    {employee.status}
                  </Badge>
                </div>
              </CardTitle>
              <CardDescription>Employee Profile Information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <div>
                    <p><strong>Department:</strong> {employee.department}</p>
                    <p><strong>Location:</strong> {employee.locationName || employee.locationType}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <div>
                    <p><strong>Joining Date:</strong> {new Date(employee.joiningDate).toLocaleDateString()}</p>
                    <p><strong>Phone:</strong> {employee.phoneNumber}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  <div>
                    <p><strong>Monthly Salary:</strong> {PayrollCalculationService.formatCurrency(employee.fixedMonthlySalary)}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <h4 className="font-semibold">Contact Information</h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <div>
                      <p><strong>Emergency Contact:</strong> {employee.emergencyContactNumber}</p>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p><strong>Address:</strong></p>
                    <p>{employee.address}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payroll History Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Payroll History
            </CardTitle>
            <CardDescription>Your salary history and downloadable payslips</CardDescription>
          </CardHeader>
          <CardContent>
            {payrollHistory.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Payroll Records</h3>
                <p className="text-muted-foreground">
                  Your payroll history will appear here once payroll is processed.
                </p>
              </div>
            ) : (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {payrollHistory.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Pay Periods</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {payrollHistory.reduce((sum, item) => sum + item.gross, 0).toLocaleString('en-IN')}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Gross</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-destructive">
                      {payrollHistory.reduce((sum, item) => sum + item.tds, 0).toLocaleString('en-IN')}
                    </div>
                    <div className="text-sm text-muted-foreground">Total TDS</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-700">
                      {payrollHistory.reduce((sum, item) => sum + item.net, 0).toLocaleString('en-IN')}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Net</div>
                  </div>
                </div>

                {/* Payroll History Table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Base Salary</TableHead>
                      <TableHead>LOP Days</TableHead>
                      <TableHead>Gross Pay</TableHead>
                      <TableHead>TDS (1%)</TableHead>
                      <TableHead>Net Pay</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollHistory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {months[item.payroll_runs.month - 1]} {item.payroll_runs.year}
                        </TableCell>
                        <TableCell>
                          {PayrollCalculationService.formatCurrency(item.baseMonthlySalary)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.lopDays > 0 ? 'destructive' : 'secondary'}>
                            {item.lopDays}
                          </Badge>
                        </TableCell>
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
                          <Badge variant={item.payroll_runs.status === 'FINAL' ? 'default' : 'secondary'}>
                            {item.payroll_runs.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleViewPayslip(item)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDownloadPayslip(item.id)} disabled={isDownloading}>
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>

        {/* Payslip Details Dialog */}
        <Dialog open={showPayslipDialog} onOpenChange={setShowPayslipDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Payslip Details</DialogTitle>
              <DialogDescription>
                Detailed breakdown of your payslip for{' '}
                {selectedPayslip && months[selectedPayslip.payroll_runs.month - 1]}{' '}
                {selectedPayslip?.payroll_runs.year}
              </DialogDescription>
            </DialogHeader>
            {selectedPayslip && (
              <div className="space-y-6">
                {/* Employee Info */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-4">Employee Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p><strong>Employee ID:</strong> {selectedPayslip.employee.employeeId}</p>
                      <p><strong>Name:</strong> {selectedPayslip.employee.fullName}</p>
                      <p><strong>Department:</strong> {selectedPayslip.employee.department}</p>
                    </div>
                    <div>
                      <p><strong>Location:</strong> {selectedPayslip.employee.locationName || selectedPayslip.employee.locationType}</p>
                      <p><strong>Joining Date:</strong> {new Date(selectedPayslip.employee.joiningDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                {/* Earnings */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-4">Earnings</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Base Salary:</span>
                      <span className="font-semibold">
                        {PayrollCalculationService.formatCurrency(selectedPayslip.earned)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bonus:</span>
                      <span className="font-semibold text-green-600">
                        +{PayrollCalculationService.formatCurrency(selectedPayslip.bonus)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Incentive:</span>
                      <span className="font-semibold text-green-600">
                        +{PayrollCalculationService.formatCurrency(selectedPayslip.incentive)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="font-semibold">Total Earnings:</span>
                      <span className="font-semibold">
                        {PayrollCalculationService.formatCurrency(selectedPayslip.gross)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-4">Deductions</h4>
                  <div className="space-y-2 text-sm">
                    {selectedPayslip.lopDays > 0 && (
                      <div className="flex justify-between">
                        <span>LOP ({selectedPayslip.lopDays} days):</span>
                        <span className="text-destructive">
                          -{PayrollCalculationService.formatCurrency(selectedPayslip.lopDays * (selectedPayslip.baseMonthlySalary / selectedPayslip.daysInMonth))}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>TDS (1%):</span>
                      <span className="text-destructive">
                        -{PayrollCalculationService.formatCurrency(selectedPayslip.tds)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>PF:</span>
                      <span className="text-destructive">
                        -{PayrollCalculationService.formatCurrency(selectedPayslip.pf)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>ESI:</span>
                      <span className="text-destructive">
                        -{PayrollCalculationService.formatCurrency(selectedPayslip.esi)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="font-semibold">Total Deductions:</span>
                      <span className="font-semibold text-destructive">
                        -{PayrollCalculationService.formatCurrency(selectedPayslip.tds + selectedPayslip.pf + selectedPayslip.esi + (selectedPayslip.lopDays * (selectedPayslip.baseMonthlySalary / selectedPayslip.daysInMonth)))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Net Pay */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="text-center">
                    <h4 className="font-semibold mb-2">Net Pay</h4>
                    <div className="text-3xl font-bold text-green-700">
                      {PayrollCalculationService.formatCurrency(selectedPayslip.net)}
                    </div>
                  </div>
                </div>

                {/* Payment Schedule */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-4">Payment Schedule</h4>
                  <div className="text-sm text-muted-foreground">
                    <p className="mb-2">
                      <strong>Company Policy:</strong> 1–20 days credited on 2nd of next month, 21–end credited on 10th of next month
                    </p>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Amount payable on 2nd of next month:</span>
                        <span className="font-semibold">
                          {PayrollCalculationService.formatCurrency(selectedPayslip.net * 0.67)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Amount payable on 10th of next month:</span>
                        <span className="font-semibold">
                          {PayrollCalculationService.formatCurrency(selectedPayslip.net * 0.33)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button variant="outline" onClick={() => setShowPayslipDialog(false)}>
                    Close
                  </Button>
                  <Button onClick={() => handleDownloadPayslip(selectedPayslip.id)} disabled={isDownloading}>
                    {isDownloading ? 'Downloading...' : 'Download Payslip'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  );
}
