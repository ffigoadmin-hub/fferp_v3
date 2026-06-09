// @ts-nocheck
// HR Dashboard Page
// Complete HR management interface with employee management, payroll processing, and payslip generation

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

import {
  Plus,
  Search,
  Filter,
  Users,
  FileText,
  Download,
  Calendar,
  DollarSign,
  Edit,
  Trash2,
  Eye,
  Lock,
  Unlock,
  CheckCircle
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
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getDepartments
} from '../../services/employeeService';
import { type Department } from '../../services/employeeMasterService';
import {
  getPayrollRuns,
  generatePayroll,
  getPayrollItems,
  updatePayrollItem,
  finalizePayroll,
  unfinalizePayroll
} from '../../services/payrollService';
import {
  downloadBulkPayslips
} from '../../services/payslipService';
import { PayrollCalculationService } from '../../services/payrollCalculation';

const months = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleString('default', { month: 'long' })
);

export default function HRDashboard() {
  // State management
  const [activeTab, setActiveTab] = useState<'employees' | 'payroll'>('employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [selectedPayrollRun, setSelectedPayrollRun] = useState<PayrollRun | null>(null);
  const [payrollItems, setPayrollItems] = useState<PayrollItemWithEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPayroll, setIsGeneratingPayroll] = useState(false);
  const [isFinalizingPayroll, setIsFinalizingPayroll] = useState(false);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [showGeneratePayrollDialog, setShowGeneratePayrollDialog] = useState(false);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [isUnlockingPayroll, setIsUnlockingPayroll] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingPayrollItem, setEditingPayrollItem] = useState<PayrollItemWithEmployee | null>(null);
  const [showBonusIncentiveModal, setShowBonusIncentiveModal] = useState(false);
  const [bonusIncentiveType, setBonusIncentiveType] = useState<'bonus' | 'incentive'>('bonus');
  const [bonusIncentiveAmount, setBonusIncentiveAmount] = useState(0);
  const [filters, setFilters] = useState({
    department: '',
    status: '',
    search: ''
  });

  // Load initial data
  useEffect(() => {
    loadEmployees();
    loadPayrollRuns();
  }, []);

  // Load employees
  const loadEmployees = async () => {
    setIsLoading(true);
    try {
      const result = await getEmployees(filters);
      if (result.success) {
        setEmployees(result.data || []);
      } else {
        toast.error(result.error || 'Failed to load employees');
      }
    } catch (error) {
      console.error('Error loading employees:', error);
      toast.error('Failed to load employees');
    } finally {
      setIsLoading(false);
    }
  };

  // Load payroll runs
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

  // Load payroll items for selected run
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

  // Generate payroll
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

  // Finalize payroll
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

  // Unlock finalized payroll (revert to DRAFT)
  const handleUnlockPayroll = async () => {
    if (!selectedPayrollRun) return;

    setIsUnlockingPayroll(true);
    try {
      const result = await unfinalizePayroll(selectedPayrollRun.id);
      if (result.success) {
        toast.success('Payroll unlocked and reverted to draft');
        setShowUnlockDialog(false);
        loadPayrollRuns();
      } else {
        toast.error(result.error || 'Failed to unlock payroll');
      }
    } catch (error) {
      console.error('Error unlocking payroll:', error);
      toast.error('Failed to unlock payroll');
    } finally {
      setIsUnlockingPayroll(false);
    }
  };

  // Download bulk payslips
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

  // Update payroll item
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

  // Add bonus/incentive
  const handleAddBonusIncentive = (type: 'bonus' | 'incentive', payrollItem: PayrollItemWithEmployee) => {
    setBonusIncentiveType(type);
    setBonusIncentiveAmount(type === 'bonus' ? payrollItem.bonus : payrollItem.incentive);
    setShowBonusIncentiveModal(true);
  };

  // Save bonus/incentive
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
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">HR Dashboard</h1>
            <p className="text-muted-foreground">
              Manage employees, process payroll, and generate payslips
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-4 border-b">
          <button
            className={`pb-2 px-4 ${activeTab === 'employees' ? 'border-b-2 border-blue-500 text-blue-600' : 'border-transparent text-gray-600'}`}
            onClick={() => setActiveTab('employees')}
          >
            <Users className="h-4 w-4 mr-2" />
            Employees
          </button>
          <button
            className={`pb-2 px-4 ${activeTab === 'payroll' ? 'border-b-2 border-blue-500 text-blue-600' : 'border-transparent text-gray-600'}`}
            onClick={() => setActiveTab('payroll')}
          >
            <FileText className="h-4 w-4 mr-2" />
            Payroll
          </button>
        </div>

        {/* Employees Tab */}
        {activeTab === 'employees' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Employee Management */}
            <Card>
              <CardHeader>
                <CardTitle>Employee Management</CardTitle>
                <CardDescription>
                  Add, edit, and manage employee records
                </CardDescription>
                <div className="flex justify-between items-center">
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Search employees..."
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      className="w-64"
                    />
                    <Select value={filters.department} onValueChange={(value) => setFilters({ ...filters, department: value })}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Departments</SelectItem>
                        <SelectItem value="IT">IT</SelectItem>
                        <SelectItem value="HR">HR</SelectItem>
                        <SelectItem value="Operations">Operations</SelectItem>
                        <SelectItem value="Finance">Finance</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={() => setShowEmployeeDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Employee
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Salary</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((employee) => (
                        <TableRow key={employee.id}>
                          <TableCell className="font-medium">{employee.employeeId}</TableCell>
                          <TableCell>{employee.fullName}</TableCell>
                          <TableCell>{employee.department}</TableCell>
                          <TableCell>
                            <Badge variant={employee.status === 'ACTIVE' ? 'default' : 'secondary'}>
                              {employee.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {PayrollCalculationService.formatCurrency(employee.fixedMonthlySalary)}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingEmployee(employee)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteEmployee(employee.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Employee Dialog */}
            <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingEmployee ? 'Edit Employee' : 'Add Employee'}
                  </DialogTitle>
                </DialogHeader>
                <EmployeeForm
                  employee={editingEmployee}
                  onSave={(employeeData) => {
                    if (editingEmployee) {
                      updateEmployee(editingEmployee.id, employeeData);
                    } else {
                      createEmployee(employeeData);
                    }
                    setShowEmployeeDialog(false);
                    setEditingEmployee(null);
                    loadEmployees();
                  }}
                  onCancel={() => {
                    setShowEmployeeDialog(false);
                    setEditingEmployee(null);
                  }}
                />
              </DialogContent>
            </Dialog>
          </motion.div>
        )}

        {/* Payroll Tab */}
        {activeTab === 'payroll' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Payroll Generation */}
            <Card>
              <CardHeader>
                <CardTitle>Payroll Generation</CardTitle>
                <CardDescription>
                  Generate payroll runs and manage payroll items
                </CardDescription>
                <div className="flex justify-between items-center">
                  <div className="flex space-x-2">
                    <Button onClick={() => setShowGeneratePayrollDialog(true)}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Generate Payroll
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Payroll Runs List */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4">Payroll Runs</h3>
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
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedPayrollRun(run);
                                    setShowUnlockDialog(true);
                                  }}
                                >
                                  <Unlock className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Payroll Items */}
                {selectedPayrollRun && (
                  <div className="mt-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">
                        Payroll Items - {months[selectedPayrollRun.month - 1]} {selectedPayrollRun.year}
                      </h3>
                      <Button onClick={() => handleDownloadBulkPayslips()}>
                        <Download className="h-4 w-4 mr-2" />
                        Download All Payslips
                      </Button>
                    </div>
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
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAddBonusIncentive('bonus', item)}
                                >
                                  + Bonus
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAddBonusIncentive('incentive', item)}
                                >
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
                              <div className="flex space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingPayrollItem(item)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

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
                      <Select id="month">
                        <SelectTrigger>
                          <SelectValue placeholder="Select month" />
                        </SelectTrigger>
                        <SelectContent>
                          {months.map((month, index) => (
                            <SelectItem key={index} value={index + 1}>
                              {month}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="year">Year</Label>
                      <Input
                        id="year"
                        type="number"
                        placeholder="Enter year"
                        min={2020}
                        max={2100}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowGeneratePayrollDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        const monthSelect = document.getElementById('month') as HTMLSelectElement;
                        const yearInput = document.getElementById('year') as HTMLInputElement;
                        
                        if (monthSelect && yearInput) {
                          handleGeneratePayroll(
                            parseInt(monthSelect.value),
                            parseInt(yearInput.value)
                          );
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

            {/* Unlock Payroll Dialog */}
            <Dialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Unlock Payroll</DialogTitle>
                  <DialogDescription>
                    This will revert the payroll run back to DRAFT, allowing edits. Are you sure?
                  </DialogDescription>
                </DialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setShowUnlockDialog(false)}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction onClick={handleUnlockPayroll}>
                    {isUnlockingPayroll ? 'Unlocking...' : 'Unlock Payroll'}
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
                    <Button
                      onClick={handleSaveBonusIncentive}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Saving...' : `Add ${bonusIncentiveType}`}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

// Employee Form Component
interface EmployeeFormProps {
  employee?: Employee | null;
  onSave: (employeeData: any) => void;
  onCancel: () => void;
}

function EmployeeForm({ employee, onSave, onCancel }: EmployeeFormProps) {
  const [formData, setFormData] = useState({
    employeeId: '',
    fullName: '',
    joiningDate: '',
    phoneNumber: '',
    dob: '',
    emergencyContactNumber: '',
    address: '',
    department: '',
    locationType: 'HEAD_OFFICE' as LocationType,
    locationName: '',
    status: 'ACTIVE' as EmployeeStatus,
    fixedMonthlySalary: 0,
    bankAccountNumber: '',
    bankName: '',
    bankIfsc: ''
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false);

  // Fetch departments on mount
  useEffect(() => {
    const loadDepartments = async () => {
      setIsLoadingDepartments(true);
      try {
        const deptData = await getDepartments();
        setDepartments(deptData);
      } catch (error) {
        console.error('Failed to load departments:', error);
        toast.error('Failed to load departments');
      } finally {
        setIsLoadingDepartments(false);
      }
    };
    loadDepartments();
  }, []);

  useEffect(() => {
    if (employee) {
      setFormData({
        employeeId: employee.employeeId,
        fullName: employee.fullName,
        joiningDate: employee.joiningDate,
        phoneNumber: employee.phoneNumber,
        dob: employee.dob,
        emergencyContactNumber: employee.emergencyContactNumber,
        address: employee.address,
        department: employee.department,
        locationType: employee.locationType,
        locationName: employee.locationName || '',
        status: employee.status,
        fixedMonthlySalary: employee.fixedMonthlySalary,
        bankAccountNumber: employee.bankAccountNumber || '',
        bankName: employee.bankName || '',
        bankIfsc: employee.bankIfsc || ''
      });
    }
  }, [employee]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="employeeId">Employee ID</Label>
          <Input
            id="employeeId"
            value={formData.employeeId}
            onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
            placeholder="EMP001"
            disabled={!!employee}
          />
        </div>
        <div>
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            placeholder="Enter full name"
            required
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="joiningDate">Joining Date</Label>
          <Input
            id="joiningDate"
            type="date"
            value={formData.joiningDate}
            onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="phoneNumber">Phone Number</Label>
          <Input
            id="phoneNumber"
            value={formData.phoneNumber}
            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
            placeholder="Enter phone number"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="dob">Date of Birth</Label>
          <Input
            id="dob"
            type="date"
            value={formData.dob}
            onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="emergencyContactNumber">Emergency Contact</Label>
          <Input
            id="emergencyContactNumber"
            value={formData.emergencyContactNumber}
            onChange={(e) => setFormData({ ...formData, emergencyContactNumber: e.target.value })}
            placeholder="Enter emergency contact"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Enter address"
            required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="department">Department</Label>
          <Select 
            value={formData.department} 
            onValueChange={(value) => setFormData({ ...formData, department: value })}
            disabled={isLoadingDepartments}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoadingDepartments ? "Loading..." : "Select department"} />
            </SelectTrigger>
            <SelectContent>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.name}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="locationType">Location Type</Label>
          <Select value={formData.locationType} onValueChange={(value) => setFormData({ ...formData, locationType: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select location type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={LocationType.HEAD_OFFICE}>Head Office</SelectItem>
              <SelectItem value={LocationType.BACK_OFFICE}>Back Office</SelectItem>
              <SelectItem value={LocationType.OTHER}>Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EmployeeStatus.ACTIVE}>Active</SelectItem>
              <SelectItem value={EmployeeStatus.INACTIVE}>Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="fixedMonthlySalary">Fixed Monthly Salary</Label>
          <Input
            id="fixedMonthlySalary"
            type="number"
            value={formData.fixedMonthlySalary}
            onChange={(e) => setFormData({ ...formData, fixedMonthlySalary: parseFloat(e.target.value) || 0 })}
            placeholder="Enter fixed monthly salary"
            min={0}
            required
          />
        </div>
      </div>

      {/* Bank Details */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold">Bank Details (Optional)</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="bankAccountNumber">Account Number</Label>
            <Input
              id="bankAccountNumber"
              value={formData.bankAccountNumber}
              onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
              placeholder="Enter bank account number"
            />
          </div>
          <div>
            <Label htmlFor="bankName">Bank Name</Label>
            <Input
              id="bankName"
              value={formData.bankName}
              onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              placeholder="Enter bank name"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="bankIfsc">IFSC Code</Label>
            <Input
              id="bankIfsc"
              value={formData.bankIfsc}
              onChange={(e) => setFormData({ ...formData, bankIfsc: e.target.value })}
              placeholder="Enter IFSC code"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit">
          {employee ? 'Update Employee' : 'Create Employee'}
        </Button>
      </div>
    </form>
  );
}
