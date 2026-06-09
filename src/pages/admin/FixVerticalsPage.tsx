import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const EXPECTED_VERTICALS = {
    DIRECT: [
        { code: 'polyhouse', name: 'Polyhouse', description: 'Protected cultivation structures', icon: 'Warehouse', color: 'green', display_order: 1 },
        { code: 'microgreens', name: 'Microgreens', description: 'Indoor microgreen farming', icon: 'Sprout', color: 'emerald', display_order: 2 },
        { code: 'mushroom', name: 'Mushroom', description: 'Mushroom cultivation', icon: 'Circle', color: 'amber', display_order: 3 },
        { code: 'open_cultivation', name: 'Open Cultivation', description: 'Open field farming', icon: 'Sun', color: 'yellow', display_order: 4 },
        { code: 'goat_farming', name: 'Goat Farming', description: 'Livestock - Goats', icon: 'Milk', color: 'orange', display_order: 5 },
        { code: 'crab_farming', name: 'Crab Farming', description: 'Aquaculture - Crabs', icon: 'Fish', color: 'blue', display_order: 6 },
    ],
    JV: [
        { code: 'new_jv', name: 'New JV', description: 'New joint venture construction', icon: 'Building2', color: 'indigo', display_order: 1 },
        { code: 'revamp_jv', name: 'Revamp JV', description: 'Renovation of existing JV', icon: 'RefreshCw', color: 'violet', display_order: 2 },
        { code: 'repair_services', name: 'Repair & Services', description: 'Maintenance and repair work', icon: 'Wrench', color: 'slate', display_order: 3 },
    ],
};

interface VerticalStatus {
    category: string;
    code: string;
    name: string;
    exists: boolean;
    active: boolean;
}

export function FixVerticalsPage() {
    const [loading, setLoading] = useState(true);
    const [fixing, setFixing] = useState(false);
    const [verticals, setVerticals] = useState<VerticalStatus[]>([]);
    const [fixed, setFixed] = useState(false);

    const checkVerticals = async () => {
        setLoading(true);
        try {
            const { data: existing } = await supabase
                .from('project_verticals')
                .select('*');

            const existingMap = new Map(existing?.map(v => [v.code, v]) || []);

            const status: VerticalStatus[] = [];

            for (const [category, list] of Object.entries(EXPECTED_VERTICALS)) {
                for (const expected of list) {
                    const exists = existingMap.has(expected.code);
                    const vertical = existingMap.get(expected.code);
                    status.push({
                        category,
                        code: expected.code,
                        name: expected.name,
                        exists,
                        active: vertical?.is_active || false,
                    });
                }
            }

            setVerticals(status);
        } catch (error) {
            console.error('Error checking verticals:', error);
        } finally {
            setLoading(false);
        }
    };

    const fixVerticals = async () => {
        setFixing(true);
        try {
            for (const [category, list] of Object.entries(EXPECTED_VERTICALS)) {
                for (const expected of list) {
                    const { error } = await supabase
                        .from('project_verticals')
                        .upsert({
                            category,
                            code: expected.code,
                            name: expected.name,
                            description: expected.description,
                            icon: expected.icon,
                            color: expected.color,
                            display_order: expected.display_order,
                            is_active: true,
                        }, {
                            onConflict: 'code',
                        });

                    if (error) {
                        console.error(`Error upserting ${expected.code}:`, error);
                    }
                }
            }

            setFixed(true);
            await checkVerticals();
        } catch (error) {
            console.error('Error fixing verticals:', error);
        } finally {
            setFixing(false);
        }
    };

    useEffect(() => {
        checkVerticals();
    }, []);

    const missingCount = verticals.filter(v => !v.exists).length;
    const inactiveCount = verticals.filter(v => v.exists && !v.active).length;

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Project Verticals Diagnostic</h1>
                <p className="text-muted-foreground">
                    Check and repair project verticals for DIRECT and JV categories
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center p-12">
                    <Loader2 className="w-8 h-8 animate-spin" />
                </div>
            ) : (
                <>
                    <Card className="p-6 mb-6">
                        <h2 className="text-xl font-semibold mb-4">Status Summary</h2>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <div className="text-2xl font-bold">{verticals.length}</div>
                                <div className="text-sm text-muted-foreground">Expected</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-red-600">{missingCount}</div>
                                <div className="text-sm text-muted-foreground">Missing</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-amber-600">{inactiveCount}</div>
                                <div className="text-sm text-muted-foreground">Inactive</div>
                            </div>
                        </div>

                        {(missingCount > 0 || inactiveCount > 0) && !fixed && (
                            <Button
                                onClick={fixVerticals}
                                disabled={fixing}
                                className="mt-6 w-full"
                            >
                                {fixing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Fixing...
                                    </>
                                ) : (
                                    'Fix Missing/Inactive Verticals'
                                )}
                            </Button>
                        )}

                        {fixed && (
                            <div className="mt-6 p-4 bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-100 rounded-lg">
                                ✅ Verticals have been fixed! Refresh the page to see the updated status.
                            </div>
                        )}
                    </Card>

                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">DIRECT Category (6 verticals)</h3>
                        {verticals
                            .filter(v => v.category === 'DIRECT')
                            .map(v => (
                                <div key={v.code} className="flex items-center gap-3 p-3 border rounded-lg">
                                    {v.exists && v.active ? (
                                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    ) : (
                                        <XCircle className="w-5 h-5 text-red-600" />
                                    )}
                                    <div className="flex-1">
                                        <div className="font-medium">{v.name}</div>
                                        <div className="text-sm text-muted-foreground">{v.code}</div>
                                    </div>
                                    <div className="text-sm">
                                        {!v.exists ? (
                                            <span className="text-red-600">Missing</span>
                                        ) : !v.active ? (
                                            <span className="text-amber-600">Inactive</span>
                                        ) : (
                                            <span className="text-green-600">Active</span>
                                        )}
                                    </div>
                                </div>
                            ))}

                        <h3 className="text-lg font-semibold mt-8">JV Category (3 verticals)</h3>
                        {verticals
                            .filter(v => v.category === 'JV')
                            .map(v => (
                                <div key={v.code} className="flex items-center gap-3 p-3 border rounded-lg">
                                    {v.exists && v.active ? (
                                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    ) : (
                                        <XCircle className="w-5 h-5 text-red-600" />
                                    )}
                                    <div className="flex-1">
                                        <div className="font-medium">{v.name}</div>
                                        <div className="text-sm text-muted-foreground">{v.code}</div>
                                    </div>
                                    <div className="text-sm">
                                        {!v.exists ? (
                                            <span className="text-red-600">Missing</span>
                                        ) : !v.active ? (
                                            <span className="text-amber-600">Inactive</span>
                                        ) : (
                                            <span className="text-green-600">Active</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                    </div>
                </>
            )}
        </div>
    );
}
