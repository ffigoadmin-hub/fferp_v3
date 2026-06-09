# Engineering Module - Full Documentation

## Table of Contents
1. [Overview](#overview)
2. [Module Architecture](#module-architecture)
3. [Pages & Routes](#pages--routes)
4. [Components](#components)
5. [Database Schema](#database-schema)
6. [Hooks & Custom Functions](#hooks--custom-functions)
7. [Features & Workflows](#features--workflows)
8. [Access Control & Permissions](#access-control--permissions)
9. [Integration Points](#integration-points)
10. [API Endpoints](#api-endpoints)

---

## Overview

The **Engineering Module** is a comprehensive project management system designed for managing engineering and agricultural projects from deal upload through execution and completion. It handles Bill of Quantities (BOQ), project phases, material requests, work orders, milestones, and execution tracking.

### Key Capabilities
- **Deal Management**: Upload and track client deals
- **BOQ Builder**: Create, manage, and approve Bills of Quantities
- **Project Lifecycle Management**: Track projects through stages (New Deal → Engineering Assigned → BOQ Submitted → BOQ Approved → Sourcing → Execution → Completed)
- **Phase Management**: Break projects into phases with progress tracking
- **Material & Work Order Sourcing**: Request materials and services linked to BOQ items
- **Milestone Tracking**: Set and monitor project milestones with deviation management
- **Execution Monitoring**: Real-time project execution tracking with proof uploads
- **Template System**: Reusable BOQ templates for common project types
- **Dashboard Analytics**: Comprehensive views for engineers, managers, and executives

---

## Module Architecture

### Technology Stack
- **Frontend**: React + TypeScript + Vite
- **UI Framework**: Tailwind CSS + shadcn/ui
- **State Management**: React hooks + custom hooks
- **Real-time Updates**: Supabase real-time subscriptions
- **Database**: PostgreSQL (via Supabase)
- **Animation**: Framer Motion

### Directory Structure
```
src/
├── pages/engineering/
│   ├── EngineerDashboardPage.tsx        # Main engineer dashboard
│   ├── BOQBuilderPage.tsx               # BOQ creation/editing interface
│   ├── BOQBuilderLandingPage.tsx        # BOQ selection landing page
│   ├── ProjectExecutionDashboard.tsx    # Individual project execution view
│   ├── SourcingDashboard.tsx            # Multi-project sourcing view
│   └── DealUploadPage.tsx               # Deal/project upload interface
│
└── components/engineering/
    ├── BOQItemUpdateModal.tsx           # Edit BOQ items
    ├── AddPhaseModal.tsx                # Add project phases
    ├── PhaseUpdateModal.tsx             # Update phase details
    ├── TemplateManager.tsx              # BOQ template management
    ├── MilestoneManager.tsx             # Milestone tracking & deviations
    ├── ProjectDailyLogsWidget.tsx       # Daily log entries
    ├── ProjectGanttChart.tsx            # Visual timeline
    ├── MaterialRequestModal.tsx         # Material procurement requests
    ├── VendorWorkRequestModal.tsx       # Vendor work requests
    ├── ConvertToWorkOrderModal.tsx      # Convert BOQ to work order
    ├── DeviationRequestModal.tsx        # Milestone deviation requests
    ├── DeviationApprovalsWidget.tsx     # Deviation approval management
    └── ProcurementTimeline.tsx          # Sourcing timeline view
```

---

## Pages & Routes

### 1. Engineer Dashboard Page
**Route**: `/engineer-dashboard`  
**File**: `src/pages/engineering/EngineerDashboardPage.tsx`  
**Access**: Engineering department employees

#### Features
- **Real-time Stats**: Active projects, pending materials, work orders, tasks
- **Project List**: All assigned projects with status and quick actions
- **Material Requests**: Track all material procurement requests
- **Tasks**: Personal task assignments with priorities
- **Health Monitoring**: Project health widget and BOQ pipeline widget
- **Quick Actions**: 
  - Create new BOQ
  - Submit material requests
  - View execution dashboard
  - Access sourcing dashboard

#### Real-time Subscriptions
- Projects table changes
- BOQ items updates
- Material requests updates
- Work orders updates
- Task assignments updates

---

### 2. BOQ Builder Page
**Route**: `/engineering/boq/:projectId`  
**File**: `src/pages/engineering/BOQBuilderPage.tsx`  
**Access**: Employees, SMO roles

#### Features
- **Phase-based Organization**: BOQ items organized by project phases
- **Category System**: Materials, Labour, Equipment categorization
- **Template Support**: Load from predefined templates
- **Bulk Operations**: Add multiple items at once
- **Real-time Calculations**: Automatic cost totals per phase and project
- **Material Request Creation**: Direct material request submission from BOQ
- **Status Tracking**: Pending, Sourced, Ordered, Delivered, Completed
- **Edit Capabilities**: Update quantities, costs, specifications
- **BOQ Submission**: Submit for approval when complete

#### BOQ Categories
```typescript
- Material: Construction materials, supplies
- Labour: Workforce, manpower
- Equipment: Machinery, tools, rentals
```

#### BOQ Statuses
```typescript
- pending: Not yet sourced
- sourced: Sourcing in progress
- ordered: Purchase/work order created
- delivered: Items received
- completed: Item fully utilized
```

---

### 3. Project Execution Dashboard
**Route**: `/projects/execution/:projectId`  
**File**: `src/pages/engineering/ProjectExecutionDashboard.tsx`  
**Access**: Project team members, executives

#### Features
- **Comprehensive Overview**: Project details, timeline, progress
- **Phase Management**: 
  - View all project phases
  - Update phase status and progress
  - Track phase costs (estimated vs actual)
  - Add new phases dynamically
- **BOQ Management**:
  - View all BOQ items by phase
  - Edit quantities and costs
  - Track sourcing status
  - Link to POs/WOs
- **Milestone Tracking**:
  - Create project milestones
  - Update milestone progress
  - Request deadline deviations
  - Monitor milestone health
- **Gantt Chart**: Visual project timeline
- **Material Requests**: Create and track material requests
- **Work Orders**: Create and manage vendor work orders
- **Daily Logs**: Hourly project activity logs
- **Execution Proofs**: Upload photos, documents, notes with location data
- **Project Timeline**: Complete audit trail of all actions

#### Tabs
1. **Overview**: Key metrics and status
2. **Phases**: Phase-wise breakdown
3. **BOQ**: Full bill of quantities
4. **Milestones**: Milestone tracking
5. **Timeline**: Gantt chart view
6. **Logs**: Daily execution logs

---

### 4. Sourcing Dashboard
**Route**: `/sourcing-dashboard`  
**File**: `src/pages/engineering/SourcingDashboard.tsx`  
**Access**: Engineering, Procurement teams

#### Features
- **Multi-Project View**: All projects requiring materials/services
- **Stage Filtering**: View projects by lifecycle stage
- **Sourcing Progress**: Track BOQ item sourcing completion
- **Phase Status**: Monitor phase completion across projects
- **Quick Actions**: Navigate to execution dashboard or BOQ builder
- **Real-time Updates**: Automatic refresh on changes

#### Metrics Displayed
- Total BOQ items
- Pending items
- Ordered items
- Delivered items
- Total phases
- Completed phases
- Project lifecycle stage

---

### 5. BOQ Builder Landing Page
**Route**: `/boq-builder`  
**File**: `src/pages/engineering/BOQBuilderLandingPage.tsx`  
**Access**: Engineering employees

#### Features
- **Project Selection**: Choose project to build/edit BOQ
- **Project Filtering**: Search and filter projects
- **Quick Stats**: View BOQ status per project
- **Direct Navigation**: Jump to BOQ builder for selected project

---

### 6. Deal Upload Page
**Route**: `/deal-upload`  
**File**: `src/pages/engineering/DealUploadPage.tsx`  
**Access**: Admin, executives

#### Features
- **Client Deal Upload**: Upload new project deals
- **Vertical Assignment**: Select project vertical (Polyhouse, Microgreens, etc.)
- **Category Selection**: DIRECT (AMC) or JV projects
- **Deal File Upload**: Attach deal documents
- **Automatic Lifecycle**: New projects start at "new_deal" stage
- **Project Creation**: Creates project with proper metadata

#### Supported Verticals

**DIRECT (AMC) Projects:**
- Polyhouse
- Microgreens
- Mushroom
- Open Cultivation
- Goat Farming
- Crab Farming

**JV Projects:**
- New JV
- Revamp JV
- Repair & Services

---

## Components

### 1. BOQItemUpdateModal
**File**: `src/components/engineering/BOQItemUpdateModal.tsx`

#### Purpose
Edit existing BOQ items with full details

#### Fields
- Line Number
- Material/Item Name
- Specification
- Quantity
- Unit
- Estimated Unit Cost
- Actual Unit Cost
- Category (Material/Labour/Equipment)
- Status
- Notes
- Phase Assignment
- PO/WO Linkage

---

### 2. TemplateManager
**File**: `src/components/engineering/TemplateManager.tsx`

#### Purpose
Manage reusable BOQ templates for common project types

#### Features
- **Create Templates**: Define template name and items
- **Edit Templates**: Modify template names and items
- **Add Items**: Add line items to templates
- **Delete Templates**: Remove unused templates
- **Load Templates**: Apply template to current BOQ
- **Category Organization**: Templates organized by BOQ category

#### Template Structure
```typescript
{
  id: UUID,
  name: string,
  description: string,
  created_by: UUID,
  items: [
    {
      line_number: number,
      material_name: string,
      specification: string,
      quantity: number,
      unit: string,
      estimated_unit_cost: number,
      category: 'material' | 'labour' | 'equipment',
      phase_name: string (optional)
    }
  ]
}
```

---

### 3. MilestoneManager
**File**: `src/components/engineering/MilestoneManager.tsx`

#### Purpose
Track project milestones and handle deadline deviations

#### Features
- **Create Milestones**: Define milestone name, target date, phase
- **Update Progress**: Track completion percentage (0-100%)
- **Status Indicators**: 
  - On Track (green)
  - At Risk (yellow)
  - Delayed (red)
  - Completed (blue)
- **Deviation Requests**: Request deadline extensions with justification
- **Approval Workflow**: Deviations require approval from executives
- **Visual Progress**: Slider-based progress updates

#### Milestone Fields
- Name/Title
- Description
- Target Date
- Completion Percentage
- Linked Phase
- Status

---

### 4. ProjectDailyLogsWidget
**File**: `src/components/engineering/ProjectDailyLogsWidget.tsx`

#### Purpose
Record hourly project activities and progress updates

#### Features
- **Hourly Logging**: Track activities by hour
- **Activity Types**: 
  - Site Work
  - Material Delivery
  - Quality Check
  - Safety Inspection
  - Meeting
  - Other
- **Worker Tracking**: Number of workers on-site
- **Weather Recording**: Weather conditions
- **Photo Attachments**: Upload activity proofs
- **Notes**: Detailed descriptions
- **Timeline View**: Chronological activity log

---

### 5. ConvertToWorkOrderModal
**File**: `src/components/engineering/ConvertToWorkOrderModal.tsx`

#### Purpose
Convert BOQ items into vendor work orders

#### Features
- **Vendor Selection**: Choose vendor from system
- **Scope Definition**: Define work scope
- **Cost Estimation**: Set work order value
- **Timeline**: Set expected completion date
- **BOQ Linkage**: Automatically links to source BOQ item
- **Status Update**: Updates BOQ item status to "ordered"

---

### 6. MaterialRequestModal
**File**: `src/components/engineering/MaterialRequestModal.tsx`

#### Purpose
Create material procurement requests from BOQ or standalone

#### Features
- **Material Details**: Name, quantity, specifications
- **Priority Setting**: High, Medium, Low
- **Required Date**: Delivery deadline
- **BOQ Linkage**: Optional link to BOQ item
- **Phase Assignment**: Assign to project phase
- **Auto-routing**: Routes to appropriate procurement team
- **Status Tracking**: Pending → Approved → Ordered → Delivered

---

### 7. DeviationApprovalsWidget
**File**: `src/components/engineering/DeviationApprovalsWidget.tsx`

#### Purpose
Executive approval interface for milestone deviations

#### Features
- **Pending Requests**: List all pending deviation requests
- **Request Details**: View milestone, old date, new date, justification
- **Approve/Reject**: Binary approval with feedback
- **Real-time Updates**: Instant notification on approval/rejection
- **Audit Trail**: Records approver and timestamp

#### Approval Roles
- CEO
- Admin
- GM
- GMO
- SMO

---

### 8. ProjectGanttChart
**File**: `src/components/engineering/ProjectGanttChart.tsx`

#### Purpose
Visual timeline representation of project phases and milestones

#### Features
- **Phase Bars**: Horizontal bars showing phase duration
- **Milestone Markers**: Diamond markers for milestones
- **Progress Indicators**: Completion percentage overlays
- **Date Range**: Automatic timeline scaling
- **Status Colors**: Color-coded by phase status
- **Interactive**: Hover for details

---

### 9. ProcurementTimeline
**File**: `src/components/engineering/ProcurementTimeline.tsx`

#### Purpose
Visual timeline of material and work order sourcing

#### Features
- **Request Timeline**: Chronological sourcing events
- **Status Flow**: Visual progression through statuses
- **Vendor Information**: Linked vendor details
- **Cost Tracking**: Budget vs actual
- **Delivery Dates**: Expected and actual delivery

---

### 10. AddPhaseModal
**File**: `src/components/engineering/AddPhaseModal.tsx`

#### Purpose
Add new phases to existing projects

#### Fields
- Phase Name
- Phase Order (sequence)
- Description
- Estimated Cost
- Status (Pending/In Progress/Completed)
- Start Date
- Completion Date
- Completion Percentage

---

### 11. PhaseUpdateModal
**File**: `src/components/engineering/PhaseUpdateModal.tsx`

#### Purpose
Update existing phase details and progress

#### Editable Fields
- Phase Name
- Description
- Status
- Completion Percentage
- Actual Cost
- Start/Completion Dates

---

## Database Schema

### Core Tables

#### 1. **project_verticals**
Defines project categories and types

```sql
CREATE TABLE project_verticals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('DIRECT', 'JV')),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'FolderKanban',
  color TEXT DEFAULT 'blue',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);
```

#### 2. **projects** (Extended Columns)
Main project table with lifecycle tracking

```sql
ALTER TABLE projects ADD COLUMN:
  -- Vertical & Category
  project_category TEXT DEFAULT 'DIRECT',
  vertical_id UUID REFERENCES project_verticals(id),
  
  -- Deal Information
  deal_file_url TEXT,
  deal_uploaded_by UUID REFERENCES profiles(id),
  deal_uploaded_at TIMESTAMPTZ,
  
  -- Lifecycle Stage
  lifecycle_stage TEXT DEFAULT 'new_deal',
  
  -- Assignments
  assigned_site_manager_id UUID REFERENCES profiles(id),
  assigned_project_engineer_id UUID REFERENCES profiles(id),
  
  -- BOQ Metadata
  current_phase_id UUID REFERENCES project_phases(id),
  boq_submitted_at TIMESTAMPTZ,
  boq_submitted_by UUID REFERENCES profiles(id),
  boq_approved_at TIMESTAMPTZ,
  boq_approved_by UUID REFERENCES profiles(id),
  boq_rejection_reason TEXT,
  
  -- Stage Timestamps
  stage_new_deal_at TIMESTAMPTZ DEFAULT NOW(),
  stage_engineering_assigned_at TIMESTAMPTZ,
  stage_boq_submitted_at TIMESTAMPTZ,
  stage_boq_approved_at TIMESTAMPTZ,
  stage_sourcing_at TIMESTAMPTZ,
  stage_execution_at TIMESTAMPTZ,
  stage_completed_at TIMESTAMPTZ;
```

**Lifecycle Stages:**
- `new_deal`: Newly uploaded, awaiting engineering assignment
- `engineering_assigned`: Assigned to engineer/site manager
- `boq_submitted`: BOQ created and submitted for approval
- `boq_approved`: BOQ approved, ready for sourcing
- `sourcing`: Materials/services being procured
- `execution`: Active construction/implementation
- `completed`: Project finished

---

#### 3. **project_phases**
Project phases for granular tracking

```sql
CREATE TABLE project_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_name TEXT NOT NULL,
  phase_order INTEGER NOT NULL,
  description TEXT,
  estimated_cost NUMERIC DEFAULT 0,
  actual_cost NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending' 
    CHECK (status IN ('pending', 'in_progress', 'completed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completion_percentage INTEGER DEFAULT 0 
    CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, phase_order)
);
```

**Common Phases:**
- Foundation
- Structural Work
- Electrical
- Plumbing
- Finishing
- Landscaping

---

#### 4. **project_boq**
Bill of Quantities items

```sql
CREATE TABLE project_boq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES project_phases(id) ON DELETE SET NULL,
  line_number INTEGER NOT NULL,
  material_name TEXT NOT NULL,
  specification TEXT,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'units',
  estimated_unit_cost NUMERIC DEFAULT 0,
  actual_unit_cost NUMERIC,
  actual_total NUMERIC,
  category TEXT DEFAULT 'material' 
    CHECK (category IN ('material', 'labour', 'equipment')),
  sourced_via TEXT CHECK (sourced_via IN ('po', 'wo', NULL)),
  linked_po_id UUID REFERENCES purchase_orders(id),
  linked_wo_id UUID REFERENCES work_orders(id),
  status TEXT DEFAULT 'pending' 
    CHECK (status IN ('pending', 'sourced', 'ordered', 'delivered', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, line_number)
);
```

---

#### 5. **project_milestones**
Project milestone tracking

```sql
CREATE TABLE project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES project_phases(id) ON DELETE SET NULL,
  milestone_name TEXT NOT NULL,
  description TEXT,
  target_date DATE NOT NULL,
  completion_percentage INTEGER DEFAULT 0 
    CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### 6. **milestone_deviation_requests**
Deadline extension requests

```sql
CREATE TABLE milestone_deviation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID REFERENCES project_milestones(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES profiles(id),
  old_target_date DATE NOT NULL,
  new_target_date DATE NOT NULL,
  justification TEXT NOT NULL,
  status TEXT DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### 7. **boq_templates**
Reusable BOQ templates

```sql
CREATE TABLE boq_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE boq_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES boq_templates(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  material_name TEXT NOT NULL,
  specification TEXT,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  estimated_unit_cost NUMERIC DEFAULT 0,
  category TEXT DEFAULT 'material',
  phase_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### 8. **project_execution_proofs**
Execution evidence (photos, documents, notes)

```sql
CREATE TABLE project_execution_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES project_phases(id),
  proof_type TEXT NOT NULL DEFAULT 'photo' 
    CHECK (proof_type IN ('photo', 'document', 'note')),
  file_url TEXT,
  notes TEXT,
  location_data JSONB,
  uploaded_by UUID REFERENCES profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### 9. **project_timeline**
Complete audit trail of all project actions

```sql
CREATE TABLE project_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by UUID REFERENCES profiles(id),
  performed_by_name TEXT,
  performed_by_role TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Sample Actions:**
- Deal uploaded
- Engineer assigned
- BOQ submitted
- BOQ approved
- Phase updated
- Milestone completed
- Material delivered
- Proof uploaded

---

#### 10. **project_daily_logs**
Hourly project activity logs

```sql
CREATE TABLE project_daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES project_phases(id) ON DELETE SET NULL,
  log_date DATE NOT NULL,
  log_hour INTEGER CHECK (log_hour >= 0 AND log_hour <= 23),
  activity_type TEXT,
  description TEXT NOT NULL,
  workers_count INTEGER DEFAULT 0,
  weather_conditions TEXT,
  photo_urls TEXT[],
  logged_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Row Level Security (RLS) Policies

#### project_phases
```sql
-- Team can manage phases for assigned projects
CREATE POLICY "Team can manage phases for assigned projects" 
ON project_phases FOR ALL USING (
  project_id IN (
    SELECT id FROM projects 
    WHERE assigned_project_engineer_id = auth.uid()
       OR assigned_site_manager_id = auth.uid()
       OR assigned_manager_id = auth.uid()
  )
);

-- Executives can view all phases
CREATE POLICY "Executives can view all phases" 
ON project_phases FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('Admin', 'CEO', 'GM', 'GMO', 'SMO', 'BOI')
  )
);
```

#### project_boq
```sql
-- Engineers can manage BOQ for assigned projects
CREATE POLICY "Engineers can manage BOQ for assigned projects" 
ON project_boq FOR ALL USING (
  project_id IN (
    SELECT id FROM projects 
    WHERE assigned_project_engineer_id = auth.uid()
       OR assigned_engineer_id = auth.uid()
       OR assigned_manager_id = auth.uid()
  )
);

-- Executives can view all BOQ
CREATE POLICY "Executives can view all BOQ" 
ON project_boq FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('Admin', 'CEO', 'GM', 'GMO', 'SMO', 'BOI')
  )
);
```

---

## Hooks & Custom Functions

### Custom React Hooks

#### 1. **useBOQ.ts**
Manage BOQ items for a project

```typescript
const { 
  boqItems,      // All BOQ items
  isLoading,
  addItem,       // Add new BOQ item
  updateItem,    // Update existing item
  deleteItem,    // Remove BOQ item
  submitBOQ,     // Submit BOQ for approval
  refetch        // Manually refresh
} = useBOQ(projectId);
```

---

#### 2. **useProjectPhases.ts**
Manage project phases

```typescript
const { 
  phases,        // All phases
  isLoading,
  addPhase,      // Create new phase
  updatePhase,   // Update phase details
  deletePhase,   // Remove phase
  refetch
} = useProjectPhases(projectId);
```

---

#### 3. **useMilestones.ts**
Manage milestones and deviations

```typescript
const { 
  milestones,           // All milestones
  isLoading,
  addMilestone,         // Create milestone
  updateMilestone,      // Update progress
  requestDeviation,     // Request deadline extension
  refetch
} = useMilestones(projectId);

const {
  deviationRequests,    // All deviation requests
  isLoading,
  approveRequest,       // Approve deviation
  rejectRequest,        // Reject deviation
  refetch
} = useDeviationRequests();
```

---

#### 4. **useBOQTemplates.ts**
Manage BOQ templates

```typescript
const { 
  templates,            // All templates
  isLoading,
  createTemplate,       // New template
  updateTemplate,       // Edit template
  deleteTemplate,       // Remove template
  addItemToTemplate,    // Add item to template
  refetch
} = useBOQTemplates();
```

---

#### 5. **useProjectExecution.ts**
Comprehensive project execution data

```typescript
const { 
  project,              // Project details
  phases,               // Project phases
  boqItems,             // BOQ items
  milestones,           // Milestones
  timeline,             // Action timeline
  proofs,               // Execution proofs
  isLoading,
  refreshAll            // Refresh all data
} = useProjectExecution(projectId);
```

---

#### 6. **useProjectLifecycle.ts**
Handle lifecycle stage transitions

```typescript
const { 
  updateLifecycleStage,    // Move to next stage
  canTransition,           // Check if transition allowed
  getStageLabel            // Get human-readable label
} = useProjectLifecycle();
```

---

#### 7. **useProjectTimeline.ts**
Record timeline events

```typescript
const { 
  addTimelineEvent,        // Log new event
  getTimeline              // Fetch timeline
} = useProjectTimeline(projectId);
```

---

### Database Functions

#### 1. **get_project_aging()**
Calculate project age by lifecycle stage

```sql
CREATE OR REPLACE FUNCTION get_project_aging(p_project_id UUID)
RETURNS JSONB AS $$
  -- Returns:
  {
    "total_age_days": number,
    "current_stage": string,
    "stage_ages": {
      "new_deal": days,
      "engineering_assigned": days,
      "boq_pending": days,
      "sourcing": days,
      "execution": days
    }
  }
$$ LANGUAGE plpgsql STABLE;
```

---

## Features & Workflows

### 1. Deal Upload → Engineering Assignment

**Initiated By**: Admin, CEO, GM, GMO  
**Flow**:
1. Upload deal file via Deal Upload Page
2. Select vertical (Polyhouse, Microgreens, etc.)
3. Enter client and project details
4. System creates project with stage = `new_deal`
5. Executive assigns engineer via project assignment
6. System updates stage to `engineering_assigned`
7. Timeline event logged

---

### 2. BOQ Creation & Submission

**Initiated By**: Assigned Engineer  
**Flow**:
1. Engineer navigates to BOQ Builder for project
2. Optionally loads template to pre-fill items
3. Adds/edits BOQ line items:
   - Material name
   - Specifications
   - Quantity & unit
   - Estimated cost
   - Category (Material/Labour/Equipment)
   - Assign to phase
4. Reviews total costs per phase
5. Clicks "Submit BOQ for Approval"
6. System updates:
   - `boq_submitted_at` timestamp
   - `boq_submitted_by` = engineer's ID
   - `lifecycle_stage` = `boq_submitted`
7. Notification sent to approvers (SMO, Admin, CEO)
8. Timeline event logged

---

### 3. BOQ Approval/Rejection

**Approved By**: SMO, Admin, CEO  
**Flow**:

**Approval:**
1. Approver reviews BOQ in project execution dashboard
2. Clicks "Approve BOQ"
3. System updates:
   - `boq_approved_at` timestamp
   - `boq_approved_by` = approver's ID
   - `lifecycle_stage` = `boq_approved`
4. Project moves to sourcing stage
5. Timeline event logged

**Rejection:**
1. Approver clicks "Reject BOQ"
2. Enters rejection reason
3. System updates:
   - `boq_rejection_reason` = reason
   - `lifecycle_stage` back to `engineering_assigned`
4. Engineer notified to revise BOQ
5. Timeline event logged

---

### 4. Material Sourcing

**Initiated By**: Engineer, Procurement Team  
**Flow**:
1. Engineer opens BOQ item or phase in execution dashboard
2. Clicks "Request Materials"
3. Fills material request form:
   - Material details (auto-filled from BOQ)
   - Priority (High/Medium/Low)
   - Required date
   - Notes
4. System creates `material_request` linked to BOQ item
5. Request routes to Procurement/Purchase team
6. Procurement creates Purchase Order
7. PO linked back to BOQ item via `linked_po_id`
8. BOQ item status updates to `ordered`
9. On delivery, status updates to `delivered`
10. Timeline events logged at each step

---

### 5. Work Order Creation

**Initiated By**: Engineer, Procurement  
**Flow**:
1. Engineer selects BOQ item for vendor work
2. Opens "Convert to Work Order" modal
3. Selects vendor
4. Defines scope and cost
5. Sets expected completion date
6. System creates `work_order` linked to BOQ item
7. BOQ item status updates to `ordered`
8. Vendor receives work order notification
9. On completion, status updates to `completed`
10. Timeline events logged

---

### 6. Milestone Tracking & Deviations

**Initiated By**: Engineer, Site Manager  
**Flow**:

**Create Milestone:**
1. Navigate to Milestone Manager in execution dashboard
2. Click "Add Milestone"
3. Enter milestone name, target date, description
4. Optionally link to phase
5. Milestone created with status = `pending`

**Update Progress:**
1. Click milestone to update
2. Adjust completion percentage (0-100%)
3. System calculates status:
   - `On Track`: On schedule, not delayed
   - `At Risk`: Approaching deadline with low progress
   - `Delayed`: Past deadline, not completed
   - `Completed`: 100% progress

**Request Deviation:**
1. If milestone will be delayed, click "Request Deviation"
2. Enter new target date
3. Provide justification
4. System creates `milestone_deviation_request`
5. Request sent to executives (CEO, Admin, GM)
6. Approver reviews:
   - **Approve**: Updates milestone target date, status = `approved`
   - **Reject**: Milestone keeps old date, status = `rejected`
7. Timeline event logged

---

### 7. Phase Management

**Initiated By**: Engineer, Project Manager  
**Flow**:

**Add Phase:**
1. Open "Add Phase" modal in execution dashboard
2. Enter phase name, order, estimated cost
3. Optionally set start/end dates
4. Phase created with status = `pending`

**Update Phase:**
1. Click "Edit Phase"
2. Update status (Pending → In Progress → Completed)
3. Update completion percentage
4. Enter actual cost when available
5. System calculates cost variance (estimated vs actual)
6. Timeline event logged

---

### 8. Daily Logging

**Initiated By**: Site Manager, Engineer  
**Flow**:
1. Open Project Daily Logs widget
2. Select date and hour
3. Choose activity type (Site Work, Delivery, Inspection, etc.)
4. Enter description, workers count, weather
5. Upload photos (optional)
6. Log saved with timestamp and author
7. Logs displayed in chronological order
8. Filterable by date, activity type

---

### 9. Execution Proofs

**Initiated By**: Site Team  
**Flow**:
1. Navigate to execution dashboard
2. Click "Upload Proof"
3. Select proof type (Photo/Document/Note)
4. Upload file or enter note
5. Optionally link to phase
6. Add location data (GPS coordinates)
7. Proof saved with metadata
8. Timeline event logged
9. Viewable by executives and project team

---

### 10. Template-Based BOQ Creation

**Initiated By**: Engineer  
**Flow**:
1. Open BOQ Builder for new project
2. Click "Load Template"
3. Select template from list (filtered by category)
4. Template items loaded into BOQ
5. Engineer customizes quantities, costs as needed
6. Map template phases to project phases
7. Save and submit BOQ

**Template Management:**
1. Navigate to Template Manager
2. Create new template with name and description
3. Add items with default quantities and costs
4. Save template for future use
5. Edit/delete templates as needed

---

## Access Control & Permissions

### Role-Based Access

#### Engineering Department
**Access**: Full engineering module
- Create/edit BOQs
- Manage project phases
- Request materials and work orders
- Update milestones
- Upload execution proofs
- View assigned projects only (unless executive)

#### SMO (Site Management Officer)
**Access**: Approval authority + engineering access
- All engineering features
- Approve BOQs
- Approve deviation requests
- View all projects

#### Admin, CEO, GM, GMO
**Access**: Executive oversight
- View all projects
- Approve BOQs
- Approve deviations
- View all BOQ items, phases, milestones
- Access all dashboards

#### BOI (Board of Investment)
**Access**: View-only executive access
- View projects, BOQs, milestones
- Cannot approve or edit

#### Procurement/Purchase Team
**Access**: Sourcing focus
- View BOQs
- Create purchase orders
- Create work orders
- Update material request statuses

---

### Component-Level Permissions

```typescript
// Sidebar visibility (Engineering module links)
{
  title: 'Engineering',
  departments: ['engineering', 'agri', 'rental sourcing', 'tnskill'],
  roles: ['employee', 'smo'],
  items: [
    { to: '/engineer-dashboard', label: 'Dashboard' },
    { to: '/boq-builder', label: 'BOQ Builder' },
    { to: '/sourcing-dashboard', label: 'Sourcing' },
  ]
}

// BOQ Approval (shown only to approvers)
{
  roles: ['SMO', 'Admin', 'CEO'],
  action: 'Approve/Reject BOQ'
}

// Deviation Approval Widget
{
  roles: ['CEO', 'Admin', 'GM', 'GMO', 'SMO'],
  action: 'Approve/Reject Deviations'
}
```

---

## Integration Points

### 1. Project Management
- **Interface**: Projects table, lifecycle stages
- **Integration**: Engineering module updates project lifecycle
- **Events**: Stage transitions trigger notifications

### 2. Procurement Module
- **Interface**: Material requests, purchase orders
- **Integration**: BOQ items link to POs
- **Events**: Material request creation → Procurement notification

### 3. Vendor Management
- **Interface**: Work orders
- **Integration**: BOQ items link to work orders
- **Events**: Work order creation → Vendor notification

### 4. Escalations & Criticals
- **Interface**: Shared department filtering
- **Integration**: Engineering projects can have escalations
- **Events**: Delayed milestones can trigger escalations

### 5. Farm/Project Dashboard
- **Interface**: Construction mode view
- **Integration**: Farm projects use same execution dashboard
- **Events**: Execution proofs visible in farm dashboard

### 6. Employee Dashboard
- **Interface**: Task assignments, material requests
- **Integration**: Engineers see tasks and requests
- **Events**: Task completion updates metrics

### 7. Executive Dashboards
- **Interface**: CEO, GM, GMO dashboards
- **Integration**: Engineering metrics displayed (BOQ approvals, deviations)
- **Events**: Pending approvals show in dashboard widgets

---

## API Endpoints

### Supabase Real-time Subscriptions

```typescript
// Projects updates
supabase.channel('projects')
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'projects' 
  }, callback)

// BOQ updates
supabase.channel('project_boq')
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'project_boq' 
  }, callback)

// Phase updates
supabase.channel('project_phases')
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'project_phases' 
  }, callback)

// Milestone updates
supabase.channel('project_milestones')
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'project_milestones' 
  }, callback)

// Material request updates
supabase.channel('material_requests')
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'material_requests' 
  }, callback)
```

---

### Database Queries (via Supabase Client)

#### Fetch Project Execution Details
```typescript
const { data: project } = await supabase
  .from('projects')
  .select(`
    *,
    vertical:project_verticals(*),
    phases:project_phases(*),
    boq_items:project_boq(*),
    milestones:project_milestones(*),
    timeline:project_timeline(*),
    proofs:project_execution_proofs(*)
  `)
  .eq('id', projectId)
  .single();
```

#### Fetch BOQ with Phases
```typescript
const { data: boqItems } = await supabase
  .from('project_boq')
  .select(`
    *,
    phase:project_phases(phase_name),
    linked_po:purchase_orders(po_number, status),
    linked_wo:work_orders(wo_number, status)
  `)
  .eq('project_id', projectId)
  .order('line_number');
```

#### Fetch Pending Deviations
```typescript
const { data: requests } = await supabase
  .from('milestone_deviation_requests')
  .select(`
    *,
    milestone:project_milestones(
      milestone_name,
      project:projects(project_name, client_name)
    ),
    requester:profiles!requested_by(name)
  `)
  .eq('status', 'pending');
```

#### Submit BOQ
```typescript
const { error } = await supabase
  .from('projects')
  .update({
    boq_submitted_at: new Date().toISOString(),
    boq_submitted_by: userId,
    lifecycle_stage: 'boq_submitted',
    stage_boq_submitted_at: new Date().toISOString()
  })
  .eq('id', projectId);
```

#### Approve BOQ
```typescript
const { error } = await supabase
  .from('projects')
  .update({
    boq_approved_at: new Date().toISOString(),
    boq_approved_by: userId,
    lifecycle_stage: 'boq_approved',
    stage_boq_approved_at: new Date().toISOString()
  })
  .eq('id', projectId);
```

---

## Technical Details

### State Management
- **React Hooks**: useState, useEffect, useCallback
- **Custom Hooks**: Centralized data fetching and mutations
- **Real-time Sync**: Supabase subscriptions for live updates
- **Optimistic Updates**: Immediate UI feedback before server confirmation

### Performance Optimizations
- **Lazy Loading**: Components loaded on demand
- **Pagination**: Large datasets (BOQ items, timeline events)
- **Memoization**: React.memo for expensive components
- **Debouncing**: Search and filter inputs
- **Caching**: Query results cached until invalidation

### Error Handling
- **Try-Catch Blocks**: All database operations wrapped
- **Toast Notifications**: User-friendly error messages via sonner
- **Fallback UI**: Loading states and error boundaries
- **Validation**: Form validation before submission

### Security
- **Row Level Security**: All tables have RLS policies
- **Role-Based Access**: UI elements conditionally rendered
- **Input Sanitization**: XSS protection
- **File Upload**: Secure file handling via Supabase Storage

---

## Usage Examples

### Creating a BOQ from Template

```typescript
// 1. Load template
const template = await loadTemplate(templateId);

// 2. Map template items to project
const boqItems = template.items.map((item, index) => ({
  project_id: projectId,
  phase_id: getPhaseIdByName(item.phase_name),
  line_number: index + 1,
  material_name: item.material_name,
  specification: item.specification,
  quantity: item.quantity,
  unit: item.unit,
  estimated_unit_cost: item.estimated_unit_cost,
  category: item.category,
  status: 'pending',
  created_by: userId
}));

// 3. Bulk insert BOQ items
await supabase.from('project_boq').insert(boqItems);

// 4. Log timeline event
await addTimelineEvent({
  project_id: projectId,
  action: 'BOQ created from template',
  details: { template_name: template.name }
});
```

### Requesting Material from BOQ

```typescript
// 1. Open material request modal with BOQ item data
const boqItem = { /* BOQ item */ };

// 2. Create material request
const materialRequest = {
  project_id: boqItem.project_id,
  boq_item_id: boqItem.id,
  material_name: boqItem.material_name,
  specification: boqItem.specification,
  quantity: boqItem.quantity,
  unit: boqItem.unit,
  priority: 'high',
  required_date: targetDate,
  requested_by: userId,
  status: 'pending'
};

await supabase.from('material_requests').insert(materialRequest);

// 3. Update BOQ item status
await supabase
  .from('project_boq')
  .update({ status: 'sourced' })
  .eq('id', boqItem.id);

// 4. Log timeline
await addTimelineEvent({
  project_id: boqItem.project_id,
  action: 'Material requested',
  details: { material: boqItem.material_name, quantity: boqItem.quantity }
});
```

### Approving Milestone Deviation

```typescript
// 1. Fetch deviation request
const request = { /* deviation request */ };

// 2. Approve deviation
await supabase
  .from('milestone_deviation_requests')
  .update({
    status: 'approved',
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
    feedback: 'Approved due to valid reasons'
  })
  .eq('id', request.id);

// 3. Update milestone target date
await supabase
  .from('project_milestones')
  .update({ target_date: request.new_target_date })
  .eq('id', request.milestone_id);

// 4. Log timeline
await addTimelineEvent({
  project_id: request.project_id,
  action: 'Milestone deviation approved',
  details: { 
    milestone: request.milestone_name, 
    old_date: request.old_target_date,
    new_date: request.new_target_date
  }
});
```

---

## Future Enhancements

### Planned Features
1. **AI-Powered BOQ Estimation**: Auto-suggest quantities and costs based on historical data
2. **Mobile App**: Field engineers can update from mobile devices
3. **Photo Recognition**: Auto-tag photos to phases/milestones using AI
4. **Budget Forecasting**: Predict project costs based on current spend rate
5. **Vendor Rating System**: Rate vendors based on work order performance
6. **Resource Allocation**: Assign workers and equipment to phases
7. **Weather Integration**: Auto-fetch weather data for daily logs
8. **Gantt Chart Interaction**: Drag-and-drop to adjust phase timelines
9. **BOQ Import/Export**: Excel import/export for bulk operations
10. **Material Inventory Tracking**: Real-time inventory deductions on material delivery

---

## Troubleshooting

### Common Issues

**Issue**: BOQ items not showing  
**Solution**: Check RLS policies, ensure user is assigned to project

**Issue**: Real-time updates not working  
**Solution**: Verify Supabase channel subscriptions, check network connectivity

**Issue**: Template not loading items  
**Solution**: Ensure template has items, check phase name mapping

**Issue**: Deviation approval not reflecting  
**Solution**: Refresh page, check database update logs

**Issue**: File upload failing  
**Solution**: Check file size limits, storage bucket permissions

---

## Conclusion

The **Engineering Module** is a comprehensive, feature-rich system for managing engineering and agricultural projects from inception to completion. It provides tools for BOQ management, phase tracking, milestone monitoring, material sourcing, and execution tracking, all with real-time updates and role-based access control.

For detailed implementation questions or support, refer to individual component files or database migration scripts.

---

**Last Updated**: January 25, 2026  
**Version**: 1.0  
**Maintained By**: Engineering & Development Team
