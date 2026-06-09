import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Wallet } from 'lucide-react';

interface CashflowPoint {
    date: string;
    projectValue: number;
    cumulativeCollection: number;
    projectedCollection: number; // Ideal/Planned
}

interface ProjectCashflowChartProps {
    data: CashflowPoint[];
}

export function ProjectCashflowChart({ data }: ProjectCashflowChartProps) {
    // If no data, show empty state or mock
    const displayData = data.length > 0 ? data : [
        { date: 'Jan', projectValue: 0, cumulativeCollection: 0, projectedCollection: 0 },
        { date: 'Feb', projectValue: 0, cumulativeCollection: 0, projectedCollection: 0 }
    ];

    return (
        <Card className="h-full bg-card/40 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-2 border-b border-border/10">
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Cashflow Trajectory
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={displayData} margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorCollection" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis
                            dataKey="date"
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                            tickFormatter={(value) => `₹${value / 100000}L`}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                borderColor: 'hsl(var(--border))',
                                borderRadius: '8px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                            }}
                            formatter={(value: number) => [`₹${(value / 100000).toFixed(2)}L`, '']}
                        />
                        <Legend iconType="circle" />

                        {/* Project Value (The Ceiling) */}
                        <Area
                            type="stepAfter"
                            dataKey="projectValue"
                            name="Net Contract Value"
                            stroke="hsl(var(--primary))"
                            fill="url(#colorValue)"
                            strokeWidth={2}
                        />

                        {/* Actual Collections */}
                        <Area
                            type="monotone"
                            dataKey="cumulativeCollection"
                            name="Realized Collection"
                            stroke="#10b981"
                            fill="url(#colorCollection)"
                            strokeWidth={2}
                        />

                        {/* Projected/Ideal Line (Dashed) */}
                        <Line
                            type="monotone"
                            dataKey="projectedCollection"
                            name="Planned Schedule"
                            stroke="#f59e0b"
                            strokeDasharray="5 5"
                            strokeWidth={2}
                            dot={false}
                        />

                    </ComposedChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
