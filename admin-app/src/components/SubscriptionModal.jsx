import { useState } from 'react';
import { usePaystackPayment } from 'react-paystack';
import { dbHelpers } from '../services/firebase';
import { APP_CONSTANTS } from '../constants';

const SubscriptionModal = ({ isOpen, onClose, user, onSuccess }) => {
    if (!isOpen) return null;

    const [loading, setLoading] = useState(false);

    const config = {
        reference: (new Date()).getTime().toString(),
        email: user?.email,
        amount: APP_CONSTANTS.SUBSCRIPTION.PRO_PRICE_KOBO,
        publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
        metadata: {
            custom_fields: [
                {
                    display_name: "Vendor Code",
                    variable_name: "vendor_code",
                    value: user?.uid
                }
            ]
        }
    };

    const initializePayment = usePaystackPayment(config);

    const handleSuccess = async (reference) => {
        console.log("Paystack Success:", reference);
        setLoading(true);
        try {
            // Update vendor profile directly
            await dbHelpers.updateVendorProfile(user.uid, {
                planType: 'pro',
                subscriptionStatus: 'active',
                subscriptionDate: Date.now(),
                paystackReference: reference.reference
            });

            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Upgrade failed:", error);
            alert("Payment successful but profile update failed. Please screenshot this and contact support: " + (error.message || error));
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) onClose();
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-md w-full relative overflow-hidden">
                {/* Decorative Background */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600"></div>
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl"></div>

                <div className="text-center mb-8 relative z-10">
                    <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-900/20 transform rotate-3">
                        <span className="text-4xl">👑</span>
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-2">Upgrade to Pro</h2>
                    <p className="text-slate-400">Unlock the full power of RideWatch</p>
                </div>

                <div className="space-y-4 mb-8 relative z-10">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                        <span className="text-green-400 text-xl">∞</span>
                        <div className="text-left">
                            <h4 className="text-white font-medium">Unlimited Deliveries</h4>
                            <p className="text-xs text-slate-500">No more monthly caps</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                        <span className="text-green-400 text-xl">⚡</span>
                        <div className="text-left">
                            <h4 className="text-white font-medium">Simultaneous Tracking</h4>
                            <p className="text-xs text-slate-500">Track as many active rides as you need</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                        <span className="text-green-400 text-xl">🛡️</span>
                        <div className="text-left">
                            <h4 className="text-white font-medium">Priority Support</h4>
                            <p className="text-xs text-slate-500">Direct access to our team</p>
                        </div>
                    </div>
                </div>

                <div className="mb-8 text-center relative z-10">
                    <div className="text-3xl font-bold text-white">₦{APP_CONSTANTS.SUBSCRIPTION.PRO_PRICE_NAIRA.toLocaleString()}</div>
                    <div className="text-sm text-slate-500">per month</div>
                </div>

                <div className="space-y-3 relative z-10">
                    <button
                        onClick={() => {
                            if (!config.publicKey) {
                                alert("Paystack key is missing. Please check .env configuration.");
                                return;
                            }
                            initializePayment(handleSuccess, handleClose);
                        }}
                        disabled={loading}
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-white font-bold text-lg hover:shadow-lg hover:shadow-amber-900/20 transition transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Processing...
                            </>
                        ) : (
                            'Pay Now via Paystack'
                        )}
                    </button>
                    <button
                        onClick={handleClose}
                        disabled={loading}
                        className="w-full py-3 rounded-xl bg-transparent text-slate-400 hover:text-white transition"
                    >
                        Maybe Later
                    </button>
                </div>

                <div className="mt-6 flex justify-center opacity-50 grayscale hover:grayscale-0 transition duration-300">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/1/1f/Paystack.png" alt="Powered by Paystack" className="h-4" />
                </div>
            </div>
        </div>
    );
};

export default SubscriptionModal;
