import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, dbHelpers, isDemoMode } from '../services/firebase';
import { ref, onValue, off, update } from 'firebase/database';
import SessionDetailsModal from '../components/SessionDetailsModal';
import VendorSettingsModal from '../components/VendorSettingsModal';
import SubscriptionModal from '../components/SubscriptionModal';
import { useVendorUsage } from '../hooks/useVendorUsage';
import 'leaflet/dist/leaflet.css';
import DashboardMap from '../components/DashboardMap';
import CreateDeliveryForm from '../components/CreateDeliveryForm';
import AddressAutocomplete from '../components/AddressAutocomplete';
import { getGuestSessions, clearGuestSessions } from '../utils/guestStorage';

// Component to handle map bounds and focus - MOVED TO DashboardMap.jsx
// Custom marker icons - MOVED TO DashboardMap.jsx

// Component to handle map bounds and focus


// LocalStorage helpers for guest mode - MOVED TO utils/guestStorage.js

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-800 p-6 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-700 transform transition-all scale-100">
                <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                <p className="text-slate-300 mb-6">{message}</p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 font-medium hover:bg-slate-600 transition">Cancel</button>
                    <button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition shadow-lg shadow-red-900/20">Confirm</button>
                </div>
            </div>
        </div>
    );
};

const LimitReachedModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-800 p-6 rounded-2xl shadow-2xl max-w-md w-full border border-slate-700 transform transition-all scale-100 text-center">
                <div className="w-16 h-16 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                    🔒
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Usage Limit Reached</h3>
                <p className="text-slate-300 mb-6">
                    You've reached the limits of the Free/Guest plan. Upgrade to Pro for unlimited deliveries and priority support.
                </p>
                <div className="bg-slate-700/50 rounded-lg p-4 mb-6 text-left space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Max Active Deliveries</span>
                        <span className="text-white font-medium">5</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Max Monthly Deliveries</span>
                        <span className="text-white font-medium">30</span>
                    </div>
                </div>
                <button
                    onClick={() => {
                        onClose();
                        window.dispatchEvent(new CustomEvent('open-subscription-modal'));
                    }}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-green-600 to-green-500 text-white font-bold hover:shadow-lg hover:shadow-green-900/20 transition transform hover:-translate-y-0.5"
                >
                    Upgrade to Pro
                </button>
                <button
                    onClick={onClose}
                    className="mt-3 text-slate-400 text-sm hover:text-white transition"
                >
                    Maybe Later
                </button>
            </div>
        </div>
    );
};

export default function VendorDashboard() {
    const { user, vendorProfile, signOut } = useAuth();
    const navigate = useNavigate();
    const [sessions, setSessions] = useState([]);
    // generatedLinks removed (handled in CreateDeliveryForm)
    const [modalOpen, setModalOpen] = useState(false); // For Session Details
    const [selectedSession, setSelectedSession] = useState(null);
    const [focusedSession, setFocusedSession] = useState(null); // For map focus
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, sessionId: null });
    const [limitModalOpen, setLimitModalOpen] = useState(false);
    const [settingsModalOpen, setSettingsModalOpen] = useState(false);
    const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);

    // Usage Tracking
    const usage = useVendorUsage(sessions, vendorProfile?.planType === 'pro');
    const [loading, setLoading] = useState(false);
    const [showSignupBanner, setShowSignupBanner] = useState(true);
    // NEW: History Tab State
    const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history' | 'riders' | 'customers'
    const [riderModal, setRiderModal] = useState({ isOpen: false, data: null });
    const [customerModal, setCustomerModal] = useState({ isOpen: false, data: null });
    const [customerFormAddress, setCustomerFormAddress] = useState('');
    const [geocodingCustomerAddress, setGeocodingCustomerAddress] = useState(false);

    const handleSaveRider = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            name: formData.get('name'),
            phone: formData.get('phone'),
            vendorId: user.uid,
            status: 'active'
        };

        if (riderModal.data) {
            await dbHelpers.updateRider(riderModal.data.id, data);
        } else {
            await dbHelpers.createRider(data);
        }
        setRiderModal({ isOpen: false, data: null });
        showToast('Rider saved successfully');
    };

    const handleSaveCustomer = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            name: formData.get('name'),
            phone: formData.get('phone'),
            defaultAddress: customerFormAddress,
            vendorId: user.uid
        };

        if (customerModal.data) {
            await dbHelpers.updateCustomer(customerModal.data.id, data);
        } else {
            await dbHelpers.createCustomer(data);
        }
        showToast('Customer saved successfully');
        setCustomerModal({ isOpen: false, data: null });
    };

    // Geocode current location for the customer address field
    const useCurrentLocation = (field) => {
        if (!navigator.geolocation) {
            alert('Geolocation not supported');
            return;
        }
        if (field === 'customer') {
            setGeocodingCustomerAddress(true);
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    try {
                        const response = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                            { headers: { 'User-Agent': 'RideWatch/1.0' } }
                        );
                        const data = await response.json();
                        setCustomerFormAddress(data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
                    } catch {
                        setCustomerFormAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
                    }
                    setGeocodingCustomerAddress(false);
                },
                (error) => {
                    alert('Could not get location: ' + error.message);
                    setGeocodingCustomerAddress(false);
                }
            );
        }
    };

    // Helper: compute rider average rating from sessions
    const getRiderRating = (rider) => {
        const riderSessions = sessions.filter(s => {
            if (!s.rating) return false;
            if (s.riderId) return s.riderId === rider.id;
            return s.riderName === rider.name;
        });
        const totalRating = riderSessions.reduce((sum, s) => sum + parseInt(s.rating || 0), 0);
        const avgRating = riderSessions.length > 0 ? (totalRating / riderSessions.length).toFixed(1) : null;
        return { avgRating, count: riderSessions.length };
    };

    const isGuest = !user;

    // Demo data
    const demoSessions = [
        { id: 'demo_001', refId: 'ORD-5521', riderName: 'Emeka', stopCode: '4829', status: 'active', lastPing: '5s ago', battery: 72, lat: 6.5244, lng: 3.3792 },
        { id: 'demo_002', refId: 'ORD-5520', riderName: 'Chidi', stopCode: '7153', status: 'active', lastPing: '12s ago', battery: 45, lat: 6.5355, lng: 3.3481 }
    ];

    // Guest session refresh trigger
    const [guestRefresh, setGuestRefresh] = useState(0);

    useEffect(() => {
        if (isDemoMode()) {
            setSessions(demoSessions);
            return;
        }

        // Authenticated mode OR Guest mode: load from Firebase
        if (!isGuest) {
            // Logged in vendor: use secure query
            const unsubscribe = dbHelpers.getSessions(setSessions, user.uid);
            return () => unsubscribe();
        } else {
            // Guest mode: load specific sessions from local storage IDs
            const localSessions = getGuestSessions();
            if (localSessions.length === 0) {
                setSessions([]);
                return;
            }

            // For now, guest mode still needs to read specific paths or we need a guest-specific query
            // Since we locked down read access, guests can't read 'sessions' root.
            // They need to subscribe to each session ID individually.

            const listeners = [];
            const newSessions = {};

            localSessions.forEach(ls => {
                const sessionRef = ref(db, `sessions/${ls.id}`);
                const unsub = onValue(sessionRef, (snapshot) => {
                    if (snapshot.exists()) {
                        newSessions[ls.id] = { id: ls.id, ...snapshot.val() };
                        setSessions(Object.values(newSessions).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
                    }
                });
                listeners.push(() => off(sessionRef));
            });

            return () => listeners.forEach(unsub => unsub());
        }
    }, [user, isGuest, guestRefresh]);

    // CRM Data Loading
    const [myRiders, setMyRiders] = useState([]);
    const [myCustomers, setMyCustomers] = useState([]);

    useEffect(() => {
        if (!user || isGuest) return; // Only for logged-in vendors

        const unsubRiders = dbHelpers.getVendorRiders(user.uid, setMyRiders);
        const unsubCustomers = dbHelpers.getVendorCustomers(user.uid, setMyCustomers);

        return () => {
            unsubRiders();
            unsubCustomers();
        };
    }, [user, isGuest]);

    useEffect(() => {
        const handleOpenSub = () => setSubscriptionModalOpen(true);
        window.addEventListener('open-subscription-modal', handleOpenSub);
        return () => window.removeEventListener('open-subscription-modal', handleOpenSub);
    }, []);



    const focusOnMap = (session) => {
        setFocusedSession({ ...session, _ts: Date.now() });
        document.querySelector('.leaflet-container')?.scrollIntoView({ behavior: 'smooth' });
    };

    const getStatusBadge = (status) => {
        const styles = {
            active: 'bg-green-500/20 text-green-400 border-green-500/30',
            pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
            en_route_to_pickup: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            picked_up: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            lost: 'bg-red-500/20 text-red-400 border-red-500/30',
            cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
            completed: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
        };
        return styles[status] || styles.pending;
    };

    const activeSessions = sessions.filter(s => s.status !== 'completed' && ((s.lat && s.lng) || s.pickup || s.dropoff));

    // Filter states
    const [riderFilter, setRiderFilter] = useState(null); // riderId or null

    // Split sessions for Table
    const activeTableSessions = sessions.filter(s => s.status !== 'completed' && s.status !== 'cancelled');
    const historyTableSessions = sessions.filter(s => {
        const isHistory = s.status === 'completed' || s.status === 'cancelled';
        if (!isHistory) return false;
        if (riderFilter) {
            // Strict ID match or fallback name match
            if (s.riderId) return s.riderId === riderFilter;
            // Find rider name from ID for fallback
            const rider = myRiders.find(r => r.id === riderFilter);
            return rider && s.riderName === rider.name;
        }
        return true;
    });

    // CSV/Excel Export
    const exportHistory = () => {
        const headers = ['Date', 'Ref ID', 'Rider', 'Status', 'Pickup', 'Dropoff'];
        const rows = historyTableSessions.map(s => [
            new Date(s.createdAt).toLocaleDateString(),
            s.refId,
            s.riderName,
            s.status,
            s.pickup?.address?.replace(/,/g, ' ') || '',
            s.dropoff?.address?.replace(/,/g, ' ') || ''
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `ridewatch_history_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Toast Notification State
    const [toast, setToast] = useState(null);
    const prevSessionsRef = useRef([]);

    useEffect(() => {
        // Check for status changes to 'completed'
        sessions.forEach(session => {
            const prevSession = prevSessionsRef.current.find(s => s.id === session.id);
            if (prevSession && prevSession.status !== 'completed' && session.status === 'completed') {
                showToast(`🎉 Delivery Completed: ${session.refId} (${session.riderName})`);
                playNotificationSound();
            }
        });
        prevSessionsRef.current = sessions;
    }, [sessions]);

    const showToast = (message) => {
        setToast(message);
        setTimeout(() => setToast(null), 5000);
    };

    const playNotificationSound = () => {
        try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(e => console.log('Audio play failed', e));
        } catch (e) {
            console.log('Audio error', e);
        }
    };

    const requestCancel = (sessionId) => {
        setConfirmModal({ isOpen: true, sessionId });
    };

    const confirmCancel = async () => {
        const sessionId = confirmModal.sessionId;
        if (!sessionId) return;

        try {
            await update(ref(db, `sessions/${sessionId}`), { status: 'cancelled' });
            showToast('Order cancelled successfully.');
        } catch (e) {
            console.error('Error cancelling:', e);
            showToast('Failed to cancel order.');
        }
        setConfirmModal({ isOpen: false, sessionId: null });
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white relative">
            {/* Toast Notification */}
            {toast && (
                <div className="fixed top-4 right-4 z-50 bg-green-600/90 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-slide-in border-l-4 border-white backdrop-blur-sm">
                    <div className="text-2xl">✅</div>
                    <div>
                        <h4 className="font-bold">Mission Accomplished</h4>
                        <p className="text-sm opacity-90">{toast}</p>
                    </div>
                    <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100">✕</button>
                </div>
            )}

            {/* Limit Reached Modal */}
            <LimitReachedModal
                isOpen={limitModalOpen}
                onClose={() => setLimitModalOpen(false)}
            />

            {/* Settings Modal */}
            <VendorSettingsModal
                isOpen={settingsModalOpen}
                onClose={() => setSettingsModalOpen(false)}
                vendor={vendorProfile}
                user={user}
                onUpdate={(updatedData) => {
                    showToast('Profile updated successfully');
                    // Note: Real-time update via Firebase listener will handle re-render of profile data
                }}
            />

            {/* Subscription Modal */}
            <SubscriptionModal
                isOpen={subscriptionModalOpen}
                onClose={() => setSubscriptionModalOpen(false)}
                user={user}
                onSuccess={() => {
                    showToast('🎉 Upgrade Successful! You are now a PRO vendor.');
                    playNotificationSound();
                }}
            />

            {/* Guest Header */}
            <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-40">
                <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
                    <h1 className="text-lg md:text-xl font-bold">
                        <span className="text-green-400">Ride</span>Watch
                        <span className="hidden sm:inline-block text-xs ml-2 text-slate-400">
                            {isGuest ? 'Free Tool' : 'Vendor Portal'}
                        </span>
                    </h1>
                    <div className="flex items-center gap-2 md:gap-3">
                        {isGuest ? (
                            <div className="flex items-center gap-2">
                                <Link
                                    to="/vendor/login"
                                    className="px-3 py-1.5 text-xs md:text-sm text-slate-300 hover:text-white transition"
                                >
                                    Login
                                </Link>
                                <Link
                                    to="/vendor/signup"
                                    className="px-3 py-1.5 text-xs md:text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-bold"
                                >
                                    Sign Up
                                </Link>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 md:gap-3">
                                <div className="text-right hidden sm:block">
                                    <div className="font-bold text-white text-sm">
                                        {vendorProfile?.businessName || 'Vendor'}
                                        {vendorProfile?.planType === 'pro' && (
                                            <span className="ml-2 bg-gradient-to-r from-yellow-500 to-amber-600 text-white text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">PRO</span>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate max-w-[120px]">{user?.email}</div>
                                </div>
                                <button
                                    onClick={() => setSettingsModalOpen(true)}
                                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition"
                                    title="Settings"
                                >
                                    ⚙️
                                </button>
                                <button
                                    onClick={signOut}
                                    className="px-3 py-1.5 text-[10px] md:text-xs bg-slate-700 hover:bg-red-900/50 hover:text-red-400 rounded-lg transition border border-slate-600 font-medium"
                                >
                                    Exit
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header >

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
                        <div className="flex items-center gap-2 md:gap-4 mr-0 md:mr-4 text-[10px] md:text-xs font-medium text-slate-400 bg-slate-800/50 px-2 md:px-3 py-1 md:py-1.5 rounded-lg border border-slate-700/50">
                            <div className="flex items-center gap-1.5 md:gap-2">
                                <span className="hidden xs:inline">Active:</span>
                                <span className={`${usage.activeLimitReached ? 'text-red-400' : 'text-white'}`}>
                                    {usage.activeCount}
                                    <span className="opacity-50 mx-0.5">/</span>
                                    {usage.limits.maxActive === Infinity ? '∞' : usage.limits.maxActive}
                                </span>
                            </div>
                            <div className="w-px h-3 bg-slate-700"></div>
                            <div className="flex items-center gap-1.5 md:gap-2">
                                <span className="hidden xs:inline">Monthly:</span>
                                <span className={`${usage.monthlyLimitReached ? 'text-red-400' : 'text-white'}`}>
                                    {usage.monthlyCount}
                                    <span className="opacity-50 mx-0.5">/</span>
                                    {usage.limits.maxMonthly === Infinity ? '∞' : usage.limits.maxMonthly}
                                </span>
                            </div>
                        </div>

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

                {/* Navigation Tabs */}
                <div className="flex flex-wrap gap-2 bg-slate-800 p-1 md:p-1.5 rounded-xl border border-slate-700 w-full md:w-fit">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition whitespace-nowrap ${activeTab === 'active' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        🚀 <span className="hidden xs:inline">Active</span>
                    </button>
                    {!isGuest && (
                        <>
                            <button
                                onClick={() => setActiveTab('riders')}
                                className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition whitespace-nowrap ${activeTab === 'riders' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                🛵 <span className="hidden xs:inline">Fleet</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('customers')}
                                className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition whitespace-nowrap ${activeTab === 'customers' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                👥 <span className="hidden xs:inline">Contacts</span>
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition whitespace-nowrap ${activeTab === 'history' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        📜 <span className="hidden xs:inline">History</span>
                    </button>
                </div>
                {/* Link Generator */}
                {/* Link Generator & Live Map */}
                {activeTab === 'active' && (
                    <div className="space-y-6 animate-fade-in">
                        <CreateDeliveryForm
                            user={user}
                            vendorProfile={vendorProfile}
                            usage={usage}
                            riders={myRiders}
                            customers={myCustomers}
                            onLimitReached={() => setLimitModalOpen(true)}
                            onToast={showToast}
                            onSessionCreated={() => setGuestRefresh(prev => prev + 1)}
                        />

                        {/* Map Header */}
                        <div className="flex justify-between items-end px-1">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <span>🗺️</span> Live Dispatch Map
                            </h2>
                            <button
                                onClick={() => setFocusedSession({ _reset: Date.now() })}
                                className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded-full text-slate-300 transition border border-slate-600"
                            >
                                🔍 Fit All
                            </button>
                        </div>

                        <DashboardMap
                            sessions={activeSessions}
                            focusedSession={focusedSession}
                        />
                    </div>
                )}

                {/* RIDERS TAB */}
                {activeTab === 'riders' && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">My Fleet</h2>
                            <button onClick={() => setRiderModal({ isOpen: true, data: null })} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition">+ Add Rider</button>
                        </div>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-slate-400 border-b border-slate-700">
                                        <th className="p-3">Name</th>
                                        <th className="p-3">Phone</th>
                                        <th className="p-3">Rating</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {myRiders.map(rider => {
                                        const { avgRating, count: ratingCount } = getRiderRating(rider);

                                        return (
                                            <tr key={rider.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                                <td className="p-3">{rider.name}</td>
                                                <td className="p-3">{rider.phone}</td>
                                                <td className="p-3">
                                                    {avgRating ? (
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-yellow-400">★</span>
                                                            <span className="font-bold text-white">{avgRating}</span>
                                                            <span className="text-xs text-slate-500">({ratingCount})</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-500 text-xs">No ratings</span>
                                                    )}
                                                </td>
                                                <td className="p-3">{rider.status}</td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={() => {
                                                                setRiderFilter(rider.id);
                                                                setActiveTab('history');
                                                            }}
                                                            className="text-green-400 hover:text-green-300 text-xs font-bold uppercase tracking-wider"
                                                        >
                                                            View History
                                                        </button>
                                                        <button onClick={() => setRiderModal({ isOpen: true, data: rider })} className="text-blue-400 hover:underline">Edit</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {myRiders.length === 0 && <tr><td colSpan="5" className="p-6 text-center text-slate-500">No riders yet.</td></tr>}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View for Riders */}
                        <div className="md:hidden space-y-4">
                            {myRiders.map(rider => {
                                const { avgRating, count: ratingCount } = getRiderRating(rider);

                                return (
                                    <div key={rider.id} className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-bold text-white">{rider.name}</h3>
                                                <p className="text-xs text-slate-400">{rider.phone}</p>
                                            </div>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${rider.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                                                {rider.status.toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <div className="flex items-center gap-1">
                                                {avgRating ? (
                                                    <>
                                                        <span className="text-yellow-400">★</span>
                                                        <span className="font-bold text-white">{avgRating}</span>
                                                        <span className="text-[10px] text-slate-500">({ratingCount})</span>
                                                    </>
                                                ) : (
                                                    <span className="text-slate-500 text-xs italic">No ratings</span>
                                                )}
                                            </div>
                                            <div className="flex gap-4">
                                                <button
                                                    onClick={() => {
                                                        setRiderFilter(rider.id);
                                                        setActiveTab('history');
                                                    }}
                                                    className="text-green-400 text-xs font-bold"
                                                >
                                                    History
                                                </button>
                                                <button onClick={() => setRiderModal({ isOpen: true, data: rider })} className="text-blue-400 text-xs font-bold">Edit</button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            {myRiders.length === 0 && <p className="text-center text-slate-500 py-4 italic">No riders yet.</p>}
                        </div>
                    </div>
                )}

                {/* CUSTOMERS TAB */}
                {activeTab === 'customers' && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Address Book</h2>
                            <button onClick={() => { setCustomerModal({ isOpen: true, data: null }); setCustomerFormAddress(''); }} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition">+ Add Customer</button>
                        </div>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-slate-400 border-b border-slate-700">
                                        <th className="p-3">Name</th>
                                        <th className="p-3">Phone</th>
                                        <th className="p-3">Address</th>
                                        <th className="p-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {myCustomers.map(cust => (
                                        <tr key={cust.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                            <td className="p-3">{cust.name}</td>
                                            <td className="p-3">{cust.phone}</td>
                                            <td className="p-3 text-sm text-slate-400">{cust.defaultAddress}</td>
                                            <td className="p-3"><button onClick={() => { setCustomerModal({ isOpen: true, data: cust }); setCustomerFormAddress(cust.defaultAddress || ''); }} className="text-blue-400 hover:underline">Edit</button></td>
                                        </tr>
                                    ))}
                                    {myCustomers.length === 0 && <tr><td colSpan="4" className="p-6 text-center text-slate-500">No customers yet.</td></tr>}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View for Customers */}
                        <div className="md:hidden space-y-4">
                            {myCustomers.map(cust => (
                                <div key={cust.id} className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-white">{cust.name}</h3>
                                        <button onClick={() => { setCustomerModal({ isOpen: true, data: cust }); setCustomerFormAddress(cust.defaultAddress || ''); }} className="text-blue-400 text-xs font-bold">Edit</button>
                                    </div>
                                    <p className="text-xs text-slate-400">{cust.phone}</p>
                                    <p className="text-xs text-slate-500 line-clamp-2">{cust.defaultAddress}</p>
                                </div>
                            ))}
                            {myCustomers.length === 0 && <p className="text-center text-slate-500 py-4 italic">No customers yet.</p>}
                        </div>
                    </div>
                )}

                {/* Modals */}
                {riderModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                        <div className="bg-slate-800 p-6 rounded-xl w-full max-w-md border border-slate-700 shadow-2xl">
                            <h3 className="text-xl font-bold mb-4">{riderModal.data ? 'Edit Rider' : 'Add Rider'}</h3>
                            <form onSubmit={handleSaveRider} className="space-y-4">
                                <input name="name" defaultValue={riderModal.data?.name} placeholder="Name" className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white" required />
                                <input name="phone" defaultValue={riderModal.data?.phone} placeholder="Phone" className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white" required />
                                <div className="flex gap-2 pt-2">
                                    <button type="button" onClick={() => setRiderModal({ isOpen: false })} className="flex-1 bg-slate-700 p-2 rounded hover:bg-slate-600">Cancel</button>
                                    <button type="submit" className="flex-1 bg-green-600 p-2 rounded hover:bg-green-500 font-bold">Save</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                {customerModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                        <div className="bg-slate-800 p-6 rounded-xl w-full max-w-md border border-slate-700 shadow-2xl">
                            <h3 className="text-xl font-bold mb-4">{customerModal.data ? 'Edit Customer' : 'Add Customer'}</h3>
                            <form onSubmit={handleSaveCustomer} className="space-y-4">
                                <input name="name" defaultValue={customerModal.data?.name} placeholder="Name" className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white" required />
                                <input name="phone" defaultValue={customerModal.data?.phone} placeholder="Phone" className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white" required />
                                <AddressAutocomplete
                                    label="Default Address"
                                    value={customerFormAddress}
                                    onChange={(data) => setCustomerFormAddress(data.address)}
                                    onUseMyLocation={() => useCurrentLocation('customer')}
                                    isLoadingLocation={geocodingCustomerAddress}
                                    placeholder="e.g. 15 Admiralty Way..."
                                    className="bg-slate-900 border-slate-700"
                                />
                                <div className="flex gap-2 pt-2">
                                    <button type="button" onClick={() => setCustomerModal({ isOpen: false })} className="flex-1 bg-slate-700 p-2 rounded hover:bg-slate-600">Cancel</button>
                                    <button type="submit" className="flex-1 bg-green-600 p-2 rounded hover:bg-green-500 font-bold">Save</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Active Sessions Table / History */}
                {/* Show table only if active or history tab */}
                {(activeTab === 'active' || activeTab === 'history') && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                        {/* Active Sessions Table */}
                        <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setActiveTab('active')}
                                    className={`font-semibold flex items-center gap-2 pb-1 border-b-2 transition ${activeTab === 'active' ? 'text-white border-green-500' : 'text-slate-400 border-transparent hover:text-slate-300'}`}
                                >
                                    <span>📋</span> Active Deliveries
                                    <span className="bg-slate-700 text-xs py-0.5 px-2 rounded-full text-slate-300">{activeTableSessions.length}</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('history')}
                                    className={`font-semibold flex items-center gap-2 pb-1 border-b-2 transition ${activeTab === 'history' ? 'text-white border-green-500' : 'text-slate-400 border-transparent hover:text-slate-300'}`}
                                >
                                    <span>📜</span> History
                                </button>
                            </div>



                            {activeTab === 'history' && (
                                <div className="flex items-center gap-3">
                                    {riderFilter && (
                                        <div className="flex items-center gap-2 bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30">
                                            <span>Starting filter: {myRiders.find(r => r.id === riderFilter)?.name || 'Rider'}</span>
                                            <button onClick={() => setRiderFilter(null)} className="hover:text-white">✕</button>
                                        </div>
                                    )}
                                    <button
                                        onClick={exportHistory}
                                        className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded transition flex items-center gap-1"
                                    >
                                        ⬇ Export CSV
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="hidden md:block overflow-x-auto">
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
                                    {(activeTab === 'active' ? activeTableSessions : historyTableSessions).map((session) => (
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
                                                        onClick={() => setSelectedSession(session)}
                                                        className="text-green-400 hover:text-green-300 font-medium text-xs"
                                                    >
                                                        View Details
                                                    </button>
                                                    {((session.lat && session.lng) || session.pickup?.lat || session.dropoff?.lat) && (
                                                        <button
                                                            onClick={() => focusOnMap(session)}
                                                            className="text-blue-400 hover:text-blue-300 font-medium text-xs"
                                                        >
                                                            Map
                                                        </button>
                                                    )}
                                                    {session.status !== 'completed' && session.status !== 'cancelled' && (
                                                        <button
                                                            onClick={() => requestCancel(session.id)}
                                                            className="text-red-400 hover:text-red-300 font-medium text-xs"
                                                        >
                                                            Cancel
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View for Deliveries */}
                        <div className="md:hidden divide-y divide-slate-700">
                            {(activeTab === 'active' ? activeTableSessions : historyTableSessions).map((session) => (
                                <div key={session.id} className="p-4 space-y-3 hover:bg-slate-700/20 transition">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="text-xs text-slate-500 font-medium">#{session.refId}</div>
                                            <div className="font-bold text-white text-base">{session.riderName}</div>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(session.status)}`}>
                                            {session.status?.toUpperCase()}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700/50">
                                            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Stop Code</div>
                                            <div className="font-mono font-bold text-green-400 text-lg leading-none">{session.stopCode}</div>
                                        </div>
                                        <div className="bg-slate-900/50 rounded-lg p-2 border border-slate-700/50">
                                            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Status</div>
                                            <div className="text-xs text-slate-300 truncate">
                                                {session.battery ? (
                                                    <span className={session.battery > 30 ? 'text-green-400' : session.battery > 15 ? 'text-yellow-400' : 'text-red-400'}>
                                                        🔋 {session.battery}%
                                                    </span>
                                                ) : '—'}
                                                <span className="mx-1 text-slate-700">|</span>
                                                <span className="text-[10px]">{session.lastPing || 'No ping'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 pt-1">
                                        <button
                                            onClick={() => setSelectedSession(session)}
                                            className="flex-1 py-2 bg-slate-700 font-bold text-white rounded-lg text-xs"
                                        >
                                            Details
                                        </button>
                                        {((session.lat && session.lng) || session.pickup?.lat || session.dropoff?.lat) && (
                                            <button
                                                onClick={() => focusOnMap(session)}
                                                className="flex-1 py-2 bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold rounded-lg text-xs"
                                            >
                                                Map
                                            </button>
                                        )}
                                        {session.status !== 'completed' && session.status !== 'cancelled' && (
                                            <button
                                                onClick={() => requestCancel(session.id)}
                                                className="flex-1 py-2 bg-red-600/10 border border-red-500/30 text-red-400 font-bold rounded-lg text-xs"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Empty States */}
                        {(activeTab === 'active' ? activeTableSessions : historyTableSessions).length === 0 && (
                            <div className="px-6 py-12 text-center text-slate-400">
                                <div className="flex flex-col items-center justify-center opacity-50 space-y-3">
                                    <div className="text-6xl filter grayscale opacity-50">
                                        {activeTab === 'active' ? '🛵' : '📂'}
                                    </div>
                                    <div>
                                        <p className="font-medium text-lg">
                                            {activeTab === 'active' ? 'No active deliveries' : 'No delivery history'}
                                        </p>
                                        <p className="text-sm">
                                            {activeTab === 'active'
                                                ? 'Generate a new tracking link to get started.'
                                                : 'Completed deliveries will appear here.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )
                }

                {/* Session Details Modal */}
                {
                    selectedSession && (
                        <SessionDetailsModal
                            session={selectedSession}
                            onClose={() => setSelectedSession(null)}
                        />
                    )
                }

                {/* Confirmation Modal */}
                <ConfirmationModal
                    isOpen={confirmModal.isOpen}
                    onClose={() => setConfirmModal({ isOpen: false, sessionId: null })}
                    onConfirm={confirmCancel}
                    title="Cancel Order?"
                    message="This will mark the delivery as cancelled. This action cannot be undone."
                />

                {/* Footer */}
                <div className="text-center py-4">
                    <p className="text-xs text-slate-500">
                        A product of{' '}
                        <a href="https://deproductdojo.com" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300">
                            The Product Dojo
                        </a>
                    </p>
                </div>
            </div>
        </div >
    );
}
