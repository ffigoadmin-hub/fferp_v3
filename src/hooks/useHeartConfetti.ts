import confetti from 'canvas-confetti';
import { useCallback } from 'react';
import { useTheme } from '../hooks/useTheme';

export const useHeartConfetti = () => {
    const { theme } = useTheme();

    const triggerHeartExplosion = useCallback(() => {
        // Only trigger if in Valentine theme
        // But for fun, we can allow it always if manually called, 
        // or restrict it. Let's restrict to valentine for "automatic" triggers.
        // For manual triggers (like login success), we might want it regardless, 
        // but user specifically asked for "in love theme".

        // Default scalar
        const scalar = 2;
        const heart = confetti.shapeFromPath({
            path: 'M167 102.7c-22.9-25.2-61.9-20.3-77.9 6.8c-16-27.1-55-32-77.9-6.8c-26.6 29.3-22.7 80.4 34.3 131.7l34.8 30.7c2.9 2.6 7.4 2.6 10.3 0l34.8-30.7c56.8-51.3 60.8-102.4 34.2-131.7z'
        });

        confetti({
            shapes: [heart],
            colors: ['#ff0a54', '#ff477e', '#ff7096', '#ff85a1', '#fbb1bd', '#f9bec7'],
            scalar: scalar,
            drift: 0,
            gravity: 1.2, // Fall faster
            spread: 70,
            origin: { y: 0.6 }, // Start slightly lower
            particleCount: 40,
        });
    }, []);

    const triggerMouseConfetti = useCallback((x: number, y: number) => {
        if (theme !== 'valentine') return;

        const scalar = 1.5;
        const heart = confetti.shapeFromPath({
            path: 'M167 102.7c-22.9-25.2-61.9-20.3-77.9 6.8c-16-27.1-55-32-77.9-6.8c-26.6 29.3-22.7 80.4 34.3 131.7l34.8 30.7c2.9 2.6 7.4 2.6 10.3 0l34.8-30.7c56.8-51.3 60.8-102.4 34.2-131.7z'
        });

        // Normalize coordinates to 0-1 for canvas-confetti
        const xNorm = x / window.innerWidth;
        const yNorm = y / window.innerHeight;

        confetti({
            shapes: [heart],
            colors: ['#ff0a54', '#ff477e', '#ff7096'],
            scalar: scalar,
            drift: 0,
            gravity: 0.8,
            spread: 30,
            origin: { x: xNorm, y: yNorm },
            particleCount: 8, // Small burst
            ticks: 100, // Disappear faster
            startVelocity: 15,
        });
    }, [theme]);

    return { triggerHeartExplosion, triggerMouseConfetti };
};
