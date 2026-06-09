import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Package,
  Search,
  Download,
  AlertTriangle,
  CheckCircle2,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { useProjectInventory, InventoryItem } from '@/hooks/useProjectInventory';
import { useProjects } from '@/hooks/useProjects';
import { format } from 'date-fns';
import { toast } from 'sonner';

const ProjectInventoryPage = () => {
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { items, isLoading, refetch, getBalance } = useProjectInventory(
    selectedProject === 'all' ? undefined : selectedProject
  );
  const { projects } = useProjects();

  // Filter items based on search and status
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.material_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.specification?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || item.audit_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate totals
  const totalValue = filteredItems.reduce((sum, item) => {
    const balance = getBalance(item);
    return sum + balance * (item.unit_price || 0);
  }, 0);

  const lowStockItems = filteredItems.filter((item) => {
    const balance = getBalance(item);
    return balance <= (item.quantity_received * 0.2); // 20% threshold
  });

  const handleExport = () => {
    const csvData = filteredItems.map((item) => ({
      Project: item.project?.project_name || 'N/A',
      Phase: item.phase?.phase_name || 'N/A',
      Material: item.material_name,
      Specification: item.specification || '',
      Unit: item.unit,
      Received: item.quantity_received,
      Used: item.quantity_used,
      Balance: getBalance(item),
      'Unit Price': item.unit_price || 0,
      Value: getBalance(item) * (item.unit_price || 0),
      Status: item.audit_status,
    }));

    const headers = Object.keys(csvData[0] || {}).join(',');
    const rows = csvData.map((row) => Object.values(row).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Inventory exported successfully');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-500">Verified</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'discrepancy':
        return <Badge variant="destructive">Discrepancy</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            Project Inventory
          </h1>
          <p className="text-muted-foreground">
            Track and manage materials across all projects
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold">{filteredItems.length}</p>
              </div>
              <Package className="h-8 w-8 text-primary opacity-70" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Verified</p>
                <p className="text-2xl font-bold text-green-600">
                  {filteredItems.filter((i) => i.audit_status === 'verified').length}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500 opacity-70" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold text-orange-600">
                  {lowStockItems.length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500 opacity-70" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">₹{totalValue.toLocaleString()}</p>
              </div>
              <Package className="h-8 w-8 text-blue-500 opacity-70" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                Project
              </label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                Status
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="discrepancy">Discrepancy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-muted-foreground mb-1 block">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search materials..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-orange-700 dark:text-orange-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Low Stock Alerts ({lowStockItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.slice(0, 5).map((item) => (
                <Badge
                  key={item.id}
                  variant="outline"
                  className="border-orange-300 text-orange-700"
                >
                  {item.material_name}: {getBalance(item)} {item.unit} left
                </Badge>
              ))}
              {lowStockItems.length > 5 && (
                <Badge variant="outline" className="border-orange-300">
                  +{lowStockItems.length - 5} more
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Items</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No inventory items found</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project / Phase</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Used</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => {
                    const balance = getBalance(item);
                    const isLowStock = balance <= item.quantity_received * 0.2;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {item.project?.project_name || 'Unknown Project'}
                            </p>
                            {item.phase && (
                              <p className="text-xs text-muted-foreground">
                                {item.phase.phase_name}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.material_name}</p>
                            {item.specification && (
                              <p className="text-xs text-muted-foreground">
                                {item.specification}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.quantity_received} {item.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.quantity_used} {item.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              isLowStock ? 'text-orange-600 font-bold' : ''
                            }
                          >
                            {balance} {item.unit}
                          </span>
                          {isLowStock && (
                            <AlertTriangle className="h-3 w-3 inline ml-1 text-orange-500" />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          ₹{(item.unit_price || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          ₹{(balance * (item.unit_price || 0)).toLocaleString()}
                        </TableCell>
                        <TableCell>{getStatusBadge(item.audit_status)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectInventoryPage;
