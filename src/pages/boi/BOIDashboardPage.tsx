import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, Bell, RefreshCw, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useNotifications } from '@/hooks/useNotifications';
import { UniversalCommandCenter } from '@/components/shared/UniversalCommandCenter';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EscalationWizard } from '@/components/nsm/EscalationWizard';
import { useEscalationEngine } from '@/hooks/useEscalationEngine';
import { supabase } from '@/integrations/supabase/client';

interface Project {
  id: string;
  project_name: string;
  client_name: string;
  client_contact: string;
  location_city: string;
  location_state: string;
  onboarded_date: string | null;
  project_type: string | null;
}

export default function BOIDashboardPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isEscalationDispatch = location.pathname.includes('escalation-dispatch');
  const isCriticalsDispatch = location.pathname.includes('criticals-dispatch');
  const isSiteVisitDispatch = location.pathname.includes('site-visit-dispatch');
  const isTicketsUnified = location.pathname.includes('/boi/tickets');
  const isDispatchMode = isEscalationDispatch || isCriticalsDispatch || isSiteVisitDispatch || isTicketsUnified;

  const lastUpdated = new Date();

  // Escalation Creation State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const { createEscalation, isSaving } = useEscalationEngine();
  const { unreadCount } = useNotifications();

  // Effect to handle ?create=true
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setIsDialogOpen(true);
      fetchProjects();
    }
  }, [searchParams]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name, client_name, client_contact, location_city, location_state, onboarded_date, project_type')
        .order('project_name');
      if (error) throw error;
      setProjects((data || []) as unknown as Project[]);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const handleWizardSubmit = async (data: any) => {
    const result = await createEscalation({
      department: data.department,
      client_name: data.client_name || 'N/A',
      client_phone: data.client_phone,
      issue_title: data.issue_title,
      issue_description: data.issue_description,
      priority: data.priority,
      evidence_url: data.evidence_url,
      project_id: data.project_id,
      escalation_proof_url: data.evidence_url,
      bucket: data.bucket,
    });

    // Clear the query param on close/submit
    if (result.success) {
      setSearchParams({});
    }
    return result;
  };

  // Close handler to clear query param
  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSearchParams({});
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {isDispatchMode ? 'BOI Ticket Center' : 'BOI Dashboard'}
            </h1>
            <p className="text-muted-foreground">
              {isDispatchMode
                ? 'Back Office Incharge - Unified Ticket Management & Dispatch'
                : 'Back Office Incharge - Department Oversight & Approvals'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {/* Escalation Creation Dialog - Always show for BOI */}
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            if (open) fetchProjects();
            else setSearchParams({});
            setIsDialogOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-red-600 hover:bg-red-700 text-white" size="sm">
                <Plus className="w-4 h-4" />
                Raise Escalation
              </Button>
            </DialogTrigger>
            <EscalationWizard
              onClose={handleDialogClose}
              onSubmit={handleWizardSubmit}
              isSaving={isSaving}
              projects={projects}
            />
          </Dialog>

          {unreadCount > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              <Bell className="w-3 h-3 mr-1" />
              {unreadCount} new
            </Badge>
          )}
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
            LIVE
          </Badge>
          <span className="hidden sm:flex items-center gap-1 text-xs">
            <RefreshCw className="w-3 h-3" />
            {format(lastUpdated, 'HH:mm:ss')}
          </span>
        </div>
      </div>

      {/* Main Content - Ticket Center only */}
      <div className="mt-6">
        <UniversalCommandCenter
          key={isTicketsUnified ? 'unified' : (isCriticalsDispatch ? 'criticals' : 'escalations')}
          roleOverride="boi"
          defaultTab={isCriticalsDispatch ? 'criticals' : 'escalations'}
          hideTabs={!isTicketsUnified && isDispatchMode}
        />
      </div>
    </motion.div >
  );
}
