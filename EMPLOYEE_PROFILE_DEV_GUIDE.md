# ⚡ EMPLOYEE PROFILE SYSTEM - DEVELOPER QUICK REFERENCE

**Quick Links**: [Directive](directives/04_employee_profiles.md) | [Implementation](EMPLOYEE_PROFILE_SYSTEM_IMPLEMENTATION.md) | [Manifest](DELIVERABLES_MANIFEST.md)

---

## 🚀 QUICK START FOR DEVELOPERS

### Step 1: Setup Database (Copy-Paste Ready)

**Open Supabase SQL Editor and run these 7 files in order:**

```sql
-- File 1: Run 20260416_001_profiles_enhancements.sql
-- File 2: Run 20260416_002_employee_ratings.sql
-- File 3: Run 20260416_003_employee_achievements.sql
-- File 4: Run 20260416_004_employee_memos.sql
-- File 5: Run 20260416_005_employee_history.sql
-- File 6: Run 20260416_006_functions_and_triggers.sql
-- File 7: Run 20260416_007_storage_bucket_rls.sql
```

### Step 2: Create Storage Bucket

```
Supabase Dashboard → Storage → Create Bucket
- Name: employee-profile-pictures
- Make Public: ✅
- Size limit: 5MB
```

### Step 3: Verify Installation

```bash
python3 execution/verify_employee_profile_system.py
```

---

## 📱 SERVICE IMPORTS (Copy-Paste Ready)

### Import Profile Service
```typescript
import {
  uploadProfilePicture,
  updateProfilePictureUrl,
  deleteProfilePicture,
  getEmployeeProfile,
  updateEmployeeProfile,
  getTeamProfiles,
  getAllProfiles,
  getProfileStatistics,
} from '@/services/employeeProfileService';
```

### Import Ratings Service
```typescript
import {
  addRating,
  updateRating,
  finalizeRating,
  deleteRating,
  getEmployeeRatings,
  getMonthlyRating,
  getDraftRating,
  getRatingsForPeriod,
  getAverageRatingTrend,
  getCompanyAverageRatings,
  getDepartmentAverageRatings,
} from '@/services/employeeRatingsService';
```

### Import Achievements Service
```typescript
import {
  addAchievement,
  updateAchievement,
  deleteAchievement,
  getEmployeeAchievements,
  getAchievementsByCategory,
  getPublicAchievements,
  getAchievementStats,
  getRecentAchievements,
  searchAchievements,
} from '@/services/employeeAchievementsService';
```

### Import Memos Service
```typescript
import {
  issueMemo,
  updateMemo,
  acknowledgeMemo,
  deactivateMemo,
  deleteMemo,
  getEmployeeMemos,
  getWarningMemos,
  getAppreciationMemos,
  getUnacknowledgedMemos,
  getMemoStats,
  getRecentMemos,
  getMemosBySeverity,
  getMemosByDateRange,
  getDepartmentWarnings,
} from '@/services/employeeMemosService';
```

### Import History Service
```typescript
import {
  getEmployeeHistory,
  getFullEmployeeTimeline,
  getRoleChanges,
  getDepartmentChanges,
  getTeamChanges,
  getPromotions,
  getCareerStats,
  getHistoryByDateRange,
  getDepartmentHistory,
  getCareerPath,
} from '@/services/employeeHistoryService';
```

---

## 💡 COMMON TASKS (Code Examples)

### Get Employee Profile
```typescript
try {
  const profile = await getEmployeeProfile(userId);
  console.log(profile.full_name, profile.email);
} catch (error) {
  console.error('Error fetching profile:', error);
}
```

### Upload Profile Picture
```typescript
try {
  const file = fileInput.files[0];
  const publicUrl = await uploadProfilePicture(userId, file);
  await updateProfilePictureUrl(userId, publicUrl);
  console.log('Picture updated:', publicUrl);
} catch (error) {
  console.error('Error uploading picture:', error);
}
```

### Add Monthly Rating
```typescript
try {
  const rating = await addRating({
    employee_id: employeeId,
    rating_month: new Date().getMonth() + 1,
    rating_year: new Date().getFullYear(),
    rating_period: new Date().toISOString().split('T')[0],
    overall_rating: 8.5,
    work_quality_rating: 9,
    punctuality_rating: 8,
    teamwork_rating: 8,
    communication_rating: 8.5,
    initiative_rating: 9,
    strengths: 'Great problem solver',
    areas_for_improvement: 'Work on documentation',
    manager_comments: 'Keep up the good work!',
    is_final: true,
  });
  
  await finalizeRating(rating.id);
  console.log('Rating created and finalized');
} catch (error) {
  console.error('Error creating rating:', error);
}
```

### Get Employee Ratings Trend
```typescript
try {
  const trend = await getAverageRatingTrend(userId);
  // Returns: [{ month: 'Jan 2026', average_rating: 7.5 }, ...]
  // Perfect for chart libraries
  console.log('Trend:', trend);
} catch (error) {
  console.error('Error fetching trend:', error);
}
```

### Add Achievement
```typescript
try {
  const achievement = await addAchievement({
    employee_id: userId,
    achievement_title: 'Project Alpha Completion',
    achievement_description: 'Led successful completion of Project Alpha',
    achievement_category: 'work',
    achievement_date: new Date().toISOString().split('T')[0],
    proof_url: 'https://..../project-alpha-completion.pdf',
    recognition_level: 'department',
    is_public: true,
  });
  console.log('Achievement added:', achievement.id);
} catch (error) {
  console.error('Error adding achievement:', error);
}
```

### Issue Warning Memo
```typescript
try {
  const memo = await issueMemo({
    employee_id: targetUserId,
    memo_type: 'warning',
    memo_title: 'Attendance Issue',
    memo_description: 'Multiple late arrivals in April 2026',
    severity: 'medium',
    violation_type: 'attendance',
    action_taken: 'Verbal warning issued',
    memo_date: new Date().toISOString().split('T')[0],
    attachment_urls: ['https://..../attendance-log.pdf'],
  });
  console.log('Memo issued:', memo.id);
} catch (error) {
  console.error('Error issuing memo:', error);
}
```

### Get Career Path
```typescript
try {
  const careerPath = await getCareerPath(userId);
  console.log('Current Role:', careerPath.current_role);
  console.log('Current Department:', careerPath.current_department);
  console.log('Role History:', careerPath.role_progression);
  console.log('Department History:', careerPath.department_progression);
} catch (error) {
  console.error('Error fetching career path:', error);
}
```

---

## 🎨 COMPONENT STRUCTURE

### Profile Component
```typescript
<ProfileComponent userId={userId}>
  ├── ProfileHeader (picture, name, role, department)
  ├── ProfileTabs
  │   ├── PersonalInfoTab (DOB, bio, contact)
  │   ├── EmploymentTab (joining date, role, department)
  │   ├── RatingsTab (monthly ratings, chart, average)
  │   ├── AchievementsTab (work, personal, awards)
  │   ├── MemosTab (warnings, appreciation)
  │   └── HistoryTab (timeline, career progression)
  └── Modals
      ├── ProfilePictureUpload
      └── AddRatingModal (admin only)
</ProfileComponent>
```

---

## 🔐 PERMISSION MATRIX AT A GLANCE

| Feature | Employee | Manager | Admin | CEO | HR |
|---------|----------|---------|-------|-----|-----|
| View own profile | ✅ | - | - | - | - |
| View team profiles | - | ✅ | - | - | - |
| View all profiles | - | - | ✅ | ✅ | ✅ |
| Upload picture | ✅ | ✅ | ✅ | ✅ | ✅ |
| Add rating | - | - | ✅ | ✅ | - |
| View own ratings | ✅ | - | - | - | - |
| View all ratings | - | - | ✅ | ✅ | ✅ |
| Add achievement | - | - | ✅ | ✅ | ✅ |
| Issue memo | - | - | ✅ | ✅ | ✅ |
| View own memos | ✅ | - | - | - | - |
| View all memos | - | - | ✅ | ✅ | ✅ |

---

## ⚠️ COMMON ERRORS & FIXES

| Error | Cause | Fix |
|-------|-------|-----|
| "File must be less than 5MB" | Image too large | Compress image before upload |
| "Only JPG, PNG, WEBP allowed" | Wrong format | Convert to JPG/PNG/WEBP |
| "Rating already exists for month" | Duplicate rating | Check for existing draft |
| "You don't have permission" | RLS policy blocking | Check user role in database |
| "Auth not available" | User not logged in | Ensure auth session active |
| "Bucket not found" | Storage not created | Create bucket in dashboard |

---

## ✅ DEPLOYMENT CHECKLIST

- [ ] Run all 7 migrations
- [ ] Create storage bucket
- [ ] Run verification script
- [ ] Test profile picture upload
- [ ] Test rating creation
- [ ] Test RLS with different roles
- [ ] Test memo acknowledgment
- [ ] Load test data
- [ ] Build frontend components
- [ ] Test all CRUD operations
- [ ] Performance testing
- [ ] Go live!

---

**Ready to build?** Start with [directives/04_employee_profiles.md](directives/04_employee_profiles.md) section 6!
