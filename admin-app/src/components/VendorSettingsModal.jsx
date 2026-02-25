import { useState, useEffect } from 'react';
import { dbHelpers } from '../services/firebase';
import { ref, update, remove } from 'firebase/database';
import { db } from '../services/firebase';
import AddressAutocomplete from './AddressAutocomplete';

export default function VendorSettingsModal({ isOpen, onClose, vendor, user, onUpdate }) {
    if (!isOpen) return null;

    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        businessName: '',
        phone: '',
        supportContact: '',
        defaultPickup: null
    });

    // WhatsApp linking state
    const [waCode, setWaCode] = useState('');
    const [waLinking, setWaLinking] = useState(false);
    const [waError, setWaError] = useState('');
    const [waSuccess, setWaSuccess] = useState('');
    const [waLinked, setWaLinked] = useState(false);
    const [waPhone, setWaPhone] = useState('');

    useEffect(() => {
        if (vendor?.whatsappPhone) {
            setWaLinked(true);
            setWaPhone(vendor.whatsappPhone.replace(/(\d{3})\d+(\d{4})/, '$1****$2'));
        }
    }, [vendor]);

    useEffect(() => {
        if (vendor) {
            setFormData({
                businessName: vendor.businessName || '',
                phone: vendor.phone || '',
                supportContact: vendor.supportContact || '',
                defaultPickup: vendor.defaultPickup || null
            });
        }
    }, [vendor]);

    const handleSave = async () => {
        setLoading(true);
        try {
            await dbHelpers.updateVendorProfile(user.uid, formData);
            if (onUpdate) onUpdate(formData); // Optimistic update or refetch trigger
            onClose();
        } catch (error) {
            console.error("Error updating profile:", error);
            alert("Failed to update profile");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col max-h-[90vh] mx-4">
                {/* Header */}
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span>⚙️</span> Settings
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition">✕</button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-700 bg-slate-800/50 overflow-x-auto">
                    {['profile', 'preferences', 'whatsapp', 'notifications'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-4 text-sm font-medium transition relative whitespace-nowrap px-3 ${activeTab === tab ? 'text-green-400' : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            {tab === 'whatsapp' ? '💬 WhatsApp' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                            {activeTab === tab && (
                                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-green-500 shadow-[0_-2px_6px_rgba(34,197,94,0.4)]"></div>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {activeTab === 'profile' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Business Name</label>
                                <input
                                    type="text"
                                    value={formData.businessName}
                                    onChange={e => setFormData({ ...formData, businessName: e.target.value })}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-green-500 focus:outline-none"
                                    placeholder="e.g. QuickMeds Pharmacy"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Phone Number</label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-green-500 focus:outline-none"
                                    placeholder="e.g. 08012345678"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Support Contact (Email/Phone)</label>
                                <input
                                    type="text"
                                    value={formData.supportContact}
                                    onChange={e => setFormData({ ...formData, supportContact: e.target.value })}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-green-500 focus:outline-none"
                                    placeholder="Contact info visible to customers/riders"
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'preferences' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Default Pickup Location</label>
                                <p className="text-xs text-slate-500 mb-3">
                                    Automatically fill the "Pickup Address" field when creating new delivery links.
                                </p>
                                <AddressAutocomplete
                                    placeholder="Search for your store address..."
                                    value={formData.defaultPickup?.address || ''}
                                    onChange={(val) => setFormData({
                                        ...formData,
                                        defaultPickup: {
                                            address: val.address,
                                            lat: val.lat,
                                            lng: val.lng
                                        }
                                    })}
                                    className="w-full"
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'whatsapp' && (
                        <div className="space-y-6">
                            {/* Header */}
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-2xl">💬</div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">WhatsApp Integration</h3>
                                    <p className="text-sm text-slate-400">Manage deliveries directly from WhatsApp</p>
                                </div>
                            </div>

                            {waLinked ? (
                                /* Connected State */
                                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-5">
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="text-green-400 text-xl">✅</span>
                                        <div>
                                            <p className="text-white font-semibold">WhatsApp Connected</p>
                                            <p className="text-sm text-slate-400">Phone: {waPhone}</p>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-400 mb-4">
                                        Send <span className="text-green-400 font-medium">"menu"</span> to your RideWatch WhatsApp number to start managing deliveries.
                                    </p>
                                    <div className="bg-slate-800/60 rounded-lg p-4 mb-4">
                                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">What you can do</p>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div className="text-slate-300">📦 Create deliveries</div>
                                            <div className="text-slate-300">🛵 Assign riders</div>
                                            <div className="text-slate-300">📊 Daily summary</div>
                                            <div className="text-slate-300">🔍 Track status</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (!confirm('Disconnect WhatsApp? You can reconnect anytime.')) return;
                                            try {
                                                await dbHelpers.updateVendorProfile(user.uid, { whatsappPhone: null, whatsappLinkedAt: null });
                                                setWaLinked(false);
                                                setWaPhone('');
                                                setWaSuccess('');
                                            } catch (e) {
                                                console.error(e);
                                            }
                                        }}
                                        className="text-sm text-red-400 hover:text-red-300 transition"
                                    >
                                        Disconnect WhatsApp
                                    </button>
                                </div>
                            ) : (
                                /* Linking Flow */
                                <>
                                    <div className="bg-slate-700/30 rounded-xl p-5 border border-slate-600/50">
                                        <p className="text-sm text-slate-300 mb-4">
                                            <span className="font-semibold text-white">How to connect:</span>
                                        </p>
                                        <ol className="space-y-3 text-sm text-slate-400">
                                            <li className="flex gap-3">
                                                <span className="text-green-400 font-bold">1</span>
                                                <span>Send <span className="text-white font-medium">"hi"</span> to the RideWatch WhatsApp number</span>
                                            </li>
                                            <li className="flex gap-3">
                                                <span className="text-green-400 font-bold">2</span>
                                                <span>You'll receive a <span className="text-white font-medium">6-character code</span></span>
                                            </li>
                                            <li className="flex gap-3">
                                                <span className="text-green-400 font-bold">3</span>
                                                <span>Enter the code below to link your account</span>
                                            </li>
                                        </ol>
                                    </div>

                                    <div>
                                        <label className="block text-sm text-slate-400 mb-2">Link Code</label>
                                        <div className="flex gap-3">
                                            <input
                                                type="text"
                                                value={waCode}
                                                onChange={e => {
                                                    setWaCode(e.target.value.toUpperCase());
                                                    setWaError('');
                                                }}
                                                maxLength={6}
                                                placeholder="e.g. GOHENK"
                                                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-center text-lg font-mono tracking-widest focus:border-green-500 focus:outline-none uppercase"
                                            />
                                            <button
                                                onClick={async () => {
                                                    if (!waCode || waCode.length < 4) {
                                                        setWaError('Please enter the full code');
                                                        return;
                                                    }
                                                    setWaLinking(true);
                                                    setWaError('');
                                                    try {
                                                        const res = await fetch('/api/whatsapp-link', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ code: waCode, vendorId: user.uid }),
                                                        });
                                                        const data = await res.json();
                                                        if (!res.ok) {
                                                            setWaError(data.error || 'Failed to link');
                                                        } else {
                                                            setWaLinked(true);
                                                            setWaPhone(data.phone);
                                                            setWaSuccess('WhatsApp connected! 🎉');
                                                            setWaCode('');
                                                        }
                                                    } catch (err) {
                                                        setWaError('Network error. Try again.');
                                                    } finally {
                                                        setWaLinking(false);
                                                    }
                                                }}
                                                disabled={waLinking || waCode.length < 4}
                                                className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-500 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                            >
                                                {waLinking ? (
                                                    <><span className="animate-spin">⏳</span> Linking...</>
                                                ) : (
                                                    'Link'
                                                )}
                                            </button>
                                        </div>
                                        {waError && <p className="text-red-400 text-sm mt-2">{waError}</p>}
                                        {waSuccess && <p className="text-green-400 text-sm mt-2">{waSuccess}</p>}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="text-center py-10">
                            <div className="text-4xl mb-4">🔔</div>
                            <h3 className="text-lg font-medium text-white">Notifications Center</h3>
                            <p className="text-slate-400 mt-2">View listing of recent alerts and system messages.</p>
                            <div className="mt-6 bg-slate-700/30 rounded-lg p-4 text-left max-w-md mx-auto">
                                <div className="space-y-3">
                                    <div className="flex gap-3 items-start p-3 border-b border-slate-700/50 last:border-0">
                                        <span className="text-green-400 mt-0.5">●</span>
                                        <div>
                                            <p className="text-sm text-white">Welcome to RideWatch!</p>
                                            <p className="text-xs text-slate-500">Just now</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700 bg-slate-800/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl bg-slate-700 text-slate-300 font-medium hover:bg-slate-600 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-6 py-2.5 rounded-xl bg-green-600 text-white font-medium hover:bg-green-500 transition shadow-lg shadow-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}
