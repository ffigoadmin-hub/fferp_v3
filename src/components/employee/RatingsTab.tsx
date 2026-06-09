import { useState } from 'react';
import { TrendingUp, Star, Calendar, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { addRating, getMonthlyRating, updateDraftRating } from '@/services/employeeRatingsService';

interface RatingsTabProps {
  profile: any;
  ratings: any[];
  ratingTrend: any[];
  userId: string;
  isAdmin: boolean;
  onRatingAdded?: () => Promise<void> | void;
  profileStats?: {
    ratings?: {
      average_rating?: number;
      current_rating?: number;
      total_ratings?: number;
    } | null;
  } | null;
}

export function RatingsTab({ profile, ratings, ratingTrend, userId, isAdmin, onRatingAdded, profileStats }: RatingsTabProps) {
  // Use profileStats if available, otherwise fallback to profile
  const ratingStats = profileStats?.ratings || profile;
  const averageRating = ratingStats?.average_rating ?? profile?.average_rating ?? 0;
  const currentRating = ratingStats?.current_rating ?? profile?.current_rating ?? 0;
  const totalRatings = ratingStats?.total_ratings ?? profile?.total_ratings ?? 0;
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ratingForm, setRatingForm] = useState({
    rating_month: new Date().getMonth() + 1,
    rating_year: new Date().getFullYear(),
    overall_rating: 8.0,
    work_quality_rating: 8,
    punctuality_rating: 8,
    teamwork_rating: 8,
    communication_rating: 8,
    initiative_rating: 8,
    strengths: '',
    areas_for_improvement: '',
    manager_comments: '',
    is_final: true,
  });

  const handleAddRating = async () => {
    try {
      setIsSubmitting(true);

      if (!userId) {
        throw new Error('Employee profile is not selected');
      }

      // Validate rating values are within 1-10 range
      const validateRating = (value: number, fieldName: string) => {
        if (value < 1 || value > 10) {
          throw new Error(`${fieldName} must be between 1 and 10`);
        }
      };

      validateRating(ratingForm.overall_rating, 'Overall rating');
      validateRating(ratingForm.work_quality_rating, 'Work quality rating');
      validateRating(ratingForm.punctuality_rating, 'Punctuality rating');
      validateRating(ratingForm.teamwork_rating, 'Teamwork rating');
      validateRating(ratingForm.communication_rating, 'Communication rating');
      validateRating(ratingForm.initiative_rating, 'Initiative rating');

      const ratingData = {
        employee_id: userId,
        rating_month: ratingForm.rating_month,
        rating_year: ratingForm.rating_year,
        rating_period: new Date(Date.UTC(ratingForm.rating_year, ratingForm.rating_month - 1, 1)).toISOString().split('T')[0],
        overall_rating: ratingForm.overall_rating,
        work_quality_rating: ratingForm.work_quality_rating,
        punctuality_rating: ratingForm.punctuality_rating,
        teamwork_rating: ratingForm.teamwork_rating,
        communication_rating: ratingForm.communication_rating,
        initiative_rating: ratingForm.initiative_rating,
        strengths: ratingForm.strengths,
        areas_for_improvement: ratingForm.areas_for_improvement,
        manager_comments: ratingForm.manager_comments,
        is_final: true,
      };

      const existingRating = await getMonthlyRating(
        userId,
        ratingForm.rating_year,
        ratingForm.rating_month
      );

      if (existingRating?.is_final) {
        toast.error('A final rating already exists for this employee and month');
        return;
      }

      if (existingRating) {
        await updateDraftRating(existingRating.id, ratingData);
      } else {
        await addRating(ratingData);
      }

      await onRatingAdded?.();
      setShowRatingModal(false);
      toast.success(existingRating ? 'Draft rating finalized successfully' : 'Rating added successfully');
      // Reset form
      setRatingForm({
        rating_month: new Date().getMonth() + 1,
        rating_year: new Date().getFullYear(),
        overall_rating: 8.0,
        work_quality_rating: 8,
        punctuality_rating: 8,
        teamwork_rating: 8,
        communication_rating: 8,
        initiative_rating: 8,
        strengths: '',
        areas_for_improvement: '',
        manager_comments: '',
        is_final: true,
      });
    } catch (error) {
      console.error('Error adding rating:', error);
      toast.error((error as Error)?.message || 'Failed to add rating');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Rating Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Performance Overview
          </CardTitle>
          <CardDescription>Your performance ratings and trends</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{(averageRating || 0).toFixed(1)}</div>
              <p className="text-sm text-muted-foreground">Average Rating</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{(currentRating || 0).toFixed(1)}</div>
              <p className="text-sm text-muted-foreground">Current Rating</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{totalRatings || 0}</div>
              <p className="text-sm text-muted-foreground">Total Ratings</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Rating Button (Admin Only) */}
      {isAdmin && (
        <div className="flex justify-end">
          <Dialog open={showRatingModal} onOpenChange={setShowRatingModal}>
            <DialogTrigger asChild>
              <Button>
                <Star className="w-4 h-4 mr-2" />
                Add Rating
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Performance Rating</DialogTitle>
                <DialogDescription>
                  Rate employee performance for the selected month
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Month/Year Selection */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="rating_month">Month</Label>
                    <Select
                      value={ratingForm.rating_month.toString()}
                      onValueChange={(value) => setRatingForm(prev => ({ ...prev, rating_month: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString()}>
                            {new Date(0, i).toLocaleString('en', { month: 'long' })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rating_year">Year</Label>
                    <Input
                      id="rating_year"
                      type="number"
                      value={ratingForm.rating_year}
                      onChange={(e) => setRatingForm(prev => ({ ...prev, rating_year: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>

                {/* Overall Rating */}
                <div className="space-y-2">
                  <Label htmlFor="overall_rating">Overall Rating (1-10)</Label>
                  <Input
                    id="overall_rating"
                    type="number"
                    min="1"
                    max="10"
                    step="0.1"
                    value={ratingForm.overall_rating}
                    onChange={(e) => setRatingForm(prev => ({ ...prev, overall_rating: parseFloat(e.target.value) }))}
                  />
                </div>

                {/* Category Ratings */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Work Quality (1-10)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={ratingForm.work_quality_rating}
                      onChange={(e) => setRatingForm(prev => ({ ...prev, work_quality_rating: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Punctuality (1-10)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={ratingForm.punctuality_rating}
                      onChange={(e) => setRatingForm(prev => ({ ...prev, punctuality_rating: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teamwork (1-10)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={ratingForm.teamwork_rating}
                      onChange={(e) => setRatingForm(prev => ({ ...prev, teamwork_rating: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Communication (1-10)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={ratingForm.communication_rating}
                      onChange={(e) => setRatingForm(prev => ({ ...prev, communication_rating: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Initiative (1-10)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={ratingForm.initiative_rating}
                      onChange={(e) => setRatingForm(prev => ({ ...prev, initiative_rating: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>

                {/* Comments */}
                <div className="space-y-2">
                  <Label htmlFor="strengths">Strengths</Label>
                  <Textarea
                    id="strengths"
                    value={ratingForm.strengths}
                    onChange={(e) => setRatingForm(prev => ({ ...prev, strengths: e.target.value }))}
                    placeholder="What are the employee's key strengths?"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="areas_for_improvement">Areas for Improvement</Label>
                  <Textarea
                    id="areas_for_improvement"
                    value={ratingForm.areas_for_improvement}
                    onChange={(e) => setRatingForm(prev => ({ ...prev, areas_for_improvement: e.target.value }))}
                    placeholder="What areas need improvement?"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manager_comments">Manager Comments</Label>
                  <Textarea
                    id="manager_comments"
                    value={ratingForm.manager_comments}
                    onChange={(e) => setRatingForm(prev => ({ ...prev, manager_comments: e.target.value }))}
                    placeholder="Additional comments from manager"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowRatingModal(false)} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddRating} disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Add Rating'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Recent Ratings */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Ratings</CardTitle>
          <CardDescription>Your monthly performance evaluations</CardDescription>
        </CardHeader>
        <CardContent>
          {ratings.length > 0 ? (
            <div className="space-y-4">
              {ratings.slice(0, 10).map((rating: any) => (
                <div key={rating.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">{rating.overall_rating}/10</span>
                    </div>
                    <div>
                      <div className="font-medium">
                        {new Date(rating.rating_period).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long'
                        })}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Work Quality: {rating.work_quality_rating}/10 |
                        Teamwork: {rating.teamwork_rating}/10 |
                        Communication: {rating.communication_rating}/10
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={rating.is_final ? "default" : "secondary"}>
                      {rating.is_final ? "Final" : "Draft"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No ratings available yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
