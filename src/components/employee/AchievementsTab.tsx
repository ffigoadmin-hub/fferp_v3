import { useState } from 'react';
import { Award, Plus, Trophy, Briefcase, Heart, FileText, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { addAchievement } from '@/services/employeeAchievementsService';
import type { AchievementCategory, RecognitionLevel } from '@/services/employeeAchievementsService';

interface AchievementsTabProps {
  achievements: any[];
  userId: string;
  isAdmin: boolean;
}

export function AchievementsTab({ achievements, userId, isAdmin }: AchievementsTabProps) {
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [achievementForm, setAchievementForm] = useState({
    achievement_title: '',
    achievement_description: '',
    achievement_category: 'work',
    achievement_date: new Date().toISOString().split('T')[0],
    proof_url: '',
    recognition_level: '',
    is_public: true,
  });

  const handleAddAchievement = async () => {
    try {
      await addAchievement({
        employee_id: userId,
        added_by: userId,
        ...achievementForm,
        achievement_category: achievementForm.achievement_category as AchievementCategory,
        proof_url: achievementForm.proof_url || null,
        recognition_level: (achievementForm.recognition_level || null) as RecognitionLevel | null,
      });
      setShowAchievementModal(false);
      toast.success('Achievement added successfully');
      // Reset form
      setAchievementForm({
        achievement_title: '',
        achievement_description: '',
        achievement_category: 'work',
        achievement_date: new Date().toISOString().split('T')[0],
        proof_url: '',
        recognition_level: '',
        is_public: true,
      });
    } catch (error) {
      console.error('Error adding achievement:', error);
      toast.error('Failed to add achievement');
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'work':
        return <Briefcase className="w-4 h-4" />;
      case 'personal':
        return <Heart className="w-4 h-4" />;
      case 'award':
        return <Trophy className="w-4 h-4" />;
      default:
        return <Award className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'work':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'personal':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'award':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Add Achievement Button (Admin Only) */}
      {isAdmin && (
        <div className="flex justify-end">
          <Dialog open={showAchievementModal} onOpenChange={setShowAchievementModal}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Achievement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Achievement</DialogTitle>
                <DialogDescription>
                  Record a new achievement for this employee
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="achievement_title">Achievement Title</Label>
                  <Input
                    id="achievement_title"
                    value={achievementForm.achievement_title}
                    onChange={(e) => setAchievementForm(prev => ({ ...prev, achievement_title: e.target.value }))}
                    placeholder="e.g., Project Alpha Completion"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="achievement_description">Description</Label>
                  <Textarea
                    id="achievement_description"
                    value={achievementForm.achievement_description}
                    onChange={(e) => setAchievementForm(prev => ({ ...prev, achievement_description: e.target.value }))}
                    placeholder="Describe the achievement in detail"
                    rows={3}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="achievement_category">Category</Label>
                    <Select
                      value={achievementForm.achievement_category}
                      onValueChange={(value) => setAchievementForm(prev => ({ ...prev, achievement_category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="work">Work Project</SelectItem>
                        <SelectItem value="personal">Personal Development</SelectItem>
                        <SelectItem value="award">Award/Recognition</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="achievement_date">Date</Label>
                    <Input
                      id="achievement_date"
                      type="date"
                      value={achievementForm.achievement_date}
                      onChange={(e) => setAchievementForm(prev => ({ ...prev, achievement_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="recognition_level">Recognition Level</Label>
                    <Select
                      value={achievementForm.recognition_level}
                      onValueChange={(value) => setAchievementForm(prev => ({ ...prev, recognition_level: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="team">Team Level</SelectItem>
                        <SelectItem value="department">Department Level</SelectItem>
                        <SelectItem value="company">Company Level</SelectItem>
                        <SelectItem value="industry">Industry Level</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="proof_url">Proof URL</Label>
                    <Input
                      id="proof_url"
                      value={achievementForm.proof_url}
                      onChange={(e) => setAchievementForm(prev => ({ ...prev, proof_url: e.target.value }))}
                      placeholder="Link to proof document (optional)"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_public"
                    checked={achievementForm.is_public}
                    onChange={(e) => setAchievementForm(prev => ({ ...prev, is_public: e.target.checked }))}
                  />
                  <Label htmlFor="is_public">Make this achievement public</Label>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowAchievementModal(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddAchievement}>
                    Add Achievement
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Achievements List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            Achievements
          </CardTitle>
          <CardDescription>Your work accomplishments and recognitions</CardDescription>
        </CardHeader>
        <CardContent>
          {achievements.length > 0 ? (
            <div className="space-y-4">
              {achievements.map((achievement: any) => (
                <div key={achievement.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getCategoryIcon(achievement.achievement_category)}
                        <h4 className="font-medium">{achievement.achievement_title}</h4>
                        <Badge className={getCategoryColor(achievement.achievement_category)}>
                          {achievement.achievement_category}
                        </Badge>
                        {achievement.recognition_level && (
                          <Badge variant="outline">
                            {achievement.recognition_level}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {achievement.achievement_description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(achievement.achievement_date).toLocaleDateString()}
                        </span>
                        {achievement.proof_url && (
                          <a
                            href={achievement.proof_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:underline"
                          >
                            <FileText className="w-3 h-3" />
                            View Proof
                          </a>
                        )}
                        {!achievement.is_public && (
                          <Badge variant="secondary" className="text-xs">
                            Private
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No achievements recorded yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}