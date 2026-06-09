import { format } from 'date-fns';
import { Truck, MapPin, IndianRupee, Navigation } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTransportMasters } from '@/hooks/useTransportMasters';

interface TripItem {
    trip_date: string;
    from_location: string;
    to_location: string;
    distance_km: number;
    amount: number;
    rate_per_km?: number;
    category_code: string;
    purpose?: string;
    vendor_name?: string;
    vehicle_number?: string;
    driver_name?: string;
    trip_proof_urls?: string[];
    bank_proof_url?: string;
    payee_account?: string | null;
    payee_ifsc?: string | null;
    payee_upi?: string | null;
    payment_method?: string | null;
    beneficiary_name?: string | null;
}

interface TransportTripsViewerProps {
    trips: TripItem[];
}

export function TransportTripsViewer({ trips }: TransportTripsViewerProps) {
    const { categories } = useTransportMasters();

    if (!trips || trips.length === 0) return null;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <Truck className="w-5 h-5 text-primary" />
                <h4 className="font-semibold text-lg text-primary">Transport Trip Details</h4>
                <Badge variant="outline" className="ml-auto bg-primary/10 text-primary border-primary/20">
                    {trips.length} Trip{trips.length > 1 ? 's' : ''}
                </Badge>
            </div>

            <div className="space-y-3">
                {trips.map((trip, idx) => {
                    const isOtherRaw = trip.purpose?.includes('[OTHER_CAT:');
                    let extractedOther = '';
                    let displayPurpose = trip.purpose || 'N/A';

                    if (isOtherRaw) {
                        const match = trip.purpose!.match(/\[OTHER_CAT:\s*(.*?)\]\s*/);
                        if (match) {
                            extractedOther = match[1];
                            displayPurpose = trip.purpose!.replace(match[0], '').trim() || 'N/A';
                        }
                    }

                    const masterCategory = categories.find(c => c.category_code === trip.category_code);
                    const categoryName = masterCategory?.category_name.replace(/\bFF\b\s*\(Fresh Farm\)|\bFresh Farm\b|\bFF\b/gi, 'Farmers Factory') || trip.category_code;
                    const colorCode = masterCategory?.color_code || '#666';

                    const displayCategory = extractedOther ? extractedOther.toUpperCase() : categoryName;

                    return (
                        <div key={idx} className="p-4 rounded-xl border border-border bg-card shadow-sm relative overflow-hidden group hover:border-primary/50 transition-colors">
                            {/* Absolute side accent */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />

                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col md:flex-row gap-4 justify-between">
                                    {/* Left Column: Route & Date */}
                                    <div className="flex-1 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5 uppercase tracking-wider text-[10px]">Transport</Badge>
                                            <Badge className="bg-muted text-muted-foreground hover:bg-muted/80 border-0 flex items-center gap-1.5 px-2 py-0.5">
                                                <span>#{idx + 1}</span>
                                                <span className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ background: colorCode }} />
                                                <span>{displayCategory}</span>
                                            </Badge>
                                            <span className="text-sm text-muted-foreground font-medium italic">
                                                {format(new Date(trip.trip_date), 'dd MMM yyyy')}
                                            </span>
                                        </div>

                                        <div className="flex items-start gap-4">
                                            <div className="flex flex-col items-center mt-1">
                                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/10" />
                                                <div className="w-0.5 h-8 bg-border" />
                                                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-500/10" />
                                            </div>
                                            <div className="flex flex-col gap-3">
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Starting Point</p>
                                                    <p className="text-sm font-semibold text-foreground">{trip.from_location}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Destination</p>
                                                    <p className="text-sm font-semibold text-foreground">{trip.to_location}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column: Metrics */}
                                    <div className="flex flex-col items-end justify-start min-w-[220px]">
                                        <div className="w-full p-3 bg-muted/20 rounded-lg border border-border space-y-2">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-muted-foreground">Total KM</span>
                                                <span className="font-semibold text-foreground">{trip.distance_km} KM</span>
                                            </div>
                                            {trip.rate_per_km && (
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-muted-foreground">Rate / KM</span>
                                                    <span className="font-semibold text-foreground">₹{trip.rate_per_km}</span>
                                                </div>
                                            )}
                                            <Separator className="bg-border" />
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-bold text-primary uppercase">Total Amount</span>
                                                <span className="font-bold flex items-center text-lg text-primary">
                                                    <IndianRupee className="w-3.5 h-3.5 mr-0.5" />
                                                    {trip.amount.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* bottom row for other details */}
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-muted/10 p-3 rounded-lg border border-border">
                                    <div className="space-y-0.5 col-span-1">
                                        <p className="text-[9px] text-muted-foreground uppercase font-bold">Purpose</p>
                                        <p className="text-xs text-foreground italic leading-snug">{displayPurpose}</p>
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-[9px] text-muted-foreground uppercase font-bold">Driver</p>
                                        <p className="text-xs text-foreground font-medium">{trip.driver_name || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-[9px] text-muted-foreground uppercase font-bold">Vehicle</p>
                                        <p className="text-xs text-foreground font-medium font-mono">{trip.vehicle_number || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-[9px] text-muted-foreground uppercase font-bold">Payee / Bank</p>
                                        <p className="text-xs text-foreground font-medium">{trip.beneficiary_name || trip.vendor_name || 'N/A'}</p>
                                        {(trip.payee_account || trip.payee_upi) && (
                                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5 border-t border-border/30 pt-0.5">
                                                {trip.payee_account ? `${trip.payee_account} [${trip.payee_ifsc}]` : `UPI: ${trip.payee_upi}`}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-0.5 col-span-1">
                                        <p className="text-[9px] text-muted-foreground uppercase font-bold">Proofs</p>
                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                            {trip.trip_proof_urls && trip.trip_proof_urls.length > 0 && (
                                                <a href={trip.trip_proof_urls[0]} target="_blank" rel="noreferrer">
                                                    <Badge variant="secondary" className="text-[9px] h-5 hover:bg-primary hover:text-white transition-colors cursor-pointer">
                                                        Trip {trip.trip_proof_urls.length > 1 ? `(${trip.trip_proof_urls.length})` : 'Proof'}
                                                    </Badge>
                                                </a>
                                            )}
                                            {trip.bank_proof_url && (
                                                <a href={trip.bank_proof_url} target="_blank" rel="noreferrer">
                                                    <Badge variant="secondary" className="text-[9px] h-5 hover:bg-emerald-500 hover:text-white transition-colors cursor-pointer">
                                                        Bank Proof
                                                    </Badge>
                                                </a>
                                            )}
                                            {!trip.trip_proof_urls && !trip.bank_proof_url && <p className="text-[10px] text-muted-foreground">No proofs</p>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
}

