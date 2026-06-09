import { useEffect } from 'react';
import { useHeartConfetti } from '@/hooks/useHeartConfetti';
import { useTheme } from '@/hooks/useTheme';

export const LoveClickEffect = () => {
    const { theme } = useTheme();
    const { triggerMouseConfetti } = useHeartConfetti();

    useEffect(() => {
        if (theme !== 'valentine') return;

        const handleClick = (e: MouseEvent) => {
            // Check if target is a button, link, or has role="button"
            const target = e.target as HTMLElement;
            const closestButton = target.closest('button, a, [role="button"]');

            if (closestButton) {
                triggerMouseConfetti(e.clientX, e.clientY);
            }
        };

        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [theme, triggerMouseConfetti]);

    return null; // Renderless component
};
