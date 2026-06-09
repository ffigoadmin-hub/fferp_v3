import { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProjectVerticals } from '@/hooks/useProjectVerticals';
import { PROJECT_CATEGORIES } from '@/constants/projectCategories';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function DealUploadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState<'DIRECT' | 'JV'>('DIRECT');
  const { verticals, isLoading: verticalsLoading } = useProjectVerticals(category);
  
  const [verticalId, setVerticalId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [dealFileUrl, setDealFileUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!projectName || !clientName || !clientContact || !locationCity || !locationState || !verticalId) {
      toast.error('Please fill all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const projectId = `PRJ-${Date.now().toString(36).toUpperCase()}`;
      
      const { error } = await supabase.from('projects').insert({
        project_id: projectId,
        project_name: projectName,
        client_name: clientName,
        client_contact: clientContact,
        location_city: locationCity,
        location_state: locationState,
        project_category: category,
        vertical_id: verticalId,
        vertical: category, // For backwards compatibility
        deal_file_url: dealFileUrl || null,
        deal_uploaded_by: user?.id,
        uploaded_by_bd_data_id: user?.id,
        intake_status: 'pending_admin_review',
        deal_uploaded_at: new Date().toISOString(),
        lifecycle_stage: 'new_deal',
        stage_new_deal_at: new Date().toISOString(),
        status: 'upcoming',
        approved_budget: 0,
        target_start_date: new Date().toISOString().split('T')[0],
        target_completion_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        remarks: notes || null,
        created_by: user?.id,
      });

      if (error) throw error;

      toast.success('Deal uploaded successfully! Admin will review and assign GMO, SMO, and Engineer.');
      navigate('/employee-projects');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload deal');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto p-6"
    >
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
          <Upload className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Upload New Deal</h1>
          <p className="text-muted-foreground">Submit a new project deal for team assignment</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Project Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {PROJECT_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => {
                    setCategory(cat.value as 'DIRECT' | 'JV');
                    setVerticalId('');
                  }}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    category === cat.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="font-semibold">{cat.label}</p>
                  <p className="text-sm text-muted-foreground">{cat.description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Vertical *</Label>
              <Select value={verticalId} onValueChange={setVerticalId} disabled={verticalsLoading}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select vertical" />
                </SelectTrigger>
                <SelectContent>
                  {verticals.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Project Name *</Label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Client Name *</Label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Client name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Client Contact *</Label>
                <Input
                  value={clientContact}
                  onChange={(e) => setClientContact(e.target.value)}
                  placeholder="Phone or email"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>City *</Label>
                <Input
                  value={locationCity}
                  onChange={(e) => setLocationCity(e.target.value)}
                  placeholder="City"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>State *</Label>
                <Input
                  value={locationState}
                  onChange={(e) => setLocationState(e.target.value)}
                  placeholder="State"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Deal Document URL</Label>
              <div className="flex items-center gap-2 mt-1">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={dealFileUrl}
                  onChange={(e) => setDealFileUrl(e.target.value)}
                  placeholder="Google Drive or file link (optional)"
                />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes about the deal..."
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload Deal
            </>
          )}
        </Button>
      </form>
    </motion.div>
  );
}
