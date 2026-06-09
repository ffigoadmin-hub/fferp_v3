import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export interface AIConfig {
    id: string;
    provider: string;
    model_id: string;
    fallback_model_id?: string;
    system_prompt?: string;
    temperature?: number;
    is_active: boolean;
    settings: {
        batch_size: number;
        delay_ms: number;
        max_tokens: number;
    };
    created_at: string;
    updated_at: string;
}

export interface AIUsageLog {
    id: string;
    function_name: string;
    provider: string;
    model: string;
    tokens_input: number;
    tokens_output: number;
    duration_ms: number;
    status: string;
    error_message: string | null;
    created_at: string;
    meta: any;
}

export function useAIConfig() {
    const [config, setConfig] = useState<AIConfig | null>(null);
    const [logs, setLogs] = useState<AIUsageLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [logsLoading, setLogsLoading] = useState(true);
    const { toast } = useToast();

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('ai_config')
                .select('id, provider, model_id, fallback_model_id, system_prompt, temperature, is_active, settings, created_at, updated_at')
                .limit(1)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                // Parse settings if it's a string, otherwise it's already an object
                const parsedSettings = typeof data.settings === 'string'
                    ? JSON.parse(data.settings)
                    : data.settings;

                setConfig({
                    ...data,
                    settings: parsedSettings || { batch_size: 3, delay_ms: 2000, max_tokens: 1024 }
                });
            } else {
                console.log('No AI configuration found, awaiting initialization...');
            }
        } catch (error) {
            console.error('Error fetching AI config:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateConfig = async (newConfig: Partial<AIConfig>) => {
        try {
            console.log('🔧 Attempting to update AI config...', { configId: config?.id, newConfig });

            // Prepare payload with explicit fields
            const payload: any = {
                updated_at: new Date().toISOString()
            };

            if (newConfig.provider) payload.provider = newConfig.provider;
            if (newConfig.model_id) payload.model_id = newConfig.model_id;
            if (newConfig.fallback_model_id !== undefined) payload.fallback_model_id = newConfig.fallback_model_id;
            if (newConfig.system_prompt !== undefined) payload.system_prompt = newConfig.system_prompt;
            if (newConfig.temperature !== undefined) payload.temperature = newConfig.temperature;
            if (newConfig.is_active !== undefined) payload.is_active = newConfig.is_active;
            if (newConfig.settings) payload.settings = newConfig.settings;

            console.log('📦 Payload to be sent:', payload);

            let result;
            let error;

            if (config?.id) {
                console.log('🔄 Updating existing config with ID:', config.id);
                result = await supabase
                    .from('ai_config')
                    .update(payload)
                    .eq('id', config.id)
                    .select('id, provider, model_id, fallback_model_id, system_prompt, temperature, is_active, settings, created_at, updated_at');
                error = result.error;
                console.log('📊 Update result:', { data: result.data, error: result.error });
            } else {
                console.log('➕ Inserting new config...');
                result = await supabase
                    .from('ai_config')
                    .insert([payload])
                    .select('id, provider, model_id, fallback_model_id, system_prompt, temperature, is_active, settings, created_at, updated_at');
                error = result.error;
                console.log('📊 Insert result:', { data: result.data, error: result.error });
            }

            if (error) {
                console.error('❌ Database error details:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                throw error;
            }

            console.log('✅ AI Config updated successfully!');
            toast({
                title: "Success",
                description: "AI Configuration updated successfully.",
            });
            fetchConfig();
        } catch (error: any) {
            console.error('💥 Error updating AI config:', {
                error,
                message: error?.message,
                details: error?.details,
                hint: error?.hint,
                code: error?.code,
                stack: error?.stack
            });
            toast({
                title: "Error",
                description: `Failed to update AI configuration: ${error?.message || 'Unknown error'}`,
                variant: "destructive",
            });
        }
    };

    const fetchLogs = async () => {
        try {
            setLogsLoading(true);
            const { data, error } = await supabase
                .from('ai_usage_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setLogs(data || []);
        } catch (error) {
            console.error('Error fetching AI logs:', error);
        } finally {
            setLogsLoading(false);
        }
    };

    useEffect(() => {
        const initialize = async () => {
            // Fetch logs immediately
            fetchLogs();

            // Core Initialization Logic
            const { data, error } = await supabase
                .from('ai_config')
                .select('id, provider, model_id, fallback_model_id, system_prompt, temperature, is_active, settings, created_at, updated_at')
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error('Initialization fetch failed:', error);
                setLoading(false);
                return;
            }

            if (data) {
                const parsedSettings = typeof data.settings === 'string'
                    ? JSON.parse(data.settings)
                    : data.settings;
                setConfig({
                    ...data,
                    settings: parsedSettings || { batch_size: 3, delay_ms: 2000, max_tokens: 1024 }
                });
                setLoading(false);
            } else {
                console.log('Generating default AI configuration...');
                const defaultPayload = {
                    provider: 'google',
                    model_id: 'google/gemini-2.0-flash',
                    system_prompt: 'You are a highly efficient AI Compliance Auditor. Analyze employee throughput and discipline metrics based on the provided logs.',
                    temperature: 0.7,
                    is_active: true,
                    settings: {
                        batch_size: 3,
                        delay_ms: 2000,
                        max_tokens: 1024
                    }
                };

                const { data: inserted, error: insertError } = await supabase
                    .from('ai_config')
                    .insert([defaultPayload])
                    .select()
                    .single();

                if (!insertError && inserted) {
                    setConfig(inserted as any);
                }
                setLoading(false);
            }
        };

        initialize();

        // Subscribe to realtime logs
        const channel = supabase
            .channel('ai_usage_logs_changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'ai_usage_logs',
                },
                (payload) => {
                    setLogs((prev) => [payload.new as AIUsageLog, ...prev].slice(0, 50));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return {
        config,
        logs,
        loading,
        logsLoading,
        updateConfig,
        refreshLogs: fetchLogs
    };
}
