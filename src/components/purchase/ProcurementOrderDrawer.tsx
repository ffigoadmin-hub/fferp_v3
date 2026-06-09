
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    Package, Truck, CheckCircle, Clock, Calendar,
    MapPin, FileText, Phone, Mail, ExternalLink, IndianRupee
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ProcurementOrderDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    order: any; // Using any for now to facilitate rapid development, will type properly later
}

export function ProcurementOrderDrawer({ isOpen, onClose, order }: ProcurementOrderDrawerProps) {
    if (!order) return null;

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="w-full sm:w-[540px] border-l border-white/10 bg-black/90 backdrop-blur-xl p-0 shadow-2xl">
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="p-6 border-b border-white/10 bg-gradient-to-r from-violet-500/10 to-transparent">
                        <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline" className={cn(
                                "uppercase tracking-wider text-[10px]",
                                order.order_status === 'delivered' ? "border-green-500 text-green-400" :
                                    order.order_status === 'delayed' ? "border-red-500 text-red-400" :
                                        "border-cyan-500 text-cyan-400"
                            )}>
                                {order.order_status}
                            </Badge>
                            <span className="text-xs font-mono text-muted-foreground">ID: #{order.id?.slice(0, 8)}</span>
                        </div>
                        <SheetTitle className="text-xl font-bold tracking-tight text-white mb-1">
                            {order.phase?.phase_name || 'Material Order'}
                        </SheetTitle>
                        <SheetDescription className="text-zinc-400">
                            {order.project?.project_name} • {new Date(order.created_at).toLocaleDateString()}
                        </SheetDescription>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="p-6 space-y-8">
                            {/* Vendor Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Vendor</h4>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
                                            <span className="text-xs font-bold text-violet-300">
                                                {order.vendor?.vendor_name?.slice(0, 2).toUpperCase()}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm text-zinc-200">{order.vendor?.vendor_name}</p>
                                            <p className="text-xs text-zinc-500">Tier 1 Supplier</p>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 mt-3">
                                        <div className="flex items-center text-xs text-zinc-400">
                                            <Phone className="w-3.5 h-3.5 mr-2 opacity-70" />
                                            {order.vendor?.contact_person_mobile || 'N/A'}
                                        </div>
                                        <div className="flex items-center text-xs text-zinc-400">
                                            <Mail className="w-3.5 h-3.5 mr-2 opacity-70" />
                                            {order.vendor?.contact_person_email || 'N/A'}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Value</h4>
                                    <div className="flex items-baseline gap-1 mb-1">
                                        <IndianRupee className="w-4 h-4 text-emerald-400" />
                                        <span className="text-2xl font-bold text-emerald-400">
                                            {(order.quoted_total || 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1 mt-2">
                                        <p className="text-xs text-zinc-400 flex justify-between">
                                            <span>Subtotal:</span>
                                            <span>₹{((order.quoted_total || 0) * 0.82).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                        </p>
                                        <p className="text-xs text-zinc-400 flex justify-between">
                                            <span>GST (18%):</span>
                                            <span>₹{((order.quoted_total || 0) * 0.18).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Enhanced Timeline */}
                            <div>
                                <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-cyan-400" />
                                    Shipment Tracking
                                </h3>
                                <div className="relative pl-4 border-l border-white/10 space-y-6">
                                    {[
                                        { status: 'ordered', label: 'Order Placed', time: '2 days ago', done: true },
                                        { status: 'loading', label: 'Processing & Loading', time: 'Yesterday', done: ['loading', 'shipped', 'delivered'].includes(order.order_status) },
                                        { status: 'shipped', label: 'In Transit', time: 'Today 10:30 AM', done: ['shipped', 'delivered'].includes(order.order_status) },
                                        { status: 'delivered', label: 'Delivered to Site', time: 'Expected Tomorrow', done: order.order_status === 'delivered' }
                                    ].map((step, i) => (
                                        <div key={i} className="relative group">
                                            <div className={cn(
                                                "absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 transition-all duration-300",
                                                step.done
                                                    ? "bg-cyan-500 border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                                                    : "bg-zinc-900 border-zinc-700"
                                            )} />
                                            <div className={cn("transition-opacity", step.done ? "opacity-100" : "opacity-40")}>
                                                <p className="text-sm font-medium text-zinc-200">{step.label}</p>
                                                <p className="text-xs text-zinc-500">{step.time}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Line Items */}
                            <div>
                                <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                                    <Package className="w-4 h-4 text-violet-400" />
                                    Items in Order
                                </h3>
                                <div className="space-y-2">
                                    {/* Mock items for visual appeal if real ones are missing */}
                                    {(order.boq_items?.length ? order.boq_items : [1, 2]).map((item: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/50 border border-white/5 hover:border-white/10 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center text-xs font-mono text-zinc-400">
                                                    {idx + 1}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-zinc-300">
                                                        {item.item_name || 'Construction Material Grade A'}
                                                    </p>
                                                    <p className="text-xs text-zinc-500">
                                                        QTY: {item.quantity || 100} units
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-medium text-zinc-300">
                                                    ₹{((item.rate || 5000) * (item.quantity || 100)).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </ScrollArea>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-white/10 bg-black/40 backdrop-blur-xl">
                        <div className="grid grid-cols-2 gap-3">
                            <Button variant="outline" className="border-white/10 hover:bg-white/5 text-zinc-300">
                                <FileText className="w-4 h-4 mr-2" />
                                Download PO
                            </Button>
                            <Button className="bg-cyan-600 hover:bg-cyan-700 text-white shadow-[0_0_20px_rgba(8,145,178,0.3)]">
                                <Truck className="w-4 h-4 mr-2" />
                                Track Live
                            </Button>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
