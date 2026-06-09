import React, { useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { THEMES, ThemeConfig } from "../types/theme";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Paintbrush, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const ThemeSelector = () => {
    const { theme, setTheme, isAutoMode, setAutoMode } = useTheme();
    const [isOpen, setIsOpen] = useState(false);

    // Group themes by category
    const groupedThemes = THEMES.reduce((acc, t) => {
        if (!acc[t.category]) acc[t.category] = [];
        acc[t.category].push(t);
        return acc;
    }, {} as Record<string, ThemeConfig[]>);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="relative group">
                    <Paintbrush className="w-5 h-5 group-hover:text-primary transition-colors" />
                    <span className="sr-only">Change Theme</span>
                    {/* Active Indicator */}
                    {theme !== 'default' && (
                        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary animate-pulse" />
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col glass-intensity-high border-white/10">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <Paintbrush className="w-5 h-5 text-primary" />
                            Appearance & Themes
                        </span>
                        <div className="flex items-center gap-2 text-sm font-normal mr-8">
                            <Label htmlFor="auto-mode" className="text-muted-foreground cursor-pointer">Auto-Pilot Mode</Label>
                            <Switch
                                id="auto-mode"
                                checked={isAutoMode}
                                onCheckedChange={setAutoMode}
                            />
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2 my-2">
                    <div className="space-y-6 pb-6">
                        {isAutoMode && (
                            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary mb-4 flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                <p><strong>Auto-Pilot Active:</strong> System will automatically set themes based on holidays and events.</p>
                            </div>
                        )}

                        {Object.entries(groupedThemes).map(([category, themes]) => (
                            <div key={category} className="space-y-3">
                                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest sticky top-0 bg-background/95 backdrop-blur-sm py-2 z-10 border-b border-border/50">
                                    {category}
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {themes.map((t) => (
                                        <button
                                            key={t.id}
                                            onClick={() => setTheme(t.id)}
                                            disabled={isAutoMode}
                                            className={cn(
                                                "relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left group hover:scale-[1.02]",
                                                theme === t.id
                                                    ? "bg-primary/10 border-primary ring-1 ring-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.3)]"
                                                    : "bg-card/40 border-white/5 hover:bg-card/80 hover:border-primary/30",
                                                isAutoMode && t.id !== theme && "opacity-40 cursor-not-allowed grayscale"
                                            )}
                                        >
                                            {/* Color Preview */}
                                            <div
                                                className="w-8 h-8 rounded-full shadow-inner border border-white/20 flex items-center justify-center shrink-0"
                                                style={{ backgroundColor: t.primaryColor }}
                                            >
                                                {theme === t.id && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                                                    {t.name}
                                                </div>
                                                {isAutoMode && t.id === theme && (
                                                    <div className="text-[10px] text-primary font-mono uppercase mt-0.5 animate-pulse">Auto Active</div>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="pt-4 border-t border-white/10 flex justify-end">
                    <Button onClick={() => setIsOpen(false)} variant="default" className="w-full sm:w-auto">
                        Done
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
