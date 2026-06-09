import React, { useState } from 'react';
import { useAIConfig, AIConfig } from '@/hooks/useAIConfig';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bot, Activity, Settings, Key, Database, RefreshCw, Layers, Zap, AlertTriangle, Terminal, Code, Power, BrainCircuit, ActivitySquare, Server, ArrowRight, ShieldAlert, Cpu } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const AICommandCenter = () => {
    const { config, logs, loading, logsLoading, updateConfig, refreshLogs } = useAIConfig();
    const [selectedModel, setSelectedModel] = useState('');
    const [fallbackModel, setFallbackModel] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [temperature, setTemperature] = useState(0.7);
    const [batchSize, setBatchSize] = useState(3);
    const [delayMs, setDelayMs] = useState(2000);
    const [maxTokens, setMaxTokens] = useState(1024);
    const [isActive, setIsActive] = useState(true);

    // Update local state when config loads
    React.useEffect(() => {
        if (config) {
            setSelectedModel(config.model_id);
            setFallbackModel(config.fallback_model_id || '');
            setSystemPrompt(config.system_prompt || '');
            setTemperature(config.temperature || 0.7);
            setBatchSize(config.settings?.batch_size || 3);
            setDelayMs(config.settings?.delay_ms || 2000);
            setMaxTokens(config.settings?.max_tokens || 1024);
            setIsActive(config.is_active);
        }
    }, [config]);

    const handleSaveConfig = () => {
        updateConfig({
            model_id: selectedModel,
            fallback_model_id: fallbackModel,
            system_prompt: systemPrompt,
            temperature: temperature,
            is_active: isActive,
            settings: {
                batch_size: batchSize,
                delay_ms: delayMs,
                max_tokens: maxTokens
            }
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#020617]">
                <div className="flex flex-col items-center space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin text-cyan-500" />
                    <p className="text-cyan-400 font-mono animate-pulse tracking-widest uppercase">Initializing Cyber-Core...</p>
                </div>
            </div>
        );
    }

    const chartData = [...logs].reverse().map((log, index) => ({
        index,
        latency: log.duration_ms,
        tokens: (log.tokens_input + log.tokens_output) || 0,
        time: new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));

    return (
        <div className="relative min-h-screen bg-[#020617] text-slate-300 font-mono overflow-hidden selection:bg-cyan-500 selection:text-black">
            {/* Cyber-Grid Overlay */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-20"
                style={{ backgroundImage: 'radial-gradient(#1e293b 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>

            {/* Scanline Effect */}
            <div className="absolute inset-0 z-5 pointer-events-none opacity-[0.03] animate-scanline bg-gradient-to-b from-transparent via-cyan-500 to-transparent h-[10%]"></div>

            <div className="relative z-10 p-6 space-y-6 max-w-7xl mx-auto">
                {/* Header Section */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex flex-col md:flex-row items-center justify-between border-b border-cyan-500/30 pb-6 mb-8"
                >
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-cyan-500 shadow-[0_0_20px_rgba(34,211,238,0.4)] rounded-lg">
                            <BrainCircuit className="w-10 h-10 text-black" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black tracking-tighter text-white flex items-center italic uppercase">
                                AI CONTROL HUB
                            </h1>
                            <div className="flex items-center space-x-2 mt-1">
                                <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 bg-emerald-500/5 px-2 py-0 text-[10px] uppercase font-bold tracking-widest shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                                    Secure Connection
                                </Badge>
                                <span className="text-slate-500 text-[10px] tracking-tighter">v2.5.0//CYBER-AUDIT</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 md:mt-0 flex items-center gap-4 bg-slate-900/50 p-3 rounded-xl border border-white/5 backdrop-blur-md">
                        <div className="flex flex-col items-end px-2">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Global State</span>
                            <span className={`text-xs font-black ${isActive ? 'text-emerald-400 drop-shadow-[0_0_5px_#10b981]' : 'text-rose-500 animate-pulse'}`}>
                                {isActive ? 'ACTIVE_LINK' : 'LINK_SEVERED'}
                            </span>
                        </div>
                        <Switch
                            checked={isActive}
                            onCheckedChange={(checked) => {
                                setIsActive(checked);
                                updateConfig({ is_active: checked });
                            }}
                            className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-rose-500"
                        />
                        <Separator orientation="vertical" className="h-8 bg-white/10 mx-1" />
                        <Button
                            variant="default"
                            onClick={refreshLogs}
                            disabled={logsLoading}
                            className="bg-cyan-600 hover:bg-cyan-500 text-black font-black uppercase text-xs tracking-widest shadow-[0_0_15px_rgba(34,211,238,0.3)] transition-all active:scale-95"
                        >
                            <RefreshCw className={`w-3 h-3 mr-2 ${logsLoading ? 'animate-spin' : ''}`} />
                            Sync Data
                        </Button>
                    </div>
                </motion.div>

                {/* Cyber-Stats Grid */}
                <div className="grid gap-6 md:grid-cols-4">
                    {[
                        { label: 'Uplink Calls', val: logs.length, icon: Cpu, desc: 'PACKET_COUNT', color: 'text-cyan-400', glow: 'shadow-[0_0_15px_rgba(34,211,238,0.15)]' },
                        { label: 'Signal Delay', val: logs.length > 0 ? `${Math.round(logs.reduce((a, b) => a + (b.duration_ms || 0), 0) / logs.length)}ms` : '0ms', icon: Activity, desc: 'AVG_LATENCY', color: 'text-emerald-400', glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]' },
                        { label: 'Active Matrix', val: config?.model_id?.split('/').pop() || 'OFFLINE', icon: Layers, desc: `HOST: ${config?.provider || 'NULL'}`, color: 'text-purple-400', glow: 'shadow-[0_0_15px_rgba(168,85,247,0.15)]' },
                        { label: 'Integrity', val: `${logs.length > 0 ? Math.round((logs.filter(l => l.status === 'success').length / logs.length) * 100) : 100}%`, icon: ShieldAlert, desc: 'HEALTH_SCORE', color: 'text-emerald-400', glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]' }
                    ].map((stat, i) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                        >
                            <Card className={`bg-slate-900/40 border-l-4 border-l-current ${stat.color} border-white/5 backdrop-blur-sm overflow-hidden group hover:bg-slate-900/60 transition-all ${stat.glow}`}>
                                <CardHeader className="p-4 flex flex-row items-center justify-between pb-2">
                                    <span className="text-[10px] font-bold text-slate-500 flex items-center tracking-[0.2em]">
                                        <stat.icon className="w-3 h-3 mr-2" /> {stat.label}
                                    </span>
                                </CardHeader>
                                <CardContent className="px-4 pb-4">
                                    <div className={`text-2xl font-black ${stat.color} tracking-tighter font-mono italic`}>
                                        {stat.val}
                                    </div>
                                    <div className="mt-1 flex items-center">
                                        <span className="text-[9px] text-slate-600 font-bold tracking-tighter uppercase">{stat.desc}</span>
                                        <div className="ml-2 h-0.5 bg-slate-800 flex-1">
                                            <div className={`h-full ${stat.color.replace('text', 'bg')} opacity-40`} style={{ width: '60%' }}></div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                <Tabs defaultValue="observability" className="space-y-6">
                    <TabsList className="bg-slate-900/80 border border-white/5 p-1 rounded-lg w-full md:w-auto overflow-x-auto">
                        <TabsTrigger value="observability" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 font-bold uppercase text-xs tracking-widest px-6 italic">01//Observability</TabsTrigger>
                        <TabsTrigger value="configuration" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 font-bold uppercase text-xs tracking-widest px-6 italic">02//Core_Config</TabsTrigger>
                        <TabsTrigger value="prompts" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 font-bold uppercase text-xs tracking-widest px-6 italic">03//Logic_Nodes</TabsTrigger>
                    </TabsList>

                    <TabsContent value="observability" className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-6">
                                {/* Telemetry Graph */}
                                <Card className="bg-slate-950 border border-white/5 shadow-2xl overflow-hidden group relative">
                                    <div className="absolute top-0 right-0 p-4 font-mono text-[10px] text-cyan-500 opacity-20 group-hover:opacity-40 transition-opacity">
                                        UPLINK_STABLE_V4
                                    </div>
                                    <CardHeader className="border-b border-white/5 bg-white/[0.02]">
                                        <CardTitle className="text-sm font-black text-white flex items-center tracking-widest uppercase">
                                            <ActivitySquare className="mr-3 h-4 w-4 text-cyan-500" /> Signal Strength / Latency
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-6">
                                        <div className="h-[280px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={chartData}>
                                                    <defs>
                                                        <linearGradient id="cyberGradient" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                                                            <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                                    <XAxis dataKey="time" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#475569' }} />
                                                    <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#475569' }} />
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '4px', color: '#22d3ee', fontSize: '10px' }}
                                                        cursor={{ stroke: '#22d3ee', strokeWidth: 1 }}
                                                    />
                                                    <Area type="stepBefore" dataKey="latency" stroke="#22d3ee" fill="url(#cyberGradient)" strokeWidth={2} activeDot={{ r: 4, fill: '#fff', stroke: '#22d3ee' }} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </CardContent>
                                    <div className="px-6 py-2 bg-cyan-500/5 flex justify-between border-t border-white/5">
                                        <div className="text-[10px] text-cyan-500/60 font-bold uppercase tracking-widest">Live Telemetry Feed</div>
                                        <div className="text-[10px] text-slate-500 font-mono">ENCRYPTION: AES-256</div>
                                    </div>
                                </Card>

                                {/* System Flow Visualizer */}
                                <Card className="bg-slate-950 border border-white/5 shadow-2xl relative overflow-hidden">
                                    <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(2,6,23,0.8)_100%)]"></div>
                                    <CardHeader className="bg-white/[0.02] border-b border-white/5">
                                        <CardTitle className="text-sm font-black text-white flex items-center uppercase tracking-[0.2em]">
                                            <Layers className="mr-3 h-4 w-4 text-emerald-500" /> Pipeline Architecture
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-10">
                                        <div className="flex flex-col md:flex-row items-center justify-between space-y-12 md:space-y-0 relative">

                                            {/* Node: Source */}
                                            <Node icon={Database} label="PACKET_SRC" sub="EMPLOYEE_LOG" color="text-slate-400" />
                                            <PipelineConnector active />

                                            {/* Node: Processor */}
                                            <Node icon={Cpu} label="PROCESSOR" sub="EDGE_ENCLAVE" color="text-cyan-400" pulse />
                                            <PipelineConnector active delay="0.5s" />

                                            {/* Node: AI Cluster */}
                                            <Node icon={BrainCircuit} label="NEURAL_GRID" sub={config?.model_id?.split('/').pop() || 'GEMINI'} color="text-purple-400" />
                                            <PipelineConnector active delay="1s" />

                                            {/* Node: Sync */}
                                            <Node icon={Zap} label="SYNC_NODE" sub="PERSISTENCE" color="text-emerald-400" />

                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Live Console Logs */}
                            <div className="lg:col-span-1">
                                <Card className="bg-slate-950 border border-white/5 h-full flex flex-col shadow-inner">
                                    <CardHeader className="bg-slate-900/80 border-b border-cyan-500/20 py-3 flex flex-row items-center justify-between">
                                        <CardTitle className="text-xs font-black text-white flex items-center tracking-widest uppercase italic">
                                            <Terminal className="mr-2 h-4 w-4 text-emerald-400 drop-shadow-[0_0_5px_#10b981]" /> TTY//CONSOLE_V1
                                        </CardTitle>
                                        <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10 animate-pulse tracking-widest">LINK_STABLE</Badge>
                                    </CardHeader>
                                    <CardContent className="flex-1 min-h-[500px] p-0 bg-black/60 relative">
                                        <ScrollArea className="h-[600px] w-full">
                                            <div className="p-4 space-y-3 font-mono text-[11px] leading-relaxed">
                                                {logs.map((log, i) => (
                                                    <div key={log.id}
                                                        className="group border-l-2 border-slate-800 pl-3 py-1 hover:border-cyan-500/50 hover:bg-white/[0.03] transition-all">
                                                        <div className="flex justify-between items-start opacity-70">
                                                            <span className="text-[9px] text-slate-500">[{new Date(log.created_at).toLocaleTimeString()}]</span>
                                                            <span className={`text-[9px] font-black underline ${log.status === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                {log.status === 'success' ? 'HTTP_200_OK' : 'HTTP_500_ERR'}
                                                            </span>
                                                        </div>
                                                        <div className="mt-1">
                                                            <span className="text-cyan-400 font-bold opacity-80">EXECUTORY:</span> <span className="text-slate-300">{log.function_name}</span>
                                                        </div>
                                                        <div className="mt-0.5 flex items-center justify-between">
                                                            <span className="text-purple-400 text-[10px]">@{log.model.split('/').pop()}</span>
                                                            <span className="text-slate-600 bg-slate-800/50 px-1 rounded italic">{log.duration_ms}ms</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {logs.length === 0 && (
                                                    <div className="h-48 flex flex-col items-center justify-center text-slate-700 animate-pulse">
                                                        <Activity className="w-8 h-8 mb-2 opacity-20" />
                                                        <span className="text-[10px] uppercase font-bold tracking-[0.3em]">No Signaling Detected</span>
                                                    </div>
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </CardContent>
                                    <div className="p-2 border-t border-white/5 bg-slate-900/50 flex items-center justify-between text-[8px] text-slate-500 font-bold uppercase tracking-widest">
                                        <span>SYS_KERNEL: 5.15.0</span>
                                        <span className="flex items-center"><span className="w-1 h-1 rounded-full bg-emerald-500 mr-2 animate-ping"></span> LOGS_PERSISTED</span>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="configuration" className="space-y-4">
                        <Card className="bg-[#020617] border border-cyan-500/30 shadow-[0_0_30px_rgba(34,211,238,0.05)]">
                            <CardHeader className="border-b border-white/5">
                                <CardTitle className="text-white italic uppercase tracking-[0.2em] flex items-center">
                                    <Settings className="mr-3 h-5 w-5 text-cyan-500" /> Core Orchestration
                                </CardTitle>
                                <CardDescription className="text-slate-500 font-bold text-xs">REPROGRAM SYSTEM PARAMETERS</CardDescription>
                            </CardHeader>
                            <CardContent className="p-8 space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-6 p-6 bg-slate-900/30 rounded-2xl border border-cyan-500/20 shadow-inner group transition-all hover:border-cyan-500/40">
                                        <h3 className="text-xs font-black text-cyan-400 uppercase tracking-[0.3em] flex items-center">
                                            <Zap className="w-3 h-3 mr-3" /> L1//PRIMARY_LAYER
                                        </h3>
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] text-slate-500 font-black uppercase tracking-widest">PROVIDER_HOST</Label>
                                                <Select defaultValue="google">
                                                    <SelectTrigger className="bg-black/50 border-white/10 text-slate-200">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-slate-900 border-white/10">
                                                        <SelectItem value="google">GOOGLE_AI_UPLINK</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] text-slate-500 font-black uppercase tracking-widest">MODEL_IDENT</Label>
                                                <Select value={selectedModel} onValueChange={setSelectedModel}>
                                                    <SelectTrigger className="bg-black/50 border-white/10 text-cyan-400 font-black italic">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-slate-900 border-white/10">
                                                        <SelectItem value="google/gemini-1.5-flash">GEMINI_1.5_FLASH//U_LIGHT</SelectItem>
                                                        <SelectItem value="google/gemini-1.5-pro">GEMINI_1.5_PRO//R_PRO</SelectItem>
                                                        <SelectItem value="google/gemini-2.0-flash">GEMINI_2.0_FLASH//NEXT_GEN</SelectItem>
                                                        <SelectItem value="google/gemini-2.0-flash-exp">GEMINI_2.0_FLASH_XP//V_BETA</SelectItem>
                                                        <SelectItem value="google/gemini-2.0-pro-exp-02-05">GEMINI_2.0_PRO_XP//ULTIMATE</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-6 p-6 bg-rose-500/[0.03] rounded-2xl border border-rose-500/20 shadow-inner group transition-all hover:border-rose-500/40">
                                        <h3 className="text-xs font-black text-rose-400 uppercase tracking-[0.3em] flex items-center">
                                            <AlertTriangle className="w-3 h-3 mr-3" /> L2//REDUNDANCY_NODE
                                        </h3>
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] text-slate-500 font-black uppercase tracking-widest">FAIL_OVER_DEST</Label>
                                                <Select value={fallbackModel} onValueChange={setFallbackModel}>
                                                    <SelectTrigger className="bg-black/50 border-white/10 text-rose-400 font-black italic">
                                                        <SelectValue placeholder="STATUS:DISABLED" />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-slate-900 border-white/10">
                                                        <SelectItem value="google/gemini-1.5-pro">GEMINI_1.5_PRO//STABLE</SelectItem>
                                                        <SelectItem value="google/gemini-1.5-flash">GEMINI_1.5_FLASH//RECOVERY</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="p-3 bg-black/40 rounded border border-white/5">
                                                <p className="text-[9px] text-slate-500 leading-relaxed uppercase font-bold tracking-tight italic">
                                                    CRITICAL notice: System will auto-pivot to L2 if L1 response times exceed threshold or encounter 5xx signaling errors.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h3 className="text-xs font-black text-white italic uppercase tracking-[0.3em] flex items-center">
                                        <Code className="w-4 h-4 mr-3 text-purple-500 underline" /> Physical Parameters
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                        <ParameterInput label="BATCH_SIZE" value={batchSize} onChange={setBatchSize} max={10} />
                                        <ParameterInput label="DELAY_MS" value={delayMs} onChange={setDelayMs} max={5000} />
                                        <ParameterInput label="TEMPERATURE" value={temperature} onChange={setTemperature} max={1} step={0.1} />
                                    </div>
                                </div>

                                <div className="pt-8 flex justify-end">
                                    <Button
                                        onClick={handleSaveConfig}
                                        className="bg-cyan-600 hover:bg-cyan-500 text-black font-black uppercase italic tracking-[0.2em] px-10 shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all active:scale-95 group"
                                    >
                                        <Settings className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform" />
                                        Update_Core_Directives
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="prompts" className="space-y-4">
                        <Card className="bg-[#020617] border border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.05)] h-full">
                            <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 p-8">
                                <div>
                                    <CardTitle className="text-xl font-black text-white italic uppercase tracking-[0.2em] flex items-center">
                                        <Terminal className="mr-3 h-6 w-6 text-purple-500" /> Neural Directive Entry
                                    </CardTitle>
                                    <CardDescription className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Configure logic layers for the Auditor Agent</CardDescription>
                                </div>
                                <Button
                                    onClick={handleSaveConfig}
                                    size="sm"
                                    className="bg-purple-600 hover:bg-purple-500 text-white font-black italic uppercase tracking-widest px-6 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                                >
                                    Push Directives
                                </Button>
                            </CardHeader>
                            <CardContent className="p-8 space-y-8">
                                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                                    <div className="lg:col-span-3">
                                        <div className="relative group p-[2px] rounded-xl overflow-hidden bg-gradient-to-br from-purple-500/20 to-transparent">
                                            <Textarea
                                                className="min-h-[500px] font-mono text-xs leading-relaxed p-6 bg-black/80 border-none focus:ring-1 focus:ring-purple-500/50 text-slate-300 resize-none shadow-inner"
                                                value={systemPrompt}
                                                onChange={(e) => setSystemPrompt(e.target.value)}
                                                placeholder="[SYS_INIT]// Enter directives here..."
                                            />
                                            {/* Glow overlay */}
                                            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-purple-500/10 to-transparent pointer-events-none"></div>
                                        </div>
                                    </div>

                                    <div className="space-y-8">
                                        <div className="p-6 bg-slate-900/40 rounded-xl border border-white/5 shadow-inner">
                                            <h4 className="text-[10px] font-black text-cyan-400 mb-4 uppercase tracking-[0.3em] italic">Injectable_Nodes</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {['{{userName}}', '{{department}}', '{{date}}', '{{time}}', '{{history}}'].map(tag => (
                                                    <code key={tag} className="text-[9px] bg-black/60 px-2 py-1.5 rounded border border-white/10 text-cyan-400 font-mono font-bold cursor-pointer hover:border-cyan-500/50 transition-all select-all shadow-sm">
                                                        {tag}
                                                    </code>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="p-6 bg-slate-900/40 rounded-xl border border-white/5 shadow-inner">
                                            <h4 className="text-[10px] font-black text-purple-400 mb-4 uppercase tracking-[0.3em] italic">Rule_Priority</h4>
                                            <ul className="text-[10px] text-slate-500 space-y-4 list-none uppercase font-bold tracking-tight">
                                                <li className="flex items-start group cursor-default">
                                                    <span className="bg-purple-500/50 w-1.5 h-1.5 mt-1 mr-3 shrink-0 rounded-full group-hover:scale-150 transition-transform"></span>
                                                    <span>Enforce Strict Persona: [Gov_Auditor]</span>
                                                </li>
                                                <li className="flex items-start group cursor-default">
                                                    <span className="bg-purple-500/50 w-1.5 h-1.5 mt-1 mr-3 shrink-0 rounded-full group-hover:scale-150 transition-transform"></span>
                                                    <span>Output Format: JSON_VALIDATED</span>
                                                </li>
                                                <li className="flex items-start group cursor-default">
                                                    <span className="bg-purple-500/50 w-1.5 h-1.5 mt-1 mr-3 shrink-0 rounded-full group-hover:scale-150 transition-transform"></span>
                                                    <span>Zero Tolerance for Hallucinations</span>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

// UI Components for Cyber Overhaul
const Node = ({ icon: Icon, label, sub, color, pulse = false }: any) => (
    <div className="flex flex-col items-center group cursor-pointer relative z-10 text-center">
        <div className={`p-5 bg-slate-900/80 rounded-2xl border border-white/10 shadow-2xl transition-all group-hover:scale-110 group-hover:border-white/20 relative ${color}`}>
            <Icon className={`w-8 h-8 ${pulse ? 'animate-pulse' : ''}`} />
            {pulse && (
                <div className="absolute inset-0 rounded-2xl bg-current opacity-10 blur-xl animate-pulse"></div>
            )}
        </div>
        <div className="mt-4">
            <span className="block text-[10px] font-black text-white/40 uppercase tracking-[0.3em] font-mono">{label}</span>
            <span className={`block text-[11px] font-bold ${color} font-mono mt-1`}>//{sub}</span>
        </div>
    </div>
);

const PipelineConnector = ({ active, delay = '0s' }: any) => (
    <div className="h-0.5 flex-1 mx-4 bg-slate-800/50 relative overflow-hidden min-w-[40px] hidden md:block border-y border-white/5">
        {active && (
            <div
                className="absolute top-0 left-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-current to-transparent animate-shimmer opacity-50 text-cyan-500"
                style={{ animationDelay: delay }}
            ></div>
        )}
    </div>
);

const ParameterInput = ({ label, value, onChange, max, step = 1 }: any) => (
    <div className="space-y-3 group p-4 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
        <div className="flex justify-between items-center">
            <Label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">{label}</Label>
            <span className="text-[11px] font-mono font-black text-cyan-400 italic">[{value}]</span>
        </div>
        <Input
            type="number"
            step={step}
            max={max}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="bg-black/50 border-white/10 text-xs font-mono font-bold text-slate-300 focus:border-cyan-500/50"
        />
        <div className="h-1 bg-slate-900 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500/30" style={{ width: `${(value / max) * 100}%` }}></div>
        </div>
    </div>
);

export default AICommandCenter;
