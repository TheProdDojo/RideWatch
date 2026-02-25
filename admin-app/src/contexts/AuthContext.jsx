import { createContext, useContext, useState, useEffect } from 'react';
import {
    auth,
    signInWithGoogle as googleSignIn,
    signInWithEmail as emailSignIn,
    signUpWithEmail as emailSignUp,
    resetPassword as firebaseResetPassword,
    signOut as firebaseSignOut,
    dbHelpers,
    isDemoMode
} from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState(null); // 'superadmin', 'admin', 'vendor', or null
    const [vendorProfile, setVendorProfile] = useState(null);

    useEffect(() => {
        if (isDemoMode()) {
            // Demo mode: auto-login as super admin
            setUser({ uid: 'demo', email: 'info@deproductdojo.com', displayName: 'Demo Super Admin' });
            setRole('superadmin');
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const userRole = await dbHelpers.getUserRole(firebaseUser.uid, firebaseUser.email);
                setRole(userRole);

                // If vendor OR admin, ensure state is ready for the effect to pick up
                if (userRole === 'vendor' || userRole === 'admin' || userRole === 'superadmin') {
                    // Effect will handle the listener
                }

                setUser({
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    displayName: firebaseUser.displayName,
                    photoURL: firebaseUser.photoURL,
                    emailVerified: firebaseUser.emailVerified
                });
            } else {
                setUser(null);
                setRole(null);
                setVendorProfile(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    // Separate effect for vendor profile listening to handle cleanup properly
    useEffect(() => {
        let unsubscribeProfile = null;

        if (user && (role === 'vendor' || role === 'admin' || role === 'superadmin') && !isDemoMode()) {
            unsubscribeProfile = dbHelpers.listenToVendorProfile(user.uid, (profile) => {
                setVendorProfile(profile);
            });
        }

        return () => {
            if (unsubscribeProfile) unsubscribeProfile();
        };
    }, [user, role]);

    const signInWithGoogle = async () => {
        if (isDemoMode()) {
            setUser({ uid: 'demo', email: 'info@deproductdojo.com', displayName: 'Demo Super Admin' });
            setRole('superadmin');
            return;
        }
        return await googleSignIn();
    };

    const signInWithEmail = async (email, password) => {
        if (isDemoMode()) {
            setUser({ uid: 'demo', email: 'info@deproductdojo.com', displayName: 'Demo Super Admin' });
            setRole('superadmin');
            return;
        }
        return await emailSignIn(email, password);
    };

    const signUpWithEmail = async (email, password) => {
        return await emailSignUp(email, password);
    };

    const resetPassword = async (email) => {
        return await firebaseResetPassword(email);
    };

    const signOut = async () => {
        if (isDemoMode()) {
            setUser(null);
            setRole(null);
            return;
        }
        await firebaseSignOut();
    };

    // Create vendor profile after signup — includes 7-day free trial
    const completeVendorOnboarding = async (vendorData) => {
        if (!user) throw new Error('Must be logged in');
        const TRIAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
        const now = Date.now();
        await dbHelpers.createVendorProfile(user.uid, {
            ...vendorData,
            email: user.email,
            planType: 'trial',
            subscriptionStatus: 'trialing',
            trialStartedAt: now,
            trialExpiresAt: now + TRIAL_MS
        });
        const profile = await dbHelpers.getVendorProfile(user.uid);
        setVendorProfile(profile);
        setRole('vendor');
    };

    const value = {
        user,
        role,
        vendorProfile,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        signOut,
        completeVendorOnboarding,
        isDemoMode: isDemoMode(),
        isSuperAdmin: role === 'superadmin',
        isAdmin: role === 'superadmin' || role === 'admin',
        isVendor: role === 'vendor'
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
