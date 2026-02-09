import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { QRCodeCanvas } from 'qrcode.react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, dbHelpers, isDemoMode } from '../services/firebase';
import { ref, push, set, onValue, off } from 'firebase/database';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom rider icon
const createRiderIcon = (status) => {
    const color = status === 'active' ? '#22c55e' : status === 'lost' ? '#ef4444' : '#f59e0b';
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="background: ${color}; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 16px;">🛵</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
    });
};

// Map component that updates view
function MapUpdater({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.setView(center, 14);
        }
    }, [center, map]);
    return null;
}

// LocalStorage helpers for guest mode
const GUEST_SESSIONS_KEY = 'ridetrack_guest_sessions';

function getGuestSessions() {
    try {
        const data = localStorage.getItem(GUEST_SESSIONS_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

function saveGuestSession(session) {
    const sessions = getGuestSessions();
    sessions.unshift(session);
    localStorage.setItem(GUEST_SESSIONS_KEY, JSON.stringify(sessions.slice(0, 50))); // Keep last 50
}

function clearGuestSessions() {
    localStorage.removeItem(GUEST_SESSIONS_KEY);
}

export default function VendorDashboard() {
    const { user, vendorProfile } = useAuth();
    const navigate = useNavigate();
    const [sessions, setSessions] = useState([]);
    const [generatedLinks, setGeneratedLinks] = useState(null);
    const [mapCenter, setMapCenter] = useState([6.5244, 3.3792]); // Lagos default
    const [loading, setLoading] = useState(false);
    const [showSignupBanner, setShowSignupBanner] = useState(true);

    const isGuest = !user;

    // Form state
    const [formData, setFormData] = useState({
        refId: '',
        riderName: '',
        riderPhone: ''
    });

    // Demo data
    const demoSessions = [
        { id: 'demo_001', refId: 'ORD-5521', riderName: 'Emeka', stopCode: '4829', status: 'active', lastPing: '5s ago', battery: 72, lat: 6.5244, lng: 3.3792 },
        { id: 'demo_002', refId: 'ORD-5520', riderName: 'Chidi', stopCode: '7153', status: 'active', lastPing: '12s ago', battery: 45, lat: 6.5355, lng: 3.3481 }
    ];

    useEffect(() => {
        if (isDemoMode()) {
            setSessions(demoSessions);
            return;
        }

        // Guest mode: load from localStorage
        if (isGuest) {
            setSessions(getGuestSessions());
            return;
        }

        // Authenticated mode: load from Firebase
        const sessionsRef = ref(db, 'sessions');
        const unsubscribe = onValue(sessionsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const vendorSessions = Object.entries(data)
                    .filter(([_, session]) => session.vendorId === user.uid || !session.vendorId)
                    .map(([id, session]) => ({ id, ...session }))
                    .filter(s => s.status !== 'completed')
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                setSessions(vendorSessions);
            }
        });

        return () => off(sessionsRef);
    }, [user, isGuest]);

    const generateLink = async (e) => {
        e.preventDefault();
        setLoading(true);

        const sessionId = 'sess_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
        const stopCode = Math.floor(1000 + Math.random() * 9000).toString();
        const baseUrl = window.location.origin;

        const newSession = {
            id: sessionId,
            refId: formData.refId,
            riderName: formData.riderName,
            riderPhone: formData.riderPhone,
            stopCode,
            status: 'pending',
            vendorId: user?.uid || 'guest',
            createdAt: Date.now(),
            lat: null,
            lng: null,
            lastPing: 'Waiting...'
        };

        // Save to LocalStorage (for guest list persistence)
        if (isGuest) {
            saveGuestSession(newSession);
        }

        // Save to Firebase (for Rider/Customer access)
        if (db) {
            try {
                await set(ref(db, `sessions/${sessionId}`), newSession);
            } catch (error) {
                console.error('Failed to save session to Firebase:', error);
                // If firebase fails for guest, we still have local storage
                if (!isGuest && !isDemoMode()) alert('Failed to create session. Please try again.');
            }
        }

        // Add to local state
        setSessions(prev => [newSession, ...prev]);

        // Generate links
        setGeneratedLinks({
            sessionId,
            stopCode,
            riderLink: `${baseUrl}/rider.html?session=${sessionId}`,
            customerLink: `${baseUrl}/track.html?session=${sessionId}`
        });

        // Reset form
        setFormData({ refId: '', riderName: '', riderPhone: '' });
        setLoading(false);
    };

    const copyToClipboard = async (text, e) => {
        await navigator.clipboard.writeText(text);
        if (e?.target) {
            const original = e.target.innerText;
            e.target.innerText = '✓ Copied!';
            setTimeout(() => { e.target.innerText = original; }, 1500);
        }
    };

    const sendToWhatsApp = (type) => {
        if (!generatedLinks) return;
        let message;
        if (type === 'rider') {
            message = `🛵 RideWatch: Start tracking for order. Open: ${generatedLinks.riderLink}`;
        } else {
            message = `📍 Track your order: ${generatedLinks.customerLink}\n\n🔐 Stop Code: ${generatedLinks.stopCode}\nGive this code to the rider when they arrive.`;
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    };

    const focusOnMap = (session) => {
        if (session.lat && session.lng) {
            setMapCenter([session.lat, session.lng]);
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            active: 'bg-green-500/20 text-green-400 border-green-500/30',
            pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
            lost: 'bg-red-500/20 text-red-400 border-red-500/30',
            completed: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
        };
        return styles[status] || styles.pending;
    };

    const activeSessions = sessions.filter(s => s.lat && s.lng);

    return (
        <div className="min-h-screen bg-slate-900 text-white">
            {/* Guest Header */}
            <header className="bg-slate-800 border-b border-slate-700">
                <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
                    <h1 className="text-xl font-bold">
                        <span className="text-green-400">Ride</span>Track
                        <span className="text-xs ml-2 text-slate-400">
                            {isGuest ? 'Free Tool' : 'Vendor Portal'}
                        </span>
                    </h1>
                    <div className="flex items-center gap-3">
                        {isGuest ? (
                            <>
                                <Link
                                    to="/vendor/login"
                                    className="px-4 py-2 text-sm text-slate-300 hover:text-white transition"
                                >
                                    Sign In
                                </Link>
                                <Link
                                    to="/vendor/signup"
                                    className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                                >
                                    Create Account
                                </Link>
                            </>
                        ) : (
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-slate-400">{user?.email}</span>
                                <Link
                                    to="/vendor"
                                    className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition"
                                >
                                    Dashboard
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div className="max-w-6xl mx-auto p-6 space-y-6">
                {/* Guest Signup Banner */}
                {isGuest && showSignupBanner && (
                    <div className="bg-gradient-to-r from-green-900/50 to-slate-800 border border-green-600/30 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">💡</span>
                            <div>
                                <p className="font-medium text-green-400">Create an account to save your data</p>
                                <p className="text-sm text-slate-400">Your tracking links are stored locally. Sign up to sync across devices and access history.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link
                                to="/vendor/signup"
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
                            >
                                Sign Up Free
                            </Link>
                            <button
                                onClick={() => setShowSignupBanner(false)}
                                className="p-2 text-slate-400 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Vendor Command Center</h1>
                        <p className="text-slate-400">Generate tracking links and monitor deliveries</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-medium border border-green-500/30">
                            {sessions.filter(s => s.status === 'active').length} Active
                        </span>
                        {isGuest && (
                            <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-sm font-medium border border-yellow-500/30">
                                Guest Mode
                            </span>
                        )}
                    </div>
                </div>

                {/* Link Generator */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50">
                        <h2 className="font-semibold flex items-center gap-2">
                            <span>🔗</span> Generate Tracking Link
                        </h2>
                    </div>
                    <div className="p-6">
                        <form onSubmit={generateLink} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Reference / Order ID *</label>
                                <input
                                    type="text"
                                    value={formData.refId}
                                    onChange={(e) => setFormData({ ...formData, refId: e.target.value })}
                                    required
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                                    placeholder="e.g. ORD-1234"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Rider Name *</label>
                                <input
                                    type="text"
                                    value={formData.riderName}
                                    onChange={(e) => setFormData({ ...formData, riderName: e.target.value })}
                                    required
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                                    placeholder="e.g. Chidi"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Rider WhatsApp (Optional)</label>
                                <input
                                    type="tel"
                                    value={formData.riderPhone}
                                    onChange={(e) => setFormData({ ...formData, riderPhone: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                                    placeholder="e.g. 08012345678"
                                />
                            </div>
                            <div className="md:col-span-3">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
                                >
                                    {loading ? 'Generating...' : 'Generate Links'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Generated Links Panel */}
                    {generatedLinks && (
                        <div className="p-6 bg-green-900/20 border-t border-green-700/30 space-y-4">
                            {/* Stop Code */}
                            <div className="bg-slate-800 border-2 border-dashed border-green-500/50 rounded-lg p-6 text-center">
                                <div className="text-sm text-slate-400 mb-1">🔐 Stop Code (Give to Customer)</div>
                                <div className="text-5xl font-mono font-bold text-green-400 tracking-[0.3em]">
                                    {generatedLinks.stopCode}
                                </div>
                                <div className="text-xs text-slate-500 mt-2">Rider needs this code to complete delivery</div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Rider Link */}
                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                                    <div className="text-sm font-medium text-slate-400 mb-2">📍 Rider Tracking Link</div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            readOnly
                                            value={generatedLinks.riderLink}
                                            className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm font-mono text-slate-300"
                                        />
                                        <button
                                            onClick={(e) => copyToClipboard(generatedLinks.riderLink, e)}
                                            className="px-3 py-2 bg-slate-600 hover:bg-slate-500 rounded text-sm transition"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => sendToWhatsApp('rider')}
                                        className="mt-3 w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition flex items-center justify-center gap-2"
                                    >
                                        <span>📱</span> Send to Rider via WhatsApp
                                    </button>
                                </div>

                                {/* Customer Link */}
                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                                    <div className="text-sm font-medium text-slate-400 mb-2">👀 Customer View Link</div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            readOnly
                                            value={generatedLinks.customerLink}
                                            className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm font-mono text-slate-300"
                                        />
                                        <button
                                            onClick={(e) => copyToClipboard(generatedLinks.customerLink, e)}
                                            className="px-3 py-2 bg-slate-600 hover:bg-slate-500 rounded text-sm transition"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => sendToWhatsApp('customer')}
                                        className="mt-3 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition flex items-center justify-center gap-2"
                                    >
                                        <span>📱</span> Send to Customer via WhatsApp
                                    </button>
                                </div>
                            </div>

                            {/* QR Code */}
                            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col items-center">
                                <div className="text-sm font-medium text-slate-400 mb-3">📲 Customer QR Code</div>
                                <div className="bg-white p-3 rounded-lg">
                                    <QRCodeCanvas
                                        value={generatedLinks.customerLink}
                                        size={150}
                                        fgColor="#16a34a"
                                        level="M"
                                    />
                                </div>
                                <div className="text-xs text-slate-500 mt-2">Scan to open tracking page</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Live Map */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
                        <h2 className="font-semibold flex items-center gap-2">
                            <span>🗺️</span> Live Map
                        </h2>
                        <span className="text-xs text-slate-500">OpenStreetMap</span>
                    </div>
                    <div className="h-[400px]">
                        <MapContainer
                            center={mapCenter}
                            zoom={13}
                            style={{ height: '100%', width: '100%' }}
                            className="z-0"
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <MapUpdater center={mapCenter} />
                            {activeSessions.map((session) => (
                                <Marker
                                    key={session.id}
                                    position={[session.lat, session.lng]}
                                    icon={createRiderIcon(session.status)}
                                >
                                    <Popup>
                                        <div className="text-slate-800">
                                            <strong>{session.riderName}</strong><br />
                                            {session.refId}<br />
                                            Code: {session.stopCode}
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    </div>
                </div>

                {/* Active Sessions Table */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50">
                        <h2 className="font-semibold flex items-center gap-2">
                            <span>📋</span> {isGuest ? 'Recent Links' : 'Active Deliveries'}
                            {isGuest && <span className="text-xs text-slate-500">(stored locally)</span>}
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-700/50 text-slate-400 uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-3 text-left">Order</th>
                                    <th className="px-6 py-3 text-left">Rider</th>
                                    <th className="px-6 py-3 text-left">Stop Code</th>
                                    <th className="px-6 py-3 text-left">Status</th>
                                    <th className="px-6 py-3 text-left">Last Ping</th>
                                    <th className="px-6 py-3 text-left">Battery</th>
                                    <th className="px-6 py-3 text-left">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {sessions.map((session) => (
                                    <tr key={session.id} className="hover:bg-slate-700/30 transition">
                                        <td className="px-6 py-4 font-medium">{session.refId}</td>
                                        <td className="px-6 py-4">{session.riderName}</td>
                                        <td className="px-6 py-4 font-mono font-bold text-green-400">{session.stopCode}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(session.status)}`}>
                                                {session.status?.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-400">{session.lastPing || '—'}</td>
                                        <td className="px-6 py-4">
                                            <span className={session.battery > 30 ? 'text-green-400' : session.battery > 15 ? 'text-yellow-400' : 'text-red-400'}>
                                                {session.battery ? `${session.battery}%` : '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        const baseUrl = window.location.origin;
                                                        setGeneratedLinks({
                                                            sessionId: session.id,
                                                            stopCode: session.stopCode,
                                                            riderLink: `${baseUrl}/rider.html?session=${session.id}`,
                                                            customerLink: `${baseUrl}/track.html?session=${session.id}`
                                                        });
                                                        // Scroll to top to show links
                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }}
                                                    className="text-green-400 hover:text-green-300 font-medium text-xs"
                                                >
                                                    View Links
                                                </button>
                                                {session.lat && session.lng && (
                                                    <button
                                                        onClick={() => focusOnMap(session)}
                                                        className="text-blue-400 hover:text-blue-300 font-medium text-xs"
                                                    >
                                                        Map
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {sessions.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                                            No active deliveries. Generate a link to get started.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center py-4">
                    <p className="text-xs text-slate-500">
                        A product of{' '}
                        <a href="https://theproductdojo.com" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300">
                            The Product Dojo
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
