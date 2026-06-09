import React, { useEffect, useState } from 'react';

export const FallingHearts = () => {
    const [hearts, setHearts] = useState<Array<{ id: number; left: string; animationDuration: string; delay: string; scale: number }>>([]);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const checkTheme = () => {
            const isValentine = document.documentElement.classList.contains('theme-valentine');
            setIsVisible(isValentine);

            if (isValentine && hearts.length === 0) {
                const newHearts = Array.from({ length: 15 }).map((_, i) => ({
                    id: i,
                    left: `${Math.random() * 100}%`,
                    animationDuration: `${Math.random() * 3 + 4}s`, // 4-7s for slower, more romantic fall
                    delay: `${Math.random() * 5}s`,
                    scale: Math.random() * 0.5 + 0.5, // vary size
                }));
                setHearts(newHearts);
            }
        };

        // Check immediately
        checkTheme();

        // Set up an observer to watch for class changes on html
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    checkTheme();
                }
            });
        });

        observer.observe(document.documentElement, { attributes: true });

        return () => observer.disconnect();
    }, [hearts.length]);

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
            {hearts.map((heart) => (
                <div
                    key={heart.id}
                    className="absolute top-[-10%] text-2xl animate-fall opacity-0"
                    style={{
                        left: heart.left,
                        animation: `fall ${heart.animationDuration} linear infinite`,
                        animationDelay: heart.delay,
                        fontSize: `${heart.scale * 2}rem`,
                        willChange: 'transform',
                        transform: 'translateZ(0)', // Force GPU acceleration
                    }}
                >
                    {['❤️', '💖', '💘', '💝', '💕'][Math.floor(Math.random() * 5)]}
                </div>
            ))}
        </div>
    );
};
