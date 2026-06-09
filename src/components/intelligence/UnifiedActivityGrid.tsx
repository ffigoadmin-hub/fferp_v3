import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UnifiedActivity } from '@/hooks/useUnifiedWorkAnalytics';
import { Clock, History, Activity, Coffee, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmployeeHistoryModal } from './EmployeeHistoryModal';
import { useState } from 'react';

interface UnifiedActivityGridProps {
    activities: UnifiedActivity[];
    selectedDate?: Date;
}

const AVATAR_BG = ['#EFF6FF', '#F0FDF4', '#FEF3C7', '#FEE2E2', '#F3E8FF', '#E0F2FE'];
const AVATAR_TEXT = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0284C7'];
function getAvatarColors(name?: string): [string, string] {
    const idx = (name?.charCodeAt(0) || 0) % AVATAR_BG.length;
    return [AVATAR_TEXT[idx], AVATAR_BG[idx]];
}
function getInitials(name?: string) {
    if (!name) return 'U';
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

export function UnifiedActivityGrid({ activities, selectedDate = new Date() }: UnifiedActivityGridProps) {
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<UnifiedActivity | null>(null);

    const handleCardClick = (employee: UnifiedActivity) => {
        setSelectedEmployee(employee);
        setModalOpen(true);
    };

    return (
        <>
            <EmployeeHistoryModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                employee={selectedEmployee}
                selectedDate={selectedDate}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {activities.map((activity) => {
                    const [avatarText, avatarBg] = getAvatarColors(activity.userName);
                    const isAbsent = activity.status === 'absent';
                    const isGood = activity.complianceScore >= 80;
                    const isBad = activity.complianceScore < 50;

                    const scoreColor = isGood ? '#16A34A' : isBad ? '#DC2626' : '#D97706';
                    const scoreBg = isGood ? '#F0FDF4' : isBad ? '#FEF2F2' : '#FFFBEB';
                    const cardBorderColor = isAbsent ? '#FEE2E2' : isGood ? '#BBF7D0' : isBad ? '#FECACA' : '#E5E7EB';

                    const loginOnTime = activity.loginTime && parseInt(activity.loginTime) <= 10 && activity.loginTime.includes('AM');
                    const loginColor = !activity.loginTime ? '#9CA3AF' : loginOnTime ? '#16A34A' : '#DC2626';

                    return (
                        <div
                            key={activity.id}
                            onClick={() => handleCardClick(activity)}
                            className="rounded-2xl p-4 cursor-pointer transition-all duration-200 hover:scale-[1.01]"
                            style={{
                                background: '#FFFFFF',
                                border: `1px solid ${cardBorderColor}`,
                                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                            }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(37,99,235,0.10)';
                                (e.currentTarget as HTMLElement).style.borderColor = '#BFDBFE';
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)';
                                (e.currentTarget as HTMLElement).style.borderColor = cardBorderColor;
                            }}
                        >
                            {/* Header: Avatar + Name + Score */}
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                                        style={{ background: avatarBg, color: avatarText }}
                                    >
                                        {getInitials(activity.userName)}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-sm font-bold truncate" style={{ color: '#111827' }}>
                                            {activity.userName}
                                        </h4>
                                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                            <Badge variant="outline"
                                                className="text-[9px] font-bold uppercase px-1.5 py-0 h-4 truncate max-w-[90px]"
                                                style={{ background: '#F1F5F9', color: '#475569', borderColor: '#E2E8F0' }}>
                                                {activity.department}
                                            </Badge>
                                            <Badge variant="outline"
                                                className="text-[9px] font-bold uppercase px-1.5 py-0 h-4"
                                                style={{ background: '#EFF6FF', color: '#2563EB', borderColor: '#BFDBFE' }}>
                                                {activity.type.toUpperCase()}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right shrink-0 ml-2">
                                    <div className="text-lg font-black font-mono leading-none" style={{ color: scoreColor }}>
                                        {activity.complianceScore}
                                    </div>
                                    <span className="text-[9px] font-bold uppercase tracking-tight" style={{ color: '#9CA3AF' }}>
                                        Score Index
                                    </span>
                                </div>
                            </div>

                            {/* Timing Bar */}
                            <div className="rounded-xl px-3 py-2.5 mb-3 flex items-center justify-between"
                                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                                <div>
                                    <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#9CA3AF' }}>Login Timestamp</p>
                                    <p className="text-xs font-black font-mono" style={{ color: loginColor }}>
                                        {activity.loginTime || '--:--'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#9CA3AF' }}>Target</p>
                                    <p className="text-xs font-black font-mono" style={{ color: '#374151' }}>10:15 AM</p>
                                </div>
                            </div>

                            {/* Status Row */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-1.5">
                                    <div className={cn(
                                        "w-6 h-6 rounded-lg flex items-center justify-center",
                                        activity.status === 'working' ? "bg-green-50" :
                                            activity.status === 'break' ? "bg-orange-50" :
                                                activity.status === 'completed' ? "bg-blue-50" : "bg-gray-100"
                                    )}>
                                        {activity.status === 'break' ? <Coffee className="w-3.5 h-3.5 text-orange-500" /> :
                                            activity.status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" /> :
                                                activity.status === 'working' ? <Activity className="w-3.5 h-3.5 text-green-500" /> :
                                                    <Activity className="w-3.5 h-3.5 text-gray-400" />}
                                    </div>
                                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#374151' }}>
                                        {activity.status}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1" style={{ color: '#9CA3AF' }}>
                                    <Clock className="w-3 h-3" />
                                    <span className="text-[10px] font-mono font-bold">
                                        {activity.loginTime || 'NO LOGIN'}
                                    </span>
                                </div>
                            </div>

                            {/* Activity Progress Slots */}
                            <div className="space-y-1.5 mb-3">
                                <div className="flex justify-between text-[9px] font-bold uppercase" style={{ color: '#9CA3AF' }}>
                                    <span>Activity Progress</span>
                                    <span>{activity.metrics.reportsCount}/8 Slots</span>
                                </div>
                                <div className="flex gap-1 h-1.5">
                                    {[...Array(8)].map((_, i) => (
                                        <div
                                            key={i}
                                            className="flex-1 rounded-full transition-all duration-500"
                                            style={{
                                                background: i < activity.metrics.reportsCount
                                                    ? '#2563EB'
                                                    : i < activity.metrics.plansCount
                                                        ? '#FCD34D'
                                                        : '#E5E7EB'
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Footer: Plans / Late / History */}
                            <div className="pt-2.5 flex items-center justify-between" style={{ borderTop: '1px solid #F3F4F6' }}>
                                <div className="flex gap-4">
                                    <div>
                                        <p className="text-[9px] font-bold uppercase" style={{ color: '#9CA3AF' }}>Plans</p>
                                        <p className="text-xs font-black" style={{ color: '#111827' }}>{activity.metrics.plansCount}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold uppercase" style={{ color: '#9CA3AF' }}>Late</p>
                                        <p className="text-xs font-black" style={{ color: activity.metrics.lateReports > 0 ? '#DC2626' : '#111827' }}>
                                            {activity.metrics.lateReports}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 rounded-full transition-all"
                                    style={{ color: '#9CA3AF' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#2563EB'; (e.currentTarget as HTMLElement).style.background = '#EFF6FF'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9CA3AF'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                >
                                    <History className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}
