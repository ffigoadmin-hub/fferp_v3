import { motion } from 'framer-motion';
import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WizardStep {
    id: string;
    title: string;
    description?: string;
}

interface WizardStepsProps {
    steps: WizardStep[];
    currentStep: number;
    onStepClick?: (stepIndex: number) => void;
    allowClickNavigation?: boolean;
    variant?: 'blue' | 'orange';
}

export function WizardSteps({
    steps,
    currentStep,
    onStepClick,
    allowClickNavigation = false,
    variant = 'blue'
}: WizardStepsProps) {
    return (
        <div className="relative">
            {/* Progress Line */}
            <div className="absolute top-5 left-0 right-0 h-[2px] bg-white/5">
                <motion.div
                    className={cn(
                        "h-full bg-gradient-to-r",
                        variant === 'blue' ? "from-blue-500 to-purple-500" : "from-amber-500 to-orange-500"
                    )}
                    initial={{ width: '0%' }}
                    animate={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
                    transition={{ duration: 0.3 }}
                />
            </div>

            {/* Steps */}
            <div className="relative flex justify-between">
                {steps.map((step, index) => {
                    const isCompleted = index < currentStep;
                    const isCurrent = index === currentStep;
                    const isClickable = allowClickNavigation && (isCompleted || index === currentStep);

                    return (
                        <button
                            key={step.id}
                            onClick={() => isClickable && onStepClick?.(index)}
                            disabled={!isClickable}
                            className={cn(
                                "flex flex-col items-center gap-2 group transition-opacity",
                                isClickable ? "cursor-pointer" : "cursor-default",
                                !isCurrent && !isCompleted && "opacity-40"
                            )}
                        >
                            {/* Circle Indicator */}
                            <div
                                className={cn(
                                    "relative w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                                    isCompleted && "bg-green-500 border-green-500",
                                    isCurrent && (
                                        variant === 'blue'
                                            ? "bg-blue-500 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                                            : "bg-orange-500 border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.3)]"
                                    ),
                                    !isCompleted && !isCurrent && "bg-white/5 border-white/10"
                                )}
                            >
                                {isCompleted ? (
                                    <Check className="w-5 h-5 text-white" />
                                ) : (
                                    <span className={cn(
                                        "text-sm font-bold",
                                        isCurrent ? "text-white" : "text-muted-foreground"
                                    )}>
                                        {index + 1}
                                    </span>
                                )}
                            </div>

                            {/* Label */}
                            <div className="text-center max-w-[120px]">
                                <p className={cn(
                                    "text-xs font-bold tracking-widest uppercase",
                                    isCurrent && "text-white",
                                    isCompleted && "text-green-500",
                                    !isCurrent && !isCompleted && "text-muted-foreground"
                                )}>
                                    {step.title}
                                </p>
                                {step.description && (
                                    <p className="text-[10px] text-muted-foreground mt-1 opacity-60">
                                        {step.description}
                                    </p>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
