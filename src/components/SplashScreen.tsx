import { useState, useEffect, useRef, forwardRef, useMemo } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import igoLogo from '@/assets/igo-logo.png';

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

// --- High-Speed Quantum Magnet Engine ---
const QuantumMagnet = ({ phase }: { phase: 'exploding' | 'snapping' | 'stabilized' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<any[]>([]);
  const frameId = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const count = 150;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const initParticles = () => {
      particles.current = [];
      for (let i = 0; i < count; i++) {
        particles.current.push({
          x: centerX,
          y: centerY,
          originX: centerX,
          originY: centerY,
          targetX: centerX + (Math.random() - 0.5) * 600,
          targetY: centerY + (Math.random() - 0.5) * 600,
          vx: (Math.random() - 0.5) * 40,
          vy: (Math.random() - 0.5) * 40,
          size: Math.random() * 2 + 1,
          color: i % 3 === 0 ? '#60a5fa' : i % 3 === 1 ? '#34d399' : '#fbbf24'
        });
      }
    };

    const animate = () => {
      ctx.fillStyle = 'rgba(0, 1, 5, 0.2)'; // Motion blur trail
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particles.current.forEach(p => {
        if (phase === 'exploding') {
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.96;
          p.vy *= 0.96;
        } else if (phase === 'snapping') {
          const dx = centerX - p.x;
          const dy = centerY - p.y;
          p.vx += dx * 0.08;
          p.vy += dy * 0.08;
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.85;
          p.vy *= 0.85;
        } else {
          // Stabilized drift
          p.x += (Math.random() - 0.5) * 0.5;
          p.y += (Math.random() - 0.5) * 0.5;
        }

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Connect lines if close during snapping
        if (phase === 'snapping' || phase === 'stabilized') {
          const dist = Math.sqrt((p.x - centerX) ** 2 + (p.y - centerY) ** 2);
          if (dist < 150) {
            ctx.strokeStyle = `${p.color}22`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(centerX, centerY);
            ctx.stroke();
          }
        }
      });

      frameId.current = requestAnimationFrame(animate);
    };

    window.addEventListener('resize', resize);
    resize();
    initParticles();
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frameId.current);
    };
  }, [phase]);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0" />;
};

// --- Animation Variants ---
const containerVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: {
    opacity: 0,
    transition: { duration: 0.5, ease: "circIn" }
  }
};

const logoVariants: Variants = {
  initial: { scale: 0, opacity: 0, filter: 'blur(20px) contrast(2)' },
  snap: {
    scale: [0, 1.2, 1],
    opacity: 1,
    filter: 'blur(0px) contrast(1)',
    transition: { delay: 0.6, duration: 0.8, ease: [0.16, 1, 0.3, 1] }
  }
};

const textVariants: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { delay: 1.2, duration: 0.6 }
  }
};

export const SplashScreen = forwardRef<HTMLDivElement, SplashScreenProps>(
  function SplashScreen({ onComplete, duration = 3000 }, ref) {
    const [visible, setVisible] = useState(true);
    const [phase, setPhase] = useState<'exploding' | 'snapping' | 'stabilized'>('exploding');

    useEffect(() => {
      // Phase Triggers
      const snapTimer = setTimeout(() => setPhase('snapping'), 400);
      const stableTimer = setTimeout(() => setPhase('stabilized'), 1000);
      const exitTimer = setTimeout(() => {
        setVisible(false);
        onComplete();
      }, duration);

      return () => {
        clearTimeout(snapTimer);
        clearTimeout(stableTimer);
        clearTimeout(exitTimer);
      };
    }, [duration, onComplete]);

    return (
      <AnimatePresence>
        {visible && (
          <motion.div
            key="splash-v4-quantum"
            ref={ref}
            variants={containerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-[#000105]"
          >
            {/* The Magnet Engine */}
            <QuantumMagnet phase={phase} />

            {/* Content Layer */}
            <div className="relative z-10 flex flex-col items-center">
              {/* Central Assemble Logo */}
              <motion.div
                variants={logoVariants}
                animate="snap"
                className="relative w-32 h-32 mb-8"
              >
                {/* Magnetic Core Glow */}
                <div className="absolute inset-[-40px] bg-blue-500/10 blur-[60px] rounded-full animate-pulse" />

                <div className="absolute inset-0 bg-white rounded-full p-5 shadow-[0_0_50px_rgba(59,130,246,0.3)] ring-1 ring-white/20 flex items-center justify-center overflow-hidden">
                  <img src={igoLogo} alt="IGO" className="w-full h-full object-contain" />
                </div>
              </motion.div>

              {/* Company Info */}
              <motion.div
                variants={textVariants}
                className="text-center"
              >
                <h1 className="text-4xl font-black text-white tracking-[0.4em] mb-2">
                  IGO GROUP
                </h1>
                <p className="text-[10px] text-blue-400 font-mono tracking-[0.8em] uppercase opacity-60">
                  SYSTEM_INITIALIZED
                </p>
              </motion.div>
            </div>

            {/* Bottom Tech Bar */}
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: '200px' }}
              transition={{ delay: 1, duration: 1 }}
              className="absolute bottom-16 h-[1px] bg-gradient-to-r from-transparent via-blue-500 to-transparent"
            />

            {/* Corner Precision Elements */}
            <div className="absolute top-8 left-8 border-l border-t border-white/10 w-8 h-8 opacity-40" />
            <div className="absolute bottom-8 right-8 border-r border-b border-white/10 w-8 h-8 opacity-40" />

            {/* Cinematic Noise Layer */}
            <div className="absolute inset-0 z-0 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.1] mix-blend-overlay" />
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);
