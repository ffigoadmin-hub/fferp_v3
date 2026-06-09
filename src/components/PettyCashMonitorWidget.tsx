import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Wallet, Download, TrendingUp, Building2, Tag,
    Calendar, Filter, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { usePettyCash } from '@/hooks/usePettyCash';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import * as XLSX from 'xlsx';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

type DateFilter = 'today' | 'week' | 'month' | 'all';

export function PettyCashMonitorWidget() {
    const { entries, summary, isLoading, fetchEntries } = usePettyCash();
    const [dateFilter, setDateFilter] = useState<DateFilter>('today');
    const [deptFilter, setDeptFilter] = useState<string>('all');

    const handleDateFilterChange = (value: DateFilter) => {
        setDateFilter(value);
        const now = new Date();

        switch (value) {
            case 'today':
                fetchEntries(now, now);
                break;
            case 'week':
                fetchEntries(startOfWeek(now), endOfWeek(now));
                break;
            case 'month':
                fetchEntries(startOfMonth(now), endOfMonth(now));
                break;
            case 'all':
                fetchEntries(subDays(now, 365), now);
                break;
        }
    };

    const filteredEntries = deptFilter === 'all'
        ? entries
        : entries.filter(e => e.department === deptFilter);

    const departments = [...new Set(entries.map(e => e.department))];

    // Prepare chart data
    const deptChartData = Object.entries(summary.byDepartment).map(([name, value]) => ({
        name,
        value
    }));

    const categoryChartData = Object.entries(summary.byCategory).map(([name, value]) => ({
        name,
        value
    }));

    const exportToExcel = () => {
        const exportData = filteredEntries.map(e => ({
            'Date': format(new Date(e.expense_date), 'dd/MM/yyyy'),
            'Vendor': e.vendor_name,
            'Amount': Number(e.amount),
            'Department': e.department,
            'Category': e.category || 'General'
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Petty Cash');
        XLSX.writeFile(wb, `PettyCash_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                        <Wallet className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Petty Cash Monitor</h2>
                        <p className="text-sm text-muted-foreground">Daily expense tracking</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Select value={dateFilter} onValueChange={(v) => handleDateFilterChange(v as DateFilter)}>
                        <SelectTrigger className="w-[140px]">
                            <Calendar className="w-4 h-4 mr-2" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="week">This Week</SelectItem>
                            <SelectItem value="month">This Month</SelectItem>
                            <SelectItem value="all">All Time</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={deptFilter} onValueChange={setDeptFilter}>
                        <SelectTrigger className="w-[140px]">
                            <Building2 className="w-4 h-4 mr-2" />
                            <SelectValue placeholder="Department" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Depts</SelectItem>
                            {departments.map(dept => (
                                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button variant="outline" onClick={exportToExcel}>
                        <Download className="w-4 h-4 mr-2" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Expenses</p>
                                <p className="text-3xl font-bold">₹{summary.totalAmount.toLocaleString()}</p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                <TrendingUp className="w-6 h-6 text-primary" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Entries</p>
                                <p className="text-3xl font-bold">{summary.entryCount}</p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                                <Tag className="w-6 h-6 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Departments</p>
                                <p className="text-3xl font-bold">{Object.keys(summary.byDepartment).length}</p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                                <Building2 className="w-6 h-6 text-green-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">By Department</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {deptChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie
                                        data={deptChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={80}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                        labelLine={false}
                                    >
                                        {deptChartData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                                No data
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">By Category</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {categoryChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie
                                        data={categoryChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={80}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                        labelLine={false}
                                    >
                                        {categoryChartData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                                No data
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Entries Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Daily Expense Sheet</CardTitle>
                </CardHeader>
                <CardContent>
                    {filteredEntries.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            No expense entries found for selected filters
                        </div>
                    ) : (
                        <div className="max-h-[400px] overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Vendor</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Department</TableHead>
                                        <TableHead>Category</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredEntries.map(entry => (
                                        <TableRow key={entry.id}>
                                            <TableCell className="font-mono text-xs">
                                                {format(new Date(entry.expense_date), 'dd/MM/yyyy')}
                                            </TableCell>
                                            <TableCell className="font-medium">{entry.vendor_name}</TableCell>
                                            <TableCell className="font-bold">₹{Number(entry.amount).toLocaleString()}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">{entry.department}</Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {entry.category || 'General'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
