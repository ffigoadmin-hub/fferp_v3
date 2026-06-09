# DIRECTIVE: Employee Profile Management System (ANTIGRAVITY)

**Module Code**: `EMP_PROFILE_SYSTEM`  
**Version**: 1.0  
**Created**: 2026-04-16  
**Status**: Implemented

---

## 1. PURPOSE & SCOPE

### Business Context
The Employee Profile Management System is a comprehensive HR module that centralizes employee information, performance tracking, achievement recognition, and disciplinary/appreciation records. It serves as a single source of truth for employee data with complete audit trails.

### Key Components
1. **Profile Information** - Personal & employment data
2. **Performance Ratings** - Monthly 1-10 scale ratings with category breakdown
3. **Achievements** - Work, personal, and awards tracking
4. **Memos System** - Warnings and appreciation records
5. **History Tracking** - Complete change audit trail
6. **Profile Pictures** - Supabase Storage integration

---

## 2. SYSTEM ARCHITECTURE

### Database Tables
```
profiles (existing table - modified)
├── employee_ratings
├── employee_achievements
├── employee_memos
├── employee_history
└── storage: employee-profile-pictures bucket
```

### Access Control (RLS Policies)
- **Employee**: See own profile, ratings, achievements, memos, history
- **Manager/GMO/SMO**: See own team members' profiles
- **Admin/HR**: Can add ratings, memos, manage achievements
- **CEO/Admin**: See all employees' complete profiles

---

## 3. DATA FLOW

### Flow 1: New Employee Onboarding
```
User Created in Profiles Table
    ↓
Profile Auto-Created with Defaults
    ↓
Optional: Upload Profile Picture
    ↓
Initial History Entry Created
```

### Flow 2: Monthly Performance Rating
```
Admin/CEO Accesses Rating Interface
    ↓
Enters Overall + Category Ratings
    ↓
Rating Saved to employee_ratings Table
    ↓
Average Rating Recalculated (Trigger)
    ↓
Profile Updated with Current/Average Ratings
    ↓
History Entry Created for Trending
```

### Flow 3: Achievement Recognition
```
Admin/HR/Manager Adds Achievement
    ↓
Achievement Saved with Attachment URL
    ↓
Employee Sees in Profile
    ↓
Public/Private Visibility Controlled
```

### Flow 4: Memo Issuance
```
Admin/HR Issues Memo (Warning or Appreciation)
    ↓
Employee Notified via Notification System
    ↓
Employee Can Acknowledge Receipt
    ↓
Tracked in History for Discipline Records
```

---

## 4. FEATURE SPECIFICATIONS

### 4.1 Profile Information

**Fields (added to profiles table):**
- `date_of_birth` - Employee DOB
- `profile_picture_url` - URL to Supabase Storage
- `joining_date` - Employment start date
- `current_rating` - Latest month's rating
- `average_rating` - Average of all ratings
- `total_ratings` - Count of ratings
- `bio` - Personal bio/about section
- `address` - Home address
- `emergency_contact_name` - Emergency contact
- `emergency_contact_phone` - Emergency contact phone

### 4.2 Profile Picture Management

**Specifications:**
- Single photo (latest replaces previous)
- Storage: Supabase bucket `employee-profile-pictures`
- Max size: 5MB
- Formats: JPG, PNG, WEBP
- Folder structure: `employee-profile-pictures/{user_id}/profile.{ext}`
- Public URL auto-generated
- Default avatar if not set

**Upload Process:**
1. User selects image file
2. Client validates: size < 5MB, format in whitelist
3. Upload to Storage with auth UUID in path
4. Update profiles table with public URL
5. Display in profile

### 4.3 Monthly Performance Ratings

**Rating Components:**
- **Overall Rating**: 1-10 numeric scale
- **Category Ratings** (optional):
  - Work Quality (1-10)
  - Punctuality (1-10)
  - Teamwork (1-10)
  - Communication (1-10)
  - Initiative (1-10)

**Rating Logic:**
- One rating per employee per month
- Admin/CEO can rate anyone
- Finalized ratings cannot be edited
- Triggers automatic average calculation
- History entry created for trends

**Constraints:**
- `UNIQUE(employee_id, rating_year, rating_month)` - One rating per month
- `CHECK overall_rating >= 1 AND <= 10`
- `CHECK category_ratings >= 1 AND <= 10 OR IS NULL`
- Finalized ratings are immutable

**Automatic Calculations (Trigger: `update_employee_average_rating`):**
- Average rating = AVG(overall_rating) WHERE is_final = true
- Total ratings = COUNT(*) WHERE is_final = true
- Current rating = Latest month's overall_rating
- Updates on: INSERT or UPDATE when is_final = true

### 4.4 Achievements

**Achievement Types:**
- **Work**: Completed projects, targets met, milestones
- **Personal**: Certifications, courses, training
- **Award**: Employee of month, best performer, etc.

**Fields:**
- Achievement title
- Description
- Category (work, personal, award)
- Date achieved
- Proof URL (certificate, photo, document)
- Recognition level (team, department, company, industry)
- Added by (admin/manager)
- Public/private visibility

**Rules:**
- Admin/HR/Manager can add achievements
- Employees see own achievements
- Admin/HR see all achievements
- Public achievements visible to all
- Proof documents stored in Supabase

### 4.5 Memos (Warnings & Appreciation)

**Memo Types:**
1. **Warning Memo**
   - Severity: Low, Medium, High, Critical
   - Violation Type: Attendance, Behavior, Performance, Policy, Safety, Other
   - Action Taken: Verbal warning, Written warning, Suspension, etc.
   - Evidence: Attachments (documents, images)

2. **Appreciation Memo**
   - Recognition Type: Exceptional Work, Team Player, Innovation, Customer Service, Other
   - Praise and recognition content
   - Timestamp for records

**Process:**
- Admin/HR issues memo
- Employee receives notification
- Employee can acknowledge receipt
- Status tracked (acknowledged_by_employee, acknowledged_at)
- Immutable records for compliance

**Visibility:**
- Employees see own memos
- Admin/HR see all memos
- CEO sees all memos
- Memo can be marked inactive if resolved/retracted

### 4.6 History Tracking

**Change Types Tracked:**
- Role changes (promotion, demotion, lateral move)
- Department transfers
- Team reassignments
- Status changes
- Any profile field changes

**NOT Tracked:**
- Salary information (excluded per requirements)
- Ratings are tracked separately
- Achievements have their own table

**History Entry Fields:**
- Employee ID
- Change type (role_change, department_change, etc.)
- Field changed
- Old value
- New value
- Change date
- Effective date
- Reason/notes
- Changed by (user ID)
- Timestamp

**Trigger: `track_profile_changes`**
- Fires on profiles table UPDATE
- Compares OLD vs NEW values
- Inserts history entry for each change
- Captures: role, department, engineering_team_id

---

## 5. DATABASE MIGRATIONS

### Migration Files Required
1. `20260416_create_employee_profiles_schema.sql` - Main schema
2. `20260416_create_employee_ratings.sql` - Ratings table + RLS
3. `20260416_create_employee_achievements.sql` - Achievements table + RLS
4. `20260416_create_employee_memos.sql` - Memos table + RLS
5. `20260416_create_employee_history.sql` - History table + RLS
6. `20260416_profile_rating_functions.sql` - Functions & triggers
7. `20260416_storage_bucket_rls.sql` - Storage bucket setup

### Key SQL Concepts Used
- **RLS Policies**: Row-level security per role
- **Triggers**: Auto-calculation and history tracking
- **Constraints**: Data validation at database level
- **Indexes**: Performance optimization for queries
- **Comments**: Documentation

---

## 6. FRONTEND COMPONENTS

### Component Tree
```
EmployeeProfilePage/
├── ProfileHeader (profile pic, name, basic info)
├── ProfileTabs/
│   ├── PersonalInfoTab (DOB, bio, contact)
│   ├── EmploymentTab (role, department, joining date)
│   ├── RatingsTab (ratings history, chart)
│   ├── AchievementsTab (work, personal, awards)
│   ├── MemosTab (warnings, appreciation)
│   └── HistoryTab (timeline of changes)
├── AdminRatingModal (for admin to rate)
└── ProfilePictureUpload (modal)
```

### Key Features
1. **Profile Picture Upload**
   - Drag & drop or file select
   - Real-time preview
   - Size/format validation

2. **Ratings Display**
   - Monthly ratings list
   - Category breakdown chart
   - Average rating trend
   - Admin interface for adding ratings

3. **Achievements Gallery**
   - Cards with images/proofs
   - Category filters
   - Visibility toggle

4. **Memos Feed**
   - Chronological list
   - Type badges (warning/appreciation)
   - Severity indicators (for warnings)
   - Acknowledgment checkbox

5. **History Timeline**
   - Vertical timeline
   - Change type icons
   - Before/after values
   - Change reason
   - By whom and when

---

## 7. PERMISSION MATRIX

| Action | Employee | Manager | Admin | CEO | HR |
|--------|----------|---------|-------|-----|-----|
| View own profile | ✓ | - | - | - | - |
| View team profiles | - | ✓ | - | - | - |
| View all profiles | - | - | ✓ | ✓ | ✓ |
| Edit own profile | ✓ | - | - | - | - |
| Edit any profile | - | - | ✓ | ✓ | - |
| Add rating | - | - | ✓ | ✓ | - |
| Add achievement | - | - | ✓ | ✓ | ✓ |
| Add memo | - | - | ✓ | ✓ | ✓ |
| View own memos | ✓ | - | - | - | - |
| View all memos | - | - | ✓ | ✓ | ✓ |
| Upload profile pic | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 8. VALIDATION RULES

### Rating Validation
- Overall rating: 1-10, required
- Category ratings: 1-10 or NULL
- One rating per employee per month
- is_final flag: Boolean, once true cannot change value

### Achievement Validation
- Title: Required, max 255 characters
- Category: Required, must be in (work, personal, award)
- Date: Required, cannot be future date
- Proof URL: Optional but recommended
- Recognition level: Optional

### Memo Validation
- Memo type: Required, must be in (warning, appreciation, general)
- Title: Required, max 255 characters
- Description: Required
- For warnings: severity required, violation_type required
- For appreciation: recognition_type optional
- Attachment URLs: Array of valid URLs

### Profile Validation
- Email: Valid email format (from auth)
- Phone: Optional, valid phone format if provided
- DOB: Optional, cannot be future date, age >= 16
- Joining date: Optional, cannot be future date
- Profile picture: Max 5MB, format JPG/PNG/WEBP

---

## 9. IMPLEMENTATION STEPS

### Step 1: Database Setup
1. Create migrations directory structure
2. Execute migration SQL files in order
3. Verify tables created with correct structure
4. Test RLS policies
5. Verify triggers and functions

### Step 2: Backend Services
1. Create service functions for CRUD operations
2. Create upload handler for profile pictures
3. Implement rating calculation logic
4. Implement history tracking logic

### Step 3: Frontend Components
1. Create reusable profile info display
2. Create tabs interface
3. Create upload modal
4. Create rating interface
5. Create achievement cards
6. Create memo feed
7. Create history timeline

### Step 4: Integration & Testing
1. Connect frontend to backend
2. Test CRUD operations
3. Test RLS policies
4. Test file uploads
5. Test automatic calculations
6. Test notifications

---

## 10. TESTING CHECKLIST

### Database Tests
- [ ] All tables created successfully
- [ ] RLS policies working correctly
- [ ] Triggers firing on insert/update
- [ ] Constraints preventing invalid data
- [ ] Indexes created for performance
- [ ] Relationships (FKs) intact

### Feature Tests
- [ ] Profile picture upload works
- [ ] Monthly rating calculation works
- [ ] Average rating updates automatically
- [ ] Achievement creation and display
- [ ] Memo issuance and acknowledgment
- [ ] History entries created on profile changes

### Permission Tests
- [ ] Employee can see own profile only
- [ ] Manager can see team profiles
- [ ] Admin can see all profiles
- [ ] HR can add memos
- [ ] Admin can add ratings
- [ ] Appropriate visibility enforced

### Edge Cases
- [ ] Deleting employee cascades properly
- [ ] Multiple ratings in same month blocked
- [ ] Profile picture replacement works
- [ ] Large files rejected
- [ ] Invalid formats rejected
- [ ] Concurrent updates handled

---

## 11. ERROR HANDLING

### Common Errors
- **Upload too large**: Show error "File must be less than 5MB"
- **Invalid format**: Show error "Only JPG, PNG, WEBP allowed"
- **Auth failed**: "You don't have permission to perform this action"
- **Duplicate rating**: "Rating already exists for this month"
- **Network error**: "Failed to save. Please try again."

### Logging
- All operations logged to `audit_logs` table
- File uploads logged with URL and user
- Rating changes logged with before/after values
- Memo issuance logged with full details

---

## 12. PERFORMANCE CONSIDERATIONS

### Indexes
- `idx_ratings_employee` on employee_ratings(employee_id)
- `idx_ratings_period` on employee_ratings(rating_period DESC)
- `idx_achievements_employee` on employee_achievements(employee_id)
- `idx_memos_employee` on employee_memos(employee_id)
- `idx_history_employee` on employee_history(employee_id)

### Caching
- Cache employee profiles (invalidate on update)
- Cache ratings for display (invalidate monthly)
- Cache achievement counts per employee

### Query Optimization
- Use pagination for lists
- Lazy load history timeline
- Use aggregates in views
- Denormalize average rating in profiles table

---

## 13. SECURITY

### Data Protection
- All sensitive data encrypted in transit (HTTPS)
- Profile pictures stored in public bucket (no PII)
- RLS prevents unauthorized access
- Audit trail for all changes

### Input Validation
- Client-side: Format validation
- Server-side: Type checking, length limits
- Database: Constraints and checks

### Compliance
- History tracking for compliance audits
- Memo records immutable for legal
- No salary information stored with profiles
- Follows standard HR privacy practices

---

## 14. FUTURE ENHANCEMENTS

### Phase 2 Features
- Performance review cycles
- 360-degree feedback system
- Goal tracking integration
- Skill matrix management
- Career progression planning
- Compensation history (in separate secure table)

### Phase 3 Features
- Performance prediction algorithms
- Retention risk scoring
- Succession planning
- Training need analysis
- Department benchmarking

---

## 15. RELATED DOCUMENTATION

- **Master System Documentation**: `MASTER_SYSTEM_DOCUMENTATION.md`
- **Database Schema**: Supabase migrations folder
- **Role Hierarchy**: Role definitions in system
- **RLS Policies**: Row-level security setup

---

## 16. SUPPORT & TROUBLESHOOTING

### Common Issues

**Q: Rating not saving**
- Check RLS policies for admin role
- Verify auth session is active
- Check if rating for that month already exists

**Q: Profile picture not uploading**
- Verify file size < 5MB
- Check file format (JPG/PNG/WEBP)
- Verify Storage bucket exists and accessible
- Check browser console for errors

**Q: Average rating not updating**
- Trigger might not fire - check migration applied
- Verify `is_final = true` on rating
- Check `update_employee_average_rating` function exists

**Q: History not tracking changes**
- Verify `track_profile_changes` trigger exists
- Check that profiles table updates actually changed values
- Verify `employee_history` table has records

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-16  
**Next Review**: 2026-05-16
