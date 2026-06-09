import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import App from "./App.tsx";
import "./index.css";

console.log("main.tsx: Script started - Cache cleared 2026-03-21");

const rootElement = document.getElementById("root");

import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";

if (!rootElement) {
    console.error("main.tsx: FATAL - Root element not found");
    document.body.innerHTML = '<div style="color: red; padding: 20px;"><h1>Fatal Error: Root element missing</h1></div>';
} else {
    console.log("main.tsx: Root element found, mounting React app");
    try {
        createRoot(rootElement).render(
            <ErrorBoundary>
                <AuthProvider>
                    <ThemeProvider>
                        <App />
                    </ThemeProvider>
                </AuthProvider>
            </ErrorBoundary>
        );
        console.log("main.tsx: React mount command sent");
    } catch (err) {
        console.error("main.tsx: FATAL - React mount failed", err);
        rootElement.innerHTML = `<div style="color: red; padding: 20px;"><h1>Fatal Error: React failed to mount</h1><pre>${err}</pre></div>`;
    }
}
