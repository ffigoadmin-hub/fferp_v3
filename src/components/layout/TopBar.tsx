import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { LogOut, Search, Leaf, Command, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { NotificationBell } from '@/components/NotificationBell';
import { Link, useNavigate } from 'react-router-dom';
import { MobileNav } from './MobileNav';

const ROLE_BADGE: Record<string, { label: string }> = {
  ceo:               { label: 'CEO' },
  director:          { label: 'Director' },
  Director:          { label: 'Director' },
  admin:             { label: 'Admin' },
  hr:                { label: 'HR' },
  accounts:          { label: 'Accounts' },
  gm:                { label: 'GM' },
  purchase_manager:  { label: 'Purchase Mgr' },
  purchase_head:     { label: 'Purchase Head' },
  warehouse_manager: { label: 'Warehouse Mgr' },
  qc_manager:        { label: 'QC Manager' },
  field_executive:   { label: 'Field Executive' },
  tele_caller:       { label: 'Tele Caller' },
  driver:            { label: 'Driver' },
  back_office:       { label: 'Back Office' },
  employee:          { label: 'Employee' },
};

function getInitials(name?: string) {
  if (!name) return 'U';
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

const AVATAR_BG = ['#EFF6FF','#F0FDF4','#FEF3C7','#FEE2E2','#F3E8FF','#E0F2FE'];
const AVATAR_TEXT = ['#2563EB','#16A34A','#D97706','#DC2626','#7C3AED','#0284C7'];

function getAvatarColors(name?: string): [string, string] {
  const idx = (name?.charCodeAt(0) || 0) % AVATAR_BG.length;
  return [AVATAR_TEXT[idx], AVATAR_BG[idx]];
}

export function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [hubName, setHubName] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (user && (user as any).hub_id) {
      supabase.from('hubs').select('name').eq('id', (user as any).hub_id).maybeSingle()
        .then(({ data }) => { if (data?.name) setHubName(data.name); });
    }
  }, [user]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    navigate(q ? `/payment-search?q=${encodeURIComponent(q)}` : '/payment-search');
    setSearchQuery('');
    searchRef.current?.blur();
  };

  if (!user) return null;

  const badge = ROLE_BADGE[user.role] ?? { label: user.role?.replace(/_/g, ' ') || 'Staff' };
  const initials = getInitials(user.name);
  const [fgColor, bgColor] = getAvatarColors(user.name);

  return (
    <header className="h-[60px] sticky top-0 z-50 flex items-center justify-between px-4 md:px-6"
      style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>

      {/* LEFT — Brand */}
      <div className="flex items-center gap-3">
        <MobileNav />

        <Link to="/redirect" className="flex items-center gap-2.5 select-none group">
          <img src="/ff-logo.jpg" alt="Farmers Factory"
            className="w-8 h-8 rounded-xl object-cover shrink-0"
            style={{ boxShadow: '0 2px 8px rgba(16,185,129,0.25)' }} />
          <div className="hidden sm:block">
            <p className="text-[13px] font-bold leading-tight tracking-tight" style={{ color: '#111827' }}>
              Farmers Factory
            </p>
            <p className="text-[10px] font-semibold tracking-widest uppercase leading-none" style={{ color: '#6B7280' }}>
              ERP v2.0
            </p>
          </div>
        </Link>

        {/* Hub badge (shift_employee / hub_manager) or dept badge */}
        {(hubName || user.department) && (
          <div className="hidden lg:flex items-center gap-2 ml-1 pl-3" style={{ borderLeft: '1px solid #E5E7EB' }}>
            {hubName ? (
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }}>
                <span style={{ fontSize: 9 }}>📦</span> {hubName}
              </span>
            ) : (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>
                {user.department}
              </span>
            )}
          </div>
        )}
      </div>

      {/* CENTER — Search */}
      <form onSubmit={handleSearch} className="hidden md:flex items-center flex-1 max-w-sm mx-6">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: '#9CA3AF' }} />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search payments, orders…"
            className="w-full pl-9 pr-16 py-[8px] rounded-xl text-[12.5px] outline-none transition-all duration-200"
            style={{
              background: '#F9FAFB',
              border: '1px solid #E5E7EB',
              color: '#111827',
            }}
            onFocus={e => {
              e.currentTarget.style.background = '#FFFFFF';
              e.currentTarget.style.borderColor = '#93C5FD';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.08)';
            }}
            onBlur={e => {
              e.currentTarget.style.background = '#F9FAFB';
              e.currentTarget.style.borderColor = '#E5E7EB';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium pointer-events-none"
            style={{ background: '#F3F4F6', color: '#9CA3AF', border: '1px solid #E5E7EB' }}>
            <Command className="w-2.5 h-2.5" />K
          </kbd>
        </div>
      </form>

      {/* RIGHT */}
      <div className="flex items-center gap-2">

        {/* Notification Bell */}
        <div className="[&>button]:rounded-xl [&>button]:text-gray-400 [&>button:hover]:bg-gray-100 [&>button:hover]:text-gray-600">
          <NotificationBell />
        </div>

        {/* Divider */}
        <div className="hidden lg:block w-px h-5 mx-1" style={{ background: '#E5E7EB' }} />

        {/* User chip */}
        <div className="flex items-center gap-1.5 pl-1.5 pr-2 py-1.5 rounded-xl cursor-default select-none"
          style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-bold text-[11px]"
            style={{ background: bgColor, color: fgColor }}>
            {initials}
          </div>
          {/* On mobile: only role badge. On md+: full name + ID + badge */}
          <span className="md:hidden inline-flex items-center px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wide"
            style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>
            {badge.label}
          </span>
          <div className="hidden md:block">
            <p className="text-[12px] font-semibold leading-tight max-w-[120px] truncate" style={{ color: '#111827' }}>
              {user.name}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              {user.employeeId && (
                <span className="text-[9px] font-medium" style={{ color: '#9CA3AF' }}>{user.employeeId}</span>
              )}
              <span className="inline-flex items-center px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wide"
                style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>
                {badge.label}
              </span>
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          title="Sign out"
          className="p-2 rounded-xl transition-all duration-150"
          style={{ color: '#9CA3AF' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = '#EF4444';
            (e.currentTarget as HTMLElement).style.background = '#FEF2F2';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = '#9CA3AF';
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
