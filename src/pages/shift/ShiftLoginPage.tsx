import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useShiftSession } from '@/hooks/useShiftSession';
import { ShiftSelfieCapture } from '@/components/shift/ShiftSelfieCapture';
import { Loader2, MapPin, Camera, Play } from 'lucide-react';
import { toast } from 'sonner';

export default function ShiftLoginPage() {
    const navigate = useNavigate();
    const { currentSession, startShift, isLoading } = useShiftSession();
    const [showCamera, setShowCamera] = useState(false);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locLoading, setLocLoading] = useState(false);

    const [dayPlan, setDayPlan] = useState('');

    useEffect(() => {
        if (currentSession?.status === 'active') {
            navigate('/shift/dashboard');
        }
    }, [currentSession, navigate]);

    const getLocation = () => {
        setLocLoading(true);
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser');
            setLocLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
                setLocLoading(false);
                toast.success('Location acquired');
            },
            (error) => {
                console.error('Location error:', error);
                toast.error('Failed to get location. Please allow location access.');
                setLocLoading(false);
            },
            { enableHighAccuracy: true }
        );
    };

    const handleSelfieCaptured = async (url: string) => {
        setShowCamera(false);
        if (!location) {
            toast.error('Location is required to start shift');
            return;
        }
        if (!dayPlan.trim()) {
            toast.error('Day plan is required');
            return;
        }

        try {
            const result = await startShift(url, dayPlan, location);
            if (result.success) {
                toast.success('Shift started successfully');
                navigate('/shift/dashboard');
            } else {
                toast.error(result.error?.message || 'Failed to start shift');
            }
        } catch (err: any) {
            toast.error('An unexpected error occurred');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 space-y-8">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Shift Login</h1>
                <p className="text-muted-foreground">
                    Start your flexible work shift
                </p>
            </div>

            <Card className="w-full max-w-md border-2 border-primary/10 shadow-lg">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
                        <Play className="w-8 h-8 text-primary" />
                    </div>
                    <CardTitle>Ready to start?</CardTitle>
                    <CardDescription>
                        Enter your plan for today, then capture your selfie and location.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Day Plan / Objectives
                            </label>
                            <textarea
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="What are your key tasks for today?"
                                value={dayPlan}
                                onChange={(e) => setDayPlan(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 bg-muted rounded-lg border">
                            <div className="flex items-center gap-3">
                                <MapPin className={`w-5 h-5 ${location ? 'text-green-500' : 'text-muted-foreground'}`} />
                                <div className="flex flex-col items-start">
                                    <span className="font-medium text-sm">Location</span>
                                    <span className="text-xs text-muted-foreground">
                                        {location ? 'Acquired' : 'Required'}
                                    </span>
                                </div>
                            </div>
                            {!location && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={getLocation}
                                    disabled={locLoading}
                                >
                                    {locLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Get Location'}
                                </Button>
                            )}
                            {location && <CheckCircle className="w-5 h-5 text-green-500" />}
                        </div>

                        <Button
                            className="w-full h-12 text-lg"
                            onClick={() => setShowCamera(true)}
                            disabled={!location || locLoading || !dayPlan.trim()}
                        >
                            <Camera className="w-5 h-5 mr-2" />
                            Take Selfie & Start
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {showCamera && (
                <ShiftSelfieCapture
                    onCapture={handleSelfieCaptured}
                    onCancel={() => setShowCamera(false)}
                    title="Start Shift Selfie"
                    folderPath="shift-start"
                />
            )}
        </div>
    );
}

function CheckCircle({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    );
}
