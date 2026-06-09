import React from 'react';
import igoLogo from '@/assets/igo-logo.png';

export interface WorkOrderData {
    woNumber: number;
    date: string;
    projectName: string;
    phaseName?: string;
    vendorName: string;
    vendorContact: string;
    vendorGST?: string;
    workDescription: string;
    detailedScope: string;
    agreedAmount: number;
    advanceAmount: number;
    startDate: string;
    timelineDays: number;
    termsAndConditions?: string;
    vendorBankName?: string;
    vendorAccountNumber?: string;
    vendorIFSC?: string;
    vendorAccountHolder?: string;
}

const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export const WorkOrderTemplate: React.FC<{ data: WorkOrderData }> = ({ data }) => {
    const balanceAmount = data.agreedAmount - data.advanceAmount;
    const woId = `WO-${String(data.woNumber).padStart(4, '0')}`;
    const hashCode = Math.abs(
        `${data.woNumber}${data.vendorName}${data.agreedAmount}`.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0)
    ).toString(16).toUpperCase().padStart(8, '0');

    return (
        <div
            style={{
                width: '794px',
                minHeight: '1123px',
                padding: '0',
                fontFamily: "'Segoe UI', 'Inter', 'Helvetica Neue', Arial, sans-serif",
                color: '#1a1a2e',
                background: '#ffffff',
                position: 'relative',
                overflow: 'hidden',
                fontSize: '13px',
                lineHeight: '1.5',
                letterSpacing: '0.01em',
            }}
        >
            {/* ─── Geometric Watermark ─── */}
            <div
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%) rotate(-30deg)',
                    fontSize: '120px',
                    fontWeight: 900,
                    color: 'rgba(0,0,0,0.018)',
                    letterSpacing: '16px',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    userSelect: 'none',
                    zIndex: 0,
                }}
            >
                IGO GROUP
            </div>

            {/* ─── Subtle top accent bar ─── */}
            <div
                style={{
                    height: '4px',
                    background: 'linear-gradient(90deg, #0f172a 0%, #1e40af 40%, #3b82f6 70%, #0f172a 100%)',
                }}
            />

            {/* ─── Content Container ─── */}
            <div style={{ padding: '32px 48px 24px', position: 'relative', zIndex: 1 }}>

                {/* ═══════ HEADER ═══════ */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                    {/* Left: Logo & Company */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <img
                            src={igoLogo}
                            alt="IGO GROUP"
                            style={{ width: '56px', height: '56px', objectFit: 'contain' }}
                            crossOrigin="anonymous"
                        />
                        <div>
                            <div
                                style={{
                                    fontSize: '22px',
                                    fontWeight: 800,
                                    letterSpacing: '-0.02em',
                                    color: '#0f172a',
                                    lineHeight: 1.1,
                                }}
                            >
                                IGO GROUP
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '2px' }}>
                                India's Leading Farming Conglomerate
                            </div>
                        </div>
                    </div>

                    {/* Right: Document ID */}
                    <div style={{ textAlign: 'right' }}>
                        <div
                            style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                color: '#1e40af',
                                marginBottom: '4px',
                            }}
                        >
                            WORK ORDER
                        </div>
                        <div
                            style={{
                                fontSize: '20px',
                                fontWeight: 800,
                                fontVariantNumeric: 'tabular-nums',
                                color: '#0f172a',
                                letterSpacing: '-0.01em',
                            }}
                        >
                            {woId}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', fontVariantNumeric: 'tabular-nums', marginTop: '2px' }}>
                            Date: {data.date}
                        </div>
                    </div>
                </div>

                {/* ─── Thin divider ─── */}
                <div style={{ height: '1px', background: 'linear-gradient(90deg, #e2e8f0, #94a3b8, #e2e8f0)', marginBottom: '20px' }} />

                {/* ═══════ PROJECT & VENDOR INFO GRID ═══════ */}
                <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                    {/* Project Details */}
                    <div
                        style={{
                            flex: 1,
                            padding: '16px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            background: '#f8fafc',
                        }}
                    >
                        <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#1e40af', marginBottom: '10px' }}>
                            Project Details
                        </div>
                        <InfoRow label="Project" value={data.projectName} bold />
                        {data.phaseName && <InfoRow label="Phase" value={data.phaseName} />}
                        <InfoRow label="Start Date" value={data.startDate} />
                        <InfoRow label="Duration" value={`${data.timelineDays} days`} />
                    </div>

                    {/* Vendor Details */}
                    <div
                        style={{
                            flex: 1,
                            padding: '16px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            background: '#f8fafc',
                        }}
                    >
                        <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#1e40af', marginBottom: '10px' }}>
                            Vendor Details
                        </div>
                        <InfoRow label="Vendor" value={data.vendorName} bold />
                        <InfoRow label="Contact" value={data.vendorContact} />
                        {data.vendorGST && <InfoRow label="GSTIN" value={data.vendorGST} />}
                        {data.vendorAccountNumber && (
                            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0' }}>
                                <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '4px' }}>
                                    Settlement Details
                                </div>
                                <div style={{ fontSize: '11px', color: '#0f172a', lineHeight: '1.4' }}>
                                    <span style={{ fontWeight: 600 }}>Beneficiary:</span> {data.vendorAccountHolder || data.vendorName}<br />
                                    <span style={{ fontWeight: 600 }}>A/C No:</span> <span style={{ fontVariantNumeric: 'tabular-nums' }}>{data.vendorAccountNumber}</span><br />
                                    <span style={{ fontWeight: 600 }}>Bank:</span> {data.vendorBankName}<br />
                                    <span style={{ fontWeight: 600 }}>IFSC:</span> <span style={{ fontVariantNumeric: 'tabular-nums' }}>{data.vendorIFSC}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══════ SCOPE OF WORK ═══════ */}
                <SectionHeader title="Scope of Work" />
                <div
                    style={{
                        padding: '14px 16px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        background: '#fafbfc',
                        marginBottom: '20px',
                    }}
                >
                    <div style={{ fontWeight: 600, marginBottom: '6px', fontSize: '13px' }}>{data.workDescription}</div>
                    <div style={{ color: '#475569', fontSize: '12px', whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>
                        {data.detailedScope}
                    </div>
                </div>

                {/* ═══════ FINANCIAL SUMMARY ═══════ */}
                <SectionHeader title="Financial Summary" />
                <div style={{ marginBottom: '20px' }}>
                    <table
                        style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontVariantNumeric: 'tabular-nums',
                            fontSize: '13px',
                        }}
                    >
                        <thead>
                            <tr style={{ background: '#0f172a' }}>
                                <th style={{ ...thStyle, color: '#ffffff', borderTopLeftRadius: '6px' }}>Description</th>
                                <th style={{ ...thStyle, color: '#ffffff', textAlign: 'right', borderTopRightRadius: '6px' }}>Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={tdStyle}>Total Agreed Value</td>
                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, fontSize: '14px' }}>{fmt(data.agreedAmount)}</td>
                            </tr>
                            <tr style={{ background: '#f8fafc' }}>
                                <td style={tdStyle}>Advance Payment</td>
                                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(data.advanceAmount)}</td>
                            </tr>
                            <tr>
                                <td style={{ ...tdStyle, fontWeight: 600 }}>Balance Payable</td>
                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#1e40af', fontSize: '14px' }}>
                                    {fmt(balanceAmount)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* ═══════ TERMS & CONDITIONS ═══════ */}
                {data.termsAndConditions && (
                    <>
                        <SectionHeader title="Terms & Conditions" />
                        <div
                            style={{
                                padding: '14px 16px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                background: '#fafbfc',
                                marginBottom: '20px',
                                fontSize: '11px',
                                color: '#475569',
                                lineHeight: 1.7,
                                whiteSpace: 'pre-wrap',
                            }}
                        >
                            {data.termsAndConditions}
                        </div>
                    </>
                )}

                {/* ═══════ SIGNATURE BLOCK ═══════ */}
                <div style={{ display: 'flex', gap: '20px', marginTop: '32px', marginBottom: '32px' }}>
                    <SignatureBox label="Authorized Signatory" sublabel="For IGO GROUP" />
                    <SignatureBox label="Authorized Signatory" sublabel="For Vendor Representative" />
                </div>

                {/* ═══════ DIGITAL AUTHENTICATION SEAL ═══════ */}
                <div
                    style={{
                        marginTop: '16px',
                        padding: '12px 20px',
                        border: '1.5px dashed #cbd5e1',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#f8fafc',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* Mini geometric seal icon */}
                        <div
                            style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                border: '2px solid #1e40af',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                fontWeight: 900,
                                color: '#1e40af',
                                letterSpacing: '-0.02em',
                            }}
                        >
                            IGO
                        </div>
                        <div>
                            <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0f172a' }}>
                                Digital Authentication
                            </div>
                            <div style={{ fontSize: '9px', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                                Ref: {woId}-{hashCode} • Generated by IGO ERP v2.0
                            </div>
                        </div>
                    </div>
                    <div style={{ fontSize: '9px', color: '#94a3b8', textAlign: 'right' }}>
                        This document is system-generated.<br />
                        Valid only with authorized signatures.
                    </div>
                </div>
            </div>

            {/* ─── Bottom accent bar ─── */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: 'linear-gradient(90deg, #0f172a 0%, #1e40af 40%, #3b82f6 70%, #0f172a 100%)',
                }}
            />
        </div>
    );
};

/* ─── Sub-components ─── */

const InfoRow: React.FC<{ label: string; value: string; bold?: boolean }> = ({ label, value, bold }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '12px' }}>
        <span style={{ color: '#64748b' }}>{label}</span>
        <span style={{ fontWeight: bold ? 700 : 500, color: '#0f172a', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
);

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
    <div
        style={{
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#1e40af',
            marginBottom: '8px',
            paddingBottom: '4px',
            borderBottom: '1.5px solid #1e40af',
            display: 'inline-block',
        }}
    >
        {title}
    </div>
);

const SignatureBox: React.FC<{ label: string; sublabel: string }> = ({ label, sublabel }) => (
    <div style={{ flex: 1, textAlign: 'center' }}>
        <div
            style={{
                height: '72px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                background: '#fafbfc',
                marginBottom: '8px',
            }}
        />
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>{label}</div>
        <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>{sublabel}</div>
    </div>
);

/* ─── Table cell styles ─── */

const thStyle: React.CSSProperties = {
    padding: '10px 16px',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    textAlign: 'left',
};

const tdStyle: React.CSSProperties = {
    padding: '10px 16px',
    borderBottom: '1px solid #e2e8f0',
};
