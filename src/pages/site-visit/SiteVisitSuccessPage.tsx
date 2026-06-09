import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, ArrowRight, ClipboardList, MapPin, Calendar, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export function SiteVisitSuccessPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-30">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/20 blur-[100px] rounded-full" />
      </div>

      <div className="max-w-md w-full relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <Card className="glass-card border-emerald-500/20 shadow-2xl shadow-emerald-500/5">
            <CardContent className="pt-12 pb-10 px-8 text-center space-y-8">
              {/* Success Icon */}
              <div className="relative inline-block">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 12 }}
                  className="h-24 w-24 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20"
                >
                  <CheckCircle2 className="h-12 w-12 text-emerald-400" />
                </motion.div>
                <div className="absolute -top-2 -right-2 h-8 w-8 bg-zinc-900 rounded-full border border-emerald-500/20 flex items-center justify-center">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                </div>
              </div>

              {/* Title & Message */}
              <div className="space-y-3">
                <h1 className="text-3xl font-bold text-white tracking-tight">Requisition Authorized!</h1>
                <p className="text-emerald-400/80 font-medium text-sm">Official site visit request has been submitted successfully.</p>
                <p className="text-zinc-500 text-xs leading-relaxed max-w-[280px] mx-auto">
                  Your request is now in queue for SMO review. You will be notified once a Farm Manager is assigned.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-4">
                <Button 
                  onClick={() => navigate('/site-visit-request/my')}
                  className="w-full h-14 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-lg rounded-2xl shadow-lg shadow-emerald-500/20 group transition-all"
                >
                  <ClipboardList className="mr-2 h-5 w-5 opacity-70" />
                  View My Requests
                  <ArrowRight className="ml-2 h-5 w-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </Button>
                
                <Button 
                  variant="ghost" 
                  onClick={() => navigate('/site-visit-request/new')}
                  className="w-full h-14 text-zinc-400 hover:text-white hover:bg-white/5 font-bold rounded-2xl border border-transparent hover:border-zinc-800 transition-all"
                >
                  Create Another Request
                </Button>
              </div>

              {/* Footer Details */}
              <div className="flex items-center justify-center gap-6 pt-6 border-t border-white/5">
                <div className="flex flex-col items-center gap-1">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <MapPin className="h-4 w-4 text-blue-400/60" />
                  </div>
                  <span className="text-[10px] uppercase font-black text-zinc-600 tracking-widest">Tracking</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Calendar className="h-4 w-4 text-purple-400/60" />
                  </div>
                  <span className="text-[10px] uppercase font-black text-zinc-600 tracking-widest">Status: PENDING</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
