import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedActivity } from './useUnifiedWorkAnalytics';

export type AnalysisType = 'overview' | 'department' | 'individuals' | 'recommendations';

interface UseIntelligenceAIReturn {
  response: string;
  isLoading: boolean;
  loadingStage: string;
  error: string | null;
  analyze: (activities: UnifiedActivity[], type: AnalysisType, date: string) => Promise<void>;
  clearResponse: () => void;
}

export function useIntelligenceAI(): UseIntelligenceAIReturn {
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (
    activities: UnifiedActivity[],
    analysisType: AnalysisType,
    date: string
  ) => {
    setIsLoading(true);
    setResponse('');
    setError(null);
    setLoadingStage('Connecting...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      setLoadingStage('Analyzing workforce data...');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/intelligence-analyze`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            activities: activities.map(a => ({
              id: a.id,
              userId: a.userId,
              userName: a.userName,
              userEmail: a.userEmail,
              department: a.department,
              role: a.role,
              type: a.type,
              status: a.status,
              loginTime: a.loginTime,
              lastActiveSlot: a.lastActiveSlot,
              complianceScore: a.complianceScore,
              metrics: a.metrics,
            })),
            analysisType,
            date,
          }),
        }
      );

      if (!res.ok) {
        let errorMessage = 'Analysis failed';
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `Analysis failed with status ${res.status}`;
        }
        throw new Error(errorMessage);
      }

      setLoadingStage('Generating insights...');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Process line-by-line
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.text) {
              setResponse(prev => prev + parsed.text);
              setLoadingStage('');
            }
          } catch {
            // Incomplete JSON, re-buffer
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }
    } catch (err) {
      console.error('[useIntelligenceAI] Error:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsLoading(false);
      setLoadingStage('');
    }
  }, []);

  const clearResponse = useCallback(() => {
    setResponse('');
    setError(null);
  }, []);

  return {
    response,
    isLoading,
    loadingStage,
    error,
    analyze,
    clearResponse,
  };
}
