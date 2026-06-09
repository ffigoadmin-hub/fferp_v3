import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Timer,
  Clock,
  Check,
  Lock,
  Coffee,
  ChevronRight,
  FileText,
  ClipboardList,
  AlertTriangle,
  Plus,
  AlertCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TIME_SLOTS, SlotStatus, TimeSlot } from "@/types/igo-chain";
import { cn } from "@/lib/utils";
import { format, parse, isAfter, isBefore, addMinutes, differenceInSeconds } from "date-fns";
import { useHourlyReports } from "@/hooks/useHourlyReports";
import { useHourlyPlans } from "@/hooks/useHourlyPlans";
import { useDayPlan } from "@/hooks/useDayPlan";
import { useExtraWorkEntries } from "@/hooks/useExtraWorkEntries";
import { useAuth } from "@/contexts/AuthContext";
import { SelfieCapture } from "@/components/SelfieCapture";
import { DailyActivitySummaryWidget } from "@/components/DailyActivitySummaryWidget";
import { useSlotReminders } from "@/hooks/useSlotReminders";
import { hasAdminBypass } from "@/lib/slotStatusHelpers";
import { useWeekOffAssignments } from "@/hooks/useWeekOffAssignments";
import { Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type SlotPhase = "plan" | "report" | "locked";

const getSlotPhase = (slot: TimeSlot, currentTime: Date, hasPlan: boolean, hasReport: boolean, bypassTimeLocks: boolean = false): SlotPhase => {
  if (hasReport) return "locked";

  const today = format(currentTime, "yyyy-MM-dd");
  const slotStart = parse(`${today} ${slot.startTime}`, "yyyy-MM-dd HH:mm", new Date());
  const slotEnd = parse(`${today} ${slot.endTime}`, "yyyy-MM-dd HH:mm", new Date());

  // Admin/Tester bypass - always allow report phase after slot starts
  if (bypassTimeLocks) {
    const planWindowStart = addMinutes(slotStart, -15);
    if (currentTime >= planWindowStart && currentTime < slotStart && !hasPlan) {
      return "plan";
    }
    return "report";
  }

  // Plan phase: 15 min before slot starts until slot starts (plan locks when slot starts)
  const planWindowStart = addMinutes(slotStart, -15);

  // If we're before slot start, it's plan phase
  if (currentTime < slotStart) {
    // Can only plan if within 15 min window before start
    if (currentTime >= planWindowStart && !hasPlan) {
      return "plan";
    }
    return "locked"; // Not in plan window yet
  }

  // MODULE 2: -5 Minute Rule - Report unlocks 5 minutes BEFORE slot ends
  const reportUnlockTime = addMinutes(slotEnd, -5);
  if (currentTime >= reportUnlockTime) {
    return "report";
  }

  // During the slot but before -5 minute mark - locked
  return "locked";
};

const getSlotStatus = (slot: TimeSlot, currentTime: Date, submitted: boolean, bypassTimeLocks: boolean = false): SlotStatus => {
  const today = format(currentTime, "yyyy-MM-dd");
  const slotStart = parse(`${today} ${slot.startTime}`, "yyyy-MM-dd HH:mm", new Date());
  const slotEnd = parse(`${today} ${slot.endTime}`, "yyyy-MM-dd HH:mm", new Date());

  if (submitted) return "completed";
  if (slot.isLunchBreak) return "upcoming";

  // Admin bypass - show as live if in progress
  if (bypassTimeLocks) {
    if (isBefore(currentTime, slotStart)) return "upcoming";
    return "live";
  }

  if (isBefore(currentTime, slotStart)) return "upcoming";
  if (isAfter(currentTime, slotEnd)) return "missed";
  return "live";
};

// Calculate countdown for plan lock, report unlock (-5 min rule), or grace period
const getCountdownInfo = (
  slot: TimeSlot,
  currentTime: Date,
  hasPlan: boolean,
  hasReport: boolean,
): { label: string; seconds: number; type: "plan" | "report-unlock" | "report-grace" | "none" } | null => {
  if (hasReport) return null;
  if (slot.isLunchBreak) return null;

  const today = format(currentTime, "yyyy-MM-dd");
  const slotStart = parse(`${today} ${slot.startTime}`, "yyyy-MM-dd HH:mm", new Date());
  const slotEnd = parse(`${today} ${slot.endTime}`, "yyyy-MM-dd HH:mm", new Date());
  const planWindowStart = addMinutes(slotStart, -15);
  const reportUnlockTime = addMinutes(slotEnd, -5); // -5 minute rule
  const graceEnd = addMinutes(slotEnd, 15);

  // Plan countdown: time until slot starts (plan locks)
  if (currentTime >= planWindowStart && currentTime < slotStart && !hasPlan) {
    const seconds = differenceInSeconds(slotStart, currentTime);
    return { label: "Plan locks in", seconds, type: "plan" };
  }

  // Report unlock countdown: during slot, before -5 minute mark
  if (currentTime >= slotStart && currentTime < reportUnlockTime && hasPlan) {
    const seconds = differenceInSeconds(reportUnlockTime, currentTime);
    return { label: "Report unlocks in", seconds, type: "report-unlock" };
  }

  // Report grace countdown: after slot ends, within grace period
  if (currentTime >= slotEnd && currentTime < graceEnd && !hasReport) {
    const seconds = differenceInSeconds(graceEnd, currentTime);
    return { label: "Grace ends in", seconds, type: "report-grace" };
  }

  return null;
};

const formatCountdown = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const statusConfig: Record<SlotStatus, { bg: string; border: string; text: string; label: string }> = {
  live: { bg: "bg-status-live/10", border: "border-status-live/40", text: "text-status-live", label: "LIVE" },
  late: { bg: "bg-status-late/10", border: "border-status-late/40", text: "text-status-late", label: "LATE" },
  missed: { bg: "bg-status-missed/10", border: "border-status-missed/40", text: "text-status-missed", label: "MISSED" },
  upcoming: { bg: "bg-muted/30", border: "border-border", text: "text-muted-foreground", label: "UPCOMING" },
  completed: { bg: "bg-status-live/5", border: "border-status-live/20", text: "text-status-live", label: "COMPLETED" },
};

// Selfie types mapped to time windows
type SelfieTimeType = "afternoon_break" | "evening_break";

const SELFIE_WINDOWS: { start: string; end: string; label: string; type: SelfieTimeType }[] = [
  { start: "14:45", end: "14:50", label: "After Lunch Selfie", type: "afternoon_break" },
  { start: "17:45", end: "17:50", label: "Break Selfie", type: "evening_break" },
];

interface HourlyReportPageProps {
  embedded?: boolean;
}

export function HourlyReportPage({ embedded = false }: HourlyReportPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"plan" | "report" | "extra">("plan");

  // MODULE 2: Admin bypass check
  const canBypass = hasAdminBypass(user?.role);

  // MODULE 3: Enable slot reminders
  useSlotReminders();

  // Plan state
  const [planSelectedTasks, setPlanSelectedTasks] = useState<Record<number, boolean>>({});
  const [planNotes, setPlanNotes] = useState("");

  // Report state
  const [reportSelectedTasks, setReportSelectedTasks] = useState<Record<number, boolean>>({});
  const [reportNotes, setReportNotes] = useState("");
  const [proofUrl, setProofUrl] = useState("");

  // Extra points state - for new work assigned or done
  const [extraWorkType, setExtraWorkType] = useState<"assigned" | "done">("assigned");
  const [extraWorkDescription, setExtraWorkDescription] = useState("");
  const [extraWorkProofUrl, setExtraWorkProofUrl] = useState("");

  // Selfie state
  const [showSelfieCapture, setShowSelfieCapture] = useState(false);
  const [selfieLabel, setSelfieLabel] = useState("");
  const [activeSelfieType, setActiveSelfieType] = useState<SelfieTimeType>("afternoon_break");
  const [capturedSelfies, setCapturedSelfies] = useState<Record<SelfieTimeType, boolean>>({
    afternoon_break: false,
    evening_break: false,
  });

  const { reports, isSaving: isReportSaving, submitReport, getReportForSlot } = useHourlyReports(new Date());
  const { plans, isSaving: isPlanSaving, submitPlan, getPlanForSlot, getParsedPlan } = useHourlyPlans(new Date());
  const { dayPlan, hasPlan: hasDayPlan, isLoading: isDayPlanLoading } = useDayPlan(new Date());
  const { isWeekOffDay } = useWeekOffAssignments();
  const [isWeekOff, setIsWeekOff] = useState(false);

  // Check week off status
  useEffect(() => {
    const checkWeekOff = async () => {
      if (!user) return;
      const today = format(new Date(), 'yyyy-MM-dd');
      const result = await isWeekOffDay(user.id, today);
      setIsWeekOff(result);
    };
    checkWeekOff();
  }, [user, isWeekOffDay]);

  const {
    entries: extraWorkEntries,
    isSaving: isExtraSaving,
    addEntry: addExtraEntry,
    getEntriesForSlot,
  } = useExtraWorkEntries(new Date());

  // Selfie capture is now triggered manually by button click only
  // Removed auto-popup logic - selfies should only open when user clicks the button

  const handleOpenSelfie = (type: SelfieTimeType, label: string) => {
    setSelfieLabel(label);
    setActiveSelfieType(type);
    setShowSelfieCapture(true);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSelfieCapture = (imageUrl: string) => {
    setCapturedSelfies((prev) => ({
      ...prev,
      [activeSelfieType]: true,
    }));
    setShowSelfieCapture(false);
  };

  const handleSlotClick = (slot: TimeSlot) => {
    if (slot.isLunchBreak) return;

    const existingReport = getReportForSlot(slot.id);
    const existingPlan = getPlanForSlot(slot.id);
    const phase = getSlotPhase(slot, currentTime, !!existingPlan, !!existingReport, canBypass);
    const status = getSlotStatus(slot, currentTime, !!existingReport, canBypass);

    // Block clicking only for upcoming slots not in plan phase
    // LIVE slots should always be clickable - only report submission is locked
    if (status === "upcoming" && phase !== "plan") {
      return;
    }

    setSelectedSlot(slot.id);

    // Load existing plan data
    const parsedPlan = getParsedPlan(slot.id);
    if (parsedPlan) {
      const taskMap: Record<number, boolean> = {};
      parsedPlan.tasks.forEach((idx) => {
        taskMap[idx] = true;
      });
      setPlanSelectedTasks(taskMap);
      setPlanNotes(parsedPlan.notes);
    } else {
      setPlanSelectedTasks({});
      setPlanNotes("");
    }

    // Load existing report data or pre-fill from plan
    if (existingReport) {
      setReportNotes(existingReport.report_text);
      setReportSelectedTasks({});
      setProofUrl("");
    } else if (parsedPlan) {
      // Pre-fill report tasks from plan
      const taskMap: Record<number, boolean> = {};
      parsedPlan.tasks.forEach((idx) => {
        taskMap[idx] = true;
      });
      setReportSelectedTasks(taskMap);
      setReportNotes("");
      setProofUrl("");
    } else {
      setReportSelectedTasks({});
      setReportNotes("");
      setProofUrl("");
    }

    // Reset extra work state
    setExtraWorkType("assigned");
    setExtraWorkDescription("");
    setExtraWorkProofUrl("");

    // Set active tab based on phase
    setActiveTab(phase === "plan" ? "plan" : "report");
  };

  const handleSubmitPlan = async () => {
    if (!selectedSlot) return;

    const selectedIndices = Object.entries(planSelectedTasks)
      .filter(([_, checked]) => checked)
      .map(([idx, _]) => parseInt(idx));

    // Description is mandatory
    if (!planNotes.trim()) return;

    const result = await submitPlan(selectedSlot, planNotes, selectedIndices);

    if (result.success) {
      // Pre-fill report with planned tasks
      setReportSelectedTasks(planSelectedTasks);
      setActiveTab("report");
    }
  };

  const handleSubmitReport = async () => {
    if (!selectedSlot) return;

    const slot = TIME_SLOTS.find((s) => s.id === selectedSlot);
    if (!slot) return;

    // Description is mandatory
    if (!reportNotes.trim()) return;

    // Build report text from selected day plan tasks
    const selectedTasksList = dayPlan?.tasks?.filter((_, index) => reportSelectedTasks[index]) || [];
    const tasksText =
      selectedTasksList.length > 0 ? `Tasks: ${selectedTasksList.join("; ")}` : "No specific tasks from day plan";

    const reportText = `${tasksText}${reportNotes ? `\nNotes: ${reportNotes}` : ""}${proofUrl ? `\nProof: ${proofUrl}` : ""}`;

    const today = format(currentTime, "yyyy-MM-dd");
    const slotEnd = parse(`${today} ${slot.endTime}`, "yyyy-MM-dd HH:mm", new Date());

    const result = await submitReport(slot.id, reportText, slotEnd);

    if (result.success) {
      setSelectedSlot(null);
      setReportSelectedTasks({});
      setReportNotes("");
      setProofUrl("");
    }
  };

  const completedSlots = reports.length;
  const totalSlots = TIME_SLOTS.filter((s) => !s.isLunchBreak).length;

  // Get current slot info for display
  const getSlotDisplayInfo = (slot: TimeSlot) => {
    const hasPlan = !!getPlanForSlot(slot.id);
    const hasReport = !!getReportForSlot(slot.id);

    if (hasReport) return { icon: "✓", label: "Completed" };
    if (hasPlan) return { icon: "📋", label: "Planned" };
    return { icon: "", label: "" };
  };

  // WEEK OFF MODE - Show relaxation screen and block all hourly work
  if (isWeekOff) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={embedded ? "" : "max-w-2xl mx-auto"}
      >
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-authority-admin/20 via-authority-admin/5 to-transparent p-12 border border-authority-admin/10 shadow-2xl text-center">
          <div className="absolute top-0 right-0 -m-20 w-80 h-80 bg-authority-admin/10 rounded-full blur-[100px] animate-pulse" />

          <div className="relative z-10 space-y-6">
            <div className="w-24 h-24 rounded-full bg-authority-admin/10 border border-authority-admin/20 flex items-center justify-center mx-auto mb-6">
              <Sun className="w-12 h-12 text-authority-admin" />
            </div>

            <h2 className="text-4xl font-black tracking-tight bg-gradient-to-r from-foreground to-foreground/40 bg-clip-text text-transparent">
              Enjoy your Week Off!
            </h2>

            <p className="text-muted-foreground max-w-md mx-auto text-lg">
              Today is your scheduled day off. No attendance marking, day plans, or hourly reports are required.
            </p>

            <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                variant="outline"
                onClick={() => navigate('/company-calendar')}
                className="rounded-xl border-authority-admin/20 hover:bg-authority-admin/5 w-full sm:w-auto"
              >
                View Company Calendar
              </Button>
              <Button
                onClick={() => navigate('/my-tasks')}
                className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto"
              >
                Go to My Tasks
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // If day plan not submitted, show blocking message
  if (!isDayPlanLoading && !hasDayPlan) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={embedded ? "" : "max-w-2xl mx-auto"}>
        {!embedded && (
          <div className="mb-8 p-4 bg-muted/30 border border-border rounded-2xl">
            <h1 className="text-2xl font-bold mb-1">Hourly Plan & Report</h1>
            <p className="text-muted-foreground">Plan before, report after each hour</p>
          </div>
        )}

        <Card className="border-status-late/30 bg-status-late/5">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-status-late/20 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-status-late" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Day Plan Required</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              You must submit your Day Plan before accessing hourly reports. This ensures a structured workflow: Plan →
              Work → Report.
            </p>
            <Button onClick={() => navigate("/day-plan")} className="gap-2">
              <ClipboardList className="w-4 h-4" />
              Go to Day Plan
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <>
      {/* Selfie Capture Modal */}
      <AnimatePresence>
        {showSelfieCapture && (
          <SelfieCapture
            title={selfieLabel}
            selfieType={activeSelfieType}
            onCapture={handleSelfieCapture}
            onClose={() => setShowSelfieCapture(false)}
          />
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={embedded ? "" : "max-w-4xl mx-auto"}>
        {!embedded && (
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl md:text-2xl font-bold mb-1">Hourly Plan & Report</h1>
                <p className="text-sm text-muted-foreground">Plan before, report after each hour</p>
              </div>
              {isWeekOff && (
                <Badge className="bg-authority-admin/10 text-authority-admin border-authority-admin/20 gap-1.5 px-3 py-1 animate-pulse">
                  <Sun className="w-3.5 h-3.5" />
                  Week Off Mode
                </Badge>
              )}
            </div>
            <div className="text-left sm:text-right flex-shrink-0">
              <div className="flex items-center gap-2 text-primary mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-lg font-bold">{format(currentTime, "hh:mm:ss a")}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {completedSlots}/{totalSlots} slots completed
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {TIME_SLOTS.map((slot, index) => {
              const existingReport = getReportForSlot(slot.id);
              const existingPlan = getPlanForSlot(slot.id);
              const status = getSlotStatus(slot, currentTime, !!existingReport, canBypass);
              const phase = getSlotPhase(slot, currentTime, !!existingPlan, !!existingReport, canBypass);
              const displayStatus = existingReport?.is_late ? "late" : status;
              const config = statusConfig[displayStatus];
              const isSelected = selectedSlot === slot.id;
              const slotInfo = getSlotDisplayInfo(slot);
              const countdown = getCountdownInfo(slot, currentTime, !!existingPlan, !!existingReport);

              return (
                <motion.div
                  key={slot.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <button
                    onClick={() => handleSlotClick(slot)}
                    disabled={slot.isLunchBreak || (status === "upcoming" && phase !== "plan")}
                    className={cn(
                      "w-full text-left p-4 rounded-lg border-2 transition-all duration-200",
                      config.bg,
                      isSelected ? "border-primary ring-2 ring-primary/20" : config.border,
                      (slot.isLunchBreak || (status === "upcoming" && phase !== "plan"))
                        ? "cursor-not-allowed opacity-60"
                        : "hover:ring-2 hover:ring-primary/10",
                    )}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="text-center min-w-[80px] sm:min-w-[100px]">
                          <p className="font-mono font-semibold text-sm sm:text-base">
                            {format(parse(slot.startTime, "HH:mm", new Date()), "hh:mm a")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            to {format(parse(slot.endTime, "HH:mm", new Date()), "hh:mm a")}
                          </p>
                        </div>

                        <div className="h-10 w-px bg-border" />

                        {slot.isLunchBreak ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Coffee className="w-4 h-4" />
                            <span>Lunch Break (Auto-locked)</span>
                          </div>
                        ) : existingReport ? (
                          <div className="flex-1">
                            <p className="font-medium truncate max-w-xs">{existingReport.report_text.split("\n")[0]}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Submitted at {format(new Date(existingReport.submitted_at), "hh:mm a")}</span>
                              {existingReport.is_late &&
                                existingReport.delay_minutes &&
                                existingReport.delay_minutes > 0 && (
                                  <span className="text-status-missed font-medium flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    Late by {existingReport.delay_minutes} min
                                  </span>
                                )}
                            </div>
                          </div>
                        ) : existingPlan ? (
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <ClipboardList className="w-4 h-4 text-primary" />
                              <span className="text-sm font-medium text-primary">Plan locked</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {phase === "report"
                                ? "Click to submit report"
                                : `Report unlocks at ${format(addMinutes(parse(slot.endTime, "HH:mm", new Date()), -5), "hh:mm a")}`}
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {phase === "locked" && status === "live" && (
                              <Lock className="w-4 h-4 text-muted-foreground" />
                            )}
                            <p className="text-muted-foreground italic">
                              {phase === "plan"
                                ? "Click to plan next hour..."
                                : phase === "report"
                                  ? "Click to submit report..."
                                  : phase === "locked" && status === "live"
                                    ? `Report unlocks at ${format(addMinutes(parse(slot.endTime, "HH:mm", new Date()), -5), "hh:mm a")}`
                                    : status === "missed"
                                      ? "Slot missed - click to explain"
                                      : "Not yet available"}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Countdown Timer */}
                        {countdown && (
                          <div
                            className={cn(
                              "px-2 py-1 rounded text-xs font-mono font-bold flex items-center gap-1",
                              countdown.type === "plan"
                                ? "bg-primary/10 text-primary"
                                : countdown.type === "report-unlock"
                                  ? "bg-blue-500/10 text-blue-500"
                                  : "bg-status-late/10 text-status-late",
                            )}
                          >
                            <Timer className="w-3 h-3" />
                            {formatCountdown(countdown.seconds)}
                          </div>
                        )}
                        {existingPlan && !existingReport && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                            PLANNED
                          </span>
                        )}
                        {existingReport?.is_late &&
                          existingReport.delay_minutes &&
                          existingReport.delay_minutes > 0 && (
                            <span className="px-2 py-1 rounded text-xs font-bold bg-status-missed/10 text-status-missed border border-status-missed/20">
                              +{existingReport.delay_minutes}m LATE
                            </span>
                          )}
                        <span
                          className={cn(
                            "px-2 py-1 rounded text-xs font-semibold tracking-wider",
                            config.bg,
                            config.text,
                            "border",
                            config.border,
                          )}
                        >
                          {config.label}
                        </span>
                        {!slot.isLunchBreak && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </button>
                </motion.div>
              );
            })}
          </div>

          <div className="lg:col-span-1">
            <AnimatePresence mode="wait">
              {selectedSlot ? (
                <motion.div
                  key={selectedSlot}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="authority-card sticky top-24"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">
                      {TIME_SLOTS.find((s) => s.id === selectedSlot)?.startTime &&
                        format(
                          parse(TIME_SLOTS.find((s) => s.id === selectedSlot)!.startTime, "HH:mm", new Date()),
                          "hh:mm a",
                        )}{" "}
                      -
                      {TIME_SLOTS.find((s) => s.id === selectedSlot)?.endTime &&
                        format(
                          parse(TIME_SLOTS.find((s) => s.id === selectedSlot)!.endTime, "HH:mm", new Date()),
                          "hh:mm a",
                        )}
                    </h3>
                  </div>

                  {/* Countdown display in panel */}
                  {(() => {
                    const slot = TIME_SLOTS.find((s) => s.id === selectedSlot);
                    if (!slot) return null;
                    const existingPlan = getPlanForSlot(slot.id);
                    const existingReport = getReportForSlot(slot.id);
                    const countdown = getCountdownInfo(slot, currentTime, !!existingPlan, !!existingReport);
                    if (!countdown) return null;

                    return (
                      <div
                        className={cn(
                          "mb-4 p-3 rounded-lg flex items-center gap-3",
                          countdown.type === "plan"
                            ? "bg-primary/10 border border-primary/20"
                            : countdown.type === "report-unlock"
                              ? "bg-blue-500/10 border border-blue-500/20"
                              : "bg-status-late/10 border border-status-late/20",
                        )}
                      >
                        <Timer
                          className={cn(
                            "w-5 h-5",
                            countdown.type === "plan"
                              ? "text-primary"
                              : countdown.type === "report-unlock"
                                ? "text-blue-500"
                                : "text-status-late",
                          )}
                        />
                        <div>
                          <p
                            className={cn(
                              "text-sm font-medium",
                              countdown.type === "plan"
                                ? "text-primary"
                                : countdown.type === "report-unlock"
                                  ? "text-blue-500"
                                  : "text-status-late",
                            )}
                          >
                            {countdown.label}
                          </p>
                          <p
                            className={cn(
                              "text-2xl font-mono font-bold",
                              countdown.type === "plan"
                                ? "text-primary"
                                : countdown.type === "report-unlock"
                                  ? "text-blue-500"
                                  : "text-status-late",
                            )}
                          >
                            {formatCountdown(countdown.seconds)}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  <Tabs
                    value={activeTab}
                    onValueChange={(v) => setActiveTab(v as "plan" | "report" | "extra")}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                      <TabsTrigger value="plan" className="gap-1 text-xs px-2">
                        <ClipboardList className="w-3 h-3" />
                        Plan
                      </TabsTrigger>
                      <TabsTrigger value="report" className="gap-1 text-xs px-2">
                        <FileText className="w-3 h-3" />
                        Report
                      </TabsTrigger>
                      <TabsTrigger value="extra" className="gap-1 text-xs px-2">
                        <Plus className="w-3 h-3" />
                        Extra
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="plan" className="space-y-4">
                      {getPlanForSlot(selectedSlot) ? (
                        <>
                          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                            <div className="flex items-center gap-2 mb-2">
                              <Lock className="w-4 h-4 text-primary" />
                              <span className="text-sm font-medium text-primary">Plan Locked</span>
                            </div>
                            {dayPlan?.tasks && (
                              <div className="space-y-1">
                                {getParsedPlan(selectedSlot)?.tasks.map((idx) => (
                                  <p key={idx} className="text-xs text-muted-foreground">
                                    • {dayPlan.tasks[idx]}
                                  </p>
                                ))}
                                {getParsedPlan(selectedSlot)?.notes && (
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Notes: {getParsedPlan(selectedSlot)?.notes}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground text-center">
                            Switch to Report tab to submit what you've done
                          </p>
                        </>
                      ) : (
                        <>
                          <div>
                            <Label className="text-sm mb-2 block">What will you work on?</Label>
                            {dayPlan && dayPlan.tasks && dayPlan.tasks.length > 0 ? (
                              <div className="space-y-2 max-h-40 overflow-y-auto">
                                {dayPlan.tasks.map((task, index) => (
                                  <div
                                    key={index}
                                    className="flex items-start gap-2 p-2 rounded bg-muted/30 border border-border"
                                  >
                                    <Checkbox
                                      id={`plan-task-${index}`}
                                      checked={planSelectedTasks[index] || false}
                                      onCheckedChange={(checked) => {
                                        setPlanSelectedTasks((prev) => ({ ...prev, [index]: !!checked }));
                                      }}
                                      className="mt-0.5"
                                    />
                                    <label htmlFor={`plan-task-${index}`} className="text-xs flex-1 cursor-pointer">
                                      {task}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                No day plan found. Please create a day plan first.
                              </p>
                            )}
                          </div>

                          <div>
                            <Label className="text-sm mb-2 block">Description / Explanation of Task *</Label>
                            <Textarea
                              value={planNotes}
                              onChange={(e) => setPlanNotes(e.target.value)}
                              placeholder="Describe your planned work in detail... (Required)"
                              className="min-h-[60px]"
                            />
                            {!planNotes.trim() && (
                              <p className="text-xs text-status-missed mt-1">Description is mandatory</p>
                            )}
                          </div>

                          <Button
                            onClick={handleSubmitPlan}
                            className="w-full"
                            disabled={isPlanSaving || !planNotes.trim()}
                          >
                            <Lock className="w-4 h-4 mr-2" />
                            {isPlanSaving ? "Locking..." : "Lock Hourly Plan"}
                          </Button>
                        </>
                      )}
                    </TabsContent>

                    <TabsContent value="report" className="space-y-4">
                      {(() => {
                        const slot = TIME_SLOTS.find((s) => s.id === selectedSlot);
                        if (!slot) return null;

                        const today = format(currentTime, "yyyy-MM-dd");
                        const slotEnd = parse(`${today} ${slot.endTime}`, "yyyy-MM-dd HH:mm", new Date());
                        const reportUnlockTime = addMinutes(slotEnd, -5); // -5 minute rule
                        const isReportWindowOpen = currentTime >= reportUnlockTime;
                        const existingReport = getReportForSlot(selectedSlot);

                        if (existingReport) {
                          return (
                            <div className="space-y-3">
                              <div className="p-3 rounded-lg bg-muted/30 flex items-center gap-2 text-sm text-muted-foreground">
                                <Lock className="w-4 h-4" />
                                <span>Report Submitted & Locked</span>
                              </div>
                              {existingReport.is_late && existingReport.delay_minutes && existingReport.delay_minutes > 0 && (
                                <div className="p-3 rounded-lg bg-status-missed/10 border border-status-missed/20 flex items-center gap-2">
                                  <AlertTriangle className="w-4 h-4 text-status-missed" />
                                  <span className="text-sm font-medium text-status-missed">
                                    Submitted late by {existingReport.delay_minutes} minutes
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        }

                        // Report window opens 5 minutes before slot ends - NO BYPASS for anyone (discipline rule)
                        if (!isReportWindowOpen) {
                          return (
                            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 text-center">
                              <Lock className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                              <p className="font-medium text-blue-500 mb-1">Report Not Yet Available</p>
                              <p className="text-xs text-muted-foreground">
                                Report submission opens at{" "}
                                <span className="font-semibold">{format(reportUnlockTime, "hh:mm a")}</span>
                              </p>
                              <p className="text-xs text-muted-foreground mt-2">
                                Current time: {format(currentTime, "hh:mm:ss a")}
                              </p>
                            </div>
                          );
                        }

                        return (
                          <>
                            {/* Show planned tasks for reference */}
                            {getPlanForSlot(selectedSlot) && (
                              <div className="p-2 rounded bg-primary/5 border border-primary/10 mb-2">
                                <p className="text-xs font-medium text-primary mb-1">Planned Tasks:</p>
                                {getParsedPlan(selectedSlot)?.tasks.map((idx) => (
                                  <p key={idx} className="text-xs text-muted-foreground">
                                    • {dayPlan?.tasks[idx]}
                                  </p>
                                ))}
                              </div>
                            )}

                            <div>
                              <Label className="text-sm mb-2 block">What did you complete?</Label>
                              {dayPlan && dayPlan.tasks && dayPlan.tasks.length > 0 ? (
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                  {dayPlan.tasks.map((task, index) => (
                                    <div
                                      key={index}
                                      className="flex items-start gap-2 p-2 rounded bg-muted/30 border border-border"
                                    >
                                      <Checkbox
                                        id={`report-task-${index}`}
                                        checked={reportSelectedTasks[index] || false}
                                        onCheckedChange={(checked) => {
                                          setReportSelectedTasks((prev) => ({ ...prev, [index]: !!checked }));
                                        }}
                                        className="mt-0.5"
                                      />
                                      <label htmlFor={`report-task-${index}`} className="text-xs flex-1 cursor-pointer">
                                        {task}
                                      </label>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">No day plan found.</p>
                              )}
                            </div>

                            <div>
                              <Label className="text-sm mb-2 block">Description / Explanation of Task *</Label>
                              <Textarea
                                value={reportNotes}
                                onChange={(e) => setReportNotes(e.target.value)}
                                placeholder="Describe what you completed in detail... (Required)"
                                className="min-h-[60px]"
                              />
                              {!reportNotes.trim() && (
                                <p className="text-xs text-status-missed mt-1">Description is mandatory</p>
                              )}
                            </div>

                            <div>
                              <Label className="text-sm mb-2 block">Proof URL (Optional)</Label>
                              <Input
                                value={proofUrl}
                                onChange={(e) => setProofUrl(e.target.value)}
                                placeholder="Drive link, screenshot URL..."
                              />
                            </div>

                            <Button
                              onClick={handleSubmitReport}
                              className="w-full"
                              disabled={isReportSaving || !reportNotes.trim() || !isReportWindowOpen}
                            >
                              {!isReportWindowOpen ? (
                                <>
                                  <Lock className="w-4 h-4 mr-2" />
                                  Report Locked
                                </>
                              ) : (
                                <>
                                  <Check className="w-4 h-4 mr-2" />
                                  {isReportSaving ? "Submitting..." : "Submit Report"}
                                </>
                              )}
                            </Button>
                          </>
                        );
                      })()}
                    </TabsContent>

                    <TabsContent value="extra" className="space-y-4">
                      <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Plus className="w-4 h-4 text-accent-foreground" />
                          <span className="text-sm font-medium">Extra Work Points</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Log any new work that was assigned or done outside the original day plan
                        </p>
                      </div>

                      <div>
                        <Label className="text-sm mb-2 block">Type of Extra Work *</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={extraWorkType === "assigned" ? "default" : "outline"}
                            onClick={() => setExtraWorkType("assigned")}
                            className="flex-1"
                          >
                            New Work Assigned
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={extraWorkType === "done" ? "default" : "outline"}
                            onClick={() => setExtraWorkType("done")}
                            className="flex-1"
                          >
                            Extra Work Done
                          </Button>
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm mb-2 block">Description / Explanation *</Label>
                        <Textarea
                          value={extraWorkDescription}
                          onChange={(e) => setExtraWorkDescription(e.target.value)}
                          placeholder={
                            extraWorkType === "assigned"
                              ? "Describe the new work that was assigned to you..."
                              : "Describe the extra work you completed that wasn't planned..."
                          }
                          className="min-h-[80px]"
                        />
                        {!extraWorkDescription.trim() && (
                          <p className="text-xs text-status-missed mt-1">Description is mandatory</p>
                        )}
                      </div>

                      <div>
                        <Label className="text-sm mb-2 block">Proof URL (Optional)</Label>
                        <Input
                          value={extraWorkProofUrl}
                          onChange={(e) => setExtraWorkProofUrl(e.target.value)}
                          placeholder="Drive link, screenshot URL..."
                        />
                      </div>

                      <Button
                        onClick={async () => {
                          if (!extraWorkDescription.trim() || !selectedSlot) return;
                          // Save to database
                          const result = await addExtraEntry(
                            selectedSlot,
                            extraWorkType,
                            extraWorkDescription,
                            extraWorkProofUrl || undefined,
                          );
                          if (result.success) {
                            // Also append to report notes for immediate visibility
                            const extraText = `[EXTRA - ${extraWorkType === "assigned" ? "NEW ASSIGNED" : "EXTRA DONE"}]: ${extraWorkDescription}${extraWorkProofUrl ? ` (Proof: ${extraWorkProofUrl})` : ""}`;
                            setReportNotes((prev) => (prev ? `${prev}\n\n${extraText}` : extraText));
                            setExtraWorkDescription("");
                            setExtraWorkProofUrl("");
                            setActiveTab("report");
                          }
                        }}
                        className="w-full"
                        disabled={!extraWorkDescription.trim() || isExtraSaving}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {isExtraSaving ? "Saving..." : "Add to Report"}
                      </Button>

                      {/* Show saved extra entries for this slot */}
                      {selectedSlot && getEntriesForSlot(selectedSlot).length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            Saved Extra Work for this Slot:
                          </p>
                          <div className="space-y-2">
                            {getEntriesForSlot(selectedSlot).map((entry) => (
                              <div key={entry.id} className="p-2 rounded bg-muted/30 border border-border">
                                <div className="flex items-center gap-2 mb-1">
                                  <span
                                    className={cn(
                                      "text-xs px-1.5 py-0.5 rounded font-medium",
                                      entry.work_type === "assigned"
                                        ? "bg-primary/10 text-primary"
                                        : "bg-status-live/10 text-status-live",
                                    )}
                                  >
                                    {entry.work_type === "assigned" ? "NEW ASSIGNED" : "EXTRA DONE"}
                                  </span>
                                </div>
                                <p className="text-xs text-foreground">{entry.description}</p>
                                {entry.proof_url && (
                                  <p className="text-xs text-muted-foreground mt-1">Proof: {entry.proof_url}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="authority-card text-center py-8"
                >
                  <Timer className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Select a time slot</p>
                  <p className="text-xs text-muted-foreground mt-2">Plan before → Report after</p>
                </motion.div>
              )}
            </AnimatePresence>

            {completedSlots >= 5 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                <Button variant="outline" onClick={() => navigate("/eod-summary")} className="w-full">
                  Proceed to EOD Summary
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
