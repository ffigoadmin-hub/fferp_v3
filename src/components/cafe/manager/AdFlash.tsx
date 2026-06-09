import { Sparkles, X } from 'lucide-react';
import { motion } from 'framer-motion';

export function AdFlash({ ad, onClose }: { ad: any; onClose: () => void }) {
  if (!ad) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black overflow-hidden select-none">
      {/* Immersive Background Layer: Ultimate Blur Bleed */}
      <div className="absolute inset-0 pointer-events-none">
        <img
          src={ad.image_url}
          alt=""
          className="w-full h-full object-cover blur-[100px] opacity-60 scale-125 [transition-duration:10s] animate-pulse"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black" />
      </div>

      {/* Close Button - Enhanced visibility */}
      <button
        onClick={onClose}
        className="absolute top-8 right-8 p-5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-3xl transition-all z-[600] border border-white/10 group active:scale-90 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
      >
        <X className="w-10 h-10 text-white group-hover:scale-110 duration-300" />
      </button>

      {/* Main Content Area */}
      <div className="relative w-full h-full flex flex-col items-center justify-center p-0 sm:p-4 z-10">

        {/* The Image Itself - Borderless & Immersive */}
        <div className="relative group w-full h-full flex items-center justify-center overflow-hidden">
            <motion.img
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              src={ad.image_url}
              alt="Flash Ad"
              className="max-w-full max-h-full object-contain shadow-[0_0_100px_rgba(0,0,0,1)] [transition-duration:5s] hover:scale-[1.01]"
            />

            {/* Header Badge */}
            <div className="absolute top-12 left-1/2 -translate-x-1/2 px-8 py-3 rounded-2xl bg-primary/90 text-white font-black uppercase tracking-[0.4em] text-[12px] shadow-[0_0_30px_rgba(var(--primary),0.5)] border border-white/20 backdrop-blur-xl z-20">
                LIVE ANNOUNCEMENT
            </div>
        </div>

        {/* Dynamic Content Overlay */}
        {ad.message && (
          <div className="mt-8 text-center max-w-4xl space-y-6">
            <h2 className="text-4xl sm:text-6xl font-black text-white uppercase italic tracking-tighter drop-shadow-2xl leading-none">
              {ad.message}
            </h2>
            <button
              onClick={onClose}
              className="px-12 py-5 rounded-2xl bg-white text-black font-black uppercase tracking-[0.2em] text-sm shadow-2xl transition-all hover:bg-primary hover:text-white active:scale-95 flex items-center gap-3 mx-auto"
            >
              <Sparkles className="w-5 h-5" />
              Understand
            </button>
          </div>
        )}

        {!ad.message && (
             <button
             onClick={onClose}
             className="mt-12 px-10 py-4 rounded-xl bg-white/5 hover:bg-white/10 backdrop-blur-2xl text-white/60 text-[10px] font-black uppercase tracking-[0.4em] border border-white/5 transition-all"
           >
             Double Tap or Click to Dismiss
           </button>
        )}
      </div>

      {/* Progress Bar (Subtle) */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/10">
        <div className="h-full bg-primary animate-pulse origin-left [animation-duration:6000ms] linear" />
      </div>
    </div>
  );
}
