import { useState } from 'react';
import { Search, Filter, X, Calendar, IndianRupee, Building, Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export interface PaymentFilters {
  search: string;
  status: string[];
  urgency: string[];
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  amountMin: string;
  amountMax: string;
  department: string;
}

interface PaymentSearchFiltersProps {
  filters: PaymentFilters;
  onFiltersChange: (filters: PaymentFilters) => void;
  departments?: string[];
}

const statusOptions = [
  // Workflow-specific statuses
  { value: 'smo_audit', label: 'Pending SMO' },
  { value: 'gmo_audit', label: 'Pending GMO' },
  { value: 'boi_audit', label: 'Pending BOI' },
  { value: 'gm_audit', label: 'Pending GM' },
  { value: 'director_audit', label: 'Pending Director' },
  { value: 'admin_audit', label: 'Pending Admin' },
  { value: 'ceo_audit', label: 'Pending CEO' },
  // Legacy statuses
  { value: 'pending', label: 'Pending (Legacy)' },
  { value: 'admin_approved', label: 'Admin Approved (Legacy)' },
  // Final statuses
  { value: 'ceo_approved', label: 'Ready for Payment' },
  { value: 'ceo_hold', label: 'On Hold' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'paid', label: 'Paid' },
  // Accounts/Bank statuses
  { value: 'accounts_execution', label: 'Processing' },
  { value: 'bulk_prepared', label: 'Batch Ready' },
  { value: 'bank_uploaded', label: 'Bank Processing' },
];

const urgencyOptions = [
  { value: 'emergency', label: '🔴 Emergency' },
  { value: 'important', label: '🟡 Important' },
  { value: 'normal', label: '🟢 Normal' },
];

export function PaymentSearchFilters({ filters, onFiltersChange, departments = [] }: PaymentSearchFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const activeFilterCount = [
    filters.status.length > 0,
    filters.urgency.length > 0,
    filters.dateFrom || filters.dateTo,
    filters.amountMin || filters.amountMax,
    filters.department,
  ].filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      status: [],
      urgency: [],
      dateFrom: undefined,
      dateTo: undefined,
      amountMin: '',
      amountMax: '',
      department: '',
    });
  };

  const toggleArrayFilter = (key: 'status' | 'urgency', value: string) => {
    const current = filters[key];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [key]: updated });
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by purpose, vendor, or request ID..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-10"
          />
        </div>
        <Button
          variant={showAdvanced ? 'secondary' : 'outline'}
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="relative"
        >
          <Filter className="w-4 h-4 mr-2" />
          Filters
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-4">
          {/* Status Filter */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block flex items-center gap-1">
              <Tag className="w-3 h-3" /> Status
            </label>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={filters.status.length === 0 ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => onFiltersChange({ ...filters, status: [] })}
              >
                All Status
              </Badge>
              {statusOptions.map(option => (
                <Badge
                  key={option.value}
                  variant={filters.status.includes(option.value) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleArrayFilter('status', option.value)}
                >
                  {option.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Urgency Filter */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Urgency
            </label>
            <div className="flex flex-wrap gap-2">
              {urgencyOptions.map(option => (
                <Badge
                  key={option.value}
                  variant={filters.urgency.includes(option.value) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleArrayFilter('urgency', option.value)}
                >
                  {option.label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Date Range */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Date Range
              </label>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn('flex-1 justify-start', !filters.dateFrom && 'text-muted-foreground')}>
                      {filters.dateFrom ? format(filters.dateFrom, 'dd MMM') : 'From'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={filters.dateFrom}
                      onSelect={(date) => onFiltersChange({ ...filters, dateFrom: date })}
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground">-</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn('flex-1 justify-start', !filters.dateTo && 'text-muted-foreground')}>
                      {filters.dateTo ? format(filters.dateTo, 'dd MMM') : 'To'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={filters.dateTo}
                      onSelect={(date) => onFiltersChange({ ...filters, dateTo: date })}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Amount Range */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block flex items-center gap-1">
                <IndianRupee className="w-3 h-3" /> Amount Range
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.amountMin}
                  onChange={(e) => onFiltersChange({ ...filters, amountMin: e.target.value })}
                  className="h-9"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={filters.amountMax}
                  onChange={(e) => onFiltersChange({ ...filters, amountMax: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>

            {/* Department */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block flex items-center gap-1">
                <Building className="w-3 h-3" /> Department
              </label>
              <Select
                value={filters.department || "all"}
                onValueChange={(v) => onFiltersChange({ ...filters, department: v === "all" ? "" : v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
