import { isMissingTable } from '@/lib/supabase-error-guard';
// @ts-nocheck
import { useCallback, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  User, Mail, Building, Save, Loader2, BadgeCheck, Hash, MapPin, Lock, Eye, EyeOff, Star,
  TrendingUp, Award, FileText, History, Camera, Upload, X, Calendar, AlertTriangle,
  CheckCircle, Clock, Target, Users, Briefcase
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useIsCoreHead } from '@/hooks/useIsCoreHead';
import { toast } from 'sonner';
import {
  getEmployeeProfile,
  updateEmployeeProfile,
  uploadProfilePicture,
  updateProfilePictureUrl,
  getProfileStatistics,
} from '@/services/employeeProfileService';
import { getEmployeeRatings, getAverageRatingTrend } from '@/services/employeeRatingsService';
import { getEmployeeAchievements } from '@/services/employeeAchievementsService';
import { getEmployeeMemos } from '@/services/employeeMemosService';
import { getEmployeeHistory } from '@/services/employeeHistoryService';

// Import employee components
import { RatingsTab } from '@/components/employee/RatingsTab';
import { AchievementsTab } from '@/components/employee/AchievementsTab';
import { MemosTab } from '@/components/employee/MemosTab';
import { HistoryTab } from '@/components/employee/HistoryTab';

export function ProfilePage() {
  const { user } = useAuth();
  const { isCoreHead } = useIsCoreHead();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [fetchError, setFetchError] = useState<string>('');

  // Check if user is admin (can edit profile, ratings, achievements, memos, history, security)
  const isAdmin = ['admin', 'hr', 'ceo', 'gmo', 'smo'].includes(user?.role?.toLowerCase() || '');

  // Profile data
  const [profile, setProfile] = useState({
    id: '',
    name: '',
    email: '',
    department: '',
    employee_number: '',
    role: '',
    destination: '',
    profile_picture_url: '',
    date_of_birth: '',
    joining_date: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    current_rating: 0,
    average_rating: 0,
    total_ratings: 0,
  });

  // Additional data for new features
  const [ratings, setRatings] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [memos, setMemos] = useState([]);
  const [history, setHistory] = useState([]);
  const [profileStats, setProfileStats] = useState(null);
  const [ratingTrend, setRatingTrend] = useState([]);

  // Modal states
  const [showPictureUpload, setShowPictureUpload] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [showMemoModal, setShowMemoModal] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const fetchAllData = useCallback(async () => {
    if (!user) return;
    setFetchError('');
    setIsLoading(true);

    try {
      // Fetch profile data
      const profileData = await getEmployeeProfile(user.id);
      
      if (!profileData) {
        throw new Error('Profile data is empty. Please contact your administrator.');
      }

      setProfile({
        id: profileData.id || '',
        name: profileData.full_name || profileData.name || '',
        email: profileData.email || '',
        department: profileData.department || '',
        employee_number: profileData.office_number || '',
        role: profileData.role || '',
        destination: profileData.destination || '',
        profile_picture_url: profileData.profile_picture_url || '',
        date_of_birth: profileData.date_of_birth || '',
        joining_date: profileData.joining_date || '',
        address: profileData.address || '',
        emergency_contact_name: profileData.emergency_contact_name || '',
        emergency_contact_phone: profileData.emergency_contact_phone || '',
        current_rating: profileData.current_rating || 0,
        average_rating: profileData.average_rating || 0,
        total_ratings: profileData.total_ratings || 0,
      });

      // Fetch additional data in parallel
      const [
        ratingsData,
        achievementsData,
        memosData,
        historyData,
        statsData,
        trendData
      ] = await Promise.all([
        getEmployeeRatings(user.id).catch(err => {
          console.warn('Error fetching ratings:', err);
          return [];
        }),
        getEmployeeAchievements(user.id, false).catch(err => {
          console.warn('Error fetching achievements:', err);
          return [];
        }),
        getEmployeeMemos(user.id, true).catch(err => {
          console.warn('Error fetching memos:', err);
          return [];
        }),
        getEmployeeHistory(user.id).catch(err => {
          console.warn('Error fetching history:', err);
          return [];
        }),
        getProfileStatistics(user.id).catch(err => {
          console.warn('Error fetching stats:', err);
          return null;
        }),
        getAverageRatingTrend(user.id).catch(err => {
          console.warn('Error fetching trend:', err);
          return [];
        })
      ]);

      setRatings(ratingsData || []);
      setAchievements(achievementsData || []);
      setMemos(memosData || []);
      setHistory(historyData || []);
      setProfileStats(statsData);
      setRatingTrend(trendData || []);

      // Update profile with statistics
      if (statsData?.ratings) {
        setProfile(prev => ({
          ...prev,
          average_rating: statsData.ratings.average_rating || 0,
          current_rating: statsData.ratings.current_rating || 0,
          total_ratings: statsData.ratings.total_ratings || 0,
        }));
      }

    } catch (error: any) {
      console.error('Error fetching profile data:', error);
      let errorMessage = 'Failed to load profile data. Please reload or check your connection.';

      if (error.message?.includes('profile has not been set up')) {
        errorMessage = error.message;
      } else if (error.message?.includes('Profile not found')) {
        errorMessage = 'Your profile has not been set up yet. Please contact your administrator.';
      } else if (error.message?.includes('Database connection')) {
        errorMessage = 'Database connection issue. Please check your internet connection and try again.';
      } else if (error.code === 'PGRST301') {
        errorMessage = 'Authentication error. Please log out and log back in.';
      } else if (error.status === 401) {
        errorMessage = 'Session expired. Please log in again.';
      }

      setFetchError(errorMessage);
      if (!isMissingTable(error)) toast.error('Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      await updateEmployeeProfile(user.id, {
        name: profile.name,
        email: profile.email,
        department: profile.department,
        office_number: profile.employee_number,
        role: profile.role,
        destination: profile.destination,
        date_of_birth: profile.date_of_birth,
        address: profile.address,
        emergency_contact_name: profile.emergency_contact_name,
        emergency_contact_phone: profile.emergency_contact_phone,
      });

      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsChangingPassword(true);
    try {
      // First verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        toast.error('Current password is incorrect');
        return;
      }

      // If current password is correct, update to new password
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(error.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleProfilePictureUpload = async (file: File) => {
    if (!user) return;

    try {
      const publicUrl = await uploadProfilePicture(user.id, file);
      await updateProfilePictureUrl(user.id, publicUrl);

      setProfile(prev => ({ ...prev, profile_picture_url: publicUrl }));
      setShowPictureUpload(false);
      toast.success('Profile picture updated successfully');
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      toast.error('Failed to upload profile picture');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center space-y-4">
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6">
          <h1 className="text-xl font-bold">Unable to load profile</h1>
          <p className="text-muted-foreground">{fetchError}</p>
          <Button
            onClick={() => window.location.reload()}
            className="mt-4"
            variant="outline"
          >
            Retry Loading
          </Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">My Profile</h1>
        <p className="text-muted-foreground">View and update your profile information</p>
      </div>

      <div className="authority-card">
        {/* Avatar Section */}
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
          <div className="relative">
            <Avatar className="w-20 h-20">
              <AvatarImage src={profile.profile_picture_url} alt={profile.name} />
              <AvatarFallback>
                <User className="w-10 h-10" />
              </AvatarFallback>
            </Avatar>
            <Button
              size="icon"
              variant="secondary"
              className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full"
              onClick={() => setShowPictureUpload(true)}
            >
              <Camera className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{profile.name}</h2>
            <p className="text-muted-foreground capitalize">{profile.role}</p>
            <div className="flex items-center gap-4 mt-2">
              {profile.average_rating > 0 && (
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium">{profile.average_rating.toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground">({profile.total_ratings} ratings)</span>
                </div>
              )}
              <Badge variant="outline" className="text-xs">
                {profile.department}
              </Badge>
            </div>
          </div>
          {isCoreHead && (
            <div className="ml-auto flex items-center gap-2 px-3 py-2 rounded-lg
              bg-cyan-500/10 border border-cyan-500/30
              shadow-[0_0_16px_rgba(6,182,212,0.3)]">
              <Star className="w-4 h-4 fill-cyan-400 text-cyan-400" />
              <div>
                <p className="text-xs font-bold text-cyan-400 tracking-wider uppercase">Core Manager</p>
                <p className="text-[10px] text-cyan-400/70">Performance Tracker</p>
              </div>
            </div>
          )}
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className={`mb-6 grid w-full ${isAdmin ? 'grid-cols-6' : 'grid-cols-5'}`}>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="ratings">Ratings</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
            <TabsTrigger value="memos">Memos</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            {isAdmin && <TabsTrigger value="security">Security</TabsTrigger>}
          </TabsList>

          <TabsContent value="profile">
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    value={profile.name}
                    onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your name"
                    disabled={!isAdmin}
                    className={!isAdmin ? "bg-muted/50" : ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    value={profile.email}
                    onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email address"
                    disabled={!isAdmin}
                    className={!isAdmin ? "bg-muted/50" : ""}
                  />
                  {!isAdmin && <p className="text-xs text-muted-foreground">Email can only be changed by admin</p>}
                </div>
              </div>

              {/* Employment Information */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="department" className="flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    Department
                  </Label>
                  <Input
                    id="department"
                    value={profile.department}
                    onChange={(e) => setProfile(prev => ({ ...prev, department: e.target.value }))}
                    placeholder="Enter department"
                    disabled={!isAdmin}
                    className={!isAdmin ? "bg-muted/50" : ""}
                  />
                  {!isAdmin && <p className="text-xs text-muted-foreground">Department can only be changed by admin</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employee_number" className="flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    Employee ID
                  </Label>
                  <Input
                    id="employee_number"
                    value={profile.employee_number}
                    onChange={(e) => setProfile(prev => ({ ...prev, employee_number: e.target.value }))}
                    placeholder="Enter employee ID"
                    disabled={!isAdmin}
                    className={!isAdmin ? "bg-muted/50" : ""}
                  />
                  {!isAdmin && <p className="text-xs text-muted-foreground">Employee ID can only be changed by admin</p>}
                </div>
              </div>

              {/* Additional Fields */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="role" className="flex items-center gap-2">
                    <BadgeCheck className="w-4 h-4" />
                    Role
                  </Label>
                  <Input
                    id="role"
                    value={profile.role}
                    onChange={(e) => setProfile(prev => ({ ...prev, role: e.target.value }))}
                    placeholder="Enter role"
                    disabled={!isAdmin}
                    className={!isAdmin ? "bg-muted/50" : ""}
                  />
                  {!isAdmin && <p className="text-xs text-muted-foreground">Role can only be changed by admin</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="destination" className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Destination
                  </Label>
                  <Input
                    id="destination"
                    value={profile.destination}
                    onChange={(e) => setProfile(prev => ({ ...prev, destination: e.target.value }))}
                    placeholder="Enter your work destination"
                    disabled={!isAdmin}
                    className={!isAdmin ? "bg-muted/50" : ""}
                  />
                </div>
              </div>

              {/* Personal Information */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="date_of_birth" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Date of Birth
                  </Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={profile.date_of_birth}
                    onChange={(e) => setProfile(prev => ({ ...prev, date_of_birth: e.target.value }))}
                    disabled={!isAdmin}
                    className={!isAdmin ? "bg-muted/50" : ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="joining_date" className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Joining Date
                  </Label>
                  <Input
                    id="joining_date"
                    value={profile.joining_date}
                    disabled
                    className="bg-muted/50"
                  />
                  <p className="text-xs text-muted-foreground">Set automatically on account creation</p>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={profile.address}
                  onChange={(e) => setProfile(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Enter your address..."
                  rows={2}
                  disabled={!isAdmin}
                  className={!isAdmin ? "bg-muted/50" : ""}
                />
              </div>

              {/* Emergency Contact */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
                  <Input
                    id="emergency_contact_name"
                    value={profile.emergency_contact_name}
                    onChange={(e) => setProfile(prev => ({ ...prev, emergency_contact_name: e.target.value }))}
                    placeholder="Enter emergency contact name"
                    disabled={!isAdmin}
                    className={!isAdmin ? "bg-muted/50" : ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emergency_contact_phone">Emergency Contact Phone</Label>
                  <Input
                    id="emergency_contact_phone"
                    value={profile.emergency_contact_phone}
                    onChange={(e) => setProfile(prev => ({ ...prev, emergency_contact_phone: e.target.value }))}
                    placeholder="Enter emergency contact phone"
                    disabled={!isAdmin}
                    className={!isAdmin ? "bg-muted/50" : ""}
                  />
                </div>
              </div>

              <div className="pt-4">
                <Button onClick={handleSave} disabled={isSaving || !isAdmin} className="w-full md:w-auto">
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : !isAdmin ? (
                    <>
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      View Only
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
              userId={user?.id || ''}
              isAdmin={isAdmin}
              onRatingAdded={fetchAllData}
              profileStats={profileStats}
            />
          </TabsContent>

          <TabsContent value="achievements">
            <AchievementsTab
              achievements={achievements}
              userId={user?.id || ''}
              isAdmin={isAdmin}
            />
          </TabsContent>

          <TabsContent value="memos">
            <MemosTab
              memos={memos}
              userId={user?.id || ''}
              isAdmin={isAdmin}
            />
          </TabsContent>

          <TabsContent value="history">
            <HistoryTab
              history={history}
              profile={profile}
              isAdmin={isAdmin}
            />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="security">
              <div className="space-y-6">
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <h3 className="font-medium mb-4 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Change Password
                </h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <Button
                    onClick={handleChangePassword}
                    disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                    className="w-full md:w-auto"
                  >
                    {isChangingPassword ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Changing...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Change Password
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
            </TabsContent>
          )}
        </Tabs>

        {/* Profile Picture Upload Modal */}
        <Dialog open={showPictureUpload} onOpenChange={setShowPictureUpload}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Profile Picture</DialogTitle>
              <DialogDescription>
                Choose a new profile picture. Maximum size: 5MB. Supported formats: JPG, PNG, WEBP.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <Upload className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">
                  Click to select a file or drag and drop
                </p>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error('File size must be less than 5MB');
                        return;
                      }
                      handleProfilePictureUpload(file);
                    }
                  }}
                  className="hidden"
                  id="profile-picture"
                />
                <Label htmlFor="profile-picture" className="cursor-pointer">
                  <Button variant="outline" type="button">
                    Choose File
                  </Button>
                </Label>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </motion.div>
  );
}
