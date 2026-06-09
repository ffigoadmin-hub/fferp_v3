import { useState } from 'react';
import { History, Briefcase, Users, TrendingUp, Calendar, ArrowRight, Edit2, Check, X, Plus, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { addHistoryEntry, updateHistoryEntry, deleteHistoryEntry } from '@/services/employeeHistoryService';
import { updateCareerSummary } from '@/services/employeeProfileService';

interface HistoryTabProps {
  history: any[];
  profile: any;
  isAdmin?: boolean;
}

export function HistoryTab({ history, profile, isAdmin = false }: HistoryTabProps) {
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editingHistory, setEditingHistory] = useState<any>(null);
  const [historyForm, setHistoryForm] = useState({
    change_type: 'role_change' as any,
    field_changed: '',
    old_value: '',
    new_value: '',
    change_date: new Date().toISOString().split('T')[0],
    effective_date: new Date().toISOString().split('T')[0],
    change_reason: '',
    notes: '',
  });
  const [isSavingCareerSummary, setIsSavingCareerSummary] = useState(false);
  const [summaryForm, setSummaryForm] = useState({
    years_of_service: profile.joining_date ?
      Math.floor((new Date().getTime() - new Date(profile.joining_date).getTime()) / (1000 * 60 * 60 * 24 * 365))
      : 0,
    career_changes: history.length,
    promotions: history.filter((item: any) => item.change_type === 'promotion').length,
  });

  const handleSaveSummary = async () => {
    if (!profile?.id) {
      toast.error('Profile ID not found');
      return;
    }

    setIsSavingCareerSummary(true);
    try {
      await updateCareerSummary(profile.id, {
        years_of_service: summaryForm.years_of_service,
        career_changes: summaryForm.career_changes,
        promotions: summaryForm.promotions,
      });
      toast.success('Career summary updated successfully');
      setIsEditingSummary(false);
    } catch (error: any) {
      console.error('Error saving career summary:', error);
      toast.error(error.message || 'Failed to save career summary');
    } finally {
      setIsSavingCareerSummary(false);
    }
  };

  const handleCancelEdit = () => {
    setSummaryForm({
      years_of_service: profile.joining_date ?
        Math.floor((new Date().getTime() - new Date(profile.joining_date).getTime()) / (1000 * 60 * 60 * 24 * 365))
        : 0,
      career_changes: history.length,
      promotions: history.filter((item: any) => item.change_type === 'promotion').length,
    });
    setIsEditingSummary(false);
  };

  const handleAddHistory = () => {
    setEditingHistory(null);
    setHistoryForm({
      change_type: 'role_change',
      field_changed: '',
      old_value: '',
      new_value: '',
      change_date: new Date().toISOString().split('T')[0],
      effective_date: new Date().toISOString().split('T')[0],
      change_reason: '',
      notes: '',
    });
    setShowHistoryModal(true);
  };

  const handleEditHistory = (item: any) => {
    setEditingHistory(item);
    setHistoryForm({
      change_type: item.change_type,
      field_changed: item.field_changed || '',
      old_value: item.old_value || '',
      new_value: item.new_value || '',
      change_date: item.change_date ? item.change_date.split('T')[0] : new Date().toISOString().split('T')[0],
      effective_date: item.effective_date ? item.effective_date.split('T')[0] : new Date().toISOString().split('T')[0],
      change_reason: item.change_reason || '',
      notes: item.notes || '',
    });
    setShowHistoryModal(true);
  };

  const handleDeleteHistory = async (historyId: string) => {
    if (!confirm('Are you sure you want to delete this history entry?')) {
      return;
    }

    try {
      await deleteHistoryEntry(historyId);
      toast.success('History entry deleted successfully');
      // Refresh will be handled by parent component
      window.location.reload();
    } catch (error) {
      console.error('Error deleting history entry:', error);
      toast.error('Failed to delete history entry');
    }
  };

  const handleSaveHistory = async () => {
    try {
      const historyData = {
        employee_id: profile.id,
        change_type: historyForm.change_type,
        field_changed: historyForm.field_changed,
        old_value: historyForm.old_value || null,
        new_value: historyForm.new_value || null,
        change_date: historyForm.change_date,
        effective_date: historyForm.effective_date || null,
        change_reason: historyForm.change_reason || null,
        notes: historyForm.notes || null,
      };

      if (editingHistory) {
        await updateHistoryEntry(editingHistory.id, historyData);
        toast.success('History entry updated successfully');
      } else {
        await addHistoryEntry(historyData);
        toast.success('History entry added successfully');
      }

      setShowHistoryModal(false);
      setEditingHistory(null);
      window.location.reload();
    } catch (error) {
      console.error('Error saving history entry:', error);
      toast.error(editingHistory ? 'Failed to update history entry' : 'Failed to add history entry');
    }
  };
  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'role_change':
        return <Briefcase className="w-4 h-4" />;
      case 'department_change':
        return <Users className="w-4 h-4" />;
      case 'team_change':
        return <Users className="w-4 h-4" />;
      case 'promotion':
        return <TrendingUp className="w-4 h-4" />;
      default:
        return <History className="w-4 h-4" />;
    }
  };

  const getChangeColor = (changeType: string) => {
    switch (changeType) {
      case 'promotion':
        return 'text-green-600';
      case 'role_change':
        return 'text-blue-600';
      case 'department_change':
        return 'text-purple-600';
      case 'team_change':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatChangeType = (changeType: string) => {
    return changeType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="space-y-6">
      {/* Career Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              <CardTitle>Career Summary</CardTitle>
            </div>
            {isAdmin && !isEditingSummary && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingSummary(true)}
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
          <CardDescription>Your career progression at the company</CardDescription>
        </CardHeader>
        <CardContent>
          {isEditingSummary && isAdmin ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="years_of_service">Years of Service</Label>
                  <Input
                    id="years_of_service"
                    type="number"
                    min="0"
                    value={summaryForm.years_of_service}
                    onChange={(e) => setSummaryForm(prev => ({
                      ...prev,
                      years_of_service: parseInt(e.target.value) || 0
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="career_changes">Career Changes</Label>
                  <Input
                    id="career_changes"
                    type="number"
                    min="0"
                    value={summaryForm.career_changes}
                    onChange={(e) => setSummaryForm(prev => ({
                      ...prev,
                      career_changes: parseInt(e.target.value) || 0
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="promotions">Promotions</Label>
                  <Input
                    id="promotions"
                    type="number"
                    min="0"
                    value={summaryForm.promotions}
                    onChange={(e) => setSummaryForm(prev => ({
                      ...prev,
                      promotions: parseInt(e.target.value) || 0
                    }))}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEdit}
                  disabled={isSavingCareerSummary}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveSummary}
                  disabled={isSavingCareerSummary}
                >
                  {isSavingCareerSummary ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {summaryForm.years_of_service}
                </div>
                <p className="text-sm text-muted-foreground">Years of Service</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{summaryForm.career_changes}</div>
                <p className="text-sm text-muted-foreground">Career Changes</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{summaryForm.promotions}</div>
                <p className="text-sm text-muted-foreground">Promotions</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Career Timeline */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5" />
              <CardTitle>Career Timeline</CardTitle>
            </div>
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAddHistory}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Entry
              </Button>
            )}
          </div>
          <CardDescription>Your career progression and changes</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length > 0 ? (
            <div className="space-y-6">
              {/* Current Position */}
              <div className="flex items-start gap-4">
                <div className="w-3 h-3 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                <div className="flex-1 pb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-green-100 text-green-800 border-green-200">
                      Current Position
                    </Badge>
                  </div>
                  <h4 className="font-medium">{profile.role}</h4>
                  <p className="text-sm text-muted-foreground">
                    {profile.department} Department
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Since {profile.joining_date ? new Date(profile.joining_date).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Historical Changes */}
              {history.slice(0, 20).map((item: any, index: number) => (
                <div key={item.id} className="flex items-start gap-4">
                  <div className={`w-3 h-3 rounded-full mt-2 flex-shrink-0 ${getChangeColor(item.change_type)}`}></div>
                  <div className="flex-1 pb-6 border-l border-muted pl-4">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <div className={getChangeColor(item.change_type)}>
                          {getChangeIcon(item.change_type)}
                        </div>
                        <Badge variant="outline">
                          {formatChangeType(item.change_type)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.effective_date || item.change_date).toLocaleDateString()}
                        </span>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleEditHistory(item)}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteHistory(item.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-medium mb-1">{item.change_reason}</p>
                    {(item.old_value || item.new_value || item.before_value || item.after_value) && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {(item.old_value || item.before_value) && (
                          <span className="line-through">{item.old_value || item.before_value}</span>
                        )}
                        {(item.old_value || item.before_value) && (item.new_value || item.after_value) && (
                          <ArrowRight className="w-3 h-3" />
                        )}
                        {(item.new_value || item.after_value) && (
                          <span className="font-medium">{item.new_value || item.after_value}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No career history available yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Career changes and promotions will appear here
              </p>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={handleAddHistory}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Entry
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit History Entry Modal */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingHistory ? 'Edit History Entry' : 'Add History Entry'}</DialogTitle>
            <DialogDescription>
              {editingHistory ? 'Update this career history entry' : 'Record a new career change or milestone'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="change_type">Change Type</Label>
                <Select
                  value={historyForm.change_type}
                  onValueChange={(value) => setHistoryForm(prev => ({ ...prev, change_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="role_change">Role Change</SelectItem>
                    <SelectItem value="department_change">Department Change</SelectItem>
                    <SelectItem value="team_change">Team Change</SelectItem>
                    <SelectItem value="promotion">Promotion</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="status_change">Status Change</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="field_changed">Field Changed</Label>
                <Input
                  id="field_changed"
                  value={historyForm.field_changed}
                  onChange={(e) => setHistoryForm(prev => ({ ...prev, field_changed: e.target.value }))}
                  placeholder="e.g., Role, Department, Team"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="old_value">Previous Value</Label>
                <Input
                  id="old_value"
                  value={historyForm.old_value}
                  onChange={(e) => setHistoryForm(prev => ({ ...prev, old_value: e.target.value }))}
                  placeholder="e.g., Junior Developer"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new_value">New Value</Label>
                <Input
                  id="new_value"
                  value={historyForm.new_value}
                  onChange={(e) => setHistoryForm(prev => ({ ...prev, new_value: e.target.value }))}
                  placeholder="e.g., Senior Developer"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="change_date">Change Date</Label>
                <Input
                  id="change_date"
                  type="date"
                  value={historyForm.change_date}
                  onChange={(e) => setHistoryForm(prev => ({ ...prev, change_date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="effective_date">Effective Date</Label>
                <Input
                  id="effective_date"
                  type="date"
                  value={historyForm.effective_date}
                  onChange={(e) => setHistoryForm(prev => ({ ...prev, effective_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="change_reason">Change Reason</Label>
              <Textarea
                id="change_reason"
                value={historyForm.change_reason}
                onChange={(e) => setHistoryForm(prev => ({ ...prev, change_reason: e.target.value }))}
                placeholder="Describe the reason for this change"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={historyForm.notes}
                onChange={(e) => setHistoryForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional information"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowHistoryModal(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveHistory}>
                {editingHistory ? 'Update Entry' : 'Add Entry'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Stats */}
      {history.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-center">
                {history.filter((item: any) => item.change_type === 'role_change').length}
              </div>
              <p className="text-xs text-muted-foreground text-center">Role Changes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-center">
                {history.filter((item: any) => item.change_type === 'department_change').length}
              </div>
              <p className="text-xs text-muted-foreground text-center">Department Changes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-center">
                {history.filter((item: any) => item.change_type === 'team_change').length}
              </div>
              <p className="text-xs text-muted-foreground text-center">Team Changes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-center">
                {history.filter((item: any) => item.change_type === 'transfer').length}
              </div>
              <p className="text-xs text-muted-foreground text-center">Transfers</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}