import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);

        // Auto-reload once on chunk load failures (stale cache after new deploy)
        const isChunkError = (
            error?.message?.includes('Failed to fetch dynamically imported module') ||
            error?.message?.includes('Importing a module script failed') ||
            error?.name === 'ChunkLoadError'
        );

        if (isChunkError) {
            const reloadAttempted = sessionStorage.getItem('chunk_reload_attempted');
            if (!reloadAttempted) {
                sessionStorage.setItem('chunk_reload_attempted', '1');
                window.location.reload();
            }
        }
    }

    public render() {
        if (this.state.hasError) {
            const isChunkError = (
                this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
                this.state.error?.message?.includes('Importing a module script failed') ||
                this.state.error?.name === 'ChunkLoadError'
            );

            // For chunk errors, show a minimal reload prompt
            if (isChunkError) {
                return (
                    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
                        <div className="bg-primary/10 p-4 rounded-full mb-4">
                            <RefreshCw className="h-10 w-10 text-primary animate-spin" />
                        </div>
                        <h1 className="text-xl font-bold mb-2">Updating App...</h1>
                        <p className="text-muted-foreground mb-6 max-w-md text-sm">
                            A new version is available. Reloading automatically...
                        </p>
                        <Button onClick={() => { sessionStorage.removeItem('chunk_reload_attempted'); window.location.reload(); }} className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Reload Now
                        </Button>
                    </div>
                );
            }

            return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
                    <div className="bg-destructive/10 p-4 rounded-full mb-4">
                        <AlertTriangle className="h-10 w-10 text-destructive" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
                    <p className="text-muted-foreground mb-6 max-w-md">
                        The application encountered an unexpected error.
                        {this.state.error?.message && (
                            <span className="block mt-2 text-xs font-mono bg-muted p-2 rounded">
                                {this.state.error.message}
                            </span>
                        )}
                    </p>
                    <div className="flex gap-4">
                        <Button
                            onClick={() => window.location.reload()}
                            className="gap-2"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Reload Page
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => window.location.href = '/'}
                        >
                            Go Home
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
