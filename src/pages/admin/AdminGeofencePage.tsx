import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, MapPin, Plus, Trash2, User, CheckCircle2, AlertTriangle, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { MapPicker } from '@/components/ui/map-picker';
import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format } from 'date-fns';

// Helper component REMOVED to fix render error. 
// Using direct map ref instead.

// Constants & Interfaces
interface Geofence {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    radius_meters: number;
    action_type: string;
    is_active: boolean;
    created_at: string;
}

interface UserLocation {
    id: string;
    user_id: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    action_type?: string;
    matched_geofence_id?: string;
    profiles?: {
        name: string;
        role: string;
    };
}

// Fix Leaflet marker icon issue (same as map-picker.tsx)
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Helper: Check if point is inside circle
const isPointInCircle = (lat: number, lng: number, circleLat: number, circleLng: number, radiusMeters: number) => {
    const R = 6371e3; // metres
    const φ1 = lat * Math.PI / 180;
    const φ2 = circleLat * Math.PI / 180;
    const Δφ = (circleLat - lat) * Math.PI / 180;
    const Δλ = (circleLng - lng) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;

    return d <= radiusMeters;
};

const LoginHistoryList = () => {
    const { data: logs, isLoading } = useQuery({
        queryKey: ['login-logs'],
        queryFn: async () => {
            const { data, error } = await (supabase
                .from('user_location_logs') as any)
                .select('*, profiles(name, role)')
                .in('action_type', ['LOGIN', 'ATTENDANCE_LOGIN'])
                .order('timestamp', { ascending: false })
                .limit(500);

            if (error) throw error;

            // Filter to only show actual Day Start / Selfie logs
            // 1. action_type === 'ATTENDANCE_LOGIN' (New format)
            // 2. device_info.source === 'day_start_submission' (Today's earlier format)
            return (data as UserLocation[]).filter(log => {
                const deviceInfo = (log as any).device_info;
                return (log as any).action_type === 'ATTENDANCE_LOGIN' ||
                    deviceInfo?.source === 'day_start_submission';
            });
        },
    });

    const { data: geofences } = useQuery({
        queryKey: ['geofences-list'],
        queryFn: async () => {
            const { data } = await (supabase.from('geofences') as any).select('*');
            return data as Geofence[];
        }
    });

    if (isLoading) return <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Attendance Login Audit</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-0">
                    <div className="grid grid-cols-12 gap-4 p-4 font-medium text-muted-foreground border-b text-xs uppercase tracking-wider">
                        <div className="col-span-3">Employee</div>
                        <div className="col-span-3">Login Time (Selfie)</div>
                        <div className="col-span-3">Status</div>
                        <div className="col-span-3 text-right">Location</div>
                    </div>
                    {logs?.map(log => {
                        // VISUAL TRUTH: Check overrides
                        let visualOverrideId = null;
                        if (geofences) {
                            for (const geo of geofences) {
                                if (log.latitude && log.longitude && isPointInCircle(log.latitude, log.longitude, geo.latitude, geo.longitude, geo.radius_meters)) {
                                    visualOverrideId = geo.id;
                                    break;
                                }
                            }
                        }

                        const effectiveMatchedId = visualOverrideId || log.matched_geofence_id;
                        const isVerified = !!effectiveMatchedId;
                        const geofenceName = geofences?.find(g => g.id === effectiveMatchedId)?.name;
                        const isOverrideActive = !!visualOverrideId && !log.matched_geofence_id;

                        return (
                            <div key={log.id} className="grid grid-cols-12 gap-4 p-4 border-b last:border-0 hover:bg-muted/30 transition-colors items-center text-sm">
                                <div className="col-span-3">
                                    <div className="font-semibold">{log.profiles?.name || 'Unknown'}</div>
                                    <div className="text-xs text-muted-foreground">{log.profiles?.role}</div>
                                </div>
                                <div className="col-span-3">
                                    <div className="font-medium">{format(new Date(log.timestamp), 'h:mm a')}</div>
                                    <div className="text-xs text-muted-foreground">{format(new Date(log.timestamp), 'MMM d, yyyy')}</div>
                                </div>
                                <div className="col-span-3">
                                    {isVerified ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                            <CheckCircle2 className="h-3 w-3" />
                                            Verified: {geofenceName}
                                            {isOverrideActive && <span className="ml-1 text-[8px] bg-green-600 text-white px-1 rounded">(MAP VERIFIED)</span>}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                            <AlertTriangle className="h-3 w-3" />
                                            Outside Geofence
                                        </span>
                                    )}
                                </div>
                                <div className="col-span-3 text-right">
                                    <a
                                        href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline font-mono text-xs"
                                    >
                                        {log.latitude.toFixed(5)}, {log.longitude.toFixed(5)}
                                    </a>
                                </div>
                            </div>
                        );
                    })}
                    {logs?.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">No login records found.</div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

const UserStatusList = () => {
    const { data: locations, isLoading } = useQuery({
        queryKey: ['user-locations'],
        queryFn: async () => {
            const { data, error } = await (supabase
                .from('user_location_logs') as any)
                .select('*, profiles(name, role)')
                .order('timestamp', { ascending: false })
                .limit(1000);

            if (error) throw error;

            // Deduplicate by user_id
            const uniqueLocations = new Map();
            data.forEach((log: any) => {
                if (!uniqueLocations.has(log.user_id)) {
                    uniqueLocations.set(log.user_id, log);
                }
            });

            return Array.from(uniqueLocations.values()) as UserLocation[];
        },
        refetchInterval: 60000,
    });

    const { data: geofences } = useQuery({
        queryKey: ['geofences-list'],
        queryFn: async () => {
            const { data } = await (supabase.from('geofences') as any).select('*');
            return data as Geofence[];
        }
    });

    if (isLoading) return <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>;

    const sortedLocations = [...(locations || [])].sort((a, b) => {
        // Sort: Outside (null matched_id) first
        if (!a.matched_geofence_id && b.matched_geofence_id) return -1;
        if (a.matched_geofence_id && !b.matched_geofence_id) return 1;
        return 0;
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Real-time User Status</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {sortedLocations.map(loc => {
                        // VISUAL TRUTH: Check overrides
                        let visualOverrideId = null;
                        if (geofences) {
                            for (const geo of geofences) {
                                if (loc.latitude && loc.longitude && isPointInCircle(loc.latitude, loc.longitude, geo.latitude, geo.longitude, geo.radius_meters)) {
                                    visualOverrideId = geo.id;
                                    break;
                                }
                            }
                        }

                        const effectiveMatchedId = visualOverrideId || loc.matched_geofence_id;
                        const isInside = !!effectiveMatchedId;
                        const geofenceName = geofences?.find(g => g.id === effectiveMatchedId)?.name;
                        const isOverrideActive = !!visualOverrideId && !loc.matched_geofence_id;

                        return (
                            <div key={loc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-full ${isInside ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                        {isInside ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                                    </div>
                                    <div>
                                        <h4 className="font-semibold flex items-center gap-2">
                                            {loc.profiles?.name || 'Unknown'}
                                            <span className="text-xs font-normal text-muted-foreground px-2 py-0.5 rounded-full bg-secondary">
                                                {loc.profiles?.role}
                                            </span>
                                        </h4>
                                        <div className="text-sm text-muted-foreground mt-0.5">
                                            {isInside
                                                ? <span className="text-green-600 font-medium">
                                                    Verified: {geofenceName}
                                                    {isOverrideActive && <span className="ml-1 text-[8px] bg-green-600 text-white px-1 rounded align-middle">(MAP VERIFIED)</span>}
                                                </span>
                                                : <span className="text-red-600 font-medium">Outside Geofence</span>
                                            }
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right text-xs text-muted-foreground">
                                    <div>{format(new Date(loc.timestamp), 'h:mm a')}</div>
                                    <div className="font-mono mt-1">{loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}</div>
                                </div>
                            </div>
                        );
                    })}
                    {locations?.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">No active users found.</div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

// Admin User Map Component - Full implementation with map
const AdminUserMap = () => {
    const [selectedPosition, setSelectedPosition] = useState<[number, number] | null>(null);
    const [map, setMap] = useState<L.Map | null>(null);
    const [filter, setFilter] = useState<'all' | 'inside' | 'outside'>('all');

    useEffect(() => {
        if (selectedPosition && map) {
            map.flyTo(selectedPosition, 16, {
                animate: true,
                duration: 1.5
            });
        }
    }, [selectedPosition, map]);
    const { data: locations, isLoading: isLocationsLoading } = useQuery({
        queryKey: ['user-locations'],
        queryFn: async () => {
            const { data, error } = await (supabase
                .from('user_location_logs') as any)
                .select('*, profiles(name, role)')
                .order('timestamp', { ascending: false })
                .limit(1000);

            if (error) throw error;

            // Deduplicate by user_id
            const uniqueLocations = new Map();
            data.forEach((log: any) => {
                if (!uniqueLocations.has(log.user_id)) {
                    uniqueLocations.set(log.user_id, log);
                }
            });

            return Array.from(uniqueLocations.values()) as UserLocation[];
        },
        refetchInterval: 60000, // Poll every minute
    });

    const filteredLocations = locations?.filter(loc => {
        if (filter === 'inside') return !!loc.matched_geofence_id;
        if (filter === 'outside') return !loc.matched_geofence_id;
        return true;
    });

    const { data: activeGeofences, isLoading: isGeofencesLoading } = useQuery({
        queryKey: ['active-geofences-map'],
        queryFn: async () => {
            const { data, error } = await (supabase
                .from('geofences') as any)
                .select('*')
                .eq('is_active', true);
            if (error) throw error;
            return data as Geofence[];
        },
        refetchInterval: 300000, // Sync geofences every 5 minutes
    });

    const isLoading = isLocationsLoading || isGeofencesLoading;

    if (isLoading) {
        return <div className="h-[500px] flex items-center justify-center border rounded-md"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="space-y-4">
            <div className="h-[600px] w-full border rounded-md overflow-hidden relative z-0">
                <MapContainer
                    center={[12.9716, 77.5946]}
                    zoom={10}
                    scrollWheelZoom={true}
                    style={{ height: '100%', width: '100%' }}
                    ref={setMap as any}
                >
                    <div className="absolute top-4 right-4 z-[400] bg-white rounded-md shadow-md p-2 flex gap-2">
                        <Button
                            size="sm"
                            variant={filter === 'all' ? 'default' : 'outline'}
                            onClick={() => setFilter('all')}
                            className="text-xs h-7"
                        >
                            All
                        </Button>
                        <Button
                            size="sm"
                            variant={filter === 'inside' ? 'default' : 'outline'}
                            onClick={() => setFilter('inside')}
                            className="text-xs h-7 bg-green-600 hover:bg-green-700 text-white"
                        >
                            Inside
                        </Button>
                        <Button
                            size="sm"
                            variant={filter === 'outside' ? 'destructive' : 'outline'}
                            onClick={() => setFilter('outside')}
                            className="text-xs h-7"
                        >
                            Outside
                        </Button>
                    </div>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {activeGeofences?.map((geo) => (
                        <Circle
                            key={`fence-${geo.id}`}
                            center={[geo.latitude, geo.longitude]}
                            radius={geo.radius_meters}
                            pathOptions={{ color: 'green', fillColor: 'green', fillOpacity: 0.2 }}
                        >
                            <Popup>
                                <div className="font-semibold">{geo.name}</div>
                                <div className="text-xs">Radius: {geo.radius_meters}m</div>
                            </Popup>
                        </Circle>
                    ))}
                    {filteredLocations?.map((loc) => {
                        // VISUAL TRUTH: Check if point is physically inside any active geofence circle
                        // This overrides the database status for the map display
                        let visualOverrideId = null;
                        if (activeGeofences) {
                            for (const geo of activeGeofences) {
                                if (isPointInCircle(loc.latitude, loc.longitude, geo.latitude, geo.longitude, geo.radius_meters)) {
                                    visualOverrideId = geo.id;
                                    break;
                                }
                            }
                        }

                        // Use override if available, otherwise DB status
                        const effectiveMatchedId = visualOverrideId || loc.matched_geofence_id;
                        const isVerified = !!effectiveMatchedId;
                        const matchedGeofenceName = activeGeofences?.find(g => g.id === effectiveMatchedId)?.name;
                        const isOverrideActive = !!visualOverrideId && !loc.matched_geofence_id; // Was false, now true

                        return (
                            <CircleMarker
                                key={loc.id}
                                center={[loc.latitude, loc.longitude]}
                                radius={8}
                                pathOptions={{
                                    color: 'white',
                                    weight: 2,
                                    fillColor: isVerified ? '#10b981' : '#ef4444',
                                    fillOpacity: 1
                                }}
                            >
                                <Popup>
                                    <div className="min-w-[200px]">
                                        <div className="font-bold flex items-center gap-2">
                                            <User className="h-4 w-4" />
                                            {loc.profiles?.name || 'Unknown User'}
                                        </div>
                                        <div className="text-xs text-muted-foreground mb-1">
                                            {loc.profiles?.role || 'Unknown Role'} • <span className="font-mono">{loc.action_type || 'TRACKING'}</span>
                                        </div>
                                        <div className="text-sm">
                                            Last Seen: {format(new Date(loc.timestamp), 'PPpp')}
                                        </div>
                                        {isVerified ? (
                                            <div className="mt-2 p-1.5 rounded bg-green-100 border border-green-200 text-[10px] font-bold text-green-800 uppercase flex items-center gap-1">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Verified: {matchedGeofenceName || 'Geofence'}
                                                {isOverrideActive && <span className="ml-1 text-[8px] bg-green-600 text-white px-1 rounded">(MAP VERIFIED)</span>}
                                            </div>
                                        ) : (
                                            <div className="mt-2 p-1.5 rounded bg-red-100 border border-red-200 text-[10px] font-bold text-red-800 uppercase flex items-center gap-1">
                                                <AlertTriangle className="h-3 w-3" />
                                                Outside Geofence
                                            </div>
                                        )}
                                        <div className="text-xs mt-1 font-mono text-muted-foreground">
                                            {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                                        </div>
                                    </div>
                                </Popup>
                            </CircleMarker>
                        );
                    })}
                </MapContainer>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredLocations?.map(loc => (
                    <Card
                        key={loc.id}
                        className="text-sm cursor-pointer hover:bg-muted/50 transition-colors border-l-4 border-l-transparent hover:border-l-primary"
                        onClick={() => {
                            setSelectedPosition([loc.latitude, loc.longitude]);
                            toast.info(`Locating ${loc.profiles?.name}...`);
                        }}
                    >
                        <CardHeader className="p-3 pb-0">
                            <div className="font-semibold truncate flex items-center gap-2">
                                <User className="h-3 w-3 text-muted-foreground" />
                                {loc.profiles?.name}
                            </div>
                            <div className="text-xs text-muted-foreground">{loc.profiles?.role}</div>
                        </CardHeader>
                        <CardContent className="p-3 pt-2">
                            <div className="text-xs text-muted-foreground flex justify-between">
                                <span>{format(new Date(loc.timestamp), 'MMM d, h:mm a')}</span>
                                <span className="text-primary font-medium hover:underline text-[10px]">Show on Map</span>
                            </div>
                            <div className="text-xs font-mono mt-1 pt-1 border-t">
                                📍 {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}


export default function AdminGeofencePage() {
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const queryClient = useQueryClient();

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        radius: 100,
        action_type: 'LOGIN',
        lat: 12.9716,
        lng: 77.5946,
    });

    const { data: geofences, isLoading } = useQuery({
        queryKey: ['geofences'],
        queryFn: async () => {
            const { data, error } = await (supabase
                .from('geofences') as any)
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as Geofence[];
        },
    });

    const createGeofence = useMutation({
        mutationFn: async () => {
            const { error } = await (supabase.from('geofences') as any).insert({
                name: formData.name,
                latitude: formData.lat,
                longitude: formData.lng,
                radius_meters: formData.radius,
                action_type: formData.action_type,
                is_active: true,
            });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['geofences'] });
            setIsCreateOpen(false);
            toast.success('Geofence created successfully');
            setFormData({ ...formData, name: '' });
        },
        onError: (error) => {
            toast.error(`Error creating geofence: ${error.message}`);
        },
    });

    const toggleStatus = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: boolean }) => {
            const { error } = await (supabase
                .from('geofences') as any)
                .update({ is_active: status })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['geofences'] });
            toast.success('Status updated');
        },
    });

    const deleteGeofence = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await (supabase
                .from('geofences') as any)
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['geofences'] });
            toast.success('Geofence deleted');
        },
    });

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gradient">Geofencing & Tracking</h1>
                    <p className="text-muted-foreground mt-2">
                        Manage authorized locations and track user activity.
                    </p>
                </div>
            </div>

            <Tabs defaultValue="geofences" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="geofences" className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Geofences</TabsTrigger>
                    <TabsTrigger value="usermap" className="flex items-center gap-2"><User className="h-4 w-4" /> User Map</TabsTrigger>
                    <TabsTrigger value="status" className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> User Status</TabsTrigger>
                    <TabsTrigger value="loginlogs" className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Login Logs</TabsTrigger>
                </TabsList>

                <TabsContent value="geofences" className="space-y-4">
                    <div className="flex justify-end">
                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button className="gap-2">
                                    <Plus className="h-4 w-4" /> Add Geofence
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Add New Geofence</DialogTitle>
                                    <DialogDescription>
                                        Define a new location where actions are permitted.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="name">Name</Label>
                                            <Input
                                                id="name"
                                                placeholder="e.g. Headquarters"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="radius">Radius (meters)</Label>
                                            <Input
                                                id="radius"
                                                type="number"
                                                value={formData.radius}
                                                onChange={(e) => setFormData({ ...formData, radius: parseInt(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="action">Action Type</Label>
                                        <Select
                                            value={formData.action_type}
                                            onValueChange={(val) => setFormData({ ...formData, action_type: val })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select action" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="LOGIN">Login / Attendance</SelectItem>
                                                <SelectItem value="CHECK_IN">Check-In</SelectItem>
                                                <SelectItem value="ANY">Any Action</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Select Location</Label>
                                        <MapPicker
                                            initialLat={formData.lat}
                                            initialLng={formData.lng}
                                            onLocationSelect={(lat, lng) => setFormData({ ...formData, lat, lng })}
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <Button onClick={() => createGeofence.mutate()} disabled={createGeofence.isPending}>
                                        {createGeofence.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Create Geofence
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {isLoading ? (
                            <div className="col-span-full flex justify-center py-10">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : geofences?.map((geo) => (
                            <Card key={geo.id} className="hover:shadow-lg transition-all duration-300">
                                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                                    <CardTitle className="text-xl font-semibold">
                                        {geo.name}
                                    </CardTitle>
                                    <MapPin className={`h-5 w-5 ${geo.is_active ? 'text-primary' : 'text-muted'}`} />
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3 mt-2">
                                        <div className="text-sm text-muted-foreground">
                                            <p>Action: <span className="font-medium text-foreground">{geo.action_type}</span></p>
                                            <p>Radius: <span className="font-medium text-foreground">{geo.radius_meters}m</span></p>
                                            <p className="text-xs mt-1 font-mono">
                                                {geo.latitude.toFixed(4)}, {geo.longitude.toFixed(4)}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between pt-2">
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={geo.is_active}
                                                    onCheckedChange={(checked) => toggleStatus.mutate({ id: geo.id, status: checked })}
                                                />
                                                <span className="text-sm">{geo.is_active ? 'Active' : 'Inactive'}</span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:bg-destructive/10"
                                                onClick={() => deleteGeofence.mutate(geo.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="usermap">
                    <AdminUserMap />
                </TabsContent>

                <TabsContent value="status">
                    <UserStatusList />
                </TabsContent>

                <TabsContent value="loginlogs">
                    <LoginHistoryList />
                </TabsContent>
            </Tabs>
        </div>
    );
}
