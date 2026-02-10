import { useState, useEffect } from 'react';
import { dbHelpers } from '../services/firebase';
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
                <div className="flex border-b border-slate-700 bg-slate-800/50">
                    {['profile', 'preferences', 'notifications'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-4 text-sm font-medium transition relative ${activeTab === tab ? 'text-green-400' : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
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
