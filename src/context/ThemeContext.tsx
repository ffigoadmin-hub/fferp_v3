import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeId, THEMES } from '../types/theme';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ThemeContextType {
    theme: ThemeId;
    setTheme: (theme: ThemeId) => Promise<void>;
    isAutoMode: boolean;
    setAutoMode: (isAuto: boolean) => Promise<void>;
    isLoading: boolean;
    isAdmin: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [theme, setThemeState] = useState<ThemeId>('default');
    const [isAutoMode, setAutoModeState] = useState<boolean>(true);
    const [isLoading, setIsLoading] = useState(true);

    const isAdmin = user?.role === 'admin' || user?.role === 'ceo';

    // Apply CSS class to document root
    const applyTheme = (themeId: ThemeId) => {
        const root = document.documentElement;
        // Remove all theme classes first
        THEMES.forEach(t => {
            if (t.cssClass) root.classList.remove(t.cssClass);
        });

        // Also remove any rogue theme classes just in case
        root.classList.forEach(cls => {
            if (cls.startsWith('theme-')) root.classList.remove(cls);
        });

        const newThemeConfig = THEMES.find(t => t.id === themeId);
        if (newThemeConfig && newThemeConfig.cssClass) {
            root.classList.add(newThemeConfig.cssClass);
            console.log('🎨 Applied Theme Class:', newThemeConfig.cssClass);
        } else if (themeId !== 'default') {
            // Fallback if config not found but ID exists (e.g. from DB)
            root.classList.add(`theme-${themeId}`);
            console.log('⚠️ Applied Fallback Theme Class:', `theme-${themeId}`);
        }
    };

    // Helper for Auto-Pilot Logic
    function getAutoThemeForDate(date: Date): ThemeId {
        const month = date.getMonth() + 1; // 1-12
        const day = date.getDate();

        if (month === 2 && day === 14) return 'valentine';
        if (month === 1 && day === 26) return 'republic';
        if (month === 8 && day === 15) return 'independence';
        if (month === 10 && day === 2) return 'default';
        if (month === 1 && day === 1) return 'new-year';
        if (month === 12 && day === 25) return 'christmas';

        return 'default';
    }

    // Load initial settings from Supabase
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data, error } = await (supabase
                    .from('system_settings' as any)
                    .select('value')
                    .eq('key', 'theme_config')
                    .maybeSingle());

                if (data && (data as any).value) {
                    // Safe JSON casting
                    const config = (data as any).value as any;
                    const serverTheme = config.current_theme as ThemeId;
                    const serverAuto = config.is_auto_mode as boolean;

                    setAutoModeState(serverAuto);

                    let effectiveTheme = serverTheme;
                    if (serverAuto) {
                        effectiveTheme = getAutoThemeForDate(new Date());
                    }

                    setThemeState(effectiveTheme);
                    applyTheme(effectiveTheme);

                    // Sync to localStorage for next reload
                    localStorage.setItem('theme-storage', JSON.stringify({ theme: effectiveTheme, auto: serverAuto }));
                }
            } catch (err) {
                console.error('Error loading theme settings:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSettings();

        // Realtime Subscription
        const channel = supabase
            .channel('public:system_settings')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'system_settings', filter: "key=eq.theme_config" },
                (payload) => {
                    console.log('🔔 Theme Change Received:', payload.new.value);
                    const config = payload.new.value as any;
                    const newAuto = config.is_auto_mode;
                    const newTheme = config.current_theme;

                    setAutoModeState(newAuto);

                    if (newAuto) {
                        const autoTheme = getAutoThemeForDate(new Date());
                        setThemeState(autoTheme);
                        applyTheme(autoTheme);
                    } else {
                        setThemeState(newTheme);
                        applyTheme(newTheme);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const setTheme = async (newTheme: ThemeId) => {
        // Permission check
        if (!isAdmin) {
            console.warn('⛔ Unauthorized: Only admins can change global themes. Role:', user?.role);
            toast.error("Access Denied: Admin privileges required.");
            return;
        }

        console.log('🔄 Setting Global Theme:', newTheme);

        // 1. Optimistic Update (Immediate UI feedback)
        setThemeState(newTheme);
        applyTheme(newTheme);

        // Cache to localStorage for Splash Screen
        localStorage.setItem('theme-storage', JSON.stringify({ theme: newTheme, auto: isAutoMode }));
        console.log('📦 Cached theme to localStorage:', newTheme);

        // 2. Persist to Supabase
        try {
            const { error } = await (supabase
                .from('system_settings' as any)
                .update({
                    value: {
                        current_theme: newTheme,
                        is_auto_mode: isAutoMode
                    },
                    updated_at: new Date().toISOString()
                })
                .eq('key', 'theme_config'));

            if (error) {
                console.error('❌ Error saving theme to DB:', error);
                toast.error("Failed to save global theme.");
            } else {
                console.log('💾 Theme saved to Supabase');
                toast.success(`Theme updated to ${newTheme}`);
            }
        } catch (err) {
            console.error('❌ Exception saving theme:', err);
        }
    };

    const setAutoMode = async (val: boolean) => {
        if (!isAdmin) return;

        // Optimistic update
        setAutoModeState(val);

        // If turning ON auto mode, calculate logical theme instantly
        let themeToSave = theme;
        if (val) {
            const autoTheme = getAutoThemeForDate(new Date());
            setThemeState(autoTheme);
            applyTheme(autoTheme);
            themeToSave = autoTheme; // Just for consistency, though DB stores state not result
        }

        // Cache to localStorage for Splash Screen
        localStorage.setItem('theme-storage', JSON.stringify({ theme: themeToSave, auto: val }));

        const { error } = await (supabase
            .from('system_settings' as any)
            .update({
                value: {
                    current_theme: themeToSave,
                    is_auto_mode: val
                },
                updated_at: new Date().toISOString()
            })
            .eq('key', 'theme_config'));

        if (error) console.error('Error saving auto mode:', error);
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, isAutoMode, setAutoMode, isLoading, isAdmin }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
