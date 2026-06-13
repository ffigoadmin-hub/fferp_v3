import { useAuth } from '@/contexts/AuthContext';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useDayStart } from '@/hooks/useDayStart';
import { useIsCoreHead } from '@/hooks/useIsCoreHead';
import { format } from 'date-fns';
import { useState } from 'react';
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
  BarChart3,
  Banknote,
  FileSearch,
  Search,
  Calendar,
  FolderKanban,
  AlertTriangle,
  User,
  MessageSquarePlus,
  Camera,
  ChevronDown,
  ChevronRight,
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
  X,
  Home,
  Coffee,
  ChefHat,
  Zap,
  Database,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import igoLogo from '@/assets/igo-logo.png';

interface MobileSidebarProps {
  onClose: () => void;
}

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

interface NavGroup {
  title: string;
  icon: React.ElementType;
  roles: string[];
  items: NavItem[];
  defaultOpen?: boolean;
  departments?: string[];
  excludeDepartments?: string[];
}

// Same navigation config as Sidebar
const navigationConfig: NavGroup[] = [
  // Daily Workflow — all roles except shift/purchase exec
  {
    title: 'Daily Workflow',
    icon: Clock,
    roles: [
      'employee', 'director', 'Director', 'vendor_head',
      'nsm', 'datateam', 'data_team', 'data', 'boi', 'gmo', 'smo', 'hr', 'gm', 'admin',
      'accounts', 'farmmanager', 'bd_data', 'rsh', 'RSH', 'site_visit_farm_manager',
      'cafe_manager', 'palm_cafe_manager', 'ff_operations_manager',
      'bde', 'field_executive', 'back_office', 'tele_caller', 'driver',
      'warehouse_manager', 'qc_manager',
      // purchase_manager, purchase_head, shift_employee → trimmed section below
      // hub_manager → trimmed section below
    ],
    defaultOpen: true,
    items: [
      { icon: Home, label: 'My Dashboard', path: '/employee-dashboard' },
      { icon: Clock, label: 'Login', path: '/day-start' },
      { icon: Timer, label: 'Hourly Plan & Report', path: '/hourly-report' },
      { icon: ClipboardList, label: 'Day Plan', path: '/day-plan' },
      { icon: FileText, label: 'EOD Summary', path: '/eod-summary' },
      { icon: Calendar, label: 'Company Calendar', path: '/company-calendar' },
      { icon: CheckSquare, label: 'My Tasks', path: '/my-tasks' },
      { icon: AlertTriangle, label: 'My LOP / Discipline', path: '/my-lop' },
      { icon: AlertTriangle, label: 'My Escalations', path: '/dashboard/my-escalations' },
      { icon: Calendar, label: 'Leave Request', path: '/leave-request' },
      { icon: CreditCard, label: 'Payment Request', path: '/payment-request' },
      { icon: FileText, label: 'My Payslip', path: '/my-payslips' },
      { icon: History, label: 'My Requests', path: '/my-requests' },
      { icon: Coffee, label: 'PALM CAFE', path: '/palm-cafe' },
      { icon: MessageSquare, label: 'Chat', path: '/chat' },
    ],
  },

  // Daily Workflow — Purchase Exec / Shift Employee (trimmed)
  {
    title: 'Daily Workflow',
    icon: Clock,
    roles: ['purchase_manager', 'purchase_head', 'shift_employee', 'hub_manager'],
    defaultOpen: true,
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
  {
    title: 'PALM CAFE ',
    icon: ChefHat,
    roles: ['palm_cafe_manager', 'cafe_manager'],
    defaultOpen: true,
    items: [
      { icon: LayoutDashboard, label: 'Order Receiving', path: '/cafe/manager' },
    ],
  },
  {
    title: 'Director Board',
    icon: Shield,
    roles: ['director', 'Director'],
    defaultOpen: true,
    items: [
      { icon: LayoutDashboard, label: 'Audit Dashboard', path: '/dashboard/director' },
      { icon: Activity, label: 'Employee Activity', path: '/employee-activity' },
      { icon: CheckSquare, label: 'Salary Audit (Upload)', path: '/director/salary-audit' },
      { icon: Banknote, label: 'Salary Batches', path: '/hr/sheet' },
      { icon: Search, label: 'Payment Search', path: '/payment-search' },
    ],
  },

  {
    title: 'Work',
    icon: Briefcase,
    roles: ['employee'],
    departments: ['engineering'],
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/engineer-dashboard' },
      { icon: FolderKanban, label: 'My Projects', path: '/employee-projects' },
      { icon: ShieldCheck, label: 'Escalation Audit', path: '/admin/escalation-closure' },
      { icon: AlertTriangle, label: 'All Tickets', path: '/dashboard/escalations' },
    ],
  },
  {
    title: 'Work',
    icon: Briefcase,
    roles: ['employee'], // Removed director from department-specific group
    departments: ['business development', 'bd'],
    items: [
      { icon: Plus, label: 'Create Project', path: '/projects/new' },
      { icon: FolderKanban, label: 'Project History', path: '/projects' },
      { icon: ShieldCheck, label: 'Escalation Audit', path: '/admin/escalation-closure' },
      { icon: AlertTriangle, label: 'All Tickets', path: '/dashboard/escalations' },
    ],
  },

  {
    title: 'Command Center',
    icon: LayoutDashboard,
    roles: ['nsm'],
    defaultOpen: true,
    items: [
      { icon: BarChart3, label: 'NSM Dashboard', path: '/nsm-dashboard' },
      { icon: ShieldCheck, label: 'Escalation Audit', path: '/admin/escalation-closure' },
      { icon: Zap, label: 'Criticals Audit', path: '/admin/criticals-audit' },
      { icon: AlertTriangle, label: 'All Tickets', path: '/dashboard/escalations' },
    ],
  },

  {
    title: 'Command Center',
    icon: LayoutDashboard,
    roles: ['datateam', 'data_team', 'data'],
    items: [
      { icon: BarChart3, label: 'Create Critical', path: '/datateam-dashboard' },
      { icon: FileSearch, label: 'WO Audits', path: '/datateam/wo-audits' },
      { icon: AlertTriangle, label: 'All Tickets', path: '/dashboard/escalations' },
      { icon: ShieldCheck, label: 'Escalation Audit', path: '/admin/escalation-closure' },
      { icon: Zap, label: 'Criticals Audit', path: '/admin/criticals-audit' },
    ],
  },


  {
    title: 'Command Center',
    icon: LayoutDashboard,
    roles: ['boi'],
    items: [
      { icon: BarChart3, label: 'BOI Dashboard', path: '/dashboard/boi' },
      { icon: CreditCard, label: 'Payment Audit', path: '/dashboard/boi/payments' },
      { icon: FolderKanban, label: 'Projects', path: '/projects' },
    ],
  },

  {
    title: 'Command Center',
    icon: LayoutDashboard,
    roles: ['gmo'],
    items: [
      { icon: BarChart3, label: 'Dashboard', path: '/dashboard/gmo' },
      { icon: Inbox, label: 'New Deals', path: '/gmo/new-deals' },
      { icon: Truck, label: 'Project Overview', path: '/sourcing-dashboard' },
      { icon: CheckSquare, label: 'Project Approvals', path: '/gmo/boq-approvals' },
      { icon: FolderKanban, label: 'Projects', path: '/dashboard/gmo/projects' },
      { icon: CreditCard, label: 'Payment Audit', path: '/dashboard/gmo/payments' },
      { icon: Wallet, label: 'Project Financials', path: '/gmo/project-financials' },
      { icon: Activity, label: 'Engineering Team', path: '/dashboard/gmo/engineering-team' },
      { icon: PieChart, label: 'Project Spending', path: '/project-spending' },
      { icon: AlertTriangle, label: 'My Escalations', path: '/dashboard/my-escalations' },
      { icon: Plus, label: 'Raise Escalation', path: '/nsm-dashboard?create=true' },
    ],

  },

  {
    title: 'Command Center',
    icon: LayoutDashboard,
    roles: ['smo'],
    excludeDepartments: ['rental sourcing', 'site visit'], // Site Visit SMO team doesn't need this
    items: [
      { icon: BarChart3, label: 'Dashboard', path: '/dashboard/smo' },
      { icon: CreditCard, label: 'Payment Audit', path: '/dashboard/smo/payments' },
      { icon: AlertTriangle, label: 'All Tickets', path: '/dashboard/smo/tickets' },
    ],
  },

  {
    title: 'Execution',
    icon: Truck,
    roles: ['smo'],
    excludeDepartments: ['rental sourcing', 'site visit'], // Site Visit SMO team doesn't need this
    items: [
      { icon: ClipboardCheck, label: 'Project Approvals', path: '/smo/boq-approvals' },
      { icon: Truck, label: 'Project Overview', path: '/sourcing-dashboard' },
      { icon: FolderKanban, label: 'Project Execution (All)', path: '/employee-projects' },
      { icon: FolderKanban, label: 'Projects (Manager)', path: '/dashboard/smo/projects' },
    ],
  },

  {
    title: 'Command Center',
    icon: LayoutDashboard,
    roles: ['hr'],
    items: [
      { icon: ShieldCheck, label: 'Intelligence Hub', path: '/management/intelligence' },
      { icon: Activity, label: 'Employee Activity', path: '/employee-activity' },
      { icon: Camera, label: 'Selfie Attendance', path: '/selfie-attendance' },
      { icon: Calendar, label: 'Attendance Calendar', path: '/attendance-calendar' },
      { icon: ClipboardList, label: 'Attendance Roster', path: '/admin/attendance-roster' },
      { icon: Users, label: 'Employee Directory', path: '/employee-directory' },
      { icon: History, label: 'New User Status & History', path: '/onboarding/hr-access' },
      { icon: CreditCard, label: 'Payment Audit', path: '/hr/payment-audit' },
      { icon: BarChart3, label: 'Weekly Performance Hub', path: '/performance-hub' },
    ],
  },

  {
    title: 'Leave & LOP',
    icon: Calendar,
    roles: ['hr'],
    items: [
      { icon: AlertTriangle, label: 'LOP Management', path: '/lop-management' },
      { icon: Calendar, label: 'Leave Approvals', path: '/leave-approvals' },
      { icon: Calendar, label: 'Week Off Management', path: '/admin/week-off-management' },
    ],
  },

  {
    title: 'Command Center',
    icon: LayoutDashboard,
    roles: ['gm'],
    items: [
      { icon: BarChart3, label: 'Dashboard', path: '/gm-dashboard' },
      { icon: AlertTriangle, label: 'All Tickets', path: '/dashboard/escalations' },
      { icon: Truck, label: 'Project Overview', path: '/sourcing-dashboard' },
      { icon: FolderKanban, label: 'Projects', path: '/projects' },
      { icon: CreditCard, label: 'Payment Audit', path: '/dashboard/gm/payments' },
      { icon: Search, label: 'Payment Search', path: '/payment-search' },
      { icon: PieChart, label: 'Project Spending', path: '/project-spending' },
      { icon: Database, label: 'Vendor Master', path: '/vendor-sourcing/dashboard' },
      { icon: BarChart3, label: 'Weekly Core Manager Performance', path: '/performance-hub' },
    ],
  },

  {
    title: 'Command Center',
    icon: LayoutDashboard,
    roles: ['admin'],
    items: [
      { icon: BarChart3, label: 'Dashboard', path: '/admin-dashboard' },
      { icon: ShieldCheck, label: 'Intelligence Hub', path: '/management/intelligence' },
      { icon: Bot, label: 'AI Assistant', path: '/admin/ai-assistant' },
      { icon: Settings, label: 'AI Command Center', path: '/admin/ai-command-center' },
      { icon: AlertTriangle, label: 'Escalation Closure', path: '/admin/escalation-closure' },
      { icon: AlertTriangle, label: 'Criticals Audit', path: '/admin/criticals-audit' },
      { icon: Truck, label: 'Project Overview', path: '/sourcing-dashboard' },
      { icon: FolderKanban, label: 'Projects', path: '/projects' },
      { icon: PieChart, label: 'Project Spending', path: '/project-spending' },
      { icon: Users, label: 'Team', path: '/employee-directory' },
    ],
  },
  {
    title: 'Approvals',
    icon: CheckSquare,
    roles: ['admin'],
    items: [
      { icon: Banknote, label: 'Payment Audit', path: '/admin-payments' },
      { icon: ShieldAlert, label: 'Auditor Payment Audit', path: '/admin/auditor-audit' },
      { icon: Calendar, label: 'Leave Approvals', path: '/leave-approvals' },
      { icon: Truck, label: 'Transport Analysis', path: '/admin/transport-analysis' },
    ],
  },
  {
    title: 'Payments',
    icon: CreditCard,
    roles: ['admin'],
    items: [
      { icon: Search, label: 'Payment Search', path: '/payment-search' },
    ],
  },

  /* 
  // HIDDEN AS PER USER REQUEST - Accounts Execution removed from Admin sidebar
  {
    title: 'Accounts Execution',
    icon: Banknote,
    roles: ['admin'],
    items: [
      { icon: Layers, label: 'Batch Processing', path: '/accounts-execution?tab=batches' },
      { icon: Wallet, label: 'Petty Cash', path: '/accounts-execution?tab=petty-cash' },
      { icon: Search, label: 'UTR Matching', path: '/accounts-execution?tab=utr-matching' },
      { icon: FileBarChart, label: 'Reports', path: '/accounts-execution?tab=reports' },
    ],
  },
  */

  {
    title: 'Administration',
    icon: Shield,
    roles: ['admin'],
    items: [
      { icon: Lock, label: 'Attendance Lock Management', path: '/admin/lockouts' },
      { icon: Users, label: 'User Management', path: '/user-management' },
      { icon: Building2, label: 'Departments', path: '/departments' },
      { icon: Clock, label: 'Shift Users', path: '/admin/shift-users' },
      { icon: Shield, label: 'Role Management', path: '/role-management' },
      { icon: Users, label: 'Employee Directory', path: '/employee-directory' },
      { icon: Camera, label: 'Selfie Attendance', path: '/selfie-attendance' },
      { icon: ClipboardList, label: 'Attendance Roster', path: '/admin/attendance-roster' },
      { icon: ClipboardList, label: 'LOP Register', path: '/admin-lop' },
      { icon: Calendar, label: 'Week Off Management', path: '/admin/week-off-management' },
      { icon: MessageSquarePlus, label: 'Announcements', path: '/announcements' },
      { icon: FileSearch, label: 'Audit Logs', path: '/audit-logs' },
      { icon: CheckSquare, label: 'Task Assignment', path: '/task-assignment' },
      { icon: Settings, label: 'Cron Management', path: '/admin/crons' },
      { icon: Volume2, label: 'Notification Sounds', path: '/admin/notification-sounds' },
      { icon: MapPin, label: 'Geofencing', path: '/admin/geofencing' },
      { icon: Tags, label: 'Payment Tags', path: '/admin/payment-tags' },
      { icon: Shield, label: 'Payment Guardian', path: '/admin/payment-guardian' },
    ],
  },

  // CEO Groups - CEO does NOT need Daily Workflow
  {
    title: 'Command Center',
    icon: LayoutDashboard,
    roles: ['ceo'],
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/ceo-dashboard' },
      { icon: AlertTriangle, label: 'Escalations', path: '/dashboard/escalations' },
      { icon: ShieldCheck, label: 'Intelligence Hub', path: '/management/intelligence' },
      { icon: Briefcase, label: 'Dept Analytics', path: '/ceo-departments' },
      { icon: BarChart3, label: 'Weekly Performance Hub', path: '/performance-hub' },
      { icon: Coffee, label: 'Palm Cafe Analysis', path: '/ceo/cafe-analysis' },
      { icon: Database, label: 'Vendor Master', path: '/vendor-sourcing/dashboard' },
    ],
  },
  {
    title: 'Approvals',
    icon: CheckSquare,
    roles: ['ceo'],
    items: [
      { icon: CreditCard, label: 'Payment Approvals', path: '/ceo-approvals' },
      { icon: CheckSquare, label: 'Salary Approval', path: '/ceo/salary-approval' },
      { icon: ClipboardList, label: 'Work Approvals', path: '/ceo/work-orders' },
      { icon: Package, label: 'Procurement', path: '/ceo/procurement' },
      { icon: RotateCcw, label: 'LOP Reversals', path: '/ceo/lop-reversals' },
      { icon: Calendar, label: 'Leave Approvals', path: '/leave-approvals' },
    ],
  },

  {
    title: 'Projects',
    icon: FolderKanban,
    roles: ['ceo'],
    items: [
      { icon: Truck, label: 'Project Overview', path: '/sourcing-dashboard' },
      { icon: Package, label: 'Procurement Tracking', path: '/procurement-tracking' },
      { icon: FolderKanban, label: 'Projects', path: '/projects' },
      { icon: PieChart, label: 'Project Spending', path: '/project-spending' },
      { icon: CheckSquare, label: 'Task Assignment', path: '/task-assignment' },
    ],
  },
  {
    title: 'Administration',
    icon: Shield,
    roles: ['ceo'],
    items: [
      { icon: Activity, label: 'Employee Activity', path: '/employee-activity' },
      { icon: MessageSquarePlus, label: 'Announcements', path: '/announcements' },
      { icon: Calendar, label: 'Attendance Calendar', path: '/company-calendar' },
      { icon: LayoutDashboard, label: "Dashboard", path: "/" },
      { icon: MessageSquare, label: "Chat", path: "/chat" },
      { icon: Users, label: "Employee Directory", path: "/directory" },
      { icon: Shield, label: 'Payment Guardian', path: '/admin/payment-guardian' },
    ],
  },

  {
    title: 'Accounts Board',
    icon: Shield,
    roles: ['accounts'],
    items: [
      { icon: Banknote, label: 'Salary Sheet', path: '/accounts/salary-sheet' },
      { icon: CheckSquare, label: 'Salary Execution', path: '/accounts/salary-execution' },
      { icon: Banknote, label: 'Salary Batches', path: '/accounts/salary-batches' },
      { icon: Search, label: 'Payment Search', path: '/payment-search' },
    ],
  },


  // Purchase Team - Command Center section
  {
    title: 'HR & Payroll',
    icon: Wallet,
    roles: ['hr', 'accounts'],
    items: [
      { icon: Users, label: 'Employee Master', path: '/hr/employee-master' },
      { icon: Banknote, label: 'Salary Sheet', path: '/hr/sheet' },
      { icon: CheckSquare, label: 'Salary Approval', path: '/hr/approval' },
    ],
  },
  {
    title: 'Salary Management',
    icon: Wallet,
    roles: ['ceo'],
    items: [
      { icon: Banknote, label: 'Salary Batches', path: '/hr/sheet' },
      { icon: CheckSquare, label: 'Salary Approval (Legacy)', path: '/hr/approval' },
    ],
  },
  {
    title: 'Salary Execution',
    icon: Wallet,
    roles: ['accounts'],
    items: [
      { icon: CheckSquare, label: 'Process Payments', path: '/accounts/salary-execution' },
    ],
  },


  // Purchase Team - Command Center section
  {
    title: 'Command Center',
    icon: LayoutDashboard,
    roles: ['purchase_head'],
    items: [
      { icon: Truck, label: 'Purchase Dashboard', path: '/purchase-dashboard' },
    ],
  },
  // Purchase Team - Requests section


  // Vendor Team - Command Center
  {
    title: 'Command Center',
    icon: LayoutDashboard,
    roles: ['vendor_head'],
    items: [
      { icon: Truck, label: 'Vendor Sourcing', path: '/vendor-sourcing/dashboard' },
    ],
  },
  // Vendor Team - Requests section




  {
    title: 'Farm Operations',
    icon: LayoutDashboard,
    roles: ['farmmanager'],
    items: [
      { icon: BarChart3, label: 'Farm Dashboard', path: '/farm/dashboard' },
      { icon: Camera, label: 'Site Updates', path: '/site-manager/dashboard' },
      { icon: Package, label: 'Project Inventory', path: '/inventory' },
      { icon: Truck, label: 'Delivery Audit', path: '/farm/delivery-audit' },
      { icon: FolderKanban, label: 'Projects', path: '/employee-projects' },
    ],
  },


  {
    title: 'Work',
    icon: Briefcase,
    roles: ['bd_data'],
    items: [
      { icon: Plus, label: 'Create Project', path: '/projects/new' },
      { icon: FolderKanban, label: 'Project History', path: '/projects' },
      { icon: ShieldCheck, label: 'Escalation Audit', path: '/admin/escalation-closure' },
      { icon: Zap, label: 'Criticals Audit', path: '/admin/criticals-audit' },
      { icon: AlertTriangle, label: 'All Tickets', path: '/dashboard/escalations' },
    ],
  },
 {
    title: 'Audit Intelligence',
    icon: Search,
    roles: ['auditor'],
    defaultOpen: true,
    items: [
      { icon: BarChart3, label: 'National Head Auditor', path: '/auditor-dashboard' },
      { icon: CreditCard, label: 'Payment Audit', path: '/auditor/payment-audit' },
      { icon: CheckSquare, label: 'Salary Audit', path: '/director/salary-audit' },
      { icon: ShieldCheck, label: 'Intelligence Hub', path: '/management/intelligence' },
      { icon: ClipboardList, label: 'LOP List', path: '/admin-lop' },
      { icon: Calendar, label: 'Attendance Calendar', path: '/attendance-calendar' },
      { icon: Users, label: 'Employee Directory', path: '/employee-directory' },
    ],
  },


  // Rental Management - Distributed
  {
    title: 'Rental Management',
    icon: Banknote,
    roles: ['admin'],
    items: [
      { icon: Settings, label: 'Master Setup', path: '/admin/rentals/setup' },
      { icon: BarChart3, label: 'Audit Dashboard', path: '/admin-rentals' },
    ],
  },
  {
    title: 'Rental Management',
    icon: Banknote,
    roles: ['hr'],
    excludeDepartments: ['rental sourcing'],
    items: [
      { icon: ClipboardList, label: 'My Rentals', path: '/hr/rentals' },
    ],
  },
  {
    title: 'Rental Management',
    icon: Banknote,
    roles: ['rsh', 'RSH'],
    departments: ['rental sourcing'],
    defaultOpen: true,
    items: [
      { icon: ClipboardList, label: 'My Rentals', path: '/rsh/rentals' },
    ],
  },
  {
    title: 'Rental Management',
    icon: Banknote,
    roles: ['ceo'],
    items: [
      { icon: CheckSquare, label: 'Rental Approvals', path: '/ceo/rentals/approvals' },
      { icon: LayoutDashboard, label: 'Rental Oversight', path: '/ceo/rentals/portfolio' },
    ],
  },
  {
    title: 'Weekly Productivity',
    icon: BarChart3,
    roles: ['employee', 'admin', 'hr', 'ceo', 'gm', 'gmo', 'smo', 'nsm', 'director', 'Director', 'auditor', 'rsh', 'RSH', 'site_visit_farm_manager', 'farmmanager', 'palm_cafe_manager', 'cafe_manager', 'boi'],
    items: [
      { icon: LayoutDashboard, label: 'Weekly Targets', path: '/core-head/targets' },
      { icon: ClipboardCheck, label: 'Weekly Achievements', path: '/core-head/achievements' },
    ],
  },
  {
    title: 'Site Visit',
    icon: MapPin,
    roles: ['smo'],
    departments: ['site visit'],
    defaultOpen: true,
    items: [
      { icon: LayoutDashboard, label: 'Visit Dashboard', path: '/site-visit-fm-dashboard' },
    ],
  },
  {
    title: 'Site Visit',
    icon: MapPin,
    roles: ['smo'],
    departments: ['rental sourcing', 'farm manager'],
    defaultOpen: true,
    items: [
      { icon: LayoutDashboard, label: 'Visit Dashboard', path: '/site-visit-fm-dashboard' },
      { icon: Plus, label: 'New Request', path: '/site-visit-request/new' },
    ],
  },
  {
    title: 'Site Visit',
    icon: MapPin,
    roles: ['site_visit_farm_manager', 'farmmanager', 'employee', 'rsh', 'RSH', 'smo'],
    departments: ['rental sourcing', 'site visit', 'farm manager'],
    defaultOpen: true,
    items: [
      { icon: LayoutDashboard, label: 'Visit Dashboard', path: '/site-visit-fm-dashboard' },
      { icon: Plus, label: 'New Request', path: '/site-visit-request/new' },
      { icon: History, label: 'My Requests', path: '/site-visit-request/my' },
    ],
  },
  {
    title: 'Customer Relations',
    icon: PhoneCall,
    roles: ['employee'],
    departments: ['crm'],
    defaultOpen: true,
    items: [
      { icon: AlertTriangle, label: 'Raise Escalation', path: '/nsm-dashboard?create=true' },
      { icon: History, label: 'My Escalations', path: '/dashboard/my-escalations' },
    ],
  },

  // ── FF Operations Manager ─────────────────────────────────────────────────
  {
    title: 'Hub Management',
    icon: Database,
    roles: ['ff_operations_manager'],
    defaultOpen: true,
    items: [
      { icon: LayoutDashboard, label: 'All Hubs Overview',  path: '/admin/hubs' },
      { icon: MapPin,          label: 'Palikarani Hub',    path: '/admin/hubs/palikarani' },
      { icon: MapPin,          label: 'Vanagaram Hub',     path: '/admin/hubs/vanagaram' },
      { icon: MapPin,          label: 'Hyderabad Hub',     path: '/admin/hubs/hyderabad' },
    ],
  },
  {
    title: 'FF Operations',
    icon: Briefcase,
    roles: ['ff_operations_manager'],
    defaultOpen: true,
    items: [
      { icon: LayoutDashboard, label: 'Home',              path: '/ff-operations' },
      { icon: Package,         label: 'Items',             path: '/ff-operations/items' },
      { icon: FileText,        label: 'Auto Bill',         path: '/purchase/auto-bill' },
      { icon: Truck,           label: 'Transit',           path: '/transit' },
      { icon: LayoutDashboard, label: 'Sales Dashboard',   path: '/sales' },
      { icon: Users,           label: 'Customers',         path: '/sales/customers' },
      { icon: ClipboardList,   label: 'Sales Orders',      path: '/sales/orders' },
      { icon: FileText,        label: 'Invoices',          path: '/sales/invoices' },
    ],
  },

  // ── Sales / BDE ───────────────────────────────────────────────────────────
  {
    title: 'Sales',
    icon: Activity,
    roles: ['field_executive', 'bde', 'back_office'],
    defaultOpen: true,
    items: [
      { icon: LayoutDashboard, label: 'Sales Dashboard',   path: '/sales' },
      { icon: Plus,            label: 'New Order',         path: '/sales/new-order' },
      { icon: ClipboardList,   label: 'All Orders',        path: '/sales/orders' },
      { icon: Users,           label: 'Customers',         path: '/sales/customers' },
      { icon: FileText,        label: 'Invoices',          path: '/sales/invoices' },
      { icon: Activity,        label: 'Sales Targets',     path: '/sales/targets' },
    ],
  },

  // ── Tele-Caller CRM ───────────────────────────────────────────────────────
  {
    title: 'Tele-Caller CRM',
    icon: PhoneCall,
    roles: ['tele_caller', 'back_office'],
    defaultOpen: true,
    items: [
      { icon: LayoutDashboard, label: 'CRM Dashboard',    path: '/tele-caller' },
    ],
  },

  // ── Driver / Logistics ────────────────────────────────────────────────────
  {
    title: 'Logistics',
    icon: Truck,
    roles: ['driver'],
    defaultOpen: true,
    items: [
      { icon: LayoutDashboard, label: 'Trips Dashboard',  path: '/logistics' },
      { icon: Truck,           label: 'Driver View',      path: '/driver' },
    ],
  },

  // ══ FARMERS FACTORY NEW ROLES ══════════════════════════════════════════════

  // ── GM — FF Payments only ─────────────────────────────────────────────────
  {
    title: 'FF Payment Approvals',
    icon: Banknote,
    roles: ['gm'],
    defaultOpen: true,
    items: [
      { icon: Banknote,     label: 'Vendor Payments',    path: '/gm/ff-payments' },
      { icon: Truck,        label: 'Transport Payments', path: '/gm/ff-transport-payments' },
      { icon: FileBarChart, label: 'FF Payments Report', path: '/reports/ff-payments' },
    ],
  },

  // ── L1 Manager ────────────────────────────────────────────────────────────
  {
    title: 'L1 Payment Approvals',
    icon: CheckSquare,
    roles: ['l1_manager'],
    defaultOpen: true,
    items: [
      { icon: Banknote,     label: 'Vendor Payments',    path: '/l1/payments' },
      { icon: Truck,        label: 'Transport Payments', path: '/l1/transport-payments' },
      { icon: FileBarChart, label: 'FF Payments Report', path: '/reports/ff-payments' },
    ],
  },

  // ── Auditor ───────────────────────────────────────────────────────────────
  {
    title: 'FF Payment Audit',
    icon: ShieldCheck,
    roles: ['auditor'],
    defaultOpen: true,
    items: [
      { icon: Banknote,     label: 'Vendor Payments',    path: '/auditor/ff-payments' },
      { icon: Truck,        label: 'Transport Payments', path: '/auditor/ff-transport-payments' },
      { icon: FileBarChart, label: 'FF Payments Report', path: '/reports/ff-payments' },
    ],
  },

  // ── Hub Manager ───────────────────────────────────────────────────────────
  {
    title: 'Shift',
    icon: Clock,
    roles: ['hub_manager'],
    defaultOpen: false,
    items: [
      { icon: LayoutDashboard, label: 'Shift Dashboard', path: '/shift/dashboard' },
    ],
  },
  {
    title: 'My Hub',
    icon: Wallet,
    roles: ['hub_manager'],
    defaultOpen: true,
    items: [
      { icon: LayoutDashboard, label: 'Warehouse Dashboard', path: '/warehouse' },
      { icon: ClipboardCheck,  label: 'QC Inspection',       path: '/warehouse/qc' },
      { icon: FileText,        label: 'QC Rejections',       path: '/warehouse/qc-rejections' },
      { icon: RotateCcw,       label: 'Returns',             path: '/warehouse/returns' },
    ],
  },
  {
    title: 'Payments',
    icon: Banknote,
    roles: ['hub_manager'],
    defaultOpen: false,
    items: [
      { icon: Plus,        label: 'New Vendor Payment',    path: '/ff/vendor-payment/new' },
      { icon: Truck,       label: 'New Transport Payment', path: '/ff/transport-payment/new' },
      { icon: History,     label: 'My Submitted Payments', path: '/my-submitted-payments' },
    ],
  },

  // ── Purchase Manager / Head / shift_employee ──────────────────────────────
  {
    title: 'Shift',
    icon: Clock,
    roles: ['shift_employee', 'purchase_manager', 'purchase_head'],
    defaultOpen: false,
    items: [
      { icon: LayoutDashboard, label: 'Shift Dashboard', path: '/shift/dashboard' },
    ],
  },
  {
    title: 'Purchase',
    icon: Package,
    roles: ['purchase_manager', 'purchase_head'],
    defaultOpen: true,
    items: [
      { icon: LayoutDashboard, label: 'Purchase Dashboard',  path: '/purchase' },
      { icon: ClipboardList,   label: 'My Purchase Orders',  path: '/purchase/orders' },
      { icon: Plus,            label: 'New PO',              path: '/purchase/new' },
      { icon: Zap,             label: 'EOD PO Engine',       path: '/ff-operations/eod-po-engine' },
      { icon: Database,        label: 'Vendors',             path: '/purchase/vendors' },
    ],
  },
  {
    title: 'Payments',
    icon: Banknote,
    roles: ['purchase_manager', 'purchase_head'],
    defaultOpen: false,
    items: [
      { icon: Plus,    label: 'New FF Vendor Payment', path: '/ff/vendor-payment/new' },
      { icon: History, label: 'My Submitted Payments', path: '/my-submitted-payments' },
    ],
  },

  // ── Warehouse Manager ─────────────────────────────────────────────────────
  {
    title: 'Warehouse',
    icon: Wallet,
    roles: ['warehouse_manager'],
    defaultOpen: true,
    items: [
      { icon: LayoutDashboard, label: 'Warehouse Dashboard', path: '/warehouse' },
      { icon: ClipboardCheck,  label: 'QC Inspection',       path: '/warehouse/qc' },
      { icon: FileText,        label: 'QC Rejections',       path: '/warehouse/qc-rejections' },
      { icon: Package,         label: 'Inventory',           path: '/warehouse/inventory' },
    ],
  },

  // ── QC Manager ────────────────────────────────────────────────────────────
  {
    title: 'Quality Control',
    icon: ShieldCheck,
    roles: ['qc_manager'],
    defaultOpen: true,
    items: [
      { icon: ClipboardCheck, label: 'QC Inspection',   path: '/warehouse/qc' },
      { icon: FileText,       label: 'QC Rejections',   path: '/warehouse/qc-rejections' },
    ],
  },

  // ── FF Operations Manager ─────────────────────────────────────────────────
  {
    title: 'Operations Command',
    icon: LayoutDashboard,
    roles: ['ff_operations_manager'],
    defaultOpen: true,
    items: [
      { icon: BarChart3,    label: 'GM Dashboard',       path: '/ff-operations/gm-dashboard' },
      { icon: Wallet,       label: 'Cash Collections',   path: '/collections/dashboard' },
      { icon: FileBarChart, label: 'FF Payments Report', path: '/reports/ff-payments' },
    ],
  },

  // ── Accounts ──────────────────────────────────────────────────────────────
  {
    title: 'FF Payments',
    icon: Banknote,
    roles: ['accounts'],
    defaultOpen: true,
    items: [
      { icon: Banknote,     label: 'FF Vendor Payments',    path: '/accounts/ff-payments' },
      { icon: Truck,        label: 'FF Transport Payments', path: '/accounts/ff-transport-payments' },
      { icon: FileBarChart, label: 'FF Payments Report',    path: '/reports/ff-payments' },
    ],
  },
];

export function MobileSidebar({ onClose }: MobileSidebarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const { dayStart } = useDayStart(new Date());
  const { isCoreHead } = useIsCoreHead();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  if (!user) return null;

  const userRole = (user.role || 'employee').toLowerCase();
  const userDepartment = user.department?.toLowerCase() || '';

    // Filter groups for current user role and department
  const filteredGroups = navigationConfig.filter(group => {
    // Skip groups with no items (prevents empty dropdowns)
    if (group.items.length === 0) return false;

    // Show PALM CAFE Manager group if user is a cafe manager or in the cafe department
    if (group.title.toLowerCase().includes('palm cafe') && group.roles.includes('palm_cafe_manager')) {
      return userRole.includes('cafe') || userDepartment.includes('cafe');
    }

    // Show Weekly Productivity ONLY if they are an active Core Manager, regardless of role/department
    if (group.title === 'Weekly Productivity') {
      return isCoreHead || ['palm_cafe_manager', 'cafe_manager'].includes(userRole);
    }

    const roleMatches = group.roles.some(role => role.toLowerCase() === userRole);
    if (!roleMatches) return false;

    // Check department filters for all non-admin/ceo roles to determine group visibility
    if (userRole !== 'admin' && userRole !== 'ceo') {
      // If departments array is specified, user must be in one of those departments
      if (group.departments && group.departments.length > 0) {
        const inAllowedDept = group.departments.some(dept => userDepartment.includes(dept.toLowerCase()));
        if (!inAllowedDept) return false;
      }

      // If excludeDepartments array is specified, user must NOT be in those departments
      if (group.excludeDepartments && group.excludeDepartments.length > 0) {
        const inExcludedDept = group.excludeDepartments.some(dept => userDepartment.includes(dept.toLowerCase()));
        if (inExcludedDept) return false;
      }
    }

    return true;
  });

  const toggleGroup = (groupTitle: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [groupTitle]: !prev[groupTitle],
    }));
  };

  const isGroupOpen = (group: NavGroup) => {
    if (openGroups[group.title] !== undefined) {
      return openGroups[group.title];
    }
    const hasActiveItem = group.items.some(item => location.pathname === item.path);
    return group.defaultOpen || hasActiveItem;
  };

  return (
    <div className="h-full flex flex-col bg-[#0f1f2e]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1e3a5f] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/ff-logo.jpg" alt="Farmers Factory"
            className="w-8 h-8 rounded-lg object-cover shrink-0" />
          <div>
            <p className="text-[13px] font-bold text-white leading-tight">Farmers Factory</p>
            <p className="text-[10px] text-[#4a6fa5] leading-none font-medium tracking-wider uppercase">ERP v2.0</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-[#4a6fa5] hover:text-white hover:bg-[#1a3450]">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* User chip */}
      <div className="px-4 py-2.5 border-b border-[#1e3a5f] flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-md bg-green-700 flex items-center justify-center shrink-0">
          <span className="text-white text-[11px] font-bold">
            {user.name?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || 'U'}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white truncate">{user.name}</p>
          <p className="text-[11px] text-[#4a6fa5] truncate">{user.role?.replace(/_/g, ' ')}</p>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="space-y-0.5">
          {filteredGroups.map((group) => {
            const isOpen = isGroupOpen(group);
            const GroupIcon = group.icon;

            return (
              <Collapsible
                key={`${group.title}-${group.roles.join('-')}`}
                open={isOpen}
                onOpenChange={() => toggleGroup(group.title)}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-[#4a6fa5] hover:text-[#7aa2d4] rounded-md transition-colors duration-150 mt-2 first:mt-0">
                  <div className="flex items-center gap-2">
                    <GroupIcon className="w-3.5 h-3.5" />
                    <span>{group.title}</span>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-0.5 space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;

                    if (item.path === '/cafe/manager' && !(userRole.includes('cafe') || userDepartment.includes('cafe'))) {
                      return null;
                    }

                    if (item.label.includes('Visit Dashboard') &&
                        !['smo', 'admin', 'ceo', 'site_visit_farm_manager'].includes(userRole)) {
                      return null;
                    }

                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={onClose}
                        className={({ isActive }) => cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors duration-150',
                          isActive
                            ? 'bg-green-500/15 text-green-400 border-l-2 border-green-500 pl-[10px]'
                            : 'text-[#8ba3bc] hover:text-white hover:bg-[#1a3450] border-l-2 border-transparent pl-[10px]'
                        )}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      {!(userRole === 'smo' && userDepartment.includes('site visit')) && (
        <div className="border-t border-[#1e3a5f] px-2 py-3">
          <a
            href="https://forms.gle/WDoNcZUXkp7BYZvZ7"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium text-[#4a6fa5] hover:text-white hover:bg-[#1a3450] transition-colors duration-150"
          >
            <MessageSquarePlus className="w-4 h-4 shrink-0" />
            <span>Feedback &amp; Suggestions</span>
          </a>
        </div>
      )}
    </div>
  );
}

