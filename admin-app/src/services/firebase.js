// RideTrack Admin - Firebase Configuration
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signOut as firebaseSignOut,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink,
    sendPasswordResetEmail
} from 'firebase/auth';
import { getDatabase, ref, push, set, update, remove, onValue, get, query, orderByChild, equalTo } from 'firebase/database';

// Replace with your actual Firebase project credentials
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Super Admin email - this user has full platform access
const SUPER_ADMIN_EMAIL = 'info@deproductdojo.com';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();

// Auth helpers
export const signInWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        return result.user;
    } catch (error) {
        console.error('Google Sign-In Error:', error);
        throw error;
    }
};

export const signUpWithEmail = async (email, password) => {
    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(result.user);
        return result.user;
    } catch (error) {
        console.error('Email Sign-Up Error:', error);
        throw error;
    }
};

export const signInWithEmail = async (email, password) => {
    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        return result.user;
    } catch (error) {
        console.error('Email Sign-In Error:', error);
        throw error;
    }
};

export const resetPassword = async (email) => {
    try {
        await sendPasswordResetEmail(auth, email);
    } catch (error) {
        console.error('Password Reset Error:', error);
        throw error;
    }
};

// Magic Link auth for admin invites
const actionCodeSettings = {
    url: window.location.origin + '/complete-invite',
    handleCodeInApp: true
};

export const sendAdminInviteLink = async (email) => {
    try {
        await sendSignInLinkToEmail(auth, email, actionCodeSettings);
        // Store the email for later verification
        window.localStorage.setItem('emailForSignIn', email);
    } catch (error) {
        console.error('Send Invite Link Error:', error);
        throw error;
    }
};

export const completeInviteSignIn = async (email) => {
    try {
        if (isSignInWithEmailLink(auth, window.location.href)) {
            const result = await signInWithEmailLink(auth, email, window.location.href);
            window.localStorage.removeItem('emailForSignIn');
            return result.user;
        }
        throw new Error('Invalid sign-in link');
    } catch (error) {
        console.error('Complete Invite Sign-In Error:', error);
        throw error;
    }
};

export const isEmailLink = () => isSignInWithEmailLink(auth, window.location.href);

export const signOut = async () => {
    try {
        await firebaseSignOut(auth);
    } catch (error) {
        console.error('Sign Out Error:', error);
        throw error;
    }
};

// Database helpers
export const dbHelpers = {
    // Check if user is super admin
    isSuperAdmin: (email) => {
        return email === SUPER_ADMIN_EMAIL;
    },

    // Check if user is an admin (super admin or invited admin)
    checkIsAdmin: async (uid, email) => {
        // Super admin is always an admin
        if (email === SUPER_ADMIN_EMAIL) {
            return true;
        }
        // Check if in admins collection
        const adminRef = ref(db, `admins/${uid}`);
        const snapshot = await get(adminRef);
        return snapshot.exists();
    },

    // Get user role
    getUserRole: async (uid, email) => {
        if (email === SUPER_ADMIN_EMAIL) {
            return 'superadmin';
        }
        const adminRef = ref(db, `admins/${uid}`);
        const snapshot = await get(adminRef);
        if (snapshot.exists()) {
            return 'admin';
        }
        const vendorRef = ref(db, `vendors/${uid}`);
        const vendorSnapshot = await get(vendorRef);
        if (vendorSnapshot.exists()) {
            return 'vendor';
        }
        return null;
    },

    // Admin invites
    getAdminInvites: (callback) => {
        const invitesRef = ref(db, 'adminInvites');
        return onValue(invitesRef, (snapshot) => {
            const data = snapshot.val() || {};
            const invites = Object.entries(data).map(([id, invite]) => ({ id, ...invite }));
            callback(invites);
        });
    },

    createAdminInvite: async (email, invitedByUid) => {
        const invitesRef = ref(db, 'adminInvites');
        const newRef = push(invitesRef);
        await set(newRef, {
            email,
            invitedBy: invitedByUid,
            status: 'pending',
            createdAt: Date.now()
        });
        return newRef.key;
    },

    acceptAdminInvite: async (inviteId, uid, email, displayName) => {
        // Update invite status
        const inviteRef = ref(db, `adminInvites/${inviteId}`);
        await update(inviteRef, { status: 'accepted', acceptedAt: Date.now() });

        // Create admin record
        const adminRef = ref(db, `admins/${uid}`);
        await set(adminRef, {
            email,
            name: displayName || email,
            role: 'admin',
            inviteId,
            createdAt: Date.now()
        });
    },

    deleteAdminInvite: async (inviteId) => {
        const inviteRef = ref(db, `adminInvites/${inviteId}`);
        await remove(inviteRef);
    },

    getAdmins: (callback) => {
        const adminsRef = ref(db, 'admins');
        return onValue(adminsRef, (snapshot) => {
            const data = snapshot.val() || {};
            const admins = Object.entries(data).map(([id, admin]) => ({ id, ...admin }));
            callback(admins);
        });
    },

    removeAdmin: async (uid) => {
        const adminRef = ref(db, `admins/${uid}`);
        await remove(adminRef);
    },

    // Vendors
    getVendors: (callback) => {
        const vendorsRef = ref(db, 'vendors');
        return onValue(vendorsRef, (snapshot) => {
            const data = snapshot.val() || {};
            const vendors = Object.entries(data).map(([id, vendor]) => ({ id, ...vendor }));
            callback(vendors);
        });
    },

    createVendorProfile: async (uid, vendorData) => {
        const vendorRef = ref(db, `vendors/${uid}`);
        await set(vendorRef, {
            ...vendorData,
            status: 'approved', // Auto-approve as requested
            createdAt: Date.now()
        });
    },

    getVendorProfile: async (uid) => {
        const vendorRef = ref(db, `vendors/${uid}`);
        const snapshot = await get(vendorRef);
        return snapshot.val();
    },

    createVendor: async (vendorData) => {
        const vendorsRef = ref(db, 'vendors');
        const newRef = push(vendorsRef);
        await set(newRef, { ...vendorData, createdAt: Date.now(), status: 'active' });
        return newRef.key;
    },

    updateVendor: async (vendorId, updates) => {
        const vendorRef = ref(db, `vendors/${vendorId}`);
        await update(vendorRef, { ...updates, updatedAt: Date.now() });
    },

    deleteVendor: async (vendorId) => {
        const vendorRef = ref(db, `vendors/${vendorId}`);
        await remove(vendorRef);
    },

    // Riders
    getRiders: (callback) => {
        const ridersRef = ref(db, 'riders');
        return onValue(ridersRef, (snapshot) => {
            const data = snapshot.val() || {};
            const riders = Object.entries(data).map(([id, rider]) => ({ id, ...rider }));
            callback(riders);
        });
    },

    createRider: async (riderData) => {
        const ridersRef = ref(db, 'riders');
        const newRef = push(ridersRef);
        await set(newRef, { ...riderData, createdAt: Date.now(), status: 'active', totalDeliveries: 0 });
        return newRef.key;
    },

    updateRider: async (riderId, updates) => {
        const riderRef = ref(db, `riders/${riderId}`);
        await update(riderRef, { ...updates, updatedAt: Date.now() });
    },

    deleteRider: async (riderId) => {
        const riderRef = ref(db, `riders/${riderId}`);
        await remove(riderRef);
    },

    // Customers
    getCustomers: (callback) => {
        const customersRef = ref(db, 'customers');
        return onValue(customersRef, (snapshot) => {
            const data = snapshot.val() || {};
            const customers = Object.entries(data).map(([id, customer]) => ({ id, ...customer }));
            callback(customers);
        });
    },

    // Sessions/Deliveries
    getSessions: (callback) => {
        const sessionsRef = ref(db, 'sessions');
        return onValue(sessionsRef, (snapshot) => {
            const data = snapshot.val() || {};
            const sessions = Object.entries(data).map(([id, session]) => ({ id, ...session }));
            callback(sessions);
        });
    },

    updateSession: async (sessionId, updates) => {
        const sessionRef = ref(db, `sessions/${sessionId}`);
        await update(sessionRef, updates);
    },

    // Legacy admin check - kept for compatibility
    createAdmin: async (uid, email) => {
        const adminRef = ref(db, `admins/${uid}`);
        await set(adminRef, { email, role: 'admin', createdAt: Date.now() });
    }
};

// Demo data for when Firebase isn't configured
export const isDemoMode = () => firebaseConfig.apiKey === 'YOUR_API_KEY';

export const demoData = {
    vendors: [
        { id: 'v1', displayName: 'QuickMeds Pharmacy', email: 'quickmeds@example.com', status: 'active', createdAt: Date.now() - 86400000, sessionCount: 45 },
        { id: 'v2', displayName: 'Lagos Eats', email: 'lagoseats@example.com', status: 'active', createdAt: Date.now() - 172800000, sessionCount: 127 },
        { id: 'v3', displayName: 'FreshMart', email: 'freshmart@example.com', status: 'suspended', createdAt: Date.now() - 259200000, sessionCount: 8 }
    ],
    riders: [
        { id: 'r1', name: 'Chidi Okonkwo', phone: '08012345678', vendorId: 'v1', status: 'active', totalDeliveries: 156 },
        { id: 'r2', name: 'Emeka Nnamdi', phone: '08023456789', vendorId: 'v1', status: 'active', totalDeliveries: 89 },
        { id: 'r3', name: 'Tunde Adeyemi', phone: '08034567890', vendorId: 'v2', status: 'inactive', totalDeliveries: 234 }
    ],
    customers: [
        { id: 'c1', phone: '08045678901', firstSeen: Date.now() - 604800000, orderCount: 12 },
        { id: 'c2', phone: '08056789012', firstSeen: Date.now() - 432000000, orderCount: 5 },
        { id: 'c3', phone: '08067890123', firstSeen: Date.now() - 86400000, orderCount: 1 }
    ],
    sessions: [
        { id: 's1', refId: 'ORD-5521', vendorId: 'v1', riderName: 'Chidi', stopCode: '4829', status: 'completed', createdAt: Date.now() - 3600000 },
        { id: 's2', refId: 'ORD-5520', vendorId: 'v1', riderName: 'Emeka', stopCode: '7153', status: 'active', createdAt: Date.now() - 1800000 },
        { id: 's3', refId: 'ORD-5519', vendorId: 'v2', riderName: 'Tunde', stopCode: '2947', status: 'completed', createdAt: Date.now() - 7200000 }
    ]
};
