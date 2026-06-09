// @ts-nocheck
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { MapPin, FileText, User, Calendar, AlertTriangle, ArrowLeft, Shield, CheckCircle } from 'lucide-react';
import { useSiteVisitRequests, type CreateSiteVisitInput } from '@/hooks/useSiteVisitRequests';
import { cn } from '@/lib/utils';
import { addDays, format } from 'date-fns';

const PRIORITY_CONFIG = {
  standard: { label: 'Standard', color: 'bg-emerald-900/50 text-emerald-300 border-emerald-700' },
  urgent: { label: 'Urgent', color: 'bg-amber-900/50 text-amber-300 border-amber-700' },
  emergency: { label: 'Emergency', color: 'bg-red-900/60 text-red-300 border-red-700' },
};

export function NewSiteVisitPage() {
  const navigate = useNavigate();
  const { createRequest, submitRequest, isCreating } = useSiteVisitRequests();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [priority, setPriority] = useState<'standard' | 'urgent' | 'emergency'>('standard');
  const [visitCategory, setVisitCategory] = useState<string>('');
  const [clientType, setClientType] = useState<string>('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [extractedCoords, setExtractedCoords] = useState<{ lat: number; lng: number } | null>(null);

  const minDeadline = format(addDays(new Date(), 3), 'yyyy-MM-dd');

  const { register, handleSubmit, formState: { errors, isValid } } = useForm<CreateSiteVisitInput>({
    mode: 'onChange',
  });

  const handleMapsUrlChange = (url: string) => {
    setMapsUrl(url);
    const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) {
      setExtractedCoords({ lat: parseFloat(match[1]), lng: parseFloat(match[2]) });
    } else {
      setExtractedCoords(null);
    }
  };

  const onSubmit = async (data: CreateSiteVisitInput) => {
    if (!visitCategory || !clientType) {
      toast.error('Please select visit category and client type');
      return;
    }
    try {
      setIsSubmitting(true);
      const request = await createRequest({
        ...data,
        priority,
        visit_category: visitCategory as any,
        client_type: clientType as any,
        location_google_maps_url: mapsUrl || undefined,
        location_lat: extractedCoords?.lat,
        location_lng: extractedCoords?.lng,
      });
      await submitRequest(request.id);
      toast.success('Site visit request submitted');
      navigate(`/site-visit-request/success/${request.id}`);
    } catch {
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-30">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/20 blur-[100px] rounded-full" />
      </div>
      
      <div className="max-w-3xl mx-auto space-y-6 p-4 md:p-6 relative z-10">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} 
            className="text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-zinc-800 transition-all rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="animate-in fade-in slide-in-from-left duration-500">
            <h1 className="text-2xl font-bold text-white tracking-tight">New Site Visit Request</h1>
            <p className="text-zinc-500 text-sm font-medium">Submit a site visit requisition for rental sourcing</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Priority Selector */}
          <Card className="glass-card border-zinc-800/50 p-1">
            <CardHeader className="pb-3 pt-4 px-5">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                <AlertTriangle className={cn("h-3.5 w-3.5", priority === 'emergency' ? 'text-red-400' : 'text-amber-400')} /> 
                Priority Selection
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex gap-3 p-1 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
                {(Object.entries(PRIORITY_CONFIG) as [keyof typeof PRIORITY_CONFIG, typeof PRIORITY_CONFIG[keyof typeof PRIORITY_CONFIG]][]).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPriority(key)}
                    className={cn(
                      'flex-1 py-3 rounded-lg text-sm font-bold transition-all duration-300 relative overflow-hidden',
                      priority === key 
                        ? `${cfg.color} shadow-lg shadow-${key === 'standard' ? 'emerald' : key === 'urgent' ? 'amber' : 'red'}-900/20 ring-1 ring-white/10` 
                        : 'bg-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                    )}
                  >
                    {cfg.label}
                    {priority === key && (
                      <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent pointer-events-none" />
                    )}
                  </button>
                ))}
              </div>
              {priority === 'emergency' && (
                <div className="mt-3 p-3 bg-red-950/20 border border-red-900/30 rounded-lg animate-in fade-in slide-in-from-top-1">
                  <p className="text-[11px] text-red-400 font-medium flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3" />
                    SYSTEM ALERT: Emergency requests trigger immediate SMS & App notifications to SMO and FM teams.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Location Section */}
          <Card className="glass-card border-zinc-800/50">
            <CardHeader className="pb-2 pt-5 px-6">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <div className="p-1.5 bg-blue-500/10 rounded-lg">
                  <MapPin className="h-4 w-4 text-blue-400" />
                </div>
                Location Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-6 pb-6">
              <div className="grid gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Location Title *</label>
                <div className="relative group">
                  <Input
                    {...register('location_title', { required: true })}
                    placeholder="e.g. Kovai Road Plot 14A"
                    className="bg-zinc-900/50 border-zinc-800 focus:border-blue-500/50 focus:ring-blue-500/20 text-white placeholder:text-zinc-600 h-11 transition-all"
                  />
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity">
                    <MapPin className="h-4 w-4 text-blue-500/50" />
                  </div>
                </div>
              </div>
              
              <div className="grid gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Full Address *</label>
                <Textarea
                  {...register('location_address', { required: true })}
                  rows={2}
                  placeholder="Street, area, landmarks..."
                  className="bg-zinc-900/50 border-zinc-800 focus:border-blue-500/50 focus:ring-blue-500/20 text-white placeholder:text-zinc-600 transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">City *</label>
                  <Input {...register('location_city', { required: true })} placeholder="City" className="bg-zinc-900/50 border-zinc-800 focus:border-blue-500/50 text-white h-11" />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">State *</label>
                  <Input {...register('location_state', { required: true })} placeholder="State" className="bg-zinc-900/50 border-zinc-800 focus:border-blue-500/50 text-white h-11" />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Pincode</label>
                  <Input {...register('location_pincode')} placeholder="600001" className="bg-zinc-900/50 border-zinc-800 focus:border-blue-500/50 text-white h-11" />
                </div>
              </div>

              <div className="grid gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Google Maps URL</label>
                <div className="relative group">
                  <Input
                    value={mapsUrl}
                    onChange={(e) => handleMapsUrlChange(e.target.value)}
                    placeholder="Paste Google Maps share link..."
                    className="bg-zinc-900/50 border-zinc-800 focus:border-emerald-500/50 focus:ring-emerald-500/20 text-white placeholder:text-zinc-600 h-11 transition-all pr-10"
                  />
                  {extractedCoords && (
                    <div className="absolute inset-y-0 right-3 flex items-center">
                      <div className="h-5 w-5 bg-emerald-500/20 rounded-full flex items-center justify-center">
                        <CheckCircle className="h-3 w-3 text-emerald-400" />
                      </div>
                    </div>
                  )}
                </div>
                {extractedCoords && (
                  <p className="text-[10px] text-emerald-400/80 font-medium flex items-center gap-1.5 px-1">
                    <Shield className="h-3 w-3" /> GPS metadata verified: {extractedCoords.lat.toFixed(4)}, {extractedCoords.lng.toFixed(4)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Client Details */}
          <Card className="glass-card border-zinc-800/50">
            <CardHeader className="pb-2 pt-5 px-6">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <div className="p-1.5 bg-purple-500/10 rounded-lg">
                  <User className="h-4 w-4 text-purple-400" />
                </div>
                Client Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-6 pb-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Client / Company Name *</label>
                  <Input {...register('client_name', { required: true })} placeholder="Company name" className="bg-zinc-900/50 border-zinc-800 text-white h-11" />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Contact Person *</label>
                  <Input {...register('client_contact_name', { required: true })} placeholder="Contact name" className="bg-zinc-900/50 border-zinc-800 text-white h-11" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Phone *</label>
                  <Input {...register('client_phone', { required: true })} placeholder="+91 xxxxx xxxxx" className="bg-zinc-900/50 border-zinc-800 text-white h-11" />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Email</label>
                  <Input {...register('client_email')} type="email" placeholder="email@example.com" className="bg-zinc-900/50 border-zinc-800 text-white h-11" />
                </div>
              </div>
              <div className="grid gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Client Type *</label>
                <Select onValueChange={setClientType}>
                  <SelectTrigger className="bg-zinc-900/50 border-zinc-800 text-white h-11">
                    <SelectValue placeholder="Select client type" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                    <SelectItem value="new">New Client</SelectItem>
                    <SelectItem value="existing">Existing Client</SelectItem>
                    <SelectItem value="vip">VIP Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Visit Parameters */}
          <Card className="glass-card border-zinc-800/50">
            <CardHeader className="pb-2 pt-5 px-6">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <div className="p-1.5 bg-amber-500/10 rounded-lg">
                  <FileText className="h-4 w-4 text-amber-400" />
                </div>
                Visit Parameters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-6 pb-6">
              <div className="grid gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Visit Category *</label>
                <Select onValueChange={setVisitCategory}>
                  <SelectTrigger className="bg-zinc-900/50 border-zinc-800 text-white h-11">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                    <SelectItem value="mushroom">Mushroom</SelectItem>
                    <SelectItem value="new_polyhouse">New Polyhouse</SelectItem>
                    <SelectItem value="microgreens">Microgreens</SelectItem>
                    <SelectItem value="open_cultivation">Open Cultivation</SelectItem>
                    <SelectItem value="crab_farming">Crab Farming</SelectItem>
                    <SelectItem value="goat_farming">Goat Farming</SelectItem>
                    <SelectItem value="hydroponic">Hydroponic</SelectItem>
                    <SelectItem value="agri_estate">Agri Estate</SelectItem>
                    <SelectItem value="rental_polyhouse">Rental Polyhouse</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Purpose Description * <span className="text-zinc-600 font-normal normal-case">(min 50 chars)</span>
                </label>
                <Textarea
                  {...register('purpose_description', { required: true, minLength: 50, maxLength: 1000 })}
                  rows={4}
                  placeholder="Describe why this site visit is needed..."
                  className="bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-600 resize-none"
                />
                {errors.purpose_description?.type === 'minLength' && (
                  <p className="text-[10px] text-red-400 font-medium px-1 mt-0.5 animate-in slide-in-from-left-1 duration-300">Minimum 50 characters required for authorization.</p>
                )}
              </div>
              <div className="grid gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Special Instructions</label>
                <Textarea
                  {...register('special_instructions')}
                  rows={2}
                  placeholder="Access codes, specific areas, safety notes..."
                  className="bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-600 resize-none"
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Reference Documents URL</label>
                <Input {...register('reference_documents_url')} placeholder="Google Drive share link" className="bg-zinc-900/50 border-zinc-800 text-white h-11" />
              </div>
            </CardContent>
          </Card>

          {/* Deadlines */}
          <Card className="glass-card border-zinc-800/50">
            <CardHeader className="pb-2 pt-5 px-6">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <div className="p-1.5 bg-cyan-500/10 rounded-lg">
                  <Calendar className="h-4 w-4 text-cyan-400" />
                </div>
                Temporal Deadlines
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 px-6 pb-6">
              <div className="grid gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Visit Deadline * <span className="text-zinc-600 font-normal normal-case">(min 3 days)</span></label>
                <Input
                  {...register('requested_visit_deadline', { required: true, min: minDeadline })}
                  type="date"
                  min={minDeadline}
                  className="bg-zinc-900/50 border-zinc-800 text-white h-11"
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Full Cycle Deadline</label>
                <Input
                  {...register('requested_by_rsh_deadline')}
                  type="date"
                  min={minDeadline}
                  className="bg-zinc-900/50 border-zinc-800 text-white h-11"
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="pt-2 pb-8">
            <Button
              type="submit"
              disabled={isCreating || isSubmitting || !isValid}
              className={cn(
                "w-full h-14 text-white font-bold text-lg rounded-2xl transition-all duration-500 shadow-xl",
                isValid 
                  ? "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-blue-500/20 active:scale-[0.98]" 
                  : "bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed"
              )}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Authorizing Request...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Submit Official Requisition
                </div>
              )}
            </Button>
            {!isValid && (
              <p className="text-center text-zinc-600 text-xs mt-3">Please complete all required fields (*) to enable submission</p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
