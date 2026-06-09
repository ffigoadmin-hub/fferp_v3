import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Bell, Megaphone, ClipboardList, AlertCircle, Clock, ArrowRight, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type AlertType = 'danger' | 'escalation' | 'announcement' | 'task' | 'lop' | 'sla_breach' | 'slot_opening' | 'payment_new' | 'payment_approved' | 'payment_status' | 'task_comment' | 'task_progress' | 'chat_message' | 'ceo' | 'director' | 'gm' | 'boi' | 'morning_selfie' | 'lunch_selfie' | 'evening_selfie' | 'cafe_priority';

export interface AlertData {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  timestamp: Date;
  priority?: 'high' | 'critical';
  clientName?: string;
  projectName?: string;
  department?: string;
  onAction?: () => void;
}

interface AlertPopupProps {
  alert: AlertData | null;
  onDismiss: () => void;
  autoDismissMs?: number;
}

const alertConfig: Record<AlertType, {
  icon: typeof AlertTriangle;
  gradient: string;
  glowColor: string;
  iconBg: string;
  title: string;
  emoji: string;
}> = {
  danger: {
    icon: AlertTriangle,
    gradient: 'from-red-600 via-red-500 to-orange-500',
    glowColor: 'shadow-red-500/50',
    iconBg: 'bg-white/20',
    title: 'CRITICAL ALERT',
    emoji: '⚠️',
  },
  escalation: {
    icon: AlertCircle,
    gradient: 'from-orange-600 via-orange-500 to-amber-500',
    glowColor: 'shadow-orange-500/50',
    iconBg: 'bg-white/20',
    title: 'NEW ESCALATION',
    emoji: '🚨',
  },
  announcement: {
    icon: Megaphone,
    gradient: 'from-blue-600 via-indigo-500 to-purple-500',
    glowColor: 'shadow-indigo-500/50',
    iconBg: 'bg-white/20',
    title: 'ANNOUNCEMENT',
    emoji: '📢',
  },
  task: {
    icon: ClipboardList,
    gradient: 'from-blue-600 via-blue-500 to-cyan-500',
    glowColor: 'shadow-blue-500/50',
    iconBg: 'bg-white/20',
    title: 'TASK ASSIGNED',
    emoji: '📋',
  },
  lop: {
    icon: Clock,
    gradient: 'from-amber-600 via-amber-500 to-yellow-500',
    glowColor: 'shadow-amber-500/50',
    iconBg: 'bg-white/20',
    title: 'LOP MARKED',
    emoji: '⏰',
  },
  sla_breach: {
    icon: AlertTriangle,
    gradient: 'from-red-700 via-red-600 to-rose-500',
    glowColor: 'shadow-red-600/60',
    iconBg: 'bg-white/25',
    title: 'SLA BREACHED',
    emoji: '🔴',
  },
  slot_opening: {
    icon: Bell,
    gradient: 'from-purple-600 via-violet-500 to-fuchsia-500',
    glowColor: 'shadow-purple-500/50',
    iconBg: 'bg-white/20',
    title: 'REPORT SLOT OPEN',
    emoji: '🔔',
  },
  payment_new: {
    icon: Bell,
    gradient: 'from-green-600 via-emerald-500 to-teal-500',
    glowColor: 'shadow-green-500/50',
    iconBg: 'bg-white/20',
    title: 'NEW PAYMENT REQUEST',
    emoji: '💰',
  },
  payment_approved: {
    icon: Bell,
    gradient: 'from-emerald-600 via-green-500 to-lime-500',
    glowColor: 'shadow-emerald-500/50',
    iconBg: 'bg-white/20',
    title: 'PAYMENT APPROVED',
    emoji: '✅',
  },
  payment_status: {
    icon: Bell,
    gradient: 'from-teal-600 via-cyan-500 to-blue-500',
    glowColor: 'shadow-teal-500/50',
    iconBg: 'bg-white/20',
    title: 'PAYMENT UPDATE',
    emoji: '💳',
  },
  task_comment: {
    icon: MessageSquare,
    gradient: 'from-indigo-600 via-purple-500 to-pink-500',
    glowColor: 'shadow-indigo-500/50',
    iconBg: 'bg-white/20',
    title: 'NEW COMMENT',
    emoji: '💬',
  },
  task_progress: {
    icon: ClipboardList,
    gradient: 'from-blue-400 via-indigo-400 to-violet-400',
    glowColor: 'shadow-indigo-400/50',
    iconBg: 'bg-white/20',
    title: 'TASK UPDATE',
    emoji: '📈',
  },
  chat_message: {
    icon: MessageSquare,
    gradient: 'from-blue-500 via-sky-500 to-cyan-400',
    glowColor: 'shadow-blue-400/50',
    iconBg: 'bg-white/20',
    title: 'NEW MESSAGE',
    emoji: '💬',
  },
  ceo: {
    icon: Bell,
    gradient: 'from-slate-700 via-slate-800 to-slate-900',
    glowColor: 'shadow-slate-500/50',
    iconBg: 'bg-white/20',
    title: 'CEO ACTION REQUIRED',
    emoji: '👔',
  },
  director: {
    icon: Bell,
    gradient: 'from-zinc-700 via-zinc-800 to-zinc-900',
    glowColor: 'shadow-zinc-500/50',
    iconBg: 'bg-white/20',
    title: 'DIRECTOR NOTICE',
    emoji: '🏛️',
  },
  gm: {
    icon: Bell,
    gradient: 'from-stone-700 via-stone-800 to-stone-900',
    glowColor: 'shadow-stone-500/50',
    iconBg: 'bg-white/20',
    title: 'GM UPDATE',
    emoji: '📋',
  },
  boi: {
    icon: Bell,
    gradient: 'from-neutral-700 via-neutral-800 to-neutral-900',
    glowColor: 'shadow-neutral-500/50',
    iconBg: 'bg-white/20',
    title: 'BOI NOTIFICATION',
    emoji: '🔍',
  },
  morning_selfie: {
    icon: Bell,
    gradient: 'from-amber-400 via-orange-400 to-red-400',
    glowColor: 'shadow-orange-400/50',
    iconBg: 'bg-white/20',
    title: 'MORNING SELFIE',
    emoji: '🤳',
  },
  lunch_selfie: {
    icon: Bell,
    gradient: 'from-orange-400 via-red-400 to-rose-400',
    glowColor: 'shadow-red-400/50',
    iconBg: 'bg-white/20',
    title: 'LUNCH SELFIE',
    emoji: '🍱',
  },
  evening_selfie: {
    icon: Bell,
    gradient: 'from-rose-400 via-purple-400 to-indigo-400',
    glowColor: 'shadow-purple-400/50',
    iconBg: 'bg-white/20',
    title: 'EVENING SELFIE',
    emoji: '🌇',
  },
  cafe_priority: {
    icon: Bell,
    gradient: 'from-[#ff4d00] via-[#ff8800] to-[#ffaa00]',
    glowColor: 'shadow-orange-500/60',
    iconBg: 'bg-white/25',
    title: 'PALM CAFE UPDATE',
    emoji: '🍔',
  },
};


export function AlertPopup({ alert, onDismiss, autoDismissMs = 10000 }: AlertPopupProps) {
  useEffect(() => {
    if (!alert) return;

    const timer = setTimeout(() => {
      onDismiss();
    }, autoDismissMs);

    return () => clearTimeout(timer);
  }, [alert, autoDismissMs, onDismiss]);

  if (!alert) return null;

  const config = alertConfig[alert.type];
  const Icon = config.icon;
  const isCritical = alert.type === 'danger' || alert.type === 'sla_breach' || alert.type === 'cafe_priority';

  return (
    <AnimatePresence>
      {alert && (
        <>
          {/* Backdrop overlay for critical alerts */}
          {isCritical && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[99]"
              onClick={onDismiss}
            />
          )}

          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className={cn(
              'fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-[420px]',
              'rounded-2xl overflow-hidden',
              `shadow-2xl ${config.glowColor}`,
            )}
          >
            {/* Gradient background */}
            <div className={cn(
              'absolute inset-0 bg-gradient-to-br',
              config.gradient
            )} />

            {/* Shimmer effect */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: '200%' }}
              transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
              className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12"
            />

            {/* Pulsing glow for critical alerts */}
            {isCritical && (
              <motion.div
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                className="absolute inset-0 bg-white/10"
              />
            )}

            <div className="relative p-5">
              {/* Close button */}
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onDismiss}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/20 hover:bg-black/30 flex items-center justify-center text-white/90 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </motion.button>

              {/* Header with icon */}
              <div className="flex items-start gap-4 pr-8">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', delay: 0.1 }}
                  className={cn(
                    'w-14 h-14 rounded-xl flex items-center justify-center shrink-0',
                    config.iconBg,
                    'backdrop-blur-sm border border-white/20',
                    isCritical && 'animate-pulse'
                  )}
                >
                  <Icon className="w-7 h-7 text-white drop-shadow-lg" />
                </motion.div>

                <div className="flex-1 min-w-0">
                  {/* Type label */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{config.emoji}</span>
                    <span className="text-xs font-bold tracking-wider text-white/90 uppercase">
                      {config.title}
                    </span>
                  </div>

                  {/* Alert title */}
                  <h3 className="font-bold text-white text-lg leading-tight line-clamp-2 mb-1">
                    {alert.title}
                  </h3>

                  {/* Timestamp */}
                  <p className="text-white/60 text-xs font-medium">
                    {alert.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </p>
                </div>
              </div>

              {/* Message content */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mt-4 p-3 rounded-xl bg-black/15 backdrop-blur-sm border border-white/10 space-y-2"
              >
                {/* Client & Project Info */}
                {(alert.clientName || alert.projectName) && (
                  <div className="flex flex-wrap gap-2 mb-2 pb-2 border-b border-white/5">
                    {alert.clientName && (
                      <div className="px-2 py-1 rounded bg-white/10 text-[10px] font-bold text-white uppercase tracking-tight">
                        Client: {alert.clientName}
                      </div>
                    )}
                    {alert.projectName && (
                      <div className="px-2 py-1 rounded bg-white/10 text-[10px] font-bold text-white uppercase tracking-tight">
                        Project: {alert.projectName}
                      </div>
                    )}
                    {alert.department && (
                      <div className="px-2 py-1 rounded bg-white/10 text-[10px] font-bold text-white uppercase tracking-tight">
                        Dept: {alert.department}
                      </div>
                    )}
                  </div>
                )}

                <p className="text-white/95 text-sm leading-relaxed line-clamp-3">
                  {alert.message}
                </p>
              </motion.div>

              {/* Action buttons */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex gap-3 mt-4"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 h-10 bg-black/20 hover:bg-black/30 text-white border border-white/20 hover:border-white/30 rounded-xl font-medium transition-all"
                  onClick={onDismiss}
                >
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-10 bg-white hover:bg-white/90 text-gray-900 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all group"
                  onClick={() => {
                    if (alert.onAction) {
                      alert.onAction();
                    } else {
                      window.focus();
                    }
                    onDismiss();
                  }}
                >
                  View Now
                  <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </motion.div>

              {/* Progress bar for auto-dismiss */}
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20">
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: autoDismissMs / 1000, ease: 'linear' }}
                  className="h-full bg-white/60 rounded-full"
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Global alert queue manager
const alertQueue: AlertData[] = [];
let showAlertCallback: ((alert: AlertData | null) => void) | null = null;
let currentAlert: AlertData | null = null;

export function registerAlertHandler(callback: (alert: AlertData | null) => void) {
  showAlertCallback = callback;
}

export function pushAlert(alert: Omit<AlertData, 'id' | 'timestamp'>) {
  const fullAlert: AlertData = {
    ...alert,
    id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    onAction: alert.onAction,
  };

  alertQueue.push(fullAlert);

  if (!currentAlert && showAlertCallback) {
    currentAlert = alertQueue.shift()!;
    showAlertCallback(currentAlert);
  }
}

export function dismissCurrentAlert() {
  currentAlert = null;
  if (alertQueue.length > 0 && showAlertCallback) {
    currentAlert = alertQueue.shift()!;
    showAlertCallback(currentAlert);
  } else if (showAlertCallback) {
    showAlertCallback(null);
  }
}
