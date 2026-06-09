import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, ShieldAlert, Clock, Phone, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function AbsentLockedPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // Redirect to login if already logged out
    useEffect(() => {
        if (!user) {
            navigate('/login', { replace: true });
        }
    }, [user, navigate]);

    const handleLogout = async () => {
        await logout();
        navigate('/login', { replace: true });
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-1/2 bg-destructive/5 blur-[120px] rounded-full" />
            <div className="absolute bottom-0 right-0 w-full h-1/2 bg-destructive/5 blur-[120px] rounded-full" />

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative z-10 max-w-md w-full"
            >
                <div className="bg-zinc-900/50 backdrop-blur-xl border border-destructive/20 rounded-3xl p-8 text-center shadow-2xl">
                    <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6 ring-4 ring-destructive/5">
                        <ShieldAlert className="w-10 h-10 text-destructive" />
                    </div>

                    <h1 className="text-3xl font-black text-white mb-2">ACCESS DENIED</h1>
                    <p className="text-destructive font-bold text-lg mb-6">Auto-Absent Protocol Info</p>

                    <div className="space-y-4 mb-8">
                        <div className="bg-black/40 rounded-xl p-4 border border-white/5 flex items-start gap-4 text-left">
                            <Clock className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-white text-sm">Late Login Threshold Exceeded</p>
                                <p className="text-xs text-zinc-500 mt-1">
                                    You failed to log in before 12:30 PM. The system has automatically marked you as <span className="text-destructive font-bold">ABSENT</span>.
                                </p>
                            </div>
                        </div>

                        <div className="bg-black/40 rounded-xl p-4 border border-white/5 flex items-start gap-4 text-left">
                            <Lock className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-white text-sm">System Locked</p>
                                <p className="text-xs text-zinc-500 mt-1">
                                    Access to Dashboards, Reports, and Plans has been revoked for the day.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <p className="text-xs text-zinc-500 mb-4">
                            Contact Administrator if you believe this is an error.
                        </p>
                        <Button variant="outline" className="w-full border-zinc-800 hover:bg-zinc-800 mb-2" asChild>
                            <a href="tel:+910000000000">
                                <Phone className="w-4 h-4 mr-2" />
                                Contact Admin
                            </a>
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full text-zinc-500 hover:text-white hover:bg-white/5"
                            onClick={handleLogout}
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            Logout & Re-login
                        </Button>
                    </div>
                </div>

                <p className="text-center text-zinc-600 text-[10px] mt-8 uppercase tracking-widest">
                    IGO Group • System Integrity & Discipline
                </p>
            </motion.div>
        </div>
    );
}
