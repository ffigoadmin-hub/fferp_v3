import {
  Leaf,
  Building2,
  Tractor,
  RefreshCcw,
  Key,
  GraduationCap,
  Sprout,
  Users,
  Building,
  Briefcase,
  MapPin,
  ShoppingBag,
  Truck,
  PenTool as Tool,
  Megaphone,
  PhoneCall,
  Scale,
  Factory,
  Store,
  Coffee,
  Banknote,
  FlaskConical,
  Calculator,
  ShieldCheck,
  Settings,
  BarChart3,
  HelpCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DepartmentBadgeProps {
  department: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  variant?: 'default' | 'icon-only' | 'badge';
}

const DEPARTMENT_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  agri: { icon: Leaf, color: 'text-green-500', label: 'Agri' },
  'agri_operations': { icon: Leaf, color: 'text-green-500', label: 'Agri Operations' },
  engineering: { icon: Building2, color: 'text-blue-500', label: 'Engineering' },
  farm_manager: { icon: Tractor, color: 'text-amber-500', label: 'Farm Manager' },
  buy_back: { icon: RefreshCcw, color: 'text-purple-500', label: 'Buy-Back' },
  rental_sourcing: { icon: Key, color: 'text-rose-500', label: 'Rental Sourcing' },
  tnskill: { icon: GraduationCap, color: 'text-indigo-500', label: 'TNSkill' },
  nursery_landscaping: { icon: Sprout, color: 'text-emerald-500', label: 'Nursery & Landscaping' },
  hr: { icon: Users, color: 'text-pink-500', label: 'HR' },
  head_office: { icon: Building, color: 'text-slate-400', label: 'Head Office' },
  business_development: { icon: Briefcase, color: 'text-cyan-500', label: 'Business Development' },
  site_visit: { icon: MapPin, color: 'text-orange-500', label: 'Site Visit' },
  purchase: { icon: ShoppingBag, color: 'text-teal-500', label: 'Purchase' },
  vendor_sourcing: { icon: Truck, color: 'text-orange-500', label: 'Vendor Sourcing' },
  mts: { icon: Tool, color: 'text-gray-500', label: 'MTS' },
  marketing: { icon: Megaphone, color: 'text-red-500', label: 'Marketing' },
  crm: { icon: PhoneCall, color: 'text-blue-400', label: 'CRM' },
  data_analytics_legal: { icon: Scale, color: 'text-indigo-400', label: 'Data Analytics & Legal' },
  farmers_factory: { icon: Factory, color: 'text-amber-600', label: 'Farmers Factory' },
  agrimart: { icon: Store, color: 'text-green-600', label: 'AgriMart' },
  palm_cafe: { icon: Coffee, color: 'text-yellow-600', label: 'Palm Cafe' },
  finance: { icon: Banknote, color: 'text-emerald-600', label: 'Finance' },
  rd: { icon: FlaskConical, color: 'text-purple-400', label: 'R&D' },
  accounts: { icon: Calculator, color: 'text-blue-600', label: 'Accounts' },
  ceo_office: { icon: ShieldCheck, color: 'text-red-600', label: 'CEO Office' },
  ceo: { icon: ShieldCheck, color: 'text-red-600', label: 'CEO' },
  admin: { icon: Settings, color: 'text-slate-600', label: 'Admin' },
  data_team: { icon: BarChart3, color: 'text-indigo-500', label: 'Data Team' },
  datateam: { icon: BarChart3, color: 'text-indigo-500', label: 'Data Team' },
  others: { icon: HelpCircle, color: 'text-slate-500', label: 'Others' },
};

export function DepartmentBadge({ department, showLabel = true, size = 'md', variant = 'default' }: DepartmentBadgeProps) {
  const normalizedDept = department?.toLowerCase().replace(/[\s-]+/g, '_') || 'unknown';
  const config = DEPARTMENT_CONFIG[normalizedDept];

  if (!config) {
    // Fallback for unknown departments
    return (
      <div className="flex items-center gap-1 text-muted-foreground">
        <Building2 className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
        {showLabel && <span className={size === 'sm' ? 'text-xs' : 'text-sm'}>{department || 'Unknown'}</span>}
      </div>
    );
  }

  const Icon = config.icon;
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  if (variant === 'badge') {
    return (
      <Badge variant="outline" className={`${textSize} gap-1`}>
        <Icon className={`${size === 'sm' ? 'w-2 h-2' : 'w-3 h-3'} ${config.color}`} />
        {showLabel && (config.label || department)}
      </Badge>
    );
  }

  if (variant === 'icon-only') {
    return <Icon className={`${iconSize} ${config.color}`} />;
  }

  return (
    <div className="flex items-center gap-1">
      <Icon className={`${iconSize} ${config.color}`} />
      {showLabel && <span className={`${textSize} capitalize`}>{config.label || department}</span>}
    </div>
  );
}

export function getDepartmentIcon(department: string, size: 'sm' | 'md' = 'md') {
  const normalizedDept = department?.toLowerCase().replace(/[\s-]+/g, '_') || 'unknown';
  const config = DEPARTMENT_CONFIG[normalizedDept];

  if (!config) {
    return <Building2 className={size === 'sm' ? 'w-3 h-3 text-muted-foreground' : 'w-4 h-4 text-muted-foreground'} />;
  }

  const Icon = config.icon;
  return <Icon className={`${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} ${config.color}`} />;
}
