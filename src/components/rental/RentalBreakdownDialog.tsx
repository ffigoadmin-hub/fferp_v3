
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { RentalStatusBadge } from "./RentalStatusBadge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface RentalBreakdownDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    records: any[];
}

export function RentalBreakdownDialog({ open, onOpenChange, title, description, records }: RentalBreakdownDialogProps) {
    const totalAmount = records.reduce((sum, r) => sum + (r.net_payable_amount || r.base_rent || 0), 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex justify-between items-center text-xl">
                        <span>{title}</span>
                        <Badge variant="outline" className="text-lg px-3 py-1">
                            Total: ₹{totalAmount.toLocaleString()}
                        </Badge>
                    </DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>

                <div className="flex-1 overflow-auto min-h-0 mt-4 border rounded-md">
                    <Table>
                        <TableHeader className="bg-muted/50 sticky top-0 bg-card z-10">
                            <TableRow>
                                <TableHead>Property</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Period</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {records.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        No records found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                records.map((record) => {
                                    const amount = record.net_payable_amount || record.base_rent || 0;
                                    return (
                                        <TableRow key={record.id}>
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col">
                                                    <span>{record.rental_properties?.title || 'Unknown Property'}</span>
                                                    <span className="text-[10px] text-muted-foreground">{record.rental_properties?.rental_categories?.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>{record.rental_properties?.location}</TableCell>
                                            <TableCell className="text-xs">{format(new Date(record.month_year), 'MMM yyyy')}</TableCell>
                                            <TableCell>
                                                <div className="scale-90 origin-left">
                                                    <RentalStatusBadge status={record.status} />
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-bold">
                                                ₹{amount.toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    );
}
