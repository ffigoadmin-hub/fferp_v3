import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useShiftSession } from '@/hooks/useShiftSession';
import { useShiftEOD } from '@/hooks/useShiftEOD';
import { ShiftSelfieCapture } from '@/components/shift/ShiftSelfieCapture';
import { Loader2, AlertTriangle, FileText, CheckCircle2, ChevronRight, LogOut, Camera } from 'lucide-react';
import { toast } from 'sonner';

export default function ShiftLogoutPage() {
    const navigate = useNavigate();
    const { currentSession, endShift, isLoading: sessionLoading } = useShiftSession();
    const { eodSummary, loading: eodLoading } = useShiftEOD(currentSession?.id || null);

    const [showCamera, setShowCamera] = useState(false);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locLoading, setLocLoading] = useState(false);

    useEffect(() => {
        if (!sessionLoading && (!currentSession || currentSession.status === 'completed')) {
            navigate('/shift/login');
        }
    }, [currentSession, sessionLoading, navigate]);

    const getLocation = () => {
        setLocLoading(true);
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported');
            setLocLoading(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setLocLoading(false);
            },
            (err) => {
                toast.error('Failed to get location');
                setLocLoading(false);
            }
        );
    };

    const handleEndShift = async (url: string) => {
        if (!location || !currentSession) return;

        // Check EOD Requirement again (redundant but safe)
        if (!eodSummary) {
            toast.error('Please submit EOD Summary first');
            return;
        }

        try {
            const result = await endShift(url, location);
            if (result.success) {
                toast.success('Shift ended. Good job!');
                navigate('/shift/login'); // Redirect to login for next day
            } else {
                toast.error(result.error?.message || 'Failed to end shift');
            }
        } catch (err: any) {
            toast.error('Error ending shift');
        }
    };

    if (sessionLoading || eodLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    }

    const isEODSubmitted = !!eodSummary;

    return (
        <div className="max-w-xl mx-auto space-y-8 pt-8 px-6">
            <div className="text-center space-y-3">
                <h1 className="text-3xl font-bold tracking-tight text-white">End Shift</h1>
                <p className="text-slate-400 text-lg">Wrap up your day and log out</p>
            </div>

            {!isEODSubmitted ? (
                <Card className="border-orange-500/30 bg-slate-900/40 backdrop-blur-xl shadow-2xl">
                    <CardHeader className="pb-4 border-b border-orange-500/10 bg-orange-500/5">
                        <div className="flex items-center gap-3 text-orange-400 mb-1">
                            <div className="p-2 bg-orange-500/20 rounded-full border border-orange-500/20">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <CardTitle className="text-xl">EOD Summary Required</CardTitle>
                        </div>
                        <CardDescription className="text-orange-200/60 text-base pl-[3.25rem]">
                            Submit your daily summary to unlock logout.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <Button
                            className="w-full h-14 text-lg bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-900/20 transition-all active:scale-[0.98]"
                            onClick={() => navigate('/shift/eod')}
                        >
                            <FileText className="w-5 h-5 mr-3" />
                            Go to EOD Summary
                            <ChevronRight className="w-5 h-5 ml-auto opacity-70" />
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-green-500/30 bg-slate-900/40 backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-500 overflow-hidden">
                    <div className="bg-green-500/5 border-b border-green-500/10 p-6 pb-6">
                        <div className="flex items-center gap-3 text-green-400 mb-2">
                            <div className="p-2 bg-green-500/20 rounded-full shadow-inner border border-green-500/20">
                                <CheckCircle2 className="w-6 h-6 text-green-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-green-100">Ready to Logout</h2>
                                <p className="text-green-400/60 text-sm font-medium">Great job! EOD summary submitted.</p>
                            </div>
                        </div>
                    </div>

                    <CardContent className="space-y-6 pt-6">
                        <div className="flex items-center justify-between p-4 bg-slate-950/40 rounded-xl border border-slate-800 shadow-inner">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-slate-900 rounded-full text-slate-400 shadow-sm border border-slate-800">
                                    <Camera className="w-5 h-5" />
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Verification</p>
                                    <p className={`font-bold ${location ? 'text-green-400' : 'text-slate-300'}`}>
                                        {location ? "Location Acquired" : "Location Required"}
                                    </p>
                                </div>
                            </div>

                            {!location ? (
                                <Button size="sm" variant="outline" onClick={getLocation} disabled={locLoading} className="ml-4 h-10 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-600">
                                    {locLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                    {locLoading ? 'Acquiring...' : 'Get Location'}
                                </Button>
                            ) : (
                                <div className="flex items-center gap-1.5 text-green-400 bg-green-500/10 px-3 py-1.5 rounded-full text-xs font-bold border border-green-500/20">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>VERIFIED</span>
                                </div>
                            )}
                        </div>

                        <div className="pt-2">
                            <Button
                                className="w-full h-14 text-lg font-bold bg-destructive hover:bg-destructive/90 text-white shadow-lg shadow-red-900/30 transition-all hover:scale-[1.01] active:scale-[0.99] rounded-xl"
                                disabled={!location || locLoading}
                                onClick={() => setShowCamera(true)}
                            >
                                <LogOut className="w-5 h-5 mr-3" />
                                End Shift & Logout
                            </Button>
                            <p className="text-center text-xs text-slate-500 pt-3 px-4 leading-relaxed">
                                By clicking above, you confirm that your shift is complete and you are leaving the designated work location.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {showCamera && (
                <ShiftSelfieCapture
                    onCapture={handleEndShift}
                    onCancel={() => setShowCamera(false)}
                    title="End Shift Selfie"
                    folderPath="shift-end"
                />
            )}
        </div>
    );
}
