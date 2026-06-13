import { useAuth } from '@/contexts/AuthContext';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useDayStart } from '@/hooks/useDayStart';
import { useIsCoreHead } from '@/hooks/useIsCoreHead';
import { useFFPaymentCount } from '@/hooks/useFFPaymentCount';
import { format } from 'date-fns';
import { ThemeSelector } from '@/components/ThemeSelector';
import {
  Clock,
  ClipboardList,
  Timer,
  FileText,
  CreditCard,
  History,
  Users,
  CheckSquare,
  Plus,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  BarChart3,
  Banknote,
  FileSearch,
  Search,
  Calendar,
  FolderKanban,
  AlertTriangle,
  User,
  UserPlus,
  MessageSquarePlus,
  Camera,
  PhoneCall,
  LayoutDashboard,
  Shield,
  Briefcase,
  Upload,
  Inbox,
  ClipboardCheck,
  Truck,
  Package,
  Activity,
  Settings,
  Lock,
  Volume2,
  ShieldCheck,
  MapPin,
  Layers,
  Wallet,
  FileBarChart,
  Tags,
  RotateCcw,
  Bot,
  Building2,
  PieChart,
  MessageSquare,
  ShieldAlert,
  Home,
  Coffee,
  Zap,
  ChefHat,
  Handshake,
  PlusCircle,
  BookOpen,
  Database,
  ShoppingCart,
  Warehouse,
  PackageCheck,
  TrendingUp,
  Store,
  Star,
  Boxes,
  Target,
  UserCog,
  MessageSquarePlus as Feedback,
  CheckCircle2,
  Calculator,
} from 'lucide-react';

interface NavChild {
  label: string;
  path: string;
  action?: boolean; // shows a + button
}

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  children?: NavChild[];
  badgeKey?: string; // key into pendingCounts map to show a red badge
}

interface NavGroup {
  title: string;
  icon: React.ElementType;
  roles: string[];
  items: NavItem[];
  departments?: string[];
  excludeDepartments?: string[];
}

const navigationConfig: NavGroup[] = [
  // ── Daily Workflow (ALL roles except shift/purchase exec) ───────────────────
  {
    title: 'Daily Workflow',
    icon: Clock,
    roles: [
      'employee', 'director', 'Director', 'vendor_head',
      'nsm', 'datateam', 'data_team', 'data', 'boi', 'gmo', 'smo',
      'accounts', 'farmmanager', 'bd_data', 'rsh', 'RSH', 'site_visit_farm_manager',
      'cafe_manager', 'palm_cafe_manager', 'ff_operations_manager',
      'bde', 'field_executive', 'back_office', 'tele_caller', 'driver',
      // gm, l1_manager, auditor intentionally excluded — payment-only roles
      // purchase_manager, purchase_head, shift_employee → trimmed section below
      // hub_manager → trimmed section below
    ],
    items: [
      { icon: Home,          label: 'My Dashboard',          path: '/employee-dashboard' },
      { icon: Clock,         label: 'Login',                  path: '/day-start' },
      { icon: Timer,         label: 'Hourly Plan & Report',   path: '/hourly-report' },
      { icon: ClipboardList, label: 'Day Plan',               path: '/day-plan' },
      { icon: FileText,      label: 'EOD Summary',            path: '/eod-summary' },
      { icon: Calendar,      label: 'Company Calendar',       path: '/company-calendar' },
      { icon: CheckSquare,   label: 'My Tasks',               path: '/my-tasks' },
      { icon: AlertTriangle, label: 'My LOP / Discipline',    path: '/my-lop' },
      { icon: AlertTriangle, label: 'My Escalations',         path: '/dashboard/my-escalations' },
      { icon: Calendar,      label: 'Leave Request',          path: '/leave-request' },
      { icon: CreditCard,    label: 'Payment Request',        path: '/payment-request' },
      { icon: FileText,      label: 'My Payslip',             path: '/my-payslips' },
      { icon: BookOpen,      label: 'My SOPs',                path: '/my-sops' },
      { icon: History,       label: 'My Requests',            path: '/my-requests' },
      { icon: Coffee,        label: 'PALM CAFE',              path: '/palm-cafe' },
      { icon: MessageSquare, label: 'Chat',                   path: '/chat' },
    ],
  },

  // ── Daily Workflow (Purchase Exec / Shift Employee — trimmed) ────────────────
  {
    title: 'Daily Workflow',
    icon: Clock,
    roles: ['purchase_manager', 'purchase_head', 'shift_employee', 'hub_manager'],
    items: [
      { icon: FileText,      label: 'EOD Summary',         path: '/eod-summary' },
      { icon: Calendar,      label: 'Company Calendar',    path: '/company-calendar' },
      { icon: AlertTriangle, label: 'My LOP / Discipline', path: '/my-lop' },
      { icon: AlertTriangle, label: 'My Escalations',      path: '/dashboard/my-escalations' },
      { icon: Calendar,      label: 'Leave Request',       path: '/leave-request' },
      { icon: FileText,      label: 'My Payslip',          path: '/my-payslips' },
      { icon: History,       label: 'My Requests',         path: '/my-requests' },
    ],
  },

  // ── PALM CAFE Manager ───────────────────────────────────────────────────────
  {
    title: 'PALM CAFE',
    icon: ChefHat,
    roles: ['palm_cafe_manager', 'cafe_manager'],
    items: [
      { icon: LayoutDashboard, label: 'Order Receiving', path: '/cafe/manager' },
    ],
  },

  // ── Director Board ───────────────────────────────────────────────────────────
  {
    title: 'Director Board',
    icon: Shield,
    roles: ['director', 'Director'],
    items: [
      { icon: LayoutDashboard, label: 'Audit Dashboard',       path: '/dashboard/director' },
      { icon: Handshake,       label: 'JV Audit Queue',        path: '/director/jv-approvals' },
      { icon: Activity,        label: 'Employee Activity',     path: '/employee-activity' },
      { icon: CheckSquare,     label: 'Salary Audit (Upload)', path: '/director/salary-audit' },
      { icon: Banknote,        label: 'Salary Batches',        path: '/hr/sheet' },
      { icon: Search,          label: 'Payment Search',        path: '/payment-search' },
      { icon: Coffee,          label: 'Meal Ordering',         path: '/director/meal-ordering' },
    ],
  },

  // ── Engineering Employee ────────────────────────────────────────────────────
  {
    title: 'Work',
    icon: Briefcase,
    roles: ['employee'],
    departments: ['engineering'],
    items: [
      { icon: LayoutDashboard, label: 'Dashboard',          path: '/engineer-dashboard' },
      { icon: FolderKanban,    label: 'My Projects',        path: '/employee-projects' },
      { icon: PlusCircle,      label: 'Payment Request',    path: '/payment-request' },
      { icon: ShieldCheck,     label: 'Escalation Audit',   path: '/admin/escalation-closure' },
      { icon: AlertTriangle,   label: 'All Tickets',        path: '/dashboard/escalations' },
    ],
  },
  {
    title: 'Work',
    icon: Briefcase,
    roles: ['employee'],
    departments: ['jv_engineering', 'JV Engineering'],
    items: [
      { icon: LayoutDashboard, label: 'Dashboard',    path: '/engineer-dashboard' },
      { icon: Handshake,       label: 'JV Projects',  path: '/jv-projects' },
      { icon: AlertTriangle,   label: 'All Tickets',  path: '/dashboard/escalations' },
    ],
  },
  {
    title: 'Work',
    icon: Briefcase,
    roles: ['employee'],
    departments: ['business development', 'bd'],
    items: [
      { icon: Plus,          label: 'Create Project',     path: '/projects/new' },
      { icon: FolderKanban,  label: 'Project History',    path: '/projects' },
      { icon: ShieldCheck,   label: 'Escalation Audit',   path: '/admin/escalation-closure' },
      { icon: AlertTriangle, label: 'All Tickets',        path: '/dashboard/escalations' },
    ],
  },
  {
    title: 'BD Data Work',
    icon: Briefcase,
    roles: ['bd_data'],
    items: [
      { icon: Upload,        label: 'Upload Project',     path: '/deal-upload' },
      { icon: FolderKanban,  label: 'Project History',    path: '/projects' },
      { icon: AlertTriangle, label: 'Escalation Closure', path: '/admin/escalation-closure' },
      { icon: AlertTriangle, label: 'Criticals Audit',    path: '/admin/criticals-audit' },
    ],
  },

  // ── NSM ─────────────────────────────────────────────────────────────────────
  {
    title: 'Command Center',
    icon: LayoutDashboard,
    roles: ['nsm'],
    items: [
      { icon: BarChart3,     label: 'NSM Dashboard',      path: '/nsm-dashboard' },
      { icon: ShieldCheck,   label: 'Escalation Audit',   path: '/admin/escalation-closure' },
      { icon: Zap,           label: 'Criticals Audit',    path: '/admin/criticals-audit' },
      { icon: AlertTriangle, label: 'All Tickets',        path: '/dashboard/escalations' },
    ],
  },

  // ── Data Team ───────────────────────────────────────────────────────────────
  {
    title: 'Command Center',
    icon: LayoutDashboard,
    roles: ['datateam', 'data_team', 'data'],
    items: [
      { icon: BarChart3,     label: 'Create Critical',    path: '/datateam-dashboard' },
      { icon: FileSearch,    label: 'WO Audits',          path: '/datateam/wo-audits' },
      { icon: AlertTriangle, label: 'All Tickets',        path: '/dashboard/escalations' },
      { icon: AlertTriangle, label: 'Escalation Closure', path: '/admin/escalation-closure' },
      { icon: AlertTriangle, label: 'Criticals Audit',    path: '/admin/criticals-audit' },
    ],
  },

  // ── BOI ─────────────────────────────────────────────────────────────────────
  {
    title: 'Command Center',
    icon: LayoutDashboard,
    roles: ['boi'],
    items: [
      { icon: BarChart3,    label: 'BOI Dashboard',  path: '/dashboard/boi' },
      { icon: CreditCard,   label: 'Payment Audit',  path: '/dashboard/boi/payments' },
      { icon: FolderKanban, label: 'Projects',       path: '/projects' },
    ],
  },

  // ── GMO ─────────────────────────────────────────────────────────────────────
  {
    title: 'Command Center',
    icon: LayoutDashboard,
    roles: ['gmo'],
    items: [
      { icon: BarChart3,     label: 'Dashboard',          path: '/dashboard/gmo' },
      { icon: Inbox,         label: 'New Deals',           path: '/gmo/new-deals' },
      { icon: Truck,         label: 'Project Overview',    path: '/sourcing-dashboard' },
      { icon: CheckSquare,   label: 'Project Approvals',   path: '/gmo/boq-approvals' },
      { icon: FolderKanban,  label: 'Projects',            path: '/dashboard/gmo/projects' },
      { icon: CreditCard,    label: 'Payment Audit',       path: '/dashboard/gmo/payments' },
      { icon: Wallet,        label: 'Project Financials',  path: '/gmo/project-financials' },
      { icon: Activity,      label: 'Engineering Team',    path: '/dashboard/gmo/engineering-team' },
      { icon: PieChart,      label: 'Project Spending',    path: '/project-spending' },
      { icon: AlertTriangle, label: 'My Escalations',      path: '/dashboard/my-escalations' },
    ],
  },

  // ── SMO ─────────────────────────────────────────────────────────────────────
  {
    title: 'Command Center',
    icon: LayoutDashboard,
    roles: ['smo'],
    excludeDepartments: ['rental sourcing', 'site visit', 'jv_engineering', 'JV Engineering'],
    items: [
      { icon: BarChart3,     label: 'Dashboard',      path: '/dashboard/smo' },
      { icon: CreditCard,    label: 'Payment Audit',  path: '/dashboard/smo/payments' },
      { icon: AlertTriangle, label: 'All Tickets',    path: '/dashboard/smo/tickets' },
    ],
  },
  {
    title: 'Command Center',
    icon: LayoutDashboard,
    roles: ['smo'],
    departments: ['jv_engineering', 'JV Engineering'],
    items: [
      { icon: BarChart3,     label: 'Dashboard',       path: '/dashboard/smo' },
      { icon: CreditCard,    label: 'Payment Audit',   path: '/dashboard/smo/payments' },
      { icon: AlertTriangle, label: 'My Escalations',  path: '/dashboard/my-escalations' },
    ],
  },
  {
    title: 'Execution',
    icon: Truck,
    roles: ['smo'],
    excludeDepartments: ['rental sourcing', 'site visit', 'jv_engineering', 'JV Engineering'],
    items: [
      { icon: ClipboardCheck, label: 'Project Approvals',       path: '/smo/boq-approvals' },
      { icon: Truck,          label: 'Project Overview',        path: '/sourcing-dashboard' },
      { icon: FolderKanban,   label: 'Project Execution (All)', path: '/employee-projects' },
      { icon: FolderKanban,   label: 'Projects (Manager)',      path: '/dashboard/smo/projects' },
    ],
  },
  {
    title: 'Execution',
    icon: Truck,
    roles: ['smo'],
    departments: ['jv_engineering', 'JV Engineering'],
    items: [
      { icon: FolderKanban, label: 'Project Execution (All)', path: '/employee-projects' },
    ],
  },

  // ── HR ──────────────────────────────────────────────────────────────────────
  {
    title: 'HR Home',
    icon: LayoutDashboard,
    roles: ['hr'],
    items: [
      { icon: LayoutDashboard, label: 'HR Dashboard',  path: '/hr-dashboard' },
      { icon: History,         label: 'My Requests',   path: '/my-requests' },
      { icon: Coffee,          label: 'PALM CAFE',     path: '/palm-cafe' },
      { icon: MessageSquare,   label: 'Chat',          path: '/chat' },
    ],
  },
  {
    title: 'Attendance & Activity',
    icon: Activity,
    roles: ['hr'],
    items: [
      { icon: Activity,      label: 'Employee Activity',   path: '/employee-activity' },
      { icon: Camera,        label: 'Selfie Attendance',   path: '/selfie-attendance' },
      { icon: ClipboardList, label: 'Attendance Roster',  path: '/admin/attendance-roster' },
      { icon: Calendar,      label: 'Attendance Calendar', path: '/attendance-calendar' },
    ],
  },
  {
    title: 'Leave & LOP',
    icon: Calendar,
    roles: ['hr'],
    items: [
      { icon: Calendar,      label: 'Leave Approvals',         path: '/leave-approvals' },
      { icon: AlertTriangle, label: 'LOP Management',          path: '/lop-management' },
      { icon: Calendar,      label: 'Week Off Assignment',     path: '/admin/week-off-management' },
    ],
  },
  {
    title: 'Payroll & Salary',
    icon: Wallet,
    roles: ['hr'],
    items: [
      { icon: Wallet,    label: 'Payroll Management',  path: '/hr/payroll' },
      { icon: Banknote,  label: 'Salary Sheet',        path: '/hr/sheet' },
      { icon: CheckCircle2, label: 'Salary Approval',  path: '/hr/approval' },
      { icon: Calculator,   label: 'Salary Calculation', path: '/hr/salary-calculation' },
      { icon: CreditCard,   label: 'Payment Audit',    path: '/hr/payment-audit' },
    ],
  },
  {
    title: 'Employees',
    icon: Users,
    roles: ['hr'],
    items: [
      { icon: Users,    label: 'Employee Master',      path: '/hr/employee-master' },
      { icon: User,     label: 'Employee Profiles',    path: '/admin/employee-profiles' },
      { icon: Users,    label: 'Employee Directory',   path: '/employee-directory' },
    ],
  },
  {
    title: 'Onboarding',
    icon: UserPlus,
    roles: ['hr'],
    items: [
      { icon: UserPlus, label: 'New Employee',                path: '/onboarding/new-user' },
      { icon: History,  label: 'Onboarding Status',          path: '/onboarding/hr-access' },
    ],
  },

  // ── GM — Payment Approvals ONLY ──────────────────────────────────────────
  {
    title: 'FF Payment Approvals',
    icon: Banknote,
    roles: ['gm'],
    items: [
      { icon: Banknote,     label: 'Vendor Payments',    path: '/gm/ff-payments',           badgeKey: 'gm' },
      { icon: Truck,        label: 'Transport Payments', path: '/gm/ff-transport-payments', badgeKey: 'gm' },
      { icon: FileBarChart, label: 'FF Payments Report', path: '/reports/ff-payments' },
    ],
  },

  // ── ADMIN — Zoho Books Organized Sections ───────────────────────────────────
  {
    title: 'Overview',
    icon: LayoutDashboard,
    roles: ['admin'],
    items: [
      { icon: LayoutDashboard, label: 'Dashboard',        path: '/admin-dashboard' },
      { icon: ShieldCheck,     label: 'Intelligence Hub', path: '/management/intelligence' },
      { icon: FileSearch,      label: 'Audit Logs',       path: '/audit-logs' },
      { icon: Bot,             label: 'AI Assistant',     path: '/admin/ai-assistant' },
      { icon: Settings,        label: 'AI Command Center',path: '/admin/ai-command-center' },
    ],
  },
  {
    title: 'Approvals',
    icon: CheckSquare,
    roles: ['admin'],
    items: [
      { icon: Banknote,      label: 'Payment Queue',       path: '/admin-queue' },
      { icon: Calendar,      label: 'Leave Approvals',     path: '/leave-approvals' },
      { icon: Truck,         label: 'Transport Analysis',  path: '/admin/transport-analysis' },
    ],
  },
  {
    title: 'People & HR',
    icon: Users,
    roles: ['admin'],
    items: [
      { icon: Users,         label: 'Employee Management', path: '/admin/employees' },
      { icon: UserPlus,      label: 'User Management',     path: '/user-management' },
      { icon: Shield,        label: 'Role Management',     path: '/role-management' },
      { icon: User,          label: 'Employee Profiles',   path: '/admin/employee-profiles' },
      { icon: Users,         label: 'Employee Directory',  path: '/employee-directory' },
      { icon: Camera,        label: 'Selfie Attendance',   path: '/selfie-attendance' },
      { icon: ClipboardList, label: 'Attendance Roster',   path: '/admin/attendance-roster' },
      { icon: ClipboardList, label: 'LOP Register',        path: '/admin-lop' },
      { icon: Calendar,      label: 'Week Off Mgmt',       path: '/admin/week-off-management' },
      { icon: Lock,          label: 'Attendance Lockouts', path: '/admin/lockouts' },
    ],
  },
  {
    title: 'Hub Management',
    icon: Warehouse,
    roles: ['admin'],
    items: [
      { icon: LayoutDashboard, label: 'All Hubs Overview',   path: '/admin/hubs' },
      { icon: MapPin,          label: 'Palikarani Hub',      path: '/admin/hubs/palikarani' },
      { icon: MapPin,          label: 'Vanagaram Hub',       path: '/admin/hubs/vanagaram' },
      { icon: MapPin,          label: 'Hyderabad Hub',       path: '/admin/hubs/hyderabad' },
    ],
  },
  {
    title: 'FF Operations',
    icon: Store,
    roles: ['admin'],
    items: [
      { icon: LayoutDashboard, label: 'Home', path: '/ff-operations' },
      { icon: BarChart3,       label: '🏭 GM Dashboard',  path: '/ff-operations/gm-dashboard' },
      {
        icon: Package, label: 'Items', path: '/ff-operations/items',
        children: [
          { label: 'Items', path: '/ff-operations/items', action: true },
        ],
      },
      {
        icon: ShoppingCart, label: 'Purchase', path: '/purchase',
        children: [
          { label: 'Vendors',             path: '/purchase/vendors' },
          { label: 'Purchase Orders',      path: '/purchase/auto-po' },
          { label: '⚡ EOD PO Engine',    path: '/ff-operations/eod-po-engine' },
          { label: '↳ Auto Bill',         path: '/purchase/auto-bill' },
          { label: 'New Payment',         path: '/purchase/payment-form' },
          { label: 'Payment Approvals',   path: '/purchase/payment-approvals' },
        ],
      },
      {
        icon: Truck, label: 'Transit / Gate', path: '/transit',
        children: [
          { label: 'Transit Dashboard',   path: '/transit' },
          { label: 'Gate Entry',          path: '/transit/gate-entry', action: true },
        ],
      },
      {
        icon: Warehouse, label: 'Warehouse & QC', path: '/warehouse',
        children: [
          { label: 'Dashboard',           path: '/warehouse' },
          { label: 'QC Inspection',       path: '/warehouse/qc' },
          { label: 'QC Rejections',       path: '/warehouse/qc-rejections' },
          { label: 'Inventory',           path: '/warehouse/inventory' },
          { label: '🏷️ Box Label Generator', path: '/ff-operations/labels', action: true },
          { label: '📦 Smart Inventory',       path: '/ff-operations/inventory' },
        ],
      },
      {
        icon: TrendingUp, label: 'Sales', path: '/sales',
        children: [
          { label: 'Sales Order',         path: '/sales/customers' },
          { label: 'Order Details',       path: '/sales/orders',                action: true },
          { label: 'Invoices',            path: '/sales/invoices' },
        ],
      },
      { icon: Truck,        label: 'Logistics',           path: '/logistics' },
      { icon: Wallet,       label: 'Finance / Payments',  path: '/finance/process-payments' },
      { icon: FileBarChart, label: 'Reports',             path: '/reports' },
    ],
  },
  {
    title: 'Payments',
    icon: CreditCard,
    roles: ['admin'],
    items: [
      { icon: Banknote,    label: 'Payment Audit',    path: '/admin-payments' },
      { icon: Search,      label: 'Payment Search',   path: '/payment-search' },
      { icon: Shield,      label: 'Payment Guardian', path: '/admin/payment-guardian' },
      { icon: Tags,        label: 'Payment Tags',     path: '/admin/payment-tags' },
      { icon: ShieldAlert, label: 'Auditor Audit',    path: '/admin/auditor-audit' },
    ],
  },
  {
    title: 'System',
    icon: Settings,
    roles: ['admin'],
    items: [
      { icon: Building2,      label: 'Departments',         path: '/departments' },
      { icon: BookOpen,       label: 'SOP Management',      path: '/admin/sop-management' },
      { icon: MessageSquarePlus, label: 'Announcements',   path: '/announcements' },
      { icon: Clock,          label: 'Shift Users',         path: '/admin/shift-users' },
      { icon: MapPin,         label: 'Geofencing',          path: '/admin/geofencing' },
      { icon: Volume2,        label: 'Notification Sounds', path: '/admin/notification-sounds' },
      { icon: Settings,       label: 'Cron Management',     path: '/admin/crons' },
    ],
  },
  // ── Admin — FF Payment Full Chain ────────────────────────────────────────────
  {
    title: 'FF Payment Pipeline',
    icon: Banknote,
    roles: ['admin'],
    items: [
      {
        icon: Banknote, label: 'Vendor Payments', path: '/ff-operations/payment-approvals',
        children: [
          { label: 'FF Ops Review',      path: '/ff-operations/payment-approvals' },
          { label: 'GM Approval',        path: '/gm/ff-payments' },
          { label: 'L1 Approval',        path: '/l1/payments' },
          { label: 'Auditor Approval',   path: '/auditor/ff-payments' },
          { label: 'CEO Final Approval', path: '/ceo/ff-payments' },
          { label: 'Accounts Payout',    path: '/accounts/ff-payments' },
        ],
      },
      {
        icon: Truck, label: 'Transport Payments', path: '/gm/ff-transport-payments',
        children: [
          { label: 'GM Approval',        path: '/gm/ff-transport-payments' },
          { label: 'L1 Approval',        path: '/l1/transport-payments' },
          { label: 'Auditor Approval',   path: '/auditor/ff-transport-payments' },
          { label: 'CEO Final Approval', path: '/ceo/ff-transport-payments' },
          { label: 'Accounts Payout',    path: '/accounts/ff-transport-payments' },
        ],
      },
      { icon: FileBarChart, label: 'FF Payments Report',    path: '/reports/ff-payments' },
      { icon: BarChart3,    label: 'FF Overview (CEO)',     path: '/ceo/ff-overview' },
    ],
  },
  // ── Admin — HR & Payroll ──────────────────────────────────────────────────────
  {
    title: 'HR & Payroll',
    icon: Wallet,
    roles: ['admin'],
    items: [
      { icon: Wallet,       label: 'Payroll Management',   path: '/hr/payroll' },
      { icon: Banknote,     label: 'Salary Sheet',         path: '/hr/sheet' },
      { icon: CheckCircle2, label: 'Salary Approval',      path: '/hr/approval' },
      { icon: Calculator,   label: 'Salary Calculation',   path: '/hr/salary-calculation' },
      { icon: CreditCard,   label: 'Payment Audit (HR)',   path: '/hr/payment-audit' },
      { icon: RotateCcw,    label: 'LOP Reversals',        path: '/ceo/lop-reversals' },
      { icon: Calendar,     label: 'Leave Approvals',      path: '/leave-approvals' },
    ],
  },
  // ── Admin — Reports ───────────────────────────────────────────────────────────
  {
    title: 'Reports',
    icon: FileBarChart,
    roles: ['admin'],
    items: [
      { icon: FileBarChart, label: 'Reports Dashboard',   path: '/reports' },
      { icon: Banknote,     label: 'FF Payments Report',  path: '/reports/ff-payments' },
      { icon: BarChart3,    label: 'Daily Sales',         path: '/reports/sales' },
      { icon: ShoppingCart, label: 'Purchase Report',     path: '/reports/purchase' },
      { icon: Boxes,        label: 'Inventory Report',    path: '/reports/inventory' },
      { icon: PieChart,     label: 'P&L Report',          path: '/reports/pl' },
      { icon: Truck,        label: 'Delivery Report',     path: '/reports/delivery' },
      { icon: BarChart3,    label: 'Custom Report',       path: '/reports/custom' },
      { icon: CreditCard,   label: 'Cash Collection',     path: '/reports/collection' },
    ],
  },
  // ── Admin — CEO-level controls ────────────────────────────────────────────────
  {
    title: 'Executive Controls',
    icon: Star,
    roles: ['admin'],
    items: [
      { icon: BarChart3,       label: 'CEO Dashboard',          path: '/ceo-dashboard' },
      { icon: ShieldCheck,     label: 'Intelligence Hub',       path: '/management/intelligence' },
      { icon: CreditCard,      label: 'CEO Payment Approvals',  path: '/ceo-approvals' },
      { icon: CheckSquare,     label: 'CEO Salary Approval',    path: '/ceo/salary-approval' },
      { icon: Package,         label: 'Procurement',            path: '/ceo/procurement' },
      { icon: ClipboardList,   label: 'Work Approvals',         path: '/ceo/work-orders' },
      { icon: BarChart3,       label: 'Weekly Perf. Hub',       path: '/performance-hub' },
      { icon: PieChart,        label: 'Project Spending',       path: '/project-spending' },
    ],
  },
  // ── Admin — Shift ─────────────────────────────────────────────────────────────
  {
    title: 'Shift',
    icon: Clock,
    roles: ['admin'],
    items: [
      { icon: LayoutDashboard, label: 'Shift Dashboard',  path: '/shift/dashboard' },
      { icon: Clock,           label: 'Shift Users Mgmt', path: '/admin/shift-users' },
    ],
  },
  // ── Admin — Sales & CRM ───────────────────────────────────────────────────────
  {
    title: 'Sales & CRM',
    icon: TrendingUp,
    roles: ['admin'],
    items: [
      { icon: TrendingUp,    label: 'Sales Dashboard',    path: '/sales' },
      { icon: Plus,          label: 'New Order',          path: '/sales/new-order' },
      { icon: ClipboardList, label: 'All Orders',         path: '/sales/orders' },
      { icon: Store,         label: 'App & Web Orders',   path: '/sales/app-orders' },
      { icon: Users,         label: 'Customers',          path: '/sales/customers' },
      { icon: Target,        label: 'Sales Targets',      path: '/sales/targets' },
      { icon: PhoneCall,     label: 'Tele-Caller CRM',    path: '/tele-caller' },
    ],
  },
  // ── Admin — Logistics ────────────────────────────────────────────────────────
  {
    title: 'Logistics',
    icon: Truck,
    roles: ['admin'],
    items: [
      { icon: LayoutDashboard, label: 'Logistics Dashboard', path: '/logistics' },
      { icon: Truck,           label: 'Driver View',         path: '/driver' },
      { icon: Truck,           label: 'Transport Analysis',  path: '/admin/transport-analysis' },
    ],
  },
  {
    title: 'Onboarding',
    icon: UserPlus,
    roles: ['admin'],
    items: [
      { icon: Shield, label: 'Admin Access', path: '/onboarding/admin-access' },
    ],
  },

  // ── FF OPERATIONS MANAGER ────────────────────────────────────────────────────
  {
    title: 'Operations Command',
    icon: LayoutDashboard,
    roles: ['ff_operations_manager'],
    items: [
      { icon: BarChart3,   label: '🏭 GM Dashboard',      path: '/ff-operations/gm-dashboard' },
      { icon: Store,       label: 'App & Web Orders',     path: '/sales/app-orders' },
      { icon: Target,      label: 'Task & Target Assign', path: '/ff-operations/task-assign' },
      { icon: Warehouse,   label: 'Hub Management',       path: '/admin/hubs' },
    ],
  },
  {
    title: 'Sales',
    icon: TrendingUp,
    roles: ['ff_operations_manager'],
    items: [
      {
        icon: TrendingUp, label: 'Sales', path: '/sales',
        children: [
          { label: 'Sales Dashboard', path: '/sales' },
          { label: 'All Orders',      path: '/sales/orders',      action: true },
          { label: 'Bulk Orders',     path: '/sales/bulk-order' },
          { label: 'Customers',       path: '/sales/customers' },
          { label: 'Invoices',        path: '/sales/invoices' },
        ],
      },
    ],
  },
  {
    title: 'Purchase',
    icon: ShoppingCart,
    roles: ['ff_operations_manager'],
    items: [
      {
        icon: ShoppingCart, label: 'Purchase', path: '/purchase',
        children: [
          { label: 'Purchase Dashboard',  path: '/purchase' },
          { label: 'Purchase Orders',     path: '/purchase/orders' },
          { label: '⚡ EOD PO Engine',    path: '/ff-operations/eod-po-engine' },
          { label: 'Vendors',             path: '/purchase/vendors' },
          { label: 'Payment Approvals',   path: '/ff-operations/payment-approvals', action: false },
          { label: '🏷️ Box Labels',       path: '/ff-operations/labels', action: true },
        ],
      },
    ],
  },
  {
    title: 'Warehouse & QC',
    icon: Warehouse,
    roles: ['ff_operations_manager'],
    items: [
      {
        icon: Warehouse, label: 'Warehouse & QC', path: '/warehouse',
        children: [
          { label: 'Warehouse Dashboard', path: '/warehouse' },
          { label: 'QC Inspection',       path: '/warehouse/qc' },
          { label: 'QC Rejections',       path: '/warehouse/qc-rejections' },
          { label: 'Inventory',           path: '/warehouse/inventory' },
          { label: '📦 Smart Inventory',  path: '/ff-operations/inventory' },
          { label: 'Returns',             path: '/warehouse/returns' },
        ],
      },
    ],
  },
  {
    title: 'Reports',
    icon: FileBarChart,
    roles: ['ff_operations_manager'],
    items: [
      { icon: FileBarChart, label: 'Reports Dashboard',    path: '/reports' },
      { icon: Banknote,     label: 'FF Payments Report',  path: '/reports/ff-payments' },
      { icon: BarChart3,    label: 'Daily Sales',         path: '/reports/sales' },
      { icon: ShoppingCart, label: 'Purchase Report',     path: '/reports/purchase' },
      { icon: Boxes,        label: 'Inventory Report',    path: '/reports/inventory' },
      { icon: PieChart,     label: 'P&L Report',          path: '/reports/pl' },
      { icon: Truck,        label: 'Delivery Report',     path: '/reports/delivery' },
    ],
  },

  // ── CEO ─────────────────────────────────────────────────────────────────────
  {
    title: 'Command Center',
    icon: LayoutDashboard,
    roles: ['ceo'],
    items: [
      { icon: LayoutDashboard, label: 'Dashboard',              path: '/ceo-dashboard' },
      { icon: AlertTriangle,   label: 'Escalations',            path: '/dashboard/escalations' },
      { icon: ShieldCheck,     label: 'Intelligence Hub',       path: '/management/intelligence' },
      { icon: Briefcase,       label: 'Dept Analytics',         path: '/ceo-departments' },
      { icon: BarChart3,       label: 'Weekly Performance Hub', path: '/performance-hub' },
      { icon: Coffee,          label: 'Palm Cafe Analysis',     path: '/ceo/cafe-analysis' },
      { icon: Database,        label: 'Vendor Master',          path: '/vendor-sourcing/dashboard' },
    ],
  },
  {
    title: 'Approvals',
    icon: CheckSquare,
    roles: ['ceo'],
    items: [
      { icon: CreditCard,    label: 'Payment Approvals', path: '/ceo-approvals' },
      { icon: CheckSquare,   label: 'Salary Approval',   path: '/ceo/salary-approval' },
      { icon: ClipboardList, label: 'Work Approvals',    path: '/ceo/work-orders' },
      { icon: Package,       label: 'Procurement',       path: '/ceo/procurement' },
      { icon: RotateCcw,     label: 'LOP Reversals',     path: '/ceo/lop-reversals' },
      { icon: Calendar,      label: 'Leave Approvals',   path: '/leave-approvals' },
    ],
  },
  {
    title: 'Projects',
    icon: FolderKanban,
    roles: ['ceo'],
    items: [
      { icon: Truck,         label: 'Project Overview',      path: '/sourcing-dashboard' },
      { icon: Package,       label: 'Procurement Tracking',  path: '/procurement-tracking' },
      { icon: FolderKanban,  label: 'Projects',              path: '/projects' },
      { icon: PieChart,      label: 'Project Spending',      path: '/project-spending' },
      { icon: CheckSquare,   label: 'Task Assignment',       path: '/task-assignment' },
    ],
  },
  {
    title: 'Administration',
    icon: Shield,
    roles: ['ceo'],
    items: [
      { icon: Activity,         label: 'Employee Activity',   path: '/employee-activity' },
      { icon: MessageSquarePlus,label: 'Announcements',       path: '/announcements' },
      { icon: User,             label: 'Employee Profiles',   path: '/admin/employee-profiles' },
      { icon: Shield,           label: 'Payment Guardian',    path: '/admin/payment-guardian' },
    ],
  },
  {
    title: 'Rentals',
    icon: Banknote,
    roles: ['ceo'],
    items: [
      { icon: CheckSquare,    label: 'Rental Approvals',  path: '/ceo/rentals/approvals' },
      { icon: LayoutDashboard,label: 'Rental Oversight',  path: '/ceo/rentals/portfolio' },
    ],
  },
  {
    title: 'Onboarding',
    icon: UserPlus,
    roles: ['ceo'],
    items: [
      { icon: Shield, label: 'CEO Access', path: '/onboarding/ceo-access' },
    ],
  },
  // ── CEO — FF Operations ───────────────────────────────────────────────────
  {
    title: 'FF Operations',
    icon: Store,
    roles: ['ceo'],
    items: [
      { icon: BarChart3,    label: 'FF Overview',           path: '/ceo/ff-overview' },
      { icon: Banknote,     label: 'FF Final Payments',     path: '/ceo/ff-payments' },
      { icon: Truck,        label: 'FF Transport Payments', path: '/ceo/ff-transport-payments' },
      { icon: FileBarChart, label: 'FF Payments Report',    path: '/reports/ff-payments' },
    ],
  },

  // ── Accounts ────────────────────────────────────────────────────────────────
  {
    title: 'Accounts Board',
    icon: Shield,
    roles: ['accounts'],
    items: [
      { icon: Layers,       label: 'Accounts Execution',    path: '/accounts-execution' },
      { icon: Banknote,     label: 'Salary Sheet',          path: '/accounts/salary-sheet' },
      { icon: Search,       label: 'Payment Search',        path: '/payment-search' },
    ],
  },
  {
    title: 'FF Payments',
    icon: Banknote,
    roles: ['accounts'],
    items: [
      { icon: Banknote,     label: 'FF Vendor Payments',    path: '/accounts/ff-payments' },
      { icon: Truck,        label: 'FF Transport Payments', path: '/accounts/ff-transport-payments' },
      { icon: FileBarChart, label: 'FF Payments Report',    path: '/reports/ff-payments' },
    ],
  },

  // ── Purchase Head ────────────────────────────────────────────────────────────
  {
    title: 'Command Center',
    icon: LayoutDashboard,
    roles: ['purchase_head'],
    items: [
      { icon: Truck, label: 'Purchase Dashboard', path: '/purchase-dashboard' },
    ],
  },

  // ── Vendor Head ──────────────────────────────────────────────────────────────
  {
    title: 'Command Center',
    icon: LayoutDashboard,
    roles: ['vendor_head'],
    items: [
      { icon: Truck, label: 'Vendor Sourcing', path: '/vendor-sourcing/dashboard' },
    ],
  },

  // ── Farm Manager ─────────────────────────────────────────────────────────────
  {
    title: 'Farm Operations',
    icon: LayoutDashboard,
    roles: ['farmmanager'],
    items: [
      { icon: BarChart3,    label: 'Farm Dashboard',    path: '/farm/dashboard' },
      { icon: Camera,       label: 'Site Updates',      path: '/site-manager/dashboard' },
      { icon: Package,      label: 'Project Inventory', path: '/inventory' },
      { icon: FolderKanban, label: 'Projects',          path: '/employee-projects' },
    ],
  },

  // ── Auditor — Payment Audit ONLY ─────────────────────────────────────────────
  {
    title: 'FF Payment Audit',
    icon: ShieldCheck,
    roles: ['auditor'],
    items: [
      { icon: Banknote,     label: 'Vendor Payments',    path: '/auditor/ff-payments',           badgeKey: 'auditor' },
      { icon: Truck,        label: 'Transport Payments', path: '/auditor/ff-transport-payments', badgeKey: 'auditor' },
      { icon: FileBarChart, label: 'FF Payments Report', path: '/reports/ff-payments' },
    ],
  },

  // ── Rental (RSH) ────────────────────────────────────────────────────────────
  {
    title: 'Rental Management',
    icon: Banknote,
    roles: ['rsh', 'RSH'],
    departments: ['rental sourcing'],
    items: [
      { icon: ClipboardList, label: 'My Rentals',       path: '/rsh/rentals' },
      { icon: History,       label: 'Payment History',  path: '/rentals/payment-history' },
    ],
  },

  // ── Weekly Productivity (core heads / managers) ───────────────────────────
  {
    title: 'Weekly Productivity',
    icon: BarChart3,
    roles: [
      'employee', 'admin', 'hr', 'ceo', 'gm', 'gmo', 'smo', 'nsm',
      'director', 'Director', 'auditor', 'rsh', 'RSH',
      'site_visit_farm_manager', 'farmmanager', 'palm_cafe_manager', 'cafe_manager', 'boi',
    ],
    items: [
      { icon: LayoutDashboard, label: 'Weekly Targets',      path: '/core-head/targets' },
      { icon: ClipboardCheck,  label: 'Weekly Achievements', path: '/core-head/achievements' },
    ],
  },

  // ── Site Visit ───────────────────────────────────────────────────────────────
  {
    title: 'Site Visit',
    icon: MapPin,
    roles: ['smo'],
    departments: ['site visit'],
    items: [
      { icon: LayoutDashboard, label: 'Visit Dashboard', path: '/site-visit-fm-dashboard' },
    ],
  },
  {
    title: 'Site Visit',
    icon: MapPin,
    roles: ['site_visit_farm_manager', 'farmmanager', 'employee', 'rsh', 'RSH', 'smo'],
    departments: ['rental sourcing', 'site visit', 'farm manager'],
    items: [
      { icon: LayoutDashboard, label: 'Visit Dashboard', path: '/site-visit-fm-dashboard' },
      { icon: Plus,            label: 'New Request',     path: '/site-visit-request/new' },
      { icon: History,         label: 'My Requests',     path: '/site-visit-request/my' },
    ],
  },

  // ── SALES TEAM (field_executive, bde, tele_caller) ──────────────────────────
  {
    title: 'Sales',
    icon: TrendingUp,
    roles: ['field_executive', 'bde', 'tele_caller', 'back_office'],
    items: [
      { icon: LayoutDashboard, label: 'Sales Dashboard',  path: '/sales' },
      { icon: Plus,            label: 'New Order',        path: '/sales/new-order' },
      { icon: Upload,          label: 'Bulk Order',       path: '/sales/bulk-order' },
      { icon: ClipboardList,   label: 'All Orders',       path: '/sales/orders' },
      { icon: Store,           label: 'App & Web Orders', path: '/sales/app-orders' },
      { icon: Users,           label: 'Customers',        path: '/sales/customers' },
      { icon: FileText,        label: 'Invoices',         path: '/sales/invoices' },
      { icon: Target,          label: 'Sales Targets',    path: '/sales/targets' },
    ],
  },
  {
    title: "Today's Tasks",
    icon: CheckCircle2,
    roles: ['field_executive', 'bde', 'tele_caller'],
    items: [
      { icon: CheckCircle2, label: "My Tasks Today", path: '/sales/task-today' },
    ],
  },
  {
    title: 'Purchase',
    icon: ShoppingCart,
    roles: ['field_executive', 'bde', 'tele_caller', 'back_office'],
    items: [
      { icon: ClipboardList,    label: 'Purchase Orders', path: '/purchase/orders' },
      { icon: Zap,              label: 'EOD PO Engine',   path: '/ff-operations/eod-po-engine' },
      { icon: Database,         label: 'Vendors',         path: '/purchase/vendors' },
    ],
  },
  {
    title: 'Reports',
    icon: FileBarChart,
    roles: ['field_executive', 'bde', 'tele_caller'],
    items: [
      { icon: BarChart3,  label: 'Daily Sales Report', path: '/reports/sales' },
      { icon: CreditCard, label: 'Cash Collection',    path: '/reports/collection' },
    ],
  },

  // ── Shift Dashboard — shift_employee, purchase_manager & purchase_head ─────────
  {
    title: 'Shift',
    icon: Clock,
    roles: ['shift_employee', 'purchase_manager', 'purchase_head'],
    items: [
      { icon: LayoutDashboard, label: 'Shift Dashboard', path: '/shift/dashboard' },
    ],
  },

  // ── PURCHASE EXECUTIVE (shift_employee, purchase_manager, purchase_head) ───────
  {
    title: 'My PO Queue',
    icon: ShoppingCart,
    roles: ['shift_employee', 'purchase_manager', 'purchase_head'],
    items: [
      { icon: LayoutDashboard, label: 'Purchase Dashboard',  path: '/purchase' },
      { icon: ClipboardList,   label: 'My Purchase Orders',  path: '/purchase/orders' },
      { icon: Package,         label: 'Buy (Go Purchase)',   path: '/purchase/buy' },
    ],
  },
  {
    title: 'Labels',
    icon: Tags,
    roles: ['shift_employee', 'purchase_manager', 'purchase_head'],
    items: [
      { icon: Package, label: 'Box Label Generator', path: '/ff-operations/labels' },
    ],
  },
  {
    title: 'Vendors',
    icon: Database,
    roles: ['shift_employee', 'purchase_manager', 'purchase_head'],
    items: [
      { icon: Database,   label: 'Vendors',         path: '/purchase/vendors' },
      { icon: BarChart3,  label: 'Rate Comparison', path: '/purchase/rate-comparison' },
      { icon: TrendingUp, label: 'Market Rates',    path: '/purchase/market-rates' },
    ],
  },
  {
    title: 'Payments',
    icon: CreditCard,
    roles: ['shift_employee', 'purchase_manager', 'purchase_head'],
    items: [
      { icon: Plus,        label: 'New FF Vendor Payment',    path: '/ff/vendor-payment/new' },
      { icon: History,     label: 'My Submitted Payments',    path: '/my-submitted-payments' },
      { icon: History,     label: 'Payments Made',            path: '/purchase/payments-made' },
    ],
  },

  // ── Shift Dashboard — hub_manager ────────────────────────────────────────────
  {
    title: 'Shift',
    icon: Clock,
    roles: ['hub_manager'],
    items: [
      { icon: LayoutDashboard, label: 'Shift Dashboard', path: '/shift/dashboard' },
    ],
  },

  // ── HUB MANAGER (unified: warehouse + QC + inventory) ────────────────────────
  {
    title: 'My Hub',
    icon: Warehouse,
    roles: ['hub_manager'],
    items: [
      { icon: LayoutDashboard, label: 'Warehouse Dashboard', path: '/warehouse' },
      { icon: PackageCheck,    label: 'QC Inspection',       path: '/warehouse/qc' },
      { icon: FileText,        label: 'QC Rejections',       path: '/warehouse/qc-rejections' },
      { icon: RotateCcw,       label: 'Returns',             path: '/warehouse/returns' },
    ],
  },
  {
    title: 'Payments',
    icon: Banknote,
    roles: ['hub_manager'],
    items: [
      { icon: Plus,        label: 'New Vendor Payment',    path: '/ff/vendor-payment/new' },
      { icon: Truck,       label: 'New Transport Payment', path: '/ff/transport-payment/new' },
      { icon: History,     label: 'My Submitted Payments', path: '/my-submitted-payments' },
    ],
  },
  {
    title: 'Inventory',
    icon: Boxes,
    roles: ['hub_manager'],
    items: [
      { icon: Package, label: 'Inventory Dashboard', path: '/warehouse/inventory' },
      { icon: Boxes,   label: 'Smart Inventory',     path: '/ff-operations/inventory' },
    ],
  },
  {
    title: 'Reports',
    icon: FileBarChart,
    roles: ['hub_manager'],
    items: [
      { icon: Boxes, label: 'Inventory Report', path: '/reports/inventory' },
    ],
  },

  // ── L1 MANAGER — Payment Approvals ONLY ─────────────────────────────────────
  {
    title: 'L1 Payment Approvals',
    icon: CheckSquare,
    roles: ['l1_manager'],
    items: [
      { icon: Banknote,     label: 'Vendor Payments',    path: '/l1/payments',           badgeKey: 'l1' },
      { icon: Truck,        label: 'Transport Payments', path: '/l1/transport-payments', badgeKey: 'l1' },
      { icon: FileBarChart, label: 'FF Payments Report', path: '/reports/ff-payments' },
    ],
  },

  // ── Tele-Caller CRM ───────────────────────────────────────────────────────────
  {
    title: 'Tele-Caller CRM',
    icon: PhoneCall,
    roles: ['tele_caller', 'back_office'],
    items: [
      { icon: LayoutDashboard, label: 'CRM Dashboard', path: '/tele-caller' },
    ],
  },

  // ── Logistics (Driver) ────────────────────────────────────────────────────────
  {
    title: 'Logistics',
    icon: Truck,
    roles: ['driver'],
    items: [
      { icon: LayoutDashboard, label: 'Trips Dashboard', path: '/logistics' },
      { icon: Truck,           label: 'Driver View',     path: '/driver' },
    ],
  },

  // ── Product Catalog ───────────────────────────────────────────────────────────
  {
    title: 'Product Catalog',
    icon: Store,
    roles: ['purchase_manager', 'purchase_head', 'back_office'],
    items: [
      { icon: Package, label: 'All Products', path: '/catalog' },
      { icon: Plus,    label: 'Add Product',  path: '/catalog/new' },
    ],
  },

  // ── Finance & Reports (back_office) ──────────────────────────────────────────
  {
    title: 'Finance',
    icon: Wallet,
    roles: ['back_office'],
    items: [
      { icon: LayoutDashboard, label: 'Finance Dashboard', path: '/finance' },
    ],
  },
  {
    title: 'Reports',
    icon: FileBarChart,
    roles: ['back_office'],
    items: [
      { icon: FileBarChart, label: 'Reports Dashboard', path: '/reports' },
      { icon: PieChart,     label: 'P&L Report',        path: '/reports/pl' },
      { icon: BarChart3,    label: 'Custom Report',     path: '/reports/custom' },
    ],
  },
];

// ── Sidebar Component ─────────────────────────────────────────────────────────
export function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { dayStart } = useDayStart(new Date());
  const { isCoreHead } = useIsCoreHead();
  const pendingCounts = useFFPaymentCount();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Auto-expand if a child route is active
  useEffect(() => {
    navigationConfig.forEach(group => {
      group.items.forEach(item => {
        if (item.children) {
          const childActive = item.children.some(c => location.pathname.startsWith(c.path));
          if (childActive) {
            setExpandedItems(prev => new Set([...prev, item.path]));
          }
        }
      });
    });
  }, [location.pathname]);

  const toggleExpand = (path: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  if (!user) return null;

  const userRole = (user.role || 'employee').toLowerCase();
  const userDepartment = user.department?.toLowerCase() || '';

  const filteredGroups = navigationConfig.filter(group => {
    if (group.items.length === 0) return false;

    if (group.title.toLowerCase().includes('palm cafe') && group.roles.includes('palm_cafe_manager')) {
      return userRole.includes('cafe') || userDepartment.includes('cafe');
    }

    if (group.title === 'Weekly Productivity') {
      return isCoreHead || ['palm_cafe_manager', 'cafe_manager'].includes(userRole);
    }

    const roleMatches = group.roles.some(r => r.toLowerCase() === userRole);
    if (!roleMatches) return false;

    if (userRole !== 'admin' && userRole !== 'ceo') {
      if (group.departments && group.departments.length > 0) {
        const inAllowedDept = group.departments.some(d => userDepartment.includes(d.toLowerCase()));
        if (!inAllowedDept) return false;
      }
      if (group.excludeDepartments && group.excludeDepartments.length > 0) {
        const inExcludedDept = group.excludeDepartments.some(d => userDepartment.includes(d.toLowerCase()));
        if (inExcludedDept) return false;
      }
    }

    return true;
  });

  return (
    <aside className="flex flex-col w-[240px] h-full shrink-0"
      style={{ background: '#FFFFFF', borderRight: '1px solid #E5E7EB' }}>

      {/* Scrollable nav */}
      <div className="flex-1 overflow-y-auto py-3">
        <nav>
          {filteredGroups.map((group, groupIdx) => {
            const GroupIcon = group.icon;
            const isFirst = groupIdx === 0;

            return (
              <div key={`${group.title}-${group.roles.join('-')}-${(group.departments || []).join('-')}`}
                className={cn('pb-1', !isFirst && 'mt-3')}>

                {/* Section label */}
                {!isFirst && (
                  <div className="mx-4 mb-2" style={{ borderTop: '1px solid #F3F4F6' }} />
                )}
                <div className="flex items-center gap-1.5 px-4 pt-1 pb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: '#9CA3AF' }}>
                    {group.title}
                  </span>
                </div>

                {/* Nav items */}
                <div className="space-y-0.5 px-2">
                  {group.items.map((item) => {
                    const Icon = item.icon;

                    if (item.path === '/cafe/manager' && !(userRole.includes('cafe') || userDepartment.includes('cafe'))) return null;
                    if (item.label.includes('Visit Dashboard') && !['smo', 'admin', 'ceo', 'site_visit_farm_manager'].includes(userRole)) return null;
                    if (userRole === 'employee' && (userDepartment.includes('jv') || userDepartment.includes('joint venture'))) {
                      const hiddenItems = ['Payment Request', 'My Escalations', 'Escalation Audit', 'Audits'];
                      if (hiddenItems.some(l => item.label.includes(l))) return null;
                    }

                    // ── Expandable item with children ──────────────────────
                    if (item.children && item.children.length > 0) {
                      const isExpanded = expandedItems.has(item.path);
                      const isParentActive = location.pathname === item.path || item.children.some(c => location.pathname.startsWith(c.path));

                      return (
                        <div key={item.path}>
                          {/* Parent row */}
                          <button
                            onClick={() => toggleExpand(item.path)}
                            className={cn(
                              'w-full flex items-center gap-2.5 py-2 pr-2 pl-[9px] rounded-xl text-[13px] font-medium transition-all duration-150 border-l-[3px]',
                              isParentActive
                                ? 'bg-[#EFF6FF] text-[#2563EB] border-l-[#2563EB]'
                                : 'text-[#6B7280] border-l-transparent hover:bg-[#F9FAFB] hover:text-[#374151]'
                            )}
                          >
                            <Icon className="w-[14px] h-[14px] shrink-0" />
                            <span className="truncate leading-none flex-1 text-left">{item.label}</span>
                            {isExpanded
                              ? <ChevronDown className="w-3 h-3 shrink-0 opacity-60" />
                              : <ChevronRightIcon className="w-3 h-3 shrink-0 opacity-40" />
                            }
                          </button>

                          {/* Children */}
                          {isExpanded && (
                            <div className="mt-0.5 ml-3 pl-3 space-y-0.5" style={{ borderLeft: '2px solid #E5E7EB' }}>
                              {item.children.map(child => (
                                <NavLink
                                  key={child.path}
                                  to={child.path}
                                  className={({ isActive }) => cn(
                                    'flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg text-[12px] font-medium transition-all duration-150',
                                    isActive
                                      ? 'bg-[#EFF6FF] text-[#2563EB]'
                                      : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#374151]'
                                  )}
                                >
                                  <span className="truncate">{child.label}</span>
                                  {child.action && (
                                    <span
                                      onClick={e => { e.preventDefault(); e.stopPropagation(); navigate(child.path + '/new'); }}
                                      className="w-4 h-4 rounded flex items-center justify-center shrink-0 hover:bg-[#DBEAFE] transition-colors"
                                      style={{ color: '#2563EB' }}
                                    >
                                      <Plus className="w-3 h-3" />
                                    </span>
                                  )}
                                </NavLink>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }

                    // ── Regular item ──────────────────────────────────────
                    const badgeCount = item.badgeKey ? (pendingCounts[item.badgeKey] || 0) : 0;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => cn(
                          'flex items-center gap-2.5 py-2 pr-3 rounded-xl text-[13px] font-medium transition-all duration-150 border-l-[3px]',
                          isActive
                            ? 'bg-[#EFF6FF] text-[#2563EB] border-l-[#2563EB] pl-[9px]'
                            : 'text-[#6B7280] border-l-transparent pl-[9px] hover:bg-[#F9FAFB] hover:text-[#374151]'
                        )}
                      >
                        <Icon className="w-[14px] h-[14px] shrink-0" />
                        <span className="truncate leading-none flex-1">{item.label}</span>
                        {badgeCount > 0 && (
                          <span className="ml-auto shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="px-2 py-3 space-y-1" style={{ borderTop: '1px solid #F3F4F6', background: '#FFFFFF' }}>
        {(userRole === 'employee' || userRole === 'auditor') && dayStart && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-1"
            style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
            <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: '#2563EB' }} />
            <div className="min-w-0 flex-1">
              <p className="text-[9px] uppercase tracking-wider leading-none" style={{ color: '#93C5FD' }}>Logged in</p>
              <p className="text-[12px] font-bold leading-tight tabular-nums" style={{ color: '#2563EB' }}>
                {format(new Date(dayStart.submitted_at), 'HH:mm')}
              </p>
            </div>
            {user.employeeId && (
              <span className="text-[10px] font-medium shrink-0" style={{ color: '#93C5FD' }}>{user.employeeId}</span>
            )}
          </div>
        )}

        {(user?.role === 'admin' || user?.role === 'ceo') && (
          <div className="flex justify-center px-1 mb-1">
            <ThemeSelector />
          </div>
        )}

        <a
          href="https://forms.gle/WDoNcZUXkp7BYZvZ7"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] font-medium transition-all duration-150"
          style={{ color: '#9CA3AF' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = '#F9FAFB';
            (e.currentTarget as HTMLElement).style.color = '#374151';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = '#9CA3AF';
          }}
        >
          <MessageSquarePlus className="w-3.5 h-3.5 shrink-0" />
          <span>Feedback &amp; Suggestions</span>
        </a>
      </div>
    </aside>
  );
}

