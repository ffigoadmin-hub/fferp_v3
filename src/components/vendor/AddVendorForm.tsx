import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Building2, User, Phone, Mail, MapPin, FileText, Landmark, Save, X, Link } from 'lucide-react';
import { VENDOR_WORK_TYPES, INDIAN_STATES, isPredefinedWorkType } from '@/constants/workTypes';
import { useVendorMaster } from '@/hooks/useVendorMaster';

interface AddVendorFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AddVendorForm({ onSuccess, onCancel }: AddVendorFormProps) {
  const { addVendor, isSaving } = useVendorMaster();
  const [otherWorkType, setOtherWorkType] = useState('');
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    contact_person: '',
    phone: '',
    alternate_phone: '',
    email: '',
    state: '',
    city: '',
    address: '',
    work_types: [] as string[],
    gst_number: '',
    pan_number: '',
    aadhar_drive_link: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    verification_notes: '',
    status: 'active' as const,
  });

  const handleWorkTypeToggle = (workType: string) => {
    if (workType === 'Other') {
      setShowOtherInput(!showOtherInput);
      if (showOtherInput) {
        // Remove any custom work types when unchecking "Other"
        setFormData(prev => ({
          ...prev,
          work_types: prev.work_types.filter(wt => isPredefinedWorkType(wt))
        }));
        setOtherWorkType('');
      }
      return;
    }
    setFormData(prev => ({
      ...prev,
      work_types: prev.work_types.includes(workType)
        ? prev.work_types.filter(wt => wt !== workType)
        : [...prev.work_types, workType]
    }));
  };

  const handleAddOtherWorkType = () => {
    if (otherWorkType.trim() && !formData.work_types.includes(otherWorkType.trim())) {
      setFormData(prev => ({
        ...prev,
        work_types: [...prev.work_types, otherWorkType.trim()]
      }));
      setOtherWorkType('');
    }
  };

  const handleOtherKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddOtherWorkType();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.company_name || !formData.contact_person || !formData.phone || !formData.state || !formData.city) {
      return;
    }

    if (formData.work_types.length === 0) {
      return;
    }

    try {
      await addVendor(formData);
      setFormData({
        company_name: '',
        contact_person: '',
        phone: '',
        alternate_phone: '',
        email: '',
        state: '',
        city: '',
        address: '',
        work_types: [],
        gst_number: '',
        pan_number: '',
        aadhar_drive_link: '',
        bank_name: '',
        account_number: '',
        ifsc_code: '',
        verification_notes: '',
        status: 'active',
      });
      onSuccess?.();
    } catch (error) {
      // Error handled in hook
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Company Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Company Details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="company_name">Company Name *</Label>
            <Input
              id="company_name"
              value={formData.company_name}
              onChange={e => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
              placeholder="Enter company name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_person">Contact Person *</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="contact_person"
                className="pl-9"
                value={formData.contact_person}
                onChange={e => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                placeholder="Contact person name"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                className="pl-9"
                value={formData.phone}
                onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="Primary phone number"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="alternate_phone">Alternate Phone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="alternate_phone"
                className="pl-9"
                value={formData.alternate_phone}
                onChange={e => setFormData(prev => ({ ...prev, alternate_phone: e.target.value }))}
                placeholder="Alternate phone (optional)"
              />
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                className="pl-9"
                value={formData.email}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Email address (optional)"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Location Details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="state">State *</Label>
            <Select
              value={formData.state}
              onValueChange={value => setFormData(prev => ({ ...prev, state: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {INDIAN_STATES.map(state => (
                  <SelectItem key={state} value={state}>{state}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City *</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))}
              placeholder="Enter city name"
              required
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">Full Address</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Enter full address (optional)"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Work Types */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Work Types * (Select at least one)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {VENDOR_WORK_TYPES.map(workType => (
              <Badge
                key={workType}
                variant={formData.work_types.includes(workType) ? 'default' : 'outline'}
                className="cursor-pointer hover:bg-primary/80"
                onClick={() => handleWorkTypeToggle(workType)}
              >
                {formData.work_types.includes(workType) && '✓ '}
                {workType}
              </Badge>
            ))}
            <Badge
              variant={showOtherInput ? 'default' : 'outline'}
              className="cursor-pointer hover:bg-primary/80"
              onClick={() => handleWorkTypeToggle('Other')}
            >
              {showOtherInput && '✓ '}
              Other
            </Badge>
          </div>
          
          {showOtherInput && (
            <div className="flex gap-2 items-center">
              <Input
                value={otherWorkType}
                onChange={e => setOtherWorkType(e.target.value)}
                onKeyDown={handleOtherKeyDown}
                placeholder="Enter custom work type and press Enter"
                className="max-w-xs"
              />
              <Button type="button" size="sm" onClick={handleAddOtherWorkType} disabled={!otherWorkType.trim()}>
                Add
              </Button>
            </div>
          )}
          
          {/* Show custom work types that were added */}
          {formData.work_types.filter(wt => !isPredefinedWorkType(wt)).length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <span className="text-sm text-muted-foreground">Custom:</span>
              {formData.work_types.filter(wt => !isPredefinedWorkType(wt)).map(customType => (
                <Badge
                  key={customType}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => setFormData(prev => ({
                    ...prev,
                    work_types: prev.work_types.filter(wt => wt !== customType)
                  }))}
                >
                  {customType} ✕
                </Badge>
              ))}
            </div>
          )}
          
          {formData.work_types.length === 0 && (
            <p className="text-sm text-destructive mt-2">Please select at least one work type</p>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="gst_number">GST Number</Label>
            <Input
              id="gst_number"
              value={formData.gst_number}
              onChange={e => setFormData(prev => ({ ...prev, gst_number: e.target.value.toUpperCase() }))}
              placeholder="Enter GST number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pan_number">PAN Number</Label>
            <Input
              id="pan_number"
              value={formData.pan_number}
              onChange={e => setFormData(prev => ({ ...prev, pan_number: e.target.value.toUpperCase() }))}
              placeholder="Enter PAN number"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="aadhar_drive_link">Aadhaar Proof (Google Drive Link)</Label>
            <div className="relative">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="aadhar_drive_link"
                className="pl-9"
                value={formData.aadhar_drive_link}
                onChange={e => setFormData(prev => ({ ...prev, aadhar_drive_link: e.target.value }))}
                placeholder="https://drive.google.com/..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bank Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Landmark className="h-4 w-4" />
            Bank Details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="bank_name">Bank Name</Label>
            <Input
              id="bank_name"
              value={formData.bank_name}
              onChange={e => setFormData(prev => ({ ...prev, bank_name: e.target.value }))}
              placeholder="Enter bank name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account_number">Account Number</Label>
            <Input
              id="account_number"
              value={formData.account_number}
              onChange={e => setFormData(prev => ({ ...prev, account_number: e.target.value }))}
              placeholder="Enter account number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ifsc_code">IFSC Code</Label>
            <Input
              id="ifsc_code"
              value={formData.ifsc_code}
              onChange={e => setFormData(prev => ({ ...prev, ifsc_code: e.target.value.toUpperCase() }))}
              placeholder="Enter IFSC code"
            />
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.verification_notes}
            onChange={e => setFormData(prev => ({ ...prev, verification_notes: e.target.value }))}
            placeholder="Any additional notes about this vendor..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSaving || formData.work_types.length === 0}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Vendor'}
        </Button>
      </div>
    </form>
  );
}
