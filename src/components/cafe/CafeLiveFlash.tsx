import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coffee, X, ShoppingCart, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export const CafeLiveFlash: React.FC = () => {
  const [liveDish, setLiveDish] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleDishLive = (event: any) => {
      setLiveDish(event.detail);
      // Auto close after 10 seconds
      setTimeout(() => setLiveDish(null), 10000);
    };

    window.addEventListener('cafe-dish-live', handleDishLive);
    return () => window.removeEventListener('cafe-dish-live', handleDishLive);
  }, []);

  if (!liveDish) return null;

  return (
    <AnimatePresence>
      {liveDish && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 100 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 100 }}
          className="fixed bottom-8 right-8 z-[60] max-w-sm w-full"
        >
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0A0F1E]/95 backdrop-blur-xl shadow-2xl shadow-indigo-500/20 p-6">
            {/* Animated Background Glow */}
            <div className="absolute -top-10 -right-10 h-32 w-32 bg-indigo-500/20 blur-[50px] animate-pulse" />
            
            <button 
              onClick={() => setLiveDish(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 p-0.5 shadow-lg flex items-center justify-center">
                  <div className="h-full w-full rounded-full bg-[#0A0F1E] flex items-center justify-center overflow-hidden">
                    {liveDish.image ? (
                      <img src={liveDish.image} alt={liveDish.name} className="h-full w-full object-cover" />
                    ) : (
                      <Coffee className="text-indigo-400" size={24} />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Star size={10} className="fill-indigo-400" />
                    Just In
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">{liveDish.category}</span>
                </div>
                
                <h3 className="text-lg font-bold text-white leading-tight mb-2 truncate">
                  {liveDish.name}
                </h3>
                
                <p className="text-sm text-slate-400 font-medium mb-4">
                  Fresh and hot! Starting at ₹{liveDish.price}
                </p>

                <div className="flex gap-2">
                  <Button 
                    size="sm"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold tracking-wide"
                    onClick={() => {
                      navigate('/palm-cafe');
                      setLiveDish(null);
                    }}
                  >
                    <ShoppingCart size={14} className="mr-2" />
                    Order Now
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Progress bar for auto-close */}
            <motion.div 
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 10, ease: "linear" }}
              className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
