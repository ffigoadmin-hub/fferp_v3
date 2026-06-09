import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { toast } from "sonner";
import { Download, RefreshCw } from "lucide-react";
import { 
  fetchEmployeeSalaryWithLOP,
  EmployeeSalaryWithLOP,
  formatCurrency
} from '../services/salaryCalculationService';

export default function SalaryCalculationPage() {
  // Fetch salary data with increment and incentive
  const { 
    data: salaryData = [], 
    isLoading, 
    refetch 
  } = useQuery({
    queryKey: ['employee-salary-with-lop'],
    queryFn: fetchEmployeeSalaryWithLOP
  });

  // Calculate totals
  const totals = salaryData.reduce(
    (acc, employee) => ({
      grossSalary: acc.grossSalary + employee.gross_salary,
      tds: acc.tds + employee.tds,
      netSalary: acc.netSalary + employee.net_salary,
      lopDays: acc.lopDays + employee.lop_days
    }),
    { grossSalary: 0, tds: 0, netSalary: 0, lopDays: 0 }
  );

  const handleExport = () => {
    const csvContent = [
      // Header
      ['Employee ID', 'Name', 'Department', 'Basic Salary', 'Increment', 'Incentive', 'LOP Days', 'Gross Salary', 'TDS', 'Net Salary'].join(','),
      // Data rows
      ...salaryData.map(emp => [
        emp.employee_id,
        emp.full_name,
        emp.department,
        emp.fixed_monthly_salary,
        emp.increment,
        emp.incentive,
        emp.lop_days,
        emp.gross_salary,
        emp.tds,
        emp.net_salary
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `salary-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success('Salary report exported successfully');
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Salary Calculation</h1>
        <p className="text-muted-foreground">
          View employee salary calculations with LOP deductions
        </p>
      </div>

      {/* Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={salaryData.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salaryData.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Gross Salary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.grossSalary)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total TDS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.tds)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Net Salary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.netSalary)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Employee Table */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Salary Details ({salaryData.length})</CardTitle>
          <CardDescription>
            {isLoading ? 'Loading salary data...' : 'Monthly salary calculations with LOP deductions, increment, and incentive'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {salaryData.length === 0 && !isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              No employee data found. Please ensure employees are active and have salary information.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Basic Salary</TableHead>
                  <TableHead>Increment</TableHead>
                  <TableHead>Incentive</TableHead>
                  <TableHead>LOP Days</TableHead>
                  <TableHead>Gross Salary</TableHead>
                  <TableHead>TDS (1%)</TableHead>
                  <TableHead>Net Salary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaryData.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.employee_id}</TableCell>
                    <TableCell>{employee.full_name}</TableCell>
                    <TableCell>{employee.department}</TableCell>
                    <TableCell>{formatCurrency(employee.fixed_monthly_salary)}</TableCell>
                    <TableCell>{formatCurrency(employee.increment)}</TableCell>
                    <TableCell>{formatCurrency(employee.incentive)}</TableCell>
                    <TableCell>
                      <Badge variant={employee.lop_days > 0 ? "destructive" : "secondary"}>
                        {employee.lop_days}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(employee.gross_salary)}</TableCell>
                    <TableCell>{formatCurrency(employee.tds)}</TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(employee.net_salary)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Calculation Notes */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Calculation Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• <strong>LOP Deduction:</strong> Calculated as (Basic Salary × LOP Days ÷ 30)</p>
            <p>• <strong>Gross Salary:</strong> Basic Salary + Increment + Incentive - LOP Deduction</p>
            <p>• <strong>TDS:</strong> 1% of Gross Salary</p>
            <p>• <strong>Net Salary:</strong> Gross Salary - TDS</p>
            <p>• <strong>LOP Days:</strong> Automatically fetched from lop_entries table</p>
            <p>• <strong>Increment & Incentive:</strong> Manually entered in employees table</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
