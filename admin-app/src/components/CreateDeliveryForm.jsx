import React, { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { ref, set } from 'firebase/database';
import { db, isDemoMode } from '../services/firebase';
import AddressAutocomplete from './AddressAutocomplete';
import SearchableSelect from './SearchableSelect';

import { saveGuestSession } from '../utils/guestStorage';

export default function CreateDeliveryForm({
    user,
    vendorProfile,
    usage,
    riders = [],
    customers = [],
    onLimitReached,
    onToast
}) {
    const isGuest = !user;
    const [loading, setLoading] = useState(false);

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

    const [pickupLocation, setPickupLocation] = useState(null);
    const [dropoffLocation, setDropoffLocation] = useState(null);
    const [geocodingPickup, setGeocodingPickup] = useState(false);
    const [geocodingDropoff, setGeocodingDropoff] = useState(false);
    const [generatedLinks, setGeneratedLinks] = useState(null);

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

    // Use current location
    const useCurrentLocation = async (field) => {
        if (!navigator.geolocation) {
            alert('Geolocation not supported');
            return;
        }

        const setLoadingState = field === 'pickup' ? setGeocodingPickup : setGeocodingDropoff;
        setLoadingState(true);

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
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
                    } else {
                        setFormData(prev => ({ ...prev, dropoffAddress: address }));
                        setDropoffLocation(locationData);
                    }
                } catch (e) {
                    const fallbackAddress = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                    const locationData = { lat: latitude, lng: longitude, address: fallbackAddress };

                    if (field === 'pickup') {
                        setFormData(prev => ({ ...prev, pickupAddress: fallbackAddress }));
                        setPickupLocation(locationData);
                    } else {
                        setFormData(prev => ({ ...prev, dropoffAddress: fallbackAddress }));
                        setDropoffLocation(locationData);
                    }
                }
                setLoadingState(false);
            },
            (error) => {
                alert('Could not get location: ' + error.message);
                setLoadingState(false);
            }
        );
    };

    const generateLink = async (e) => {
        e.preventDefault();

        // Check Limits
        if (usage && !usage.canCreate) {
            if (onLimitReached) onLimitReached();
            return;
        }

        setLoading(true);

        const sessionId = 'sess_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
        const stopCode = Math.floor(1000 + Math.random() * 9000).toString();
        const riderPin = Math.floor(1000 + Math.random() * 9000).toString();

        // Resolve pickup location
        let finalPickup = pickupLocation;
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

        // Determine base URL
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
            riderPin,
            status: 'pending',
            vendorId: user?.uid || 'guest',
            vendorEmail: user?.email || null,
            createdAt: Date.now(),
            lat: null,
            lng: null,
            lastPing: 'Waiting...',
            pickup: finalPickup,
            dropoff: finalDropoff
        };

        // Save to LocalStorage (guest)
        if (isGuest) {
            saveGuestSession(newSession);
        }

        // Save to Firebase
        if (db) {
            try {
                await set(ref(db, `sessions/${sessionId}`), newSession);
            } catch (error) {
                console.error('Failed to save session:', error);
                if (!isGuest && !isDemoMode()) alert('Failed to create session. Please try again.');
            }
        }

        setGeneratedLinks({
            sessionId,
            stopCode,
            riderPin,
            riderLink: `${staticBaseUrl}/rider.html?session=${sessionId}`,
            customerLink: `${staticBaseUrl}/track.html?session=${sessionId}`
        });

        // Reset form
        setFormData({ refId: '', riderName: '', riderPhone: '', customerName: '', customerPhone: '', pickupAddress: '', dropoffAddress: '' });
        setPickupLocation(null);
        setDropoffLocation(null);
        setLoading(false);

        if (onToast) onToast('Links generated successfully! 🚀');
        if (onSessionCreated) onSessionCreated();
    };

    const copyToClipboard = async (text, e) => {
        await navigator.clipboard.writeText(text);
        if (onToast) onToast('Link copied to clipboard! 📋');
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
            message = `🛵 RideWatch: Start tracking for order ${formData.refId || 'new'}. Open: ${generatedLinks.riderLink}`;
        } else {
            message = `📍 Track your order: ${generatedLinks.customerLink}\n\n🔐 Stop Code: ${generatedLinks.stopCode}\nGive this code to the rider when they arrive.`;
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    };

    return (
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
                                options={riders.map(r => ({ ...r, label: r.name, subLabel: r.phone }))}
                                onChange={(val) => setFormData({ ...formData, riderName: val })}
                                onSelect={(rider) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        riderName: rider.name,
                                        riderPhone: rider.phone
                                    }));
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

                        {/* Customer Info */}
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Customer Name</label>
                            <SearchableSelect
                                placeholder="Select or type customer name..."
                                value={formData.customerName}
                                options={customers.map(c => ({ ...c, label: c.name, subLabel: c.phone }))}
                                onChange={(val) => setFormData({ ...formData, customerName: val })}
                                onSelect={(cust) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        customerName: cust.name,
                                        customerPhone: cust.phone,
                                        dropoffAddress: cust.defaultAddress || prev.dropoffAddress
                                    }));
                                    // If loading default address, we might want to geocode it or clear previous location
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
        </>
    );
}
