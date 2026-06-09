import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function SandboxPage() {
    const [inputValue, setInputValue] = useState("");

    return (
        <div className="container mx-auto py-10 space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Developer Sandbox</h1>
                <p className="text-muted-foreground">A safe space for testing components and experimental features.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>UI Primitives</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            <Button>Default Button</Button>
                            <Button variant="secondary">Secondary</Button>
                            <Button variant="destructive">Destructive</Button>
                            <Button variant="outline">Outline</Button>
                            <Button variant="ghost">Ghost</Button>
                            <Button variant="link">Link</Button>
                        </div>
                        <Separator />
                        <div className="flex flex-wrap gap-2">
                            <Badge>Default Badge</Badge>
                            <Badge variant="secondary">Secondary</Badge>
                            <Badge variant="destructive">Destructive</Badge>
                            <Badge variant="outline">Outline</Badge>
                        </div>
                        <Separator />
                        <div className="flex w-full max-w-sm items-center space-x-2">
                            <Input 
                                type="text" 
                                placeholder="Test input state..." 
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                            />
                            <Button type="submit">Subscribe</Button>
                        </div>
                        <p className="text-sm text-muted-foreground">Input value: {inputValue}</p>
                    </CardContent>
                </Card>

                <Card className="h-full flex flex-col justify-center items-center p-6 border-dashed">
                    <div className="text-center space-y-2">
                        <h3 className="text-lg font-semibold">Experimental Zone</h3>
                        <p className="text-sm text-muted-foreground">
                            Use this area to mount new complex components or test data fetching hooks.
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    );
}
