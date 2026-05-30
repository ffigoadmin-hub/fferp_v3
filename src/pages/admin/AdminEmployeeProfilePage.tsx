import { isMissingTable } from '@/lib/supabase-error-guard';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Building, Hash, BadgeCheck, MapPin, Lock, Eye, EyeOff, Star, Award, FileText, History, Camera, Upload, Save, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getAllProfiles, getEmployeeProfile, getProfileStatistics, updateEmployeeProfile } from '@/services/employeeProfileService';
import { getEmployeeRatings, getAverageRatingTrend } from '@/services/employeeRatingsService';
import { getEmployeeAchievements } from '@/services/employeeAchievementsService';
import { getEmployeeMemos } from '@/services/employeeMemosService';
import { getEmployeeHistory } from '@/services/employeeHistoryService';
import { uploadProfilePicture, updateProfilePictureUrl, deleteProfilePicture } from '@/services/employeeProfileService';
import { RatingsTab } from '@/components/employee/RatingsTab';
import { AchievementsTab } from '@/components/employee/AchievementsTab';
import { MemosTab } from '@/components/employee/MemosTab';
import { HistoryTab } from '@/components/employee/HistoryTab';

export function AdminEmployeeProfilePage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [profile, setProfile] = useState<any>(null);
  const [ratings, setRatings] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [memos, setMemos] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [profileStats, setProfileStats] = useState<any>(null);
  const [ratingTrend, setRatingTrend] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [fetchError, setFetchError] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);

  const normalizedRole = user?.role?.toLowerCase();
  const canAccessProfileManager = ['admin', 'hr', 'ceo', 'gmo', 'smo'].includes(normalizedRole || '');
  const canEditProfiles = ['admin', 'ceo', 'hr'].includes(normalizedRole || '');
  const canAddRatings = ['admin', 'ceo', 'hr', 'gmo', 'smo'].includes(normalizedRole || '');
  const canAddMemos = ['admin', 'ceo', 'hr'].includes(normalizedRole || '');

  const invokeUpdateEmployeeProfileFunction = async (userId: string, updates: Record<string, any>) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (error) {
        console.error('Profile update error:', error);
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating employee profile:', error);
      const errorMessage = (error as any)?.message || 'Failed to update employee profile';
      throw new Error(errorMessage);
    }
  };

  useEffect(() => {
    const fetchProfiles = async () => {
      if (!user || !canAccessProfileManager) return;
      setIsLoading(true);

      try {
        const { profiles: loadedProfiles } = await getAllProfiles(200, 0);
        setProfiles(loadedProfiles || []);
        if (loadedProfiles?.length > 0) {
          setSelectedProfileId(loadedProfiles[0].id);
        }
      } catch (error) {
        console.error('Error loading employee list:', error);
        setFetchError('Unable to load employee list. Please refresh or try again later.');
        if (!isMissingTable(error)) toast.error('Failed to load employee list');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfiles();
  }, [user, canAccessProfileManager]);

  const fetchEmployeeData = useCallback(async () => {
    if (!selectedProfileId) return;
    setIsLoading(true);
    setFetchError('');

    try {
      const profileData = await getEmployeeProfile(selectedProfileId);
      
      if (!profileData) {
        throw new Error('Employee profile data is empty.');
      }

      setProfile(profileData);

      const [ratingsData, achievementsData, memosData, historyResponse, statsData, trendData] = await Promise.all([
        getEmployeeRatings(selectedProfileId).catch(err => {
          console.warn('Error fetching ratings:', err);
          return [];
        }),
        getEmployeeAchievements(selectedProfileId, false).catch(err => {
          console.warn('Error fetching achievements:', err);
          return [];
        }),
        getEmployeeMemos(selectedProfileId, true).catch(err => {
          console.warn('Error fetching memos:', err);
          return [];
        }),
        getEmployeeHistory(selectedProfileId).catch(err => {
          console.warn('Error fetching history:', err);
          return { history: [], total: 0 };
        }),
        getProfileStatistics(selectedProfileId).catch(err => {
          console.warn('Error fetching stats:', err);
          return null;
        }),
        getAverageRatingTrend(selectedProfileId).catch(err => {
          console.warn('Error fetching trend:', err);
          return [];
        }),
      ]);

      setRatings(ratingsData || []);
      setAchievements(achievementsData || []);
      setMemos(memosData || []);
      setHistory(historyResponse?.history || []);
      setProfileStats(statsData);
      setRatingTrend(trendData || []);

      // Update profile with statistics from ratings summary
      if (statsData?.ratings) {
        setProfile(prev => ({
          ...prev,
          average_rating: statsData.ratings.average_rating || 0,
          current_rating: statsData.ratings.current_rating || 0,
          total_ratings: statsData.ratings.total_ratings || 0,
        }));
      }
    } catch (error: any) {
      console.error('Error loading employee details:', error);
      let errorMessage = 'Unable to load selected employee details. Please try again.';

      if (error.message?.includes('Profile not found')) {
        errorMessage = 'Employee profile not found. The employee may have been removed.';
      } else if (error.message?.includes('Database connection')) {
        errorMessage = 'Database connection issue. Please check your internet connection and try again.';
      } else if (error.code === 'PGRST301') {
        errorMessage = 'Authentication error. Please log out and log back in.';
      } else if (error.status === 401) {
        errorMessage = 'Session expired. Please log in again.';
      }

      setFetchError(errorMessage);
      if (!isMissingTable(error)) toast.error('Failed to load employee details');
    } finally {
      setIsLoading(false);
    }
  }, [selectedProfileId]);

  useEffect(() => {
    fetchEmployeeData();
  }, [fetchEmployeeData]);

  const handleSaveProfile = async () => {
    if (!profile || !selectedProfileId) return;

    setIsSaving(true);
    try {
      const updateData = {
        name: profile.name || profile.full_name,
        email: profile.email,
        department: profile.department,
        office_number: profile.office_number || profile.employee_number,
        role: profile.role,
        destination: profile.destination,
        address: profile.address,
        emergency_contact_name: profile.emergency_contact_name,
        emergency_contact_phone: profile.emergency_contact_phone,
      };

      console.log('Updating profile for:', selectedProfileId);
      console.log('Update data:', updateData);

      await invokeUpdateEmployeeProfileFunction(selectedProfileId, updateData);
      setProfile(prev => ({ ...prev, ...updateData }));
      toast.success('Employee profile updated successfully');
    } catch (error: any) {
      console.error('Error updating employee profile:', error);
      toast.error(`Failed to update employee profile: ${error.message || error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveJoiningDate = async () => {
    if (!profile || !selectedProfileId) return;

    setIsSaving(true);
    try {
      await invokeUpdateEmployeeProfileFunction(selectedProfileId, { joining_date: profile.joining_date });
      toast.success('Joining date updated successfully');
    } catch (error: any) {
      console.error('Error updating joining date:', error);
      toast.error(`Failed to update joining date: ${error.message || error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleProfilePictureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedProfileId) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setIsUploadingPicture(true);
    try {
      // Upload to storage
      const publicUrl = await uploadProfilePicture(selectedProfileId, file);

      // Update profile with new URL
      await invokeUpdateEmployeeProfileFunction(selectedProfileId, { profile_picture_url: publicUrl });

      // Update local state
      setProfile(prev => ({ ...prev, profile_picture_url: publicUrl }));

      toast.success('Profile picture updated successfully');
    } catch (error: any) {
      console.error('Error uploading profile picture:', error);
      if (error.message?.includes('Bucket not found')) {
        toast.error('Storage bucket not found. Please create the "employee-profile-pictures" bucket in Supabase Storage.');
      } else {
        toast.error(`Failed to upload profile picture: ${error.message || error}`);
      }
    } finally {
      setIsUploadingPicture(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleDeleteProfilePicture = async () => {
    if (!selectedProfileId) return;

    if (!confirm('Are you sure you want to delete this profile picture?')) {
      return;
    }

    setIsUploadingPicture(true);
    try {
      await deleteProfilePicture(selectedProfileId);

      // Update local state
      setProfile(prev => ({ ...prev, profile_picture_url: null }));

      toast.success('Profile picture deleted successfully');
    } catch (error: any) {
      console.error('Error deleting profile picture:', error);
      toast.error(`Failed to delete profile picture: ${error.message || error}`);
    } finally {
      setIsUploadingPicture(false);
    }
  };

  if (!canAccessProfileManager) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="text-muted-foreground mt-3">You must be an admin, HR, or CEO to access the employee profile manager.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-primary">Loading administration profile manager…</span>
      </div>
    );
  }

  // Get unique departments
  const uniqueDepartments = Array.from(new Set(profiles.map(item => item.department).filter(Boolean)));

  const filteredProfiles = profiles.filter((item) => {
    const normalized = `${item.full_name || item.name || ''} ${item.email || ''} ${item.id || ''}`.toLowerCase();
    const matchesSearch = normalized.includes(searchTerm.trim().toLowerCase());
    const matchesDepartment = departmentFilter === 'all' || item.department === departmentFilter;
    return matchesSearch && matchesDepartment;
  });

  if (!profiles.length) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <h1 className="text-2xl font-bold">No employees found</h1>
        <p className="text-muted-foreground mt-3">There are no employee profiles available to display yet.</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Admin Employee Profile Manager</h1>
        <p className="text-muted-foreground mt-2">Select an employee and manage ratings, achievements, memos, history, and security details.</p>
      </div>

      <Card className="mb-6">
        <CardContent className="space-y-4">
          {fetchError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground flex items-center justify-between">
              <span>{fetchError}</span>
              <Button
                onClick={fetchEmployeeData}
                size="sm"
                variant="outline"
              >
                Retry
              </Button>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-[200px_200px_1fr] items-end">
            <div className="space-y-2">
              <Label htmlFor="employee-search">Search employees</Label>
              <Input
                id="employee-search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, or ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department-filter">Department</Label>
              <Select value={departmentFilter} onValueChange={(value) => setDepartmentFilter(value)}>
                <SelectTrigger id="department-filter">
                  <SelectValue placeholder="Filter by department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {uniqueDepartments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="employee-select">Employee</Label>
              <Select value={selectedProfileId} onValueChange={(value) => setSelectedProfileId(value)}>
                <SelectTrigger id="employee-select">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {filteredProfiles.length > 0 ? (
                    filteredProfiles.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.full_name || item.name || item.email}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-4 text-sm text-muted-foreground">No matching employees found.</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Badge variant="outline" className="uppercase tracking-[0.2em]">{profile?.role || 'N/A'}</Badge>
              <Badge className="text-xs">{profile?.department || 'No department'}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardContent>
              <div className="flex items-center gap-4">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={profile?.profile_picture_url} alt={profile?.full_name || profile?.name || ''} />
                  <AvatarFallback>
                    <User className="w-10 h-10" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-semibold">{profile?.full_name || profile?.name || 'Employee'}</h2>
                  <p className="text-sm text-muted-foreground">{profile?.email}</p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Hash className="w-4 h-4" />
                  <span>{profile?.id}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building className="w-4 h-4" />
                  <span>{profile?.department || 'Department not set'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>{profile?.destination || 'Destination not set'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Star className="w-4 h-4" />
                  <span>Average {profile?.average_rating?.toFixed(1) ?? '0.0'} • {profile?.total_ratings || 0} ratings</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5" />
                Rating Overview
              </CardTitle>
              <CardDescription>Performance ratings and trends</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{(profile?.average_rating || 0).toFixed(1)}</div>
                  <p className="text-sm text-muted-foreground">Average Rating</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{(profile?.current_rating || 0).toFixed(1)}</div>
                  <p className="text-sm text-muted-foreground">Current Rating</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{profile?.total_ratings || 0}</div>
                  <p className="text-sm text-muted-foreground">Total Ratings</p>
                </div>
              </div>

              {ratingTrend && ratingTrend.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Recent Trend</h4>
                  <div className="space-y-1">
                    {ratingTrend.slice(-5).map((trend: any, index: number) => (
                      <div key={index} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {new Date(trend.rating_period).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </span>
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{trend.overall_rating?.toFixed(1) || 'N/A'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {profileStats?.ratings && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Rating Breakdown</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Work Quality:</span>
                      <span className="font-medium ml-1">{profileStats.ratings.average_work_quality?.toFixed(1) || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Punctuality:</span>
                      <span className="font-medium ml-1">{profileStats.ratings.average_punctuality?.toFixed(1) || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Teamwork:</span>
                      <span className="font-medium ml-1">{profileStats.ratings.average_teamwork?.toFixed(1) || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Communication:</span>
                      <span className="font-medium ml-1">{profileStats.ratings.average_communication?.toFixed(1) || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Security
              </CardTitle>
              <CardDescription>Employee access and role details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <div className="text-sm">
                  <div className="font-medium">Role</div>
                  <div className="text-muted-foreground">{profile?.role || 'Not assigned'}</div>
                </div>
                <div className="text-sm">
                  <div className="font-medium">Email</div>
                  <div className="text-muted-foreground">{profile?.email}</div>
                </div>
                <div className="text-sm">
                  <div className="font-medium">Password</div>
                  <div className="text-muted-foreground">Password is managed by the user and cannot be viewed.</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="mb-6 grid grid-cols-6">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="ratings">Ratings</TabsTrigger>
              <TabsTrigger value="achievements">Achievements</TabsTrigger>
              <TabsTrigger value="memos">Memos</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      value={profile?.full_name || profile?.name || ''}
                      onChange={(e) => setProfile(prev => ({ ...prev, full_name: e.target.value, name: e.target.value }))}
                      placeholder="Enter full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input
                      value={profile?.email || ''}
                      onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Enter email address"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Input
                      value={profile?.department || ''}
                      onChange={(e) => setProfile(prev => ({ ...prev, department: e.target.value }))}
                      placeholder="Enter department"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Employee ID</Label>
                    <Input
                      value={profile?.office_number || profile?.employee_number || profile?.id || ''}
                      onChange={(e) => setProfile(prev => ({ ...prev, office_number: e.target.value, employee_number: e.target.value }))}
                      placeholder="Enter employee ID"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Input
                      value={profile?.role || ''}
                      onChange={(e) => setProfile(prev => ({ ...prev, role: e.target.value }))}
                      placeholder="Enter role"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Destination</Label>
                    <Input
                      value={profile?.destination || ''}
                      onChange={(e) => setProfile(prev => ({ ...prev, destination: e.target.value }))}
                      placeholder="Enter work destination"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Textarea
                    value={profile?.address || ''}
                    onChange={(e) => setProfile(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Enter address"
                    rows={2}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Emergency Contact</Label>
                    <Input
                      value={profile?.emergency_contact_name || ''}
                      onChange={(e) => setProfile(prev => ({ ...prev, emergency_contact_name: e.target.value }))}
                      placeholder="Enter emergency contact name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Emergency Phone</Label>
                    <Input
                      value={profile?.emergency_contact_phone || ''}
                      onChange={(e) => setProfile(prev => ({ ...prev, emergency_contact_phone: e.target.value }))}
                      placeholder="Enter emergency contact phone"
                    />
                  </div>
                </div>

                {/* Profile Picture Upload */}
                <div className="space-y-4">
                  <Label>Profile Picture</Label>
                  <div className="flex items-center gap-4">
                    <Avatar className="w-16 h-16">
                      <AvatarImage src={profile?.profile_picture_url} alt={profile?.full_name || profile?.name || ''} />
                      <AvatarFallback>
                        <User className="w-8 h-8" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex gap-2">
                      <div className="relative">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleProfilePictureUpload}
                          disabled={isUploadingPicture || !canEditProfiles}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          id="profile-picture-upload"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isUploadingPicture || !canEditProfiles}
                          className="pointer-events-none"
                        >
                          {isUploadingPicture ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              Upload Picture
                            </>
                          )}
                        </Button>
                      </div>
                      {profile?.profile_picture_url && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleDeleteProfilePicture}
                          disabled={isUploadingPicture || !canEditProfiles}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload a profile picture (JPG, PNG, or WEBP, max 5MB)
                  </p>
                </div>

                <div className="pt-4">
                  <Button onClick={handleSaveProfile} disabled={isSaving || !canEditProfiles} className="w-full md:w-auto">
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="ratings">
              <RatingsTab
                profile={profile}
                ratings={ratings}
                ratingTrend={ratingTrend}
                userId={selectedProfileId}
                isAdmin={canAddRatings}
                onRatingAdded={fetchEmployeeData}
                profileStats={profileStats}
              />
            </TabsContent>
            <TabsContent value="achievements">
              <AchievementsTab achievements={achievements} userId={selectedProfileId} isAdmin={canEditProfiles} />
            </TabsContent>
            <TabsContent value="memos">
              <MemosTab memos={memos} userId={selectedProfileId} isAdmin={canEditProfiles} />
            </TabsContent>
            <TabsContent value="history">
              <HistoryTab history={history} profile={profile} isAdmin={canEditProfiles} />
            </TabsContent>
            <TabsContent value="security">
              <div className="space-y-4">
                <div className="rounded-lg border border-border p-4 bg-muted/40">
                  <p className="text-sm font-medium">Security details are read-only here.</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Admins can review employee access and role assignments, but password changes must be handled by the employee.
                  </p>
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle>Access Summary</CardTitle>
                    <CardDescription>Review the selected employee's access information.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Role</div>
                      <div className="font-medium">{profile?.role || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Email</div>
                      <div className="font-medium">{profile?.email}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Joined</div>
                      <Input
                        type="date"
                        value={profile?.joining_date ? profile.joining_date.split('T')[0] : ''}
                        onChange={(e) => setProfile(prev => ({ ...prev, joining_date: e.target.value }))}
                        className="w-fit"
                      />
                    </div>
                    <div className="pt-2">
                      <Button onClick={handleSaveJoiningDate} disabled={isSaving} size="sm">
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </motion.div>
  );
}
