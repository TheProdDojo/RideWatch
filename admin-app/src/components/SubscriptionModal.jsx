import { useState, useEffect, useRef } from 'react';
import { usePaystackPayment } from 'react-paystack';
import { dbHelpers } from '../services/firebase';
import { APP_CONSTANTS } from '../constants';
import { useModal } from './ModalProvider';
import { ref, onValue } from 'firebase/database';
import { db } from '../services/firebase';

const SubscriptionModalContent = ({ onClose, user, onSuccess }) => {
    const { showAlert } = useModal();
    const [loading, setLoading] = useState(false);
    const closedRef = useRef(false);

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

    // Self-healing: listen for profile changes (webhook, admin override, etc.)
    // Only react to CHANGES — skip initial snapshot so we don't auto-close
    // when a cancelled-pro user opens the modal to re-subscribe
    useEffect(() => {
        if (!user?.uid) return;
        let isInitial = true;
        const vendorRef = ref(db, `vendors/${user.uid}`);
        const unsubscribe = onValue(vendorRef, (snapshot) => {
            if (isInitial) {
                isInitial = false;
                return; // Skip the initial snapshot
            }
            const profile = snapshot.val();
            if (profile?.planType === 'pro' && profile?.subscriptionStatus === 'active' && !closedRef.current) {
                closedRef.current = true;
                if (onSuccess) onSuccess();
                onClose();
            }
        });
        return () => unsubscribe();
    }, [user?.uid]);

    const handleSuccess = async (reference) => {
        console.log("Paystack Success:", reference);
        setLoading(true);

        try {
            // Write immediately for instant feedback (webhook verifies server-side as backup)
            await dbHelpers.updateVendorProfile(user.uid, {
                planType: 'pro',
                subscriptionStatus: 'active',
                subscriptionDate: Date.now(),
                subscriptionExpiresAt: Date.now() + (APP_CONSTANTS.SUBSCRIPTION.BILLING_CYCLE_DAYS * 24 * 60 * 60 * 1000),
                paystackReference: reference.reference
            });

            // The Firebase listener above will detect planType='pro' and auto-close
            // But just in case, close explicitly too
            if (!closedRef.current) {
                closedRef.current = true;
                if (onSuccess) onSuccess();
                onClose();
            }
        } catch (error) {
            console.error("Upgrade failed:", error);
            setLoading(false);
            await showAlert(
                "Payment successful but profile update failed. Please screenshot this and contact support: " + (error.message || error),
                { title: 'Update Failed', type: 'error' }
            );
        }
    };

    const handleClose = () => {
        if (!loading) onClose();
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-md w-full relative overflow-hidden mx-4">
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
                        onClick={async () => {
                            if (!config.publicKey) {
                                await showAlert("Paystack key is missing. Please check .env configuration.", { title: 'Configuration Error', type: 'error' });
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
                                Upgrading...
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

const SubscriptionModal = ({ isOpen, ...props }) => {
    if (!isOpen) return null;
    return <SubscriptionModalContent {...props} />;
};

export default SubscriptionModal;
