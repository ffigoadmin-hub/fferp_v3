export type ThemeId =
    | 'default'
    | 'valentine'
    | 'republic'
    | 'independence'
    | 'constitution'
    | 'unity'
    | 'make-in-india'
    | 'diwali'
    | 'holi'
    | 'pongal'
    | 'navratri'
    | 'christmas'
    | 'new-year'
    | 'audit'
    | 'crisis'
    | 'growth'
    | 'investor'
    | 'performance'
    | 'gratitude'
    | 'women-leadership'
    | 'farmers'
    | 'founders'
    | 'temple'
    | 'divine'
    | 'meditation'
    | 'monsoon'
    | 'summer'
    | 'winter';

export interface ThemeConfig {
    id: ThemeId;
    name: string;
    category: 'National' | 'Festival' | 'Business' | 'Emotional' | 'Spiritual' | 'Seasonal';
    cssClass: string;
    primaryColor: string; // Hex for preview circles
}

export const THEMES: ThemeConfig[] = [
    { id: 'default', name: 'Default Enterprise', category: 'Business', cssClass: '', primaryColor: '#0ea5e9' },
    { id: 'valentine', name: 'Valentine Corporate', category: 'Emotional', cssClass: 'theme-valentine', primaryColor: '#e11d48' },
    { id: 'gratitude', name: 'Gratitude Day', category: 'Emotional', cssClass: 'theme-gratitude', primaryColor: '#f97316' },
    { id: 'women-leadership', name: 'Women Leadership', category: 'Emotional', cssClass: 'theme-women-leadership', primaryColor: '#9333ea' },
    { id: 'farmers', name: 'Farmers Appreciation', category: 'Emotional', cssClass: 'theme-farmers', primaryColor: '#4ade80' },
    { id: 'founders', name: 'Founders Day', category: 'Emotional', cssClass: 'theme-founders', primaryColor: '#94a3b8' },

    { id: 'republic', name: 'Republic Pride', category: 'National', cssClass: 'theme-republic', primaryColor: '#f97316' },
    { id: 'independence', name: 'Independence Glory', category: 'National', cssClass: 'theme-independence', primaryColor: '#22c55e' },
    { id: 'constitution', name: 'Constitution Blue', category: 'National', cssClass: 'theme-constitution', primaryColor: '#0ea5e9' },
    { id: 'unity', name: 'Unity in Diversity', category: 'National', cssClass: 'theme-unity', primaryColor: '#c026d3' },
    { id: 'make-in-india', name: 'Make in India', category: 'National', cssClass: 'theme-make-in-india', primaryColor: '#d97706' },

    { id: 'diwali', name: 'Diwali Gold', category: 'Festival', cssClass: 'theme-diwali', primaryColor: '#eab308' },
    { id: 'holi', name: 'Holi Spectrum', category: 'Festival', cssClass: 'theme-holi', primaryColor: '#d946ef' },
    { id: 'pongal', name: 'Pongal Harvest', category: 'Festival', cssClass: 'theme-pongal', primaryColor: '#65a30d' },
    { id: 'navratri', name: 'Navratri Royal', category: 'Festival', cssClass: 'theme-navratri', primaryColor: '#be123c' },
    { id: 'christmas', name: 'Christmas Joy', category: 'Festival', cssClass: 'theme-christmas', primaryColor: '#dc2626' },
    { id: 'new-year', name: 'New Year Platinum', category: 'Festival', cssClass: 'theme-new-year', primaryColor: '#e2e8f0' },

    { id: 'audit', name: 'Audit Shield', category: 'Business', cssClass: 'theme-audit', primaryColor: '#3b82f6' },
    { id: 'crisis', name: 'Crisis Control', category: 'Business', cssClass: 'theme-crisis', primaryColor: '#ef4444' },
    { id: 'growth', name: 'Growth Acceleration', category: 'Business', cssClass: 'theme-growth', primaryColor: '#10b981' },
    { id: 'investor', name: 'Investor Presentation', category: 'Business', cssClass: 'theme-investor', primaryColor: '#f8fafc' },
    { id: 'performance', name: 'Performance Boost', category: 'Business', cssClass: 'theme-performance', primaryColor: '#8b5cf6' },

    { id: 'temple', name: 'Temple Saffron', category: 'Spiritual', cssClass: 'theme-temple', primaryColor: '#f59e0b' },
    { id: 'divine', name: 'Divine Gold', category: 'Spiritual', cssClass: 'theme-divine', primaryColor: '#fbbf24' },
    { id: 'meditation', name: 'Meditation Calm', category: 'Spiritual', cssClass: 'theme-meditation', primaryColor: '#2dd4bf' },

    { id: 'monsoon', name: 'Monsoon Fresh', category: 'Seasonal', cssClass: 'theme-monsoon', primaryColor: '#0ea5e9' },
    { id: 'summer', name: 'Summer Energy', category: 'Seasonal', cssClass: 'theme-summer', primaryColor: '#fbbf24' },
    { id: 'winter', name: 'Winter Calm', category: 'Seasonal', cssClass: 'theme-winter', primaryColor: '#cbd5e1' },
];
