import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';

export default function SessionDetailsModal({ session, onClose }) {
    if (!session) return null;

    // Helper to generate links (same logic as used in dashboard)
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const staticBaseUrl = isLocal ? `${window.location.protocol}//${window.location.hostname}:8000` : window.location.origin;
    const riderLink = `${staticBaseUrl}/rider.html?session=${session.id}`;
    const customerLink = `${staticBaseUrl}/track.html?session=${session.id}`;

    const copyToClipboard = async (text, e) => {
        try {
            await navigator.clipboard.writeText(text);
            const originalText = e.target.innerText;
            e.target.innerText = 'Copied!';
            setTimeout(() => {
                e.target.innerText = originalText;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy class:', err);
        }
    };

    const sendToWhatsApp = (type) => {
        const text = type === 'rider'
            ? `New delivery for you: ${session.refId}. Pickup: ${session.pickup?.address || session.pickupAddress}. Dropoff: ${session.dropoff?.address || session.dropoffAddress}. Track/Update here: ${riderLink}`
            : `Track your delivery (${session.refId}) here: ${customerLink}. Stop Code: ${session.stopCode}`;

        const phone = type === 'rider' ? session.riderPhone : ''; // We don't have customer phone stored usually
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    // Calculate duration
    let durationDisplay = null;
    if (session.startedAt && session.completedAt) {
        const diff = session.completedAt - session.startedAt;
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        durationDisplay = `${minutes}m ${seconds}s`;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/50 sticky top-0 backdrop-blur-md">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            📦 Order Details
                            <span className="text-slate-400 text-base font-normal">#{session.refId}</span>
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Key Info Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-700">
                            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Status</div>
                            <div className="flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full ${session.status === 'active' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' :
                                    session.status === 'completed' ? 'bg-blue-500' : 'bg-yellow-500'
                                    }`}></span>
                                <span className="font-semibold text-white capitalize">{session.status}</span>
                            </div>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-700">
                            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Stop Code</div>
                            <div className="font-mono text-2xl font-bold text-green-400 tracking-wider">
                                {session.stopCode}
                            </div>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-700 col-span-2 md:col-span-1">
                            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Rider PIN</div>
                            <div className="font-mono text-2xl font-bold text-blue-400 tracking-wider">
                                {session.riderPin || 'N/A'}
                            </div>
                        </div>
                        {durationDisplay && (
                            <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-700 col-span-2 md:col-span-1">
                                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Duration</div>
                                <div className="font-mono text-2xl font-bold text-yellow-400 tracking-wider">
                                    {durationDisplay}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Locations */}
                    <div className="space-y-4">
                        <div className="flex gap-3">
                            <div className="flex flex-col items-center mt-1">
                                <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center border border-orange-500/30">
                                    📦
                                </div>
                                <div className="w-0.5 h-full bg-slate-700 my-1"></div>
                            </div>
                            <div className="flex-1 pb-4">
                                <h3 className="text-sm font-medium text-slate-400 mb-1">Pickup Location</h3>
                                <p className="text-white text-lg leading-snug">
                                    {session.pickup?.address || session.pickupAddress || 'No address provided'}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <div className="flex flex-col items-center mt-1">
                                <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center border border-green-500/30">
                                    📍
                                </div>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-sm font-medium text-slate-400 mb-1">Dropoff Location</h3>
                                <p className="text-white text-lg leading-snug">
                                    {session.dropoff?.address || session.dropoffAddress || 'No address provided'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-slate-700/50 w-full"></div>

                    {/* Rider Info */}
                    <div className="bg-slate-700/30 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-xl">
                                🛵
                            </div>
                            <div>
                                <div className="font-medium text-white">{session.riderName}</div>
                                <div className="text-sm text-slate-400">{session.riderPhone || 'No phone'}</div>
                            </div>
                        </div>
                        {session.riderPhone && (
                            <a
                                href={`tel:${session.riderPhone}`}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm font-medium"
                            >
                                Call Rider
                            </a>
                        )}
                    </div>

                    {/* Customer Info */}
                    <div className="bg-slate-700/30 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-xl">
                                👤
                            </div>
                            <div>
                                <div className="font-medium text-white capitalize">{session.customerName || 'Guest Customer'}</div>
                                <div className="text-sm text-slate-400">{session.customerPhone || 'No phone'}</div>
                            </div>
                        </div>
                        {session.customerPhone && (
                            <a
                                href={`tel:${session.customerPhone}`}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm font-medium"
                            >
                                Call Customer
                            </a>
                        )}
                    </div>

                    {/* Links Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Rider Link */}
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-sm font-medium text-slate-400">📍 Rider Tracking Link</div>
                                <button
                                    onClick={() => sendToWhatsApp('rider')}
                                    className="text-green-400 hover:text-green-300 text-xs font-medium flex items-center gap-1"
                                >
                                    <span>WhatsApp</span> ↗
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={riderLink}
                                    className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-xs font-mono text-slate-300 focus:outline-none"
                                />
                                <button
                                    onClick={(e) => copyToClipboard(riderLink, e)}
                                    className="px-3 py-2 bg-slate-600 hover:bg-slate-500 rounded text-xs transition-colors"
                                >
                                    Copy
                                </button>
                            </div>
                        </div>

                        {/* Customer Link */}
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-sm font-medium text-slate-400">👀 Customer View Link</div>
                                <button
                                    onClick={() => sendToWhatsApp('customer')}
                                    className="text-blue-400 hover:text-blue-300 text-xs font-medium flex items-center gap-1"
                                >
                                    <span>WhatsApp</span> ↗
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={customerLink}
                                    className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-xs font-mono text-slate-300 focus:outline-none"
                                />
                                <button
                                    onClick={(e) => copyToClipboard(customerLink, e)}
                                    className="px-3 py-2 bg-slate-600 hover:bg-slate-500 rounded text-xs transition-colors"
                                >
                                    Copy
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* QR Code */}
                    <div className="flex flex-col items-center justify-center pt-2 pb-2">
                        <div className="bg-white p-3 rounded-xl mb-3 shadow-lg" id="qr-code-container">
                            <QRCodeCanvas
                                value={customerLink}
                                size={140}
                                fgColor="#16a34a"
                                level="M"
                                includeMargin={true}
                                id="session-qr-code"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    const canvas = document.getElementById('session-qr-code');
                                    if (canvas) {
                                        const pngUrl = canvas.toDataURL('image/png');
                                        const downloadLink = document.createElement('a');
                                        downloadLink.href = pngUrl;
                                        downloadLink.download = `ridewatch-qr-${session.refId}.png`;
                                        document.body.appendChild(downloadLink);
                                        downloadLink.click();
                                        document.body.removeChild(downloadLink);
                                    }
                                }}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-2"
                            >
                                ⬇ Download
                            </button>
                            {navigator.share && (
                                <button
                                    onClick={async () => {
                                        const canvas = document.getElementById('session-qr-code');
                                        if (canvas) {
                                            canvas.toBlob(async (blob) => {
                                                const file = new File([blob], `ridewatch-qr-${session.refId}.png`, { type: 'image/png' });
                                                try {
                                                    await navigator.share({
                                                        title: `Track Order #${session.refId}`,
                                                        text: `Scan this QR code to track your delivery from RideWatch.`,
                                                        files: [file]
                                                    });
                                                } catch (err) {
                                                    console.log('Share failed', err);
                                                }
                                            });
                                        }
                                    }}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-2"
                                >
                                    📤 Share
                                </button>
                            )}
                        </div>
                        <div className="text-xs text-slate-500 mt-2">Scan to track delivery</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
