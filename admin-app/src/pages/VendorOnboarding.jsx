import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function VendorOnboarding() {
    const { user, role, vendorProfile, completeVendorOnboarding, isDemoMode } = useAuth();
    const navigate = useNavigate();
    const [businessName, setBusinessName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!user) {
            navigate('/vendor/signup');
            return;
        }
        // If already a vendor with profile, go to vendor dashboard
        if (role === 'vendor' && vendorProfile) {
            window.location.href = '/admin.html';
        }
        // If user is admin/superadmin, go to admin dashboard
        if (role === 'admin' || role === 'superadmin') {
            navigate('/');
        }
    }, [user, role, vendorProfile, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!businessName.trim()) {
            setError('Business name is required');
            return;
        }

        if (!phone.trim()) {
            setError('Phone number is required');
            return;
        }

        setLoading(true);
        try {
            await completeVendorOnboarding({
                businessName: businessName.trim(),
                phone: phone.trim(),
                address: address.trim()
            });
            // Redirect to vendor dashboard (admin.html)
            window.location.href = '/admin.html';
        } catch (error) {
            setError('Failed to complete registration');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">🏪</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">
                        Complete Your Profile
                    </h1>
                    <p className="text-slate-400">Tell us about your business</p>
                </div>

                {isDemoMode && (
                    <div className="bg-amber-900/30 border border-amber-600 text-amber-400 rounded-lg p-4 mb-6 text-sm">
                        ⚠️ Demo Mode - Data won't be saved
                    </div>
                )}

                {user.email && !user.emailVerified && (
                    <div className="bg-blue-900/30 border border-blue-600 text-blue-400 rounded-lg p-4 mb-6 text-sm">
                        📧 Please verify your email: {user.email}
                    </div>
                )}

                {error && (
                    <div className="bg-red-900/30 border border-red-600 text-red-400 rounded-lg p-4 mb-6 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Business Name *</label>
                        <input
                            type="text"
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                            placeholder="Your Business Name"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Phone Number *</label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                            placeholder="08012345678"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Business Address (optional)</label>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                            placeholder="123 Market Street, Lagos"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition disabled:opacity-50"
                    >
                        {loading ? 'Saving...' : 'Complete Registration'}
                    </button>
                </form>

                <p className="mt-6 text-center text-xs text-slate-500">
                    By completing registration, you agree to our Terms of Service and Privacy Policy.
                </p>
            </div>
        </div>
    );
}
