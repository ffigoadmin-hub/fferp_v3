import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClipboardCheck, Users, MapPin, Briefcase, Building2, Clock, CheckCircle } from 'lucide-react';
import { useVendorSourcingLog } from '@/hooks/useVendorSourcingLog';
import { useVendorMaster, VendorMaster } from '@/hooks/useVendorMaster';

export function VendorSourcingEOD() {
  const { todayStats, isLoading, isSaving, submitEOD, refetch } = useVendorSourcingLog();
  const { getTodayVendors } = useVendorMaster();
  const [summaryNotes, setSummaryNotes] = useState('');
  const [todayVendors, setTodayVendors] = useState<VendorMaster[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(true);

  useEffect(() => {
    const loadTodayVendors = async () => {
      setLoadingVendors(true);
      const vendors = await getTodayVendors();
      setTodayVendors(vendors);
      setLoadingVendors(false);
    };
    loadTodayVendors();
    refetch();
  }, []);

  const handleSubmitEOD = async () => {
    await submitEOD(summaryNotes);
    setSummaryNotes('');
  };

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{todayStats.vendorsAdded}</p>
                <p className="text-xs text-muted-foreground">Vendors Added</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 text-green-600">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{todayStats.statesCovered.length}</p>
                <p className="text-xs text-muted-foreground">States Covered</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{todayStats.citiesCovered.length}</p>
                <p className="text-xs text-muted-foreground">Cities Covered</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{todayStats.workTypesCovered.length}</p>
                <p className="text-xs text-muted-foreground">Work Types</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coverage Details */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">States Covered</CardTitle>
          </CardHeader>
          <CardContent>
            {todayStats.statesCovered.length === 0 ? (
              <p className="text-sm text-muted-foreground">No states yet</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {todayStats.statesCovered.map(state => (
                  <Badge key={state} variant="secondary">{state}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cities Covered</CardTitle>
          </CardHeader>
          <CardContent>
            {todayStats.citiesCovered.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cities yet</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {todayStats.citiesCovered.map(city => (
                  <Badge key={city} variant="outline">{city}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Work Types Sourced</CardTitle>
          </CardHeader>
          <CardContent>
            {todayStats.workTypesCovered.length === 0 ? (
              <p className="text-sm text-muted-foreground">No work types yet</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {todayStats.workTypesCovered.map(wt => (
                  <Badge key={wt}>{wt}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Today's Vendors List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Vendors Added Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingVendors ? (
            <div className="text-center py-4 text-muted-foreground">Loading...</div>
          ) : todayVendors.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No vendors added today yet. Start adding vendors!
            </div>
          ) : (
            <ScrollArea className="h-[200px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Work Types</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayVendors.map(vendor => (
                    <TableRow key={vendor.id}>
                      <TableCell className="font-medium">{vendor.company_name}</TableCell>
                      <TableCell>{vendor.phone}</TableCell>
                      <TableCell>{vendor.city}, {vendor.state}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {vendor.work_types.slice(0, 2).map(wt => (
                            <Badge key={wt} variant="secondary" className="text-xs">{wt}</Badge>
                          ))}
                          {vendor.work_types.length > 2 && (
                            <Badge variant="outline" className="text-xs">+{vendor.work_types.length - 2}</Badge>
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

      {/* EOD Submit Section */}
      <Card className={todayStats.hasSubmittedEOD ? 'border-green-200 bg-green-50' : ''}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            EOD Summary
            {todayStats.hasSubmittedEOD && (
              <Badge className="ml-2 bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                Submitted
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {todayStats.hasSubmittedEOD ? (
            <p className="text-sm text-muted-foreground">
              You have already submitted your EOD summary for today. Good job! 🎉
            </p>
          ) : (
            <>
              <Textarea
                placeholder="Enter your daily summary notes... (e.g., challenges faced, areas focused, tomorrow's plan)"
                value={summaryNotes}
                onChange={e => setSummaryNotes(e.target.value)}
                rows={4}
              />
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Summary: {todayStats.vendorsAdded} vendors from {todayStats.statesCovered.length} states, {todayStats.citiesCovered.length} cities
                </p>
                <Button 
                  onClick={handleSubmitEOD} 
                  disabled={isSaving || todayStats.vendorsAdded === 0}
                >
                  {isSaving ? 'Submitting...' : 'Submit EOD'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
