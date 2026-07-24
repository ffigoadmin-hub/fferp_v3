import { ReactNode } from 'react';

export function ComingSoonOverlay({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <div className="pointer-events-none select-none" style={{ filter: 'blur(4px)', opacity: 0.5 }}>
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-xl px-8 py-6 text-center max-w-sm">
          <div className="text-3xl mb-2">🚧</div>
          <h3 className="font-bold text-gray-800">Coming Soon</h3>
        </div>
      </div>
    </div>
  );
}
