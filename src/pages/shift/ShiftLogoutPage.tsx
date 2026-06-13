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
        navigator.geolocation?.getCurrentPosition(
            (pos) => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocLoading(false); },
            () => { toast.error('Failed to get location'); setLocLoading(false); }
        );
    };

    const handleEndShift = async (url: string) => {
        if (!location || !currentSession || !eodSummary) return;
        const result = await endShift(url, location);
        if (result.success) {
            toast.success('Shift ended. Good job!');
            navigate('/shift/login');
        } else {
            toast.error(result.error?.message || 'Failed to end shift');
        }
    };

    if (sessionLoading || eodLoading)
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    const isEODSubmitted = !!eodSummary;

    return (
        <div className="max-w-xl mx-auto space-y-6 py-8 px-4">
            <div className="text-center space-y-1">
                <h1 className="text-2xl font-bold tracking-tight">End Shift</h1>
                <p className="text-muted-foreground">Wrap up your day and log out</p>
            </div>

            {!isEODSubmitted ? (
                <Card className="border-orange-200 bg-orange-50">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-100 rounded-full">
                                <AlertTriangle className="w-5 h-5 text-orange-500" />
                            </div>
                            <div>
                                <CardTitle className="text-base text-orange-800">EOD Summary Required</CardTitle>
                                <CardDescription className="text-orange-600/80">Submit your daily summary to unlock logout.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Button className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white" onClick={() => navigate('/shift/eod')}>
                            <FileText className="w-4 h-4 mr-2" /> Go to EOD Summary <ChevronRight className="w-4 h-4 ml-auto" />
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-green-200 bg-green-50">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-full">
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <CardTitle className="text-base text-green-800">Ready to Logout</CardTitle>
                                <CardDescription className="text-green-700/70">EOD summary submitted. Capture selfie to end shift.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white rounded-xl border">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-muted rounded-full">
                                    <Camera className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Location</p>
                                    <p className={`font-semibold text-sm ${location ? 'text-green-600' : 'text-foreground'}`}>
                                        {location ? 'Acquired ✓' : 'Required'}
                                    </p>
                                </div>
                            </div>
                            {!location && (
                                <Button size="sm" variant="outline" onClick={getLocation} disabled={locLoading}>
                                    {locLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                                    {locLoading ? 'Getting...' : 'Get Location'}
                                </Button>
                            )}
                        </div>

                        <Button
                            variant="destructive"
                            className="w-full h-12 text-base font-bold"
                            disabled={!location || locLoading}
                            onClick={() => setShowCamera(true)}
                        >
                            <LogOut className="w-4 h-4 mr-2" /> End Shift & Logout
                        </Button>
                        <p className="text-center text-xs text-muted-foreground">A selfie will be captured to confirm shift end.</p>
                    </CardContent>
                </Card>
            )}

            {showCamera && (
                <ShiftSelfieCapture onCapture={handleEndShift} onCancel={() => setShowCamera(false)} title="End Shift Selfie" folderPath="shift-end" />
            )}
        </div>
    );
}
