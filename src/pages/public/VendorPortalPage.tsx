import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Truck, Package, FileText, Upload, CheckCircle, 
  Loader2, AlertTriangle, Building2, Calendar, Phone
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface PurchaseOrderDetails {
  id: string;
  po_number?: number;
  project_id: string;
  vendor_name?: string;
  total_amount?: number;
  status: string;
  delivery_status?: string;
  lr_number?: string;
  transporter_name?: string;
  dispatch_date?: string;
  vendor_invoice_url?: string;
  created_at: string;
  project?: {
    name: string;
    location?: string;
  };
  items?: any[];
}

export default function VendorPortalPage() {
  const { accessToken } = useParams<{ accessToken: string }>();
  const [order, setOrder] = useState<PurchaseOrderDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form states
  const [lrNumber, setLrNumber] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [dispatchDate, setDispatchDate] = useState('');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!accessToken) {
        setError('Invalid access token');
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await (supabase
          .from('purchase_orders') as any)
          .select(`
            *,
            project:projects!purchase_orders_project_id_fkey(name, location)
          `)
          .eq('vendor_access_token', accessToken)
          .maybeSingle();

        if (fetchError) throw fetchError;
        
        if (!data) {
          setError('Purchase order not found or access denied');
          setIsLoading(false);
          return;
        }

        setOrder(data as unknown as PurchaseOrderDetails);
        setLrNumber(data.lr_number || '');
        setTransporterName(data.transporter_name || '');
        setDispatchDate(data.dispatch_date || '');
      } catch (err: any) {
        console.error('Error fetching order:', err);
        setError('Failed to load purchase order');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [accessToken]);

  const handleMarkDispatched = async () => {
    if (!order || !lrNumber.trim()) {
      toast.error('LR Number is required');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await (supabase
        .from('purchase_orders') as any)
        .update({
          delivery_status: 'DISPATCHED',
          lr_number: lrNumber,
          transporter_name: transporterName,
          dispatch_date: dispatchDate || new Date().toISOString().split('T')[0],
        })
        .eq('id', order.id);

      if (error) throw error;

      toast.success('Order marked as dispatched');
      setOrder(prev => prev ? {
        ...prev,
        delivery_status: 'DISPATCHED',
        lr_number: lrNumber,
        transporter_name: transporterName,
        dispatch_date: dispatchDate || new Date().toISOString().split('T')[0],
      } : null);
    } catch (err: any) {
      console.error('Error updating dispatch status:', err);
      toast.error('Failed to update dispatch status');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadInvoice = async () => {
    if (!order || !invoiceFile) {
      toast.error('Please select an invoice file');
      return;
    }

    setIsUploading(true);
    try {
      const fileName = `vendor-invoices/${order.id}/${Date.now()}_${invoiceFile.name}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, invoiceFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      const { error: updateError } = await (supabase
        .from('purchase_orders') as any)
        .update({ vendor_invoice_url: publicUrl })
        .eq('id', order.id);

      if (updateError) throw updateError;

      toast.success('Invoice uploaded successfully');
      setOrder(prev => prev ? { ...prev, vendor_invoice_url: publicUrl } : null);
      setInvoiceFile(null);
    } catch (err: any) {
      console.error('Error uploading invoice:', err);
      toast.error('Failed to upload invoice');
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'DISPATCHED':
        return <Badge className="bg-blue-500">Dispatched</Badge>;
      case 'IN_TRANSIT':
        return <Badge className="bg-orange-500">In Transit</Badge>;
      case 'DELIVERED':
        return <Badge className="bg-green-500">Delivered</Badge>;
      default:
        return <Badge variant="outline">Pending Dispatch</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="w-16 h-16 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Access Denied</h2>
            <p className="text-muted-foreground">{error || 'Order not found'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <Truck className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Vendor Portal</h1>
            <p className="text-muted-foreground">
              Purchase Order #{order.po_number || order.id.slice(-6)}
            </p>
          </div>
        </div>

        {/* Order Details Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Order Details
                </CardTitle>
                <CardDescription>
                  Created: {format(new Date(order.created_at), 'dd MMM yyyy')}
                </CardDescription>
              </div>
              {getStatusBadge(order.delivery_status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Project</p>
                <p className="font-medium flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  {order.project?.name || 'N/A'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Delivery Location</p>
                <p className="font-medium">{order.project?.location || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Vendor</p>
                <p className="font-medium">{order.vendor_name || 'Not specified'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="font-medium text-lg">
                  ₹{order.total_amount?.toLocaleString('en-IN') || '0'}
                </p>
              </div>
            </div>

            {order.lr_number && (
              <>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">LR Number</p>
                    <p className="font-medium">{order.lr_number}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Transporter</p>
                    <p className="font-medium">{order.transporter_name || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Dispatch Date</p>
                    <p className="font-medium">
                      {order.dispatch_date ? format(new Date(order.dispatch_date), 'dd MMM yyyy') : 'N/A'}
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Mark Dispatched Card */}
        {order.delivery_status !== 'DISPATCHED' && order.delivery_status !== 'DELIVERED' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Mark as Dispatched
              </CardTitle>
              <CardDescription>
                Enter shipping details to mark this order as dispatched
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lrNumber">LR Number *</Label>
                  <Input
                    id="lrNumber"
                    placeholder="Enter LR/GR Number"
                    value={lrNumber}
                    onChange={(e) => setLrNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transporter">Transporter Name</Label>
                  <Input
                    id="transporter"
                    placeholder="Transport company name"
                    value={transporterName}
                    onChange={(e) => setTransporterName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dispatchDate">Dispatch Date</Label>
                  <Input
                    id="dispatchDate"
                    type="date"
                    value={dispatchDate}
                    onChange={(e) => setDispatchDate(e.target.value)}
                  />
                </div>
              </div>
              <Button 
                onClick={handleMarkDispatched} 
                disabled={isSaving || !lrNumber.trim()}
                className="w-full md:w-auto"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Mark as Dispatched
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Upload Invoice Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Invoice Upload
            </CardTitle>
            <CardDescription>
              Upload your invoice for this purchase order
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {order.vendor_invoice_url ? (
              <div className="flex items-center gap-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-500" />
                <div className="flex-1">
                  <p className="font-medium text-green-700">Invoice Uploaded</p>
                  <a 
                    href={order.vendor_invoice_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-primary underline"
                  >
                    View Invoice
                  </a>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice">Select Invoice File</Label>
                  <Input
                    id="invoice"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                  />
                </div>
                <Button 
                  onClick={handleUploadInvoice}
                  disabled={isUploading || !invoiceFile}
                  className="w-full md:w-auto"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Invoice
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground py-4">
          <p>For any queries, please contact the purchase team.</p>
        </div>
      </div>
    </div>
  );
}
