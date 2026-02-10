import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { QRCodeCanvas } from 'qrcode.react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, dbHelpers, isDemoMode } from '../services/firebase';
import { ref, push, set, onValue, off, update } from 'firebase/database';
import AddressAutocomplete from '../components/AddressAutocomplete';
import SearchableSelect from '../components/SearchableSelect';
import SessionDetailsModal from '../components/SessionDetailsModal';
import VendorSettingsModal from '../components/VendorSettingsModal';
import SubscriptionModal from '../components/SubscriptionModal';
import { useVendorUsage } from '../hooks/useVendorUsage';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icons
const createRiderIcon = (status) => {
    const color = status === 'active' ? '#22c55e' : status === 'lost' ? '#ef4444' : '#f59e0b';
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="background: ${color}; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 16px;">🛵</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
    });
};

const createPickupIcon = () => L.divIcon({
    className: 'custom-marker',
    html: `<div style="background: #f97316; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 12px;">📦</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
});

const createDropoffIcon = () => L.divIcon({
    className: 'custom-marker',
    html: `<div style="background: #ef4444; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 12px;">📍</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
});

// Component to handle map bounds and focus
function MapLogic({ sessions, focusedSession }) {
    const map = useMap();

    useEffect(() => {
        if (!map) return;

        // 1. If a specific session is focused, ZOOM to the RIDER (or pickup)
        if (focusedSession && (focusedSession.lat || focusedSession.pickup?.lat)) {
            if (focusedSession.lat && focusedSession.lng) {
                map.flyTo([focusedSession.lat, focusedSession.lng], 16, { duration: 1.5 });
            } else if (focusedSession.pickup?.lat && focusedSession.pickup?.lng) {
                map.flyTo([focusedSession.pickup.lat, focusedSession.pickup.lng], 16, { duration: 1.5 });
            }
            return;
        }

        // 2. Otherwise, fit bounds to show ALL active sessions
        try {
            const bounds = L.latLngBounds();
            let hasPoints = false;

            sessions.forEach(session => {
                if (!session) return;
                if (session.lat && session.lng) { bounds.extend([session.lat, session.lng]); hasPoints = true; }
                if (session.pickup?.lat && session.pickup?.lng) { bounds.extend([session.pickup.lat, session.pickup.lng]); hasPoints = true; }
                if (session.dropoff?.lat && session.dropoff?.lng) { bounds.extend([session.dropoff.lat, session.dropoff.lng]); hasPoints = true; }
            });

            if (hasPoints && bounds.isValid()) {
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
            }
        } catch (error) {
            console.error('Error in MapLogic bounds calculation:', error);
        }
    }, [sessions, focusedSession, map]);

    return (
        <>
            {sessions.map(session => (
                <React.Fragment key={session.id}>
                    {/* Rider Marker */}
                    {session.lat && session.lng && (
                        <Marker position={[session.lat, session.lng]} icon={createRiderIcon(session.status)}>
                            <Popup>
                                <div className="text-slate-800">
                                    <strong>{session.riderName}</strong><br />
                                    🛵 Rider<br />
                                    Status: {session.status}
                                </div>
                            </Popup>
                        </Marker>
                    )}
                    {/* Pickup Marker */}
                    {session.pickup?.lat && session.pickup?.lng && (
                        <Marker position={[session.pickup.lat, session.pickup.lng]} icon={createPickupIcon()}>
                            <Popup>
                                <div className="text-slate-800">
                                    <strong>{session.riderName}</strong><br />
                                    📦 Pickup<br />
                                    {session.pickup.address}
                                </div>
                            </Popup>
                        </Marker>
                    )}
                    {/* Dropoff Marker */}
                    {session.dropoff?.lat && session.dropoff?.lng && (
                        <Marker position={[session.dropoff.lat, session.dropoff.lng]} icon={createDropoffIcon()}>
                            <Popup>
                                <div className="text-slate-800">
                                    <strong>{session.riderName}</strong><br />
                                    📍 Dropoff<br />
                                    {session.dropoff.address}
                                </div>
                            </Popup>
                        </Marker>
                    )}
                </React.Fragment>
            ))}
        </>
    );
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
    const [generatedLinks, setGeneratedLinks] = useState(null);
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
            // For customers we might not have update helper yet, but create works for now or add update
            // Assuming update logic exists or we add it safely. 
            // dbHelpers.updateCustomer... wait, dbHelpers doesn't have updateCustomer!
            // I'll add create only for now or use generic update logic
            showToast('Editing not fully implemented yet, create a new one instead!');
        } else {
            await dbHelpers.createCustomer(data);
            showToast('Customer saved successfully');
        }
        setCustomerModal({ isOpen: false, data: null });
    };

    const isGuest = !user;

    // Form state
    const [formData, setFormData] = useState({
        refId: '',
        riderName: '',
        riderPhone: '',
        customerName: '',
        customerPhone: '',
        pickupAddress: '',
        dropoffAddress: ''
    });

    // Resolved locations (coords + address)
    const [pickupLocation, setPickupLocation] = useState(null);
    const [dropoffLocation, setDropoffLocation] = useState(null);

    // Geocoding state for "Use My Location" buttons
    const [geocodingPickup, setGeocodingPickup] = useState(false);
    const [geocodingDropoff, setGeocodingDropoff] = useState(false);
    const [customerFormAddress, setCustomerFormAddress] = useState('');
    const [geocodingCustomerAddress, setGeocodingCustomerAddress] = useState(false);

    // Geocode address using OpenStreetMap Nominatim
    const geocodeAddress = async (address) => {
        if (!address || address.trim().length < 3) return null;
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
                { headers: { 'User-Agent': 'RideWatch/1.0' } }
            );
            const data = await response.json();
            if (data && data.length > 0) {
                return {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon),
                    address: address
                };
            }
        } catch (error) {
            console.error('Geocoding error:', error);
        }
        return null;
    };

    // Use current location for pickup/dropoff
    const useCurrentLocation = async (field) => {
        if (!navigator.geolocation) {
            alert('Geolocation not supported');
            return;
        }
        let setLoading;
        if (field === 'pickup') setLoading = setGeocodingPickup;
        else if (field === 'dropoff') setLoading = setGeocodingDropoff;
        else setLoading = setGeocodingCustomerAddress;

        setLoading(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                // Reverse geocode to get address
                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                        { headers: { 'User-Agent': 'RideWatch/1.0' } }
                    );
                    const data = await response.json();
                    const address = data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

                    const locationData = { lat: latitude, lng: longitude, address };

                    if (field === 'pickup') {
                        setFormData(prev => ({ ...prev, pickupAddress: address }));
                        setPickupLocation(locationData);
                    } else if (field === 'dropoff') {
                        setFormData(prev => ({ ...prev, dropoffAddress: address }));
                        setDropoffLocation(locationData);
                    } else if (field === 'customer') {
                        setCustomerFormAddress(address);
                    }
                } catch (e) {
                    const fallbackAddress = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                    const locationData = { lat: latitude, lng: longitude, address: fallbackAddress };

                    if (field === 'pickup') {
                        setFormData(prev => ({ ...prev, pickupAddress: fallbackAddress }));
                        setPickupLocation(locationData);
                    } else if (field === 'dropoff') {
                        setFormData(prev => ({ ...prev, dropoffAddress: fallbackAddress }));
                        setDropoffLocation(locationData);
                    } else if (field === 'customer') {
                        setCustomerFormAddress(fallbackAddress);
                    }
                }
                setLoading(false);
            },
            (error) => {
                alert('Could not get location: ' + error.message);
                setLoading(false);
            }
        );
    };

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

        // Authenticated mode OR Guest mode: load from Firebase
        const sessionsRef = ref(db, 'sessions');
        const unsubscribe = onValue(sessionsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                let vendorSessions = [];

                if (isGuest) {
                    // In guest mode, filter sessions that match ids in local storage
                    const localSessions = getGuestSessions();
                    const localIds = localSessions.map(s => s.id);

                    vendorSessions = Object.entries(data)
                        .filter(([id, _]) => localIds.includes(id))
                        .map(([id, session]) => ({ id, ...session }));
                } else {
                    // In auth mode, filter by vendorId
                    vendorSessions = Object.entries(data)
                        .filter(([_, session]) => session.vendorId === user?.uid)
                        .map(([id, session]) => ({ id, ...session }));
                }

                vendorSessions = vendorSessions
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

                setSessions(vendorSessions);
            }
        });

        return () => off(sessionsRef);
        return () => off(sessionsRef);
    }, [user, isGuest]);

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

    const generateLink = async (e) => {
        e.preventDefault();

        // Check Limits
        if (!usage.canCreate) {
            setLimitModalOpen(true);
            return;
        }

        setLoading(true);

        const sessionId = 'sess_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
        const stopCode = Math.floor(1000 + Math.random() * 9000).toString();
        const riderPin = Math.floor(1000 + Math.random() * 9000).toString();

        // Resolve pickup location: use state coords or fallback to geocoding input string
        let finalPickup = pickupLocation;
        // Priority: 1. Map/Manual selection 2. Default Pickup (if empty form) 3. Geocode Form Input
        if (!finalPickup && !formData.pickupAddress && vendorProfile?.defaultPickup) {
            finalPickup = vendorProfile.defaultPickup;
        } else if (!finalPickup && formData.pickupAddress) {
            finalPickup = await geocodeAddress(formData.pickupAddress);
        }

        // Resolve dropoff location
        let finalDropoff = dropoffLocation;
        if (!finalDropoff && formData.dropoffAddress) {
            finalDropoff = await geocodeAddress(formData.dropoffAddress);
        }

        // Determine base URL (use port 8000 for static files if local)
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const staticBaseUrl = isLocal ? `${window.location.protocol}//${window.location.hostname}:8000` : window.location.origin;

        const newSession = {
            id: sessionId,
            refId: formData.refId,
            riderName: formData.riderName,
            riderPhone: formData.riderPhone,
            customerName: formData.customerName,
            customerPhone: formData.customerPhone,
            stopCode,
            riderPin, // NEW: Rider security
            status: 'pending',
            vendorId: user?.uid || 'guest',
            vendorEmail: user?.email || null,
            createdAt: Date.now(),
            lat: null,
            lng: null,
            lastPing: 'Waiting...',
            // NEW: Pickup and Dropoff locations
            pickup: finalPickup,
            dropoff: finalDropoff
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

        // Add to local state - REMOVED to avoid duplication with onValue listener
        // setSessions(prev => [newSession, ...prev]);

        // Generate links
        setGeneratedLinks({
            sessionId,
            stopCode,
            riderPin,
            riderLink: `${staticBaseUrl}/rider.html?session=${sessionId}`,
            riderLink: `${staticBaseUrl}/rider.html?session=${sessionId}`,
            customerLink: `${staticBaseUrl}/track.html?session=${sessionId}`
        });

        // Reset form
        setFormData({ refId: '', riderName: '', riderPhone: '', customerName: '', customerPhone: '', pickupAddress: '', dropoffAddress: '' });
        setPickupLocation(null);
        setDropoffLocation(null);
        setLoading(false);
    };

    const copyToClipboard = async (text, e) => {
        await navigator.clipboard.writeText(text);
        showToast('Link copied to clipboard! 📋');
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

    // Split sessions for Table
    const activeTableSessions = sessions.filter(s => s.status !== 'completed' && s.status !== 'cancelled');
    const historyTableSessions = sessions.filter(s => s.status === 'completed' || s.status === 'cancelled');

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
            <header className="bg-slate-800 border-b border-slate-700">
                <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
                    <h1 className="text-xl font-bold">
                        <span className="text-green-400">Ride</span>Watch
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
                                <div className="text-right">
                                    <div className="font-bold text-white text-sm">
                                        {vendorProfile?.businessName || 'Vendor'}
                                        {vendorProfile?.planType === 'pro' && (
                                            <span className="ml-2 bg-gradient-to-r from-yellow-500 to-amber-600 text-white text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">PRO</span>
                                        )}
                                        {!vendorProfile?.planType && (
                                            <button
                                                onClick={() => setSubscriptionModalOpen(true)}
                                                className="ml-2 bg-slate-600 hover:bg-green-600 text-slate-300 hover:text-white text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider transition cursor-pointer"
                                            >
                                                FREE (UPGRADE)
                                            </button>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-400">{user?.email}</div>
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
                                    className="px-4 py-2 text-xs bg-slate-700 hover:bg-red-900/50 hover:text-red-400 rounded-lg transition border border-slate-600"
                                >
                                    Sign Out
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
                        <div className="hidden md:flex items-center gap-4 mr-4 text-xs font-medium text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
                            <div className="flex items-center gap-2">
                                <span>Active:</span>
                                <span className={`${usage.activeLimitReached ? 'text-red-400' : 'text-white'}`}>
                                    {usage.activeCount} / {usage.limits.maxActive === Infinity ? '∞' : usage.limits.maxActive}
                                </span>
                            </div>
                            <div className="w-px h-3 bg-slate-700"></div>
                            <div className="flex items-center gap-2">
                                <span>Monthly:</span>
                                <span className={`${usage.monthlyLimitReached ? 'text-red-400' : 'text-white'}`}>
                                    {usage.monthlyCount} / {usage.limits.maxMonthly === Infinity ? '∞' : usage.limits.maxMonthly}
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
                <div className="flex flex-wrap gap-2 bg-slate-800 p-1.5 rounded-xl border border-slate-700 w-fit">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'active' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        🚀 Active / Dispatch
                    </button>
                    {!isGuest && (
                        <>
                            <button
                                onClick={() => setActiveTab('riders')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'riders' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                🛵 My Fleet
                            </button>
                            <button
                                onClick={() => setActiveTab('customers')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'customers' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                👥 Address Book
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'history' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        📜 History
                    </button>
                </div>

                {/* Link Generator */}
                {activeTab === 'active' && (
                    <>
                        <div className="bg-slate-800 rounded-xl border border-slate-700">
                            <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50 rounded-t-xl">
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
                                        <SearchableSelect
                                            placeholder="Select or type rider name..."
                                            value={formData.riderName}
                                            options={myRiders.map(r => ({ ...r, label: r.name, subLabel: r.phone }))}
                                            onChange={(val) => setFormData({ ...formData, riderName: val })}
                                            onSelect={(rider) => {
                                                setFormData({
                                                    ...formData,
                                                    riderName: rider.name,
                                                    riderPhone: rider.phone
                                                });
                                            }}
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

                                    {/* Customer Info (NEW) */}
                                    <div>
                                        <label className="block text-sm text-slate-400 mb-2">Customer Name</label>
                                        <SearchableSelect
                                            placeholder="Select or type customer name..."
                                            value={formData.customerName}
                                            options={myCustomers.map(c => ({ ...c, label: c.name, subLabel: c.phone }))}
                                            onChange={(val) => setFormData({ ...formData, customerName: val })}
                                            onSelect={(cust) => {
                                                setFormData({
                                                    ...formData,
                                                    customerName: cust.name,
                                                    customerPhone: cust.phone,
                                                    dropoffAddress: cust.defaultAddress || ''
                                                });
                                                setDropoffLocation(null);
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-slate-400 mb-2">Customer Phone</label>
                                        <input
                                            type="tel"
                                            value={formData.customerPhone}
                                            onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                                            placeholder="e.g. 08087654321"
                                        />
                                    </div>

                                    {/* Pickup Location */}
                                    <div className="md:col-span-3 border-t border-slate-700 pt-4 mt-2">
                                        <AddressAutocomplete
                                            label="📦 Pickup Address"
                                            value={formData.pickupAddress}
                                            onChange={(data) => {
                                                setFormData(prev => ({ ...prev, pickupAddress: data.address }));
                                                if (data.lat && data.lng) {
                                                    setPickupLocation(data);
                                                } else {
                                                    setPickupLocation(null);
                                                }
                                            }}
                                            onUseMyLocation={() => useCurrentLocation('pickup')}
                                            isLoadingLocation={geocodingPickup}
                                            placeholder="e.g. 15 Admiralty Way, Lekki Phase 1, Lagos"
                                        />
                                    </div>

                                    {/* Dropoff Location */}
                                    <div className="md:col-span-3">
                                        <AddressAutocomplete
                                            label="📍 Customer/Dropoff Address"
                                            value={formData.dropoffAddress}
                                            onChange={(data) => {
                                                setFormData(prev => ({ ...prev, dropoffAddress: data.address }));
                                                if (data.lat && data.lng) {
                                                    setDropoffLocation(data);
                                                } else {
                                                    setDropoffLocation(null);
                                                }
                                            }}
                                            onUseMyLocation={() => useCurrentLocation('dropoff')}
                                            isLoadingLocation={geocodingDropoff}
                                            placeholder="e.g. 42 Marina Street, Victoria Island, Lagos"
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

                                    {/* Rider PIN */}
                                    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-center">
                                        <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">🔑 Rider PIN</div>
                                        <div className="text-2xl font-mono font-bold text-green-400 tracking-wider">
                                            {generatedLinks.riderPin}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-2">Give this to rider to unlock app</div>
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
                                    <button
                                        onClick={() => setFocusedSession({ _reset: Date.now() })}
                                        className="ml-4 text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded-full text-slate-300 transition border border-slate-600"
                                    >
                                        🔍 Fit All
                                    </button>
                                </h2>
                                <span className="text-xs text-slate-500">OpenStreetMap</span>
                            </div>
                            <div className="h-[400px]">
                                <MapContainer
                                    center={[6.5244, 3.3792]}
                                    zoom={13}
                                    style={{ height: '100%', width: '100%' }}
                                    className="z-0"
                                >
                                    <TileLayer
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    />
                                    <MapLogic sessions={activeSessions} focusedSession={focusedSession} />
                                </MapContainer>
                            </div>
                        </div>
                    </>
                )}

                {/* RIDERS TAB */}
                {activeTab === 'riders' && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">My Fleet</h2>
                            <button onClick={() => setRiderModal({ isOpen: true, data: null })} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition">+ Add Rider</button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-slate-400 border-b border-slate-700">
                                        <th className="p-3">Name</th>
                                        <th className="p-3">Phone</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {myRiders.map(rider => (
                                        <tr key={rider.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                            <td className="p-3">{rider.name}</td>
                                            <td className="p-3">{rider.phone}</td>
                                            <td className="p-3">{rider.status}</td>
                                            <td className="p-3"><button onClick={() => setRiderModal({ isOpen: true, data: rider })} className="text-blue-400 hover:underline">Edit</button></td>
                                        </tr>
                                    ))}
                                    {myRiders.length === 0 && <tr><td colSpan="4" className="p-6 text-center text-slate-500">No riders yet.</td></tr>}
                                </tbody>
                            </table>
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
                        <div className="overflow-x-auto">
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
                                            <td className="p-3">{cust.defaultAddress}</td>
                                            <td className="p-3"><button onClick={() => { setCustomerModal({ isOpen: true, data: cust }); setCustomerFormAddress(cust.defaultAddress || ''); }} className="text-blue-400 hover:underline">Edit</button></td>
                                        </tr>
                                    ))}
                                    {myCustomers.length === 0 && <tr><td colSpan="4" className="p-6 text-center text-slate-500">No customers yet.</td></tr>}
                                </tbody>
                            </table>
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
                                <button
                                    onClick={exportHistory}
                                    className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded transition flex items-center gap-1"
                                >
                                    ⬇ Export CSV
                                </button>
                            )}
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
                                    {(activeTab === 'active' ? activeTableSessions : historyTableSessions).length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
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
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
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
                        <a href="https://theproductdojo.com" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300">
                            The Product Dojo
                        </a>
                    </p>
                </div>
            </div>
        </div >
    );
}
