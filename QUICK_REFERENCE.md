# 🚀 Quick Reference - Daily Workflow & SOP System

## 📍 Where Everything Is

### 🌐 Web App
```
Admin Features
└── Sidebar → Administration → SOP Management
    └── /admin/sop-management
        ├── Tab 1: Create, Edit, Delete SOPs
        └── Tab 2: Assign & Track SOPs

Employee Features
└── Sidebar → Daily Workflow → My SOPs
    └── /my-sops
        ├── View assigned SOPs
        ├── Search & filter
        └── Acknowledge with details
```

### 📱 Mobile App
```
General Users
└── Tab 1: Daily Workflow ⚡
    ├── Quick Actions (5 items) - Grid
    └── All Tasks (10 items) - List
        └── My SOPs (Tap to view details & acknowledge)

Shift Users
└── Tab 1: Daily Workflow ⚡
    ├── Quick Actions (5 shift items) - Grid
    └── Additional Tasks (6 items) - List
        └── My SOPs (Tap to view details & acknowledge)
```

---

## 🎯 Admin Workflow

### Create a New SOP
1. Go to `/admin/sop-management`
2. Click "New SOP" button
3. Fill form:
   - **Name** (required)
   - **Code** (optional, e.g., SOP-001)
   - **Category** (e.g., Safety, Operations)
   - **Description** (optional)
   - **Content** (required - full procedures)
   - **Attachment** (optional - PDF URL)
   - **Active Status** (toggle)
4. Click "Create SOP"

### Assign SOP to Users
1. In "Assignments" tab, click "Assign SOP"
2. Select SOP from dropdown
3. Choose "Assign to Users"
4. Select employees from list (multi-select)
5. Click "Assign SOP"

### Assign SOP to Department
1. In "Assignments" tab, click "Assign SOP"
2. Select SOP from dropdown
3. Choose "Assign to Department"
4. Select department from dropdown
5. Click "Assign SOP"

### Track Acknowledgments
1. View "Assignments" tab
2. See status: "Pending" or "Acknowledged"
3. Click "Acknowledged" to see date/time
4. Filter by status as needed

---

## 👥 Employee Workflow

### Web: View & Acknowledge SOP

#### Step 1: Access My SOPs
```
Desktop → Sidebar → Daily Workflow → My SOPs
or Direct: /my-sops
```

#### Step 2: Search or Filter
```
Search box → Type SOP name
Category dropdown → Select category
Status dropdown → Pending / Acknowledged
```

#### Step 3: View SOP
```
Click SOP card → Detail modal opens
```

#### Step 4: Acknowledge
```
If Pending:
  └── Click "Mark as Acknowledged" button
      └── Timestamp recorded
      └── Status changes to "Acknowledged"
If Already Acknowledged:
  └── Shows "Acknowledged on [DATE/TIME]"
```

#### Step 5: Download PDF (if available)
```
In detail modal:
  └── Click "Download PDF" button
      └── Opens in new tab
```

### Mobile: View & Acknowledge SOP

#### Step 1: Open Daily Workflow
```
Open app → Tap "Daily Workflow" tab (⚡)
```

#### Step 2: Find My SOPs
```
Scroll down in task list
Tap "My SOPs" [NEW ✨]
```

#### Step 3: View SOP Details
```
Tap SOP card
Detail modal opens showing:
  ├── Full content
  ├── Code, version, category
  ├── Assignment date
  └── Acknowledge button (if pending)
```

#### Step 4: Acknowledge
```
If Pending:
  └── Tap "Mark as Acknowledged"
      └── Shows success toast
      └── Updates immediately
If Already Acknowledged:
  └── Shows "You acknowledged on [DATE]"
```

---

## 📊 Dashboard Metrics

### Admin Dashboard
**What You See**:
- Total SOPs created
- Total active SOPs
- Pending acknowledgments count
- Users yet to acknowledge

### Employee Dashboard
**What You See** (in My SOPs):
- Total assigned SOPs
- Pending (not yet acknowledged)
- Acknowledged (completed)

---

## 🔍 Searching & Filtering

### Web App
```
Search By:
├── Name (full-text search)
├── Code (exact match)
└── Description (partial match)

Filter By:
├── Category (dropdown)
└── Status (Pending/Acknowledged)
```

### Mobile App
```
Search By:
├── Name
├── Code
└── Description

Filter By:
├── Category (dropdown)
└── Status (dropdown)
```

---

## ⚙️ Settings & Preferences

### Admin Settings
```
/admin/sop-management
├── Create SOPs section
├── Manage assignments
├── View audit history
└── Track acknowledgments
```

### Employee Settings
```
/my-sops (Web)
├── Search preferences
└── Filter settings (persist in session)

Daily Workflow tab (Mobile)
├── View all tasks
└── Mark favorite items (future)
```

---

## 🔐 Permissions

### Who Can Create SOPs?
- ✅ Admin
- ✅ CEO
- ❌ Employees (read-only)

### Who Can Assign SOPs?
- ✅ Admin
- ✅ CEO
- ❌ Employees

### Who Can View SOPs?
- ✅ All users (if assigned)
- ✅ Departments (if assigned to dept)
- ✅ Individuals (if assigned directly)
- ❌ Users without assignment

### Who Can Acknowledge?
- ✅ Assigned employees
- ❌ Unassigned users
- ❌ Admins (only track)

---

## 📱 Mobile Tips

### Quick Actions (First 5 Items)
```
⚡ Daily Workflow Hub shows:

For General Users:
1. Login - Start your day
2. Hourly Plan - Track progress
3. Day Plan - See tasks
4. EOD - End of day report
5. Calendar - Company events

For Shift Users:
1. Shift Login - Clock in
2. Hourly Slots - Log hours
3. Breaks - Manage breaks
4. End Shift - Close shift
5. Logout - Clock out
```

### Badges & Indicators
```
Red badge (3) - You have 3 pending items
Green "NEW" - This is a brand new feature
Status icon:
  ✓ = Acknowledged/Complete
  ⚠ = Pending/Not yet done
```

### Real-Time Updates
```
Badge counts update automatically
No need to refresh
Tap back → Returns to hub
All changes sync instantly
```

---

## 🎨 Colors & Icons

### SOP Categories (Colors)
```
Safety           → Red icon
Operations       → Blue icon
HR               → Green icon
Finance          → Purple icon
General          → Gray icon
```

### Status Indicators
```
Pending   → Yellow badge with ⚠️
Read      → Yellow badge with 👁️
Acknowledged → Green with ✓
```

---

## 🆘 Troubleshooting

### I Can't See My Assigned SOPs
```
Check:
1. Are you logged in?
2. Has admin assigned SOPs to you or your department?
3. Is the SOP marked as "Active"?
4. Refresh page (web) or pull-to-refresh (mobile)
```

### I Can't Acknowledge an SOP
```
Check:
1. Are you the assigned user?
2. Is the SOP still pending?
3. Do you have internet connection?
4. Try again - might be temporary issue
```

### I Don't See SOPs on Mobile
```
Check:
1. Are you in Daily Workflow tab? (⚡)
2. Is My SOPs visible in list?
3. Are you a shift or general user?
4. Scroll down - might be below other items
```

### PDF Download Doesn't Work
```
Check:
1. Does SOP have attachment URL?
2. Is link valid?
3. Use web app for better compatibility
4. Contact admin if link is broken
```

---

## 🔄 Data Flow

### Creating & Using an SOP
```
1. Admin creates SOP
   └── Stored in database

2. Admin assigns to users/dept
   └── Creates sop_assignments records

3. Employees see in Daily Workflow
   └── Fetched from sop_assignments

4. Employee views SOP
   └── Reads full content + details

5. Employee acknowledges
   └── Records timestamp + user_id

6. Admin can track
   └── Sees acknowledgment status
```

---

## 📚 Key Files to Know

### For Admins
```
/admin/sop-management → AdminSOPManagementPage.tsx
All SOP management happens here
```

### For Employees (Web)
```
/my-sops → MySOPsPage.tsx
All employee SOP viewing here
```

### For Employees (Mobile)
```
Daily Workflow tab → DailyWorkflowScreen.tsx
All workflow items here (including My SOPs)
```

### Database
```
sops table → Master SOP data
sop_assignments table → Who has what SOP
```

---

## 🎯 Daily Routine (Employees)

### Morning (Web)
```
1. Login → Day Start
2. Check → Sidebar Daily Workflow
3. View → My SOPs (if assigned)
4. Acknowledge → If new SOP
5. Proceed → Day Plan
```

### Morning (Mobile)
```
1. Open app
2. Tap → Daily Workflow tab (⚡)
3. Tap → Login / Shift Login
4. Scroll → Find My SOPs
5. Tap → View & acknowledge
6. Continue → Other tasks
```

### Periodic Checks
```
Check My SOPs whenever:
- Admin announces new SOP
- You get notification
- During training sessions
- End of day review
```

---

## 📞 Getting Help

### Admin Help
- Check `/admin/sop-management` for all features
- Use search to find specific SOP
- View assignments tab for tracking
- Click help icon for form guidance

### Employee Help
- Web: `/my-sops` has built-in help
- Mobile: Daily Workflow hub is self-explanatory
- Search feature filters results
- Detail modal shows all info

### Technical Support
```
Contact IT Team with:
1. What you were trying to do
2. Where you were (URL or screen)
3. What error you got
4. Screenshot (if possible)
```

---

## 🚀 Best Practices

### For Admins
✅ Create clear SOP names
✅ Use consistent categories
✅ Assign to department when possible (easier management)
✅ Include version numbers
✅ Update content when procedures change
✅ Archive old SOPs (mark inactive)
✅ Review acknowledgments regularly

### For Employees
✅ Read SOPs carefully
✅ Acknowledge promptly
✅ Download PDF for reference
✅ Ask questions if unclear
✅ Check Daily Workflow regularly
✅ Follow SOPs in your work
✅ Refer back when needed

---

## 📊 Weekly Checklist

### For Admins
- [ ] Create any new SOPs
- [ ] Review pending acknowledgments
- [ ] Assign to new employees
- [ ] Update SOP versions if needed
- [ ] Archive outdated SOPs
- [ ] Check audit trail

### For Employees
- [ ] Check for new SOPs daily
- [ ] Acknowledge new assignments
- [ ] Refer to SOPs during work
- [ ] Ask questions if confused
- [ ] Report errors/improvements

---

## 🎓 Training Checklist

### Admin Training
- [ ] Know how to create SOP
- [ ] Know how to assign (user & dept)
- [ ] Know how to track acknowledgments
- [ ] Know how to update SOP
- [ ] Know how to archive SOP
- [ ] Know audit trail features

### Employee Training
- [ ] Know where to find My SOPs
- [ ] Know how to search SOPs
- [ ] Know how to view details
- [ ] Know how to acknowledge
- [ ] Know how to download PDF
- [ ] Know how to ask questions

---

## 🔗 Quick Links

```
Web Admin:     /admin/sop-management
Web Employee:  /my-sops
Mobile Hub:    Daily Workflow tab
Database:      sops + sop_assignments tables
Types:         src/types/sop.types.ts
Docs:          DAILY_WORKFLOW_COMPLETE_GUIDE.md
```

---

## ✨ Remember

- 📍 SOPs are in **Daily Workflow** (web sidebar or mobile tab)
- 🔍 You can **search & filter** by name, category, status
- 💾 **Acknowledge** SOPs to track completion
- 📱 Mobile hub shows **all your workflow items** in one place
- ⚡ **Real-time updates** - no refresh needed
- 🔐 Only see **assigned SOPs** based on security
- 📊 Admins can **track acknowledgments** for compliance

---

**Happy Working!** 🎉

For detailed guides, see:
- `MOBILE_DAILY_WORKFLOW_STRUCTURE.md`
- `DAILY_WORKFLOW_COMPLETE_GUIDE.md`
- `IMPLEMENTATION_SUMMARY.md`
