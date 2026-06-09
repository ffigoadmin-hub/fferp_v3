import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectLifecycle } from '@/hooks/useProjectLifecycle';
import { toast } from 'sonner';
import { BOQBuilderWorkspace } from '@/components/engineering/BOQBuilderWorkspace';

export default function BOQBuilderPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { project } = useProjectLifecycle(projectId);

  if (!projectId) {
    return <div className="p-6 text-center text-muted-foreground">Project ID missing</div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-card border rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Button variant="ghost" size="sm" onClick={() => navigate('/employee-projects')} className="h-8 w-8 p-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl font-bold">BOQ Builder</h1>
            </div>
            <p className="text-muted-foreground ml-10">
              {project?.project_name} <span className="mx-2">•</span> {project?.project_id}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => toast.success('Draft Saved Locally')}>
              <Save className="w-4 h-4 mr-2" /> Save Draft
            </Button>
            <Button className="bg-primary" onClick={() => navigate(`/engineering/boq/${projectId}/review`)}>
              Proceed to Review <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>

      {/* Embedded Workspace */}
      <BOQBuilderWorkspace projectId={projectId} hideHeader={true} />
    </div>
  );
}
