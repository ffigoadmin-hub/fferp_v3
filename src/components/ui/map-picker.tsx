import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

// Fix Leaflet marker icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapPickerProps {
    initialLat?: number;
    initialLng?: number;
    onLocationSelect: (lat: number, lng: number) => void;
}

const LocationMarker = ({ onSelect, position }: { onSelect: (lat: number, lng: number) => void, position: { lat: number, lng: number } }) => {
    const map = useMapEvents({
        click(e) {
            onSelect(e.latlng.lat, e.latlng.lng);
            map.flyTo(e.latlng, map.getZoom());
        },
    });

    useEffect(() => {
        if (position) {
            map.flyTo([position.lat, position.lng], map.getZoom());
        }
    }, [position, map]);

    return position === null ? null : (
        <Marker position={[position.lat, position.lng]} />
    );
};

export function MapPicker({ initialLat = 12.9716, initialLng = 77.5946, onLocationSelect }: MapPickerProps) {
    const [position, setPosition] = useState({ lat: initialLat, lng: initialLng });
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearch = async () => {
        if (!searchQuery) return;
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
            const data = await response.json();
            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                const newLat = parseFloat(lat);
                const newLng = parseFloat(lon);
                setPosition({ lat: newLat, lng: newLng });
                onLocationSelect(newLat, newLng);
            }
        } catch (error) {
            console.error("Search failed:", error);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <Input
                    placeholder="Search location..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} variant="outline" size="icon">
                    <Search className="h-4 w-4" />
                </Button>
            </div>
            <div className="h-[400px] w-full rounded-md border overflow-hidden relative z-0">
                <MapContainer center={[initialLat, initialLng]} zoom={13} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <LocationMarker
                        position={position}
                        onSelect={(lat, lng) => {
                            setPosition({ lat, lng });
                            onLocationSelect(lat, lng);
                        }}
                    />
                </MapContainer>
            </div>
            <div className="text-sm text-muted-foreground">
                Selected Coordinates: {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
            </div>
        </div>
    );
}
