import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../../../components/ui/dialog";
import { Textarea } from "../../../components/ui/textarea";
import { toast } from "sonner";
import { Search, Save, Edit2, X, Plus, Download, RefreshCw, Calculator } from "lucide-react";
import { 
  fetchPayrollSummary,
  fetchProfiles,
  upsertEmployeeMaster,
  getEmployeeMaster,
  PayrollSummary,
  Profile,
  PayrollInput,
  formatCurrency,
  calculatePayroll,
  getPayrollStatistics
} from '../services/payrollSystemService';

export default function PayrollSystemPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<PayrollSummary | null>(null);
  const [formData, setFormData] = useState<PayrollInput>({
    employee_id: '',
    basic_salary: 0,
    increment: 0,
    incentive: 0,
    tds_percent: 1.0,
  });

  const queryClient = useQueryClient();

  // Fetch payroll summary
  const { 
    data: payrollData = [], 
    isLoading, 
    refetch 
  } = useQuery({
    queryKey: ['payroll-summary'],
    queryFn: fetchPayrollSummary
  });

  // Fetch profiles for employee selection
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: fetchProfiles
  });

  // Fetch statistics
  const { data: statistics } = useQuery({
    queryKey: ['payroll-statistics'],
    queryFn: getPayrollStatistics
  });

  // Upsert employee master mutation
  const upsertMutation = useMutation({
    mutationFn: upsertEmployeeMaster,
    onSuccess: () => {
      toast.success('Employee salary details updated successfully');
      setIsEditDialogOpen(false);
      setEditingEmployee(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['payroll-summary'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-statistics'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to update employee: ${error.message}`);
    }
  });

  // Filter payroll data
  const filteredData = payrollData.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = selectedDepartment === 'all' || employee.department === selectedDepartment;
    return matchesSearch && matchesDepartment;
  });

  // Get unique departments
  const departments = Array.from(new Set(profiles.map(p => p.department).filter(Boolean)));

  // Reset form
  const resetForm = () => {
    setFormData({
      employee_id: '',
      basic_salary: 0,
      increment: 0,
      incentive: 0,
      tds_percent: 1.0,
    });
  };

  // Handle edit
  const handleEdit = (employee: PayrollSummary) => {
    setEditingEmployee(employee);
    setFormData({
      employee_id: employee.id,
      basic_salary: employee.basic_salary,
      increment: employee.increment,
      incentive: employee.incentive,
      tds_percent: employee.tds_percent,
    });
    setIsEditDialogOpen(true);
  };

  // Handle save
  const handleSave = () => {
    if (!formData.employee_id || formData.basic_salary <= 0) {
      toast.error('Please select an employee and enter a valid basic salary');
      return;
    }

    upsertMutation.mutate(formData);
  };

  // Handle form input changes
  const handleInputChange = (field: keyof PayrollInput, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'employee_id' ? value as string : Number(value)
    }));
  };

  // Export to CSV
  const handleExport = () => {
    const csvContent = [
      [
        'Name', 'Department', 'Basic Salary', 'Increment', 'Incentive', 
        'LOP Days', 'LOP Amount', 'Gross Salary', 'TDS Amount', 'Final Salary'
      ].join(','),
      ...filteredData.map(emp => [
        emp.name,
        emp.department,
        emp.basic_salary,
        emp.increment,
        emp.incentive,
        emp.lop_days,
        emp.lop_amount,
        emp.gross_salary,
        emp.tds_amount,
        emp.final_salary
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-summary-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success('Payroll summary exported successfully');
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Payroll Management System</h1>
        <p className="text-muted-foreground">
          Manage employee salaries, LOP deductions, and payroll calculations
        </p>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.total_employees}</div>
              <p className="text-xs text-muted-foreground">
                {statistics.employees_with_salary} with salary records
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Basic Salary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(statistics.total_basic_salary)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Final Salary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(statistics.total_final_salary)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Average Final Salary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(statistics.average_final_salary)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-64">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name or department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="department">Department</Label>
              <select
                id="department"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="flex h-10 w-40 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
              className="mt-6"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={filteredData.length === 0}
              className="mt-6"
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payroll Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payroll Summary ({filteredData.length})</CardTitle>
          <CardDescription>
            {isLoading ? 'Loading payroll data...' : 'Employee salary calculations with LOP deductions'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredData.length === 0 && !isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              No payroll data found. Please ensure employees have salary records.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Basic Salary</TableHead>
                    <TableHead>Increment</TableHead>
                    <TableHead>Incentive</TableHead>
                    <TableHead>LOP Days</TableHead>
                    <TableHead>LOP Amount</TableHead>
                    <TableHead>Gross Salary</TableHead>
                    <TableHead>TDS Amount</TableHead>
                    <TableHead>Final Salary</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">
                        <div>
                          {employee.name}
                          {!employee.has_salary_record && (
                            <Badge variant="destructive" className="ml-2 text-xs">
                              No Salary Record
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{employee.department}</TableCell>
                      <TableCell>{formatCurrency(employee.basic_salary)}</TableCell>
                      <TableCell>{formatCurrency(employee.increment)}</TableCell>
                      <TableCell>{formatCurrency(employee.incentive)}</TableCell>
                      <TableCell>
                        <Badge variant={employee.lop_days > 0 ? "destructive" : "secondary"}>
                          {employee.lop_days}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(employee.lop_amount)}</TableCell>
                      <TableCell>{formatCurrency(employee.gross_salary)}</TableCell>
                      <TableCell>{formatCurrency(employee.tds_amount)}</TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(employee.final_salary)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(employee)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? 'Edit Employee Salary' : 'Add Employee Salary'}
            </DialogTitle>
            <DialogDescription>
              Update salary details for {editingEmployee?.name || 'employee'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="employee" className="text-right">
                Employee
              </Label>
              <select
                id="employee"
                value={formData.employee_id}
                onChange={(e) => handleInputChange('employee_id', e.target.value)}
                className="col-span-3 flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={!!editingEmployee}
              >
                <option value="">Select Employee</option>
                {profiles.map(profile => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} ({profile.department})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="basic_salary" className="text-right">
                Basic Salary
              </Label>
              <Input
                id="basic_salary"
                type="number"
                value={formData.basic_salary}
                onChange={(e) => handleInputChange('basic_salary', e.target.value)}
                className="col-span-3"
                min="0"
                step="0.01"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="increment" className="text-right">
                Increment
              </Label>
              <Input
                id="increment"
                type="number"
                value={formData.increment}
                onChange={(e) => handleInputChange('increment', e.target.value)}
                className="col-span-3"
                min="0"
                step="0.01"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="incentive" className="text-right">
                Incentive
              </Label>
              <Input
                id="incentive"
                type="number"
                value={formData.incentive}
                onChange={(e) => handleInputChange('incentive', e.target.value)}
                className="col-span-3"
                min="0"
                step="0.01"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="tds_percent" className="text-right">
                TDS %
              </Label>
              <Input
                id="tds_percent"
                type="number"
                value={formData.tds_percent}
                onChange={(e) => handleInputChange('tds_percent', e.target.value)}
                className="col-span-3"
                min="0"
                max="100"
                step="0.01"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {upsertMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calculation Notes */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Calculation Formula</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• <strong>Daily Salary:</strong> Basic Salary ÷ 30</p>
            <p>• <strong>LOP Amount:</strong> Daily Salary × LOP Days</p>
            <p>• <strong>Gross Salary:</strong> Basic Salary + Increment + Incentive</p>
            <p>• <strong>Salary After LOP:</strong> Gross Salary - LOP Amount</p>
            <p>• <strong>TDS Amount:</strong> Salary After LOP × TDS %</p>
            <p>• <strong>Final Salary:</strong> Salary After LOP - TDS Amount</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
