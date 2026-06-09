import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Filter, Building2, Phone, MapPin, ExternalLink, Star, CheckCircle, X } from 'lucide-react';
import { useVendorMaster, VendorMaster, VendorFilters } from '@/hooks/useVendorMaster';
import { VENDOR_WORK_TYPES, INDIAN_STATES } from '@/constants/workTypes';

interface VendorDatabaseWidgetProps {
  onSelectVendor?: (vendor: VendorMaster) => void;
  selectionMode?: boolean;
  filterWorkType?: string;
}

export function VendorDatabaseWidget({ onSelectVendor, selectionMode = false, filterWorkType }: VendorDatabaseWidgetProps) {
  const { vendors, isLoading, fetchVendors, refetch } = useVendorMaster();
  const [filters, setFilters] = useState<VendorFilters>({
    search: '',
    state: '',
    work_type: filterWorkType || '',
    status: '', // Empty to show all vendors by default
  });
  const [selectedVendor, setSelectedVendor] = useState<VendorMaster | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Derive work types list to include filterWorkType if it's not already in constants
  const selectableWorkTypes = Array.from(new Set([...VENDOR_WORK_TYPES, ...(filterWorkType ? [filterWorkType] : [])]));

  // Initial fetch with no status filter to show all vendors
  useEffect(() => {
    fetchVendors(filters);
  }, []);

  // Re-fetch when filters change
  useEffect(() => {
    fetchVendors(filters);
  }, [filters.search, filters.state, filters.work_type, filters.status]);

  useEffect(() => {
    if (filterWorkType && filterWorkType !== filters.work_type) {
      setFilters(prev => ({ ...prev, work_type: filterWorkType }));
    }
  }, [filterWorkType]);

  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, search: value }));
  };

  const handleViewDetails = (vendor: VendorMaster) => {
    setSelectedVendor(vendor);
    setShowDetails(true);
  };

  const handleSelect = (vendor: VendorMaster) => {
    onSelectVendor?.(vendor);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'blacklisted': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by company, contact, phone..."
                  value={filters.search}
                  onChange={e => handleSearch(e.target.value)}
                />
              </div>
            </div>
            <Select
              value={filters.state || 'all'}
              onValueChange={value => setFilters(prev => ({ ...prev, state: value === 'all' ? '' : value }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All States" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {INDIAN_STATES.map(state => (
                  <SelectItem key={state} value={state}>{state}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.work_type || 'all'}
              onValueChange={value => setFilters(prev => ({ ...prev, work_type: value === 'all' ? '' : value }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Work Types" />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                <SelectItem value="all">All Work Types</SelectItem>
                {selectableWorkTypes.map(wt => (
                  <SelectItem key={wt} value={wt}>{wt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.status || 'all'}
              onValueChange={value => setFilters(prev => ({ ...prev, status: value === 'all' ? '' : value }))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="blacklisted">Blacklisted</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Vendor Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Vendor Database ({vendors.length} vendors)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading vendors...</div>
          ) : vendors.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <div className="text-muted-foreground">
                No vendors found. Try adjusting your filters or add new vendors.
              </div>
              <Button
                variant="outline"
                onClick={() => setFilters({ search: '', state: '', work_type: '', status: '' })}
                className="mx-auto"
              >
                Clear All Filters
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Work Types</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.map(vendor => (
                    <TableRow key={vendor.id}>
                      <TableCell>
                        <div className="font-medium">{vendor.company_name}</div>
                        <div className="text-xs text-muted-foreground">{vendor.vendor_code}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {vendor.phone}
                        </div>
                        <div className="text-xs text-muted-foreground">{vendor.contact_person}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {vendor.city}, {vendor.state}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {vendor.work_types.slice(0, 2).map(wt => (
                            <Badge key={wt} variant="secondary" className="text-xs">
                              {wt}
                            </Badge>
                          ))}
                          {vendor.work_types.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{vendor.work_types.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(vendor.status)}>
                          {vendor.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(vendor)}
                          >
                            View
                          </Button>
                          {selectionMode && (
                            <Button
                              size="sm"
                              onClick={() => handleSelect(vendor)}
                            >
                              Select
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Vendor Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {selectedVendor?.company_name}
            </DialogTitle>
          </DialogHeader>
          {selectedVendor && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Vendor Code</h4>
                  <p>{selectedVendor.vendor_code}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                  <Badge className={getStatusColor(selectedVendor.status)}>
                    {selectedVendor.status}
                  </Badge>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Contact Person</h4>
                  <p>{selectedVendor.contact_person}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Phone</h4>
                  <p>{selectedVendor.phone}</p>
                  {selectedVendor.alternate_phone && (
                    <p className="text-sm text-muted-foreground">{selectedVendor.alternate_phone}</p>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Email</h4>
                  <p>{selectedVendor.email || 'N/A'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Location</h4>
                  <p>{selectedVendor.city}, {selectedVendor.state}</p>
                </div>
                <div className="col-span-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Address</h4>
                  <p>{selectedVendor.address || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Work Types</h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedVendor.work_types.map(wt => (
                      <Badge key={wt} variant="secondary">{wt}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">GST Number</h4>
                  <p>{selectedVendor.gst_number || 'N/A'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">PAN Number</h4>
                  <p>{selectedVendor.pan_number || 'N/A'}</p>
                </div>
                {selectedVendor.aadhar_drive_link && (
                  <div className="col-span-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Aadhaar Proof</h4>
                    <a
                      href={selectedVendor.aadhar_drive_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary flex items-center gap-1 hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View on Google Drive
                    </a>
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Bank Name</h4>
                  <p>{selectedVendor.bank_name || 'N/A'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Account Number</h4>
                  <p>{selectedVendor.account_number || 'N/A'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">IFSC Code</h4>
                  <p>{selectedVendor.ifsc_code || 'N/A'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Rating</h4>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-500" />
                    {selectedVendor.rating}/5
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Total Orders</h4>
                  <p>{selectedVendor.total_orders}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Verified</h4>
                  <p className="flex items-center gap-1">
                    {selectedVendor.is_verified ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Verified
                      </>
                    ) : (
                      <>
                        <X className="h-4 w-4 text-muted-foreground" />
                        Not Verified
                      </>
                    )}
                  </p>
                </div>
              </div>
              {selectionMode && (
                <div className="flex justify-end pt-4">
                  <Button onClick={() => {
                    handleSelect(selectedVendor);
                    setShowDetails(false);
                  }}>
                    Select This Vendor
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
