import { useAuth } from '@/contexts/AuthContext';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useDayStart } from '@/hooks/useDayStart';
import { useIsCoreHead } from '@/hooks/useIsCoreHead';
import { useFFPaymentCount } from '@/hooks/useFFPaymentCount';
import { format } from 'date-fns';
import { useState } from 'react';
// Single source of truth for navigation — imported from the desktop
// Sidebar so the two can never drift apart again (they previously had
// separately-maintained copies; mobile was missing 22 groups, including
// the entire FF Payment Pipeline, because of it).
import { navigationConfig, type NavGroup, type NavItem } from './Sidebar';
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

export function MobileSidebar({ onClose }: MobileSidebarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { dayStart } = useDayStart(new Date());
  const { isCoreHead } = useIsCoreHead();
  const pendingCounts = useFFPaymentCount();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

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

  // ff_payment_access: specific individuals (Anusiya/Arun) with payment
  // access including raising new payments — see matching bypass in
  // App.tsx's ProtectedRoute.
  if ((user as any)?.ff_payment_access) {
    filteredGroups.push({
      title: 'Payments',
      icon: Banknote,
      roles: [],
      items: [
        { icon: Plus,    label: 'New Vendor Payment',       path: '/ff/vendor-payment/new' },
        { icon: Truck,   label: 'New Transport Payment',    path: '/ff/transport-payment/new' },
        { icon: History, label: 'My Submitted Payments',  path: '/my-submitted-payments' },
        { icon: CheckSquare, label: 'Payment Approvals',  path: '/ff-operations/payment-approvals' },
      ],
    });
  }

  const toggleGroup = (groupTitle: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [groupTitle]: !prev[groupTitle],
    }));
  };

  const toggleItemExpand = (path: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // Live filter — matches item labels, and (for items with a sub-menu)
  // child labels too; a matching child keeps its parent item (trimmed to
  // just the matching children) even if the parent's own label doesn't
  // match. A group survives only if at least one item still has something.
  const search = searchQuery.trim().toLowerCase();
  const searchedGroups = search
    ? filteredGroups
        .map(group => ({
          ...group,
          items: group.items
            .map(item => {
              const selfMatches = item.label.toLowerCase().includes(search);
              if (item.children && item.children.length > 0) {
                if (selfMatches) return item;
                const childMatches = item.children.filter(c => c.label.toLowerCase().includes(search));
                return childMatches.length > 0 ? { ...item, children: childMatches } : null;
              }
              return selfMatches ? item : null;
            })
            .filter((i): i is NavItem => i !== null),
        }))
        .filter(group => group.items.length > 0)
    : filteredGroups;

  const isGroupOpen = (group: NavGroup) => {
    if (search) return true; // auto-expand every matching group while searching
    if (openGroups[group.title] !== undefined) {
      return openGroups[group.title];
    }
    const hasActiveItem = group.items.some(item =>
      location.pathname === item.path || item.children?.some(c => location.pathname.startsWith(c.path))
    );
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

      {/* Search */}
      <div className="px-3 py-2.5 border-b border-[#1e3a5f]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4a6fa5]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search menu…"
            className="w-full bg-[#1a3450] text-white placeholder:text-[#4a6fa5] text-[13px] rounded-md pl-8 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#4a6fa5] hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {search && searchedGroups.length === 0 && (
          <p className="text-[11px] text-[#4a6fa5] mt-1.5 px-0.5">No matching pages</p>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="space-y-0.5">
          {searchedGroups.map((group) => {
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

                    // ── Item with a sub-menu (e.g. FF Payment Pipeline's
                    //    Vendor Payments -> Manager Review / L1 Approval / ...) ──
                    if (item.children && item.children.length > 0) {
                      const isItemActive = location.pathname === item.path ||
                        item.children.some(c => location.pathname.startsWith(c.path));
                      const isItemOpen = search || expandedItems.has(item.path) || isItemActive;

                      return (
                        <div key={item.path}>
                          <button
                            onClick={() => toggleItemExpand(item.path)}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors duration-150 border-l-2',
                              isItemActive
                                ? 'bg-green-500/15 text-green-400 border-green-500 pl-[10px]'
                                : 'text-[#8ba3bc] hover:text-white hover:bg-[#1a3450] border-transparent pl-[10px]'
                            )}
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="flex-1 text-left truncate">{item.label}</span>
                            {isItemOpen
                              ? <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
                              : <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-40" />}
                          </button>
                          {isItemOpen && (
                            <div className="mt-0.5 ml-3 pl-3 space-y-0.5 border-l border-[#1e3a5f]">
                              {item.children.map(child => (
                                <NavLink
                                  key={child.path}
                                  to={child.path}
                                  onClick={onClose}
                                  className={({ isActive }) => cn(
                                    'flex items-center justify-between gap-2 py-1.5 px-2 rounded-md text-[12px] font-medium transition-colors duration-150',
                                    isActive
                                      ? 'bg-green-500/15 text-green-400'
                                      : 'text-[#8ba3bc] hover:text-white hover:bg-[#1a3450]'
                                  )}
                                >
                                  <span className="truncate">{child.label}</span>
                                  {child.action && (
                                    <span
                                      onClick={e => { e.preventDefault(); e.stopPropagation(); navigate(child.path + '/new'); onClose(); }}
                                      className="w-4 h-4 rounded flex items-center justify-center shrink-0 hover:bg-[#1e3a5f] text-green-400"
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

                    // ── Regular item ──────────────────────────────────
                    const badgeCount = item.badgeKey ? (pendingCounts[item.badgeKey] || 0) : 0;
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
                        <span className="flex-1 truncate">{item.label}</span>
                        {badgeCount > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </span>
                        )}
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

