// RideTrack - Firebase Configuration
// In production, set environment variables. For development, update values below.

// Check window for injected config (from Vite build or server)
const getEnv = (key, fallback) => {
    if (typeof window !== 'undefined' && window.__RIDETRACK_ENV__ && window.__RIDETRACK_ENV__[key]) {
        return window.__RIDETRACK_ENV__[key];
    }
    return fallback;
};

const firebaseConfig = {
    apiKey: "AIzaSyDjw4J6gYdobfGoKS_AZIYyzbuCxfnwF20",
    authDomain: "ridewatch-8291a.firebaseapp.com",
    databaseURL: "https://ridewatch-8291a-default-rtdb.firebaseio.com",
    projectId: "ridewatch-8291a",
    storageBucket: "ridewatch-8291a.firebasestorage.app",
    messagingSenderId: "381897266033",
    appId: "1:381897266033:web:8ecf8364f6d9fda0a75cd0",
    measurementId: "G-Y7PF0CH00W"
};

// Firebase will be initialized in each HTML file after loading the SDK
// This file provides shared config and helper functions

const FirebaseHelpers = {
    // Generate random 4-digit stop code
    generateStopCode: function () {
        return Math.floor(1000 + Math.random() * 9000).toString();
    },

    // Generate session ID
    generateSessionId: function () {
        return 'sess_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    },

    // Auth helpers (to be used after Firebase is initialized)
    signInWithGoogle: async function () {
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            const result = await firebase.auth().signInWithPopup(provider);
            return result.user;
        } catch (error) {
            console.error('Google Sign-In Error:', error);
            throw error;
        }
    },

    signOut: async function () {
        try {
            await firebase.auth().signOut();
        } catch (error) {
            console.error('Sign Out Error:', error);
            throw error;
        }
    },

    // Database helpers
    createSession: async function (sessionData, vendorUid = null) {
        const sessionId = this.generateSessionId();
        const stopCode = this.generateStopCode();

        const session = {
            ...sessionData,
            stopCode,
            status: 'pending',
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            expiresAt: Date.now() + (2 * 60 * 60 * 1000) // 2 hours
        };

        // If vendor is logged in, save under their UID
        if (vendorUid) {
            await firebase.database().ref(`vendors/${vendorUid}/sessions/${sessionId}`).set(session);
        }

        // Always save to global sessions for rider/customer access
        await firebase.database().ref(`sessions/${sessionId}`).set(session);

        return { sessionId, stopCode };
    },

    getSession: async function (sessionId) {
        const snapshot = await firebase.database().ref(`sessions/${sessionId}`).once('value');
        return snapshot.val();
    },

    updateSession: async function (sessionId, updates) {
        await firebase.database().ref(`sessions/${sessionId}`).update(updates);
    },

    pushLocation: async function (sessionId, locationData) {
        await firebase.database().ref(`locations/${sessionId}`).push(locationData);
    },

    subscribeToLocations: function (sessionId, callback) {
        const ref = firebase.database().ref(`locations/${sessionId}`);
        ref.on('child_added', (snapshot) => {
            callback(snapshot.val());
        });
        return () => ref.off('child_added');
    },

    subscribeToSession: function (sessionId, callback) {
        const ref = firebase.database().ref(`sessions/${sessionId}`);
        ref.on('value', (snapshot) => {
            callback(snapshot.val());
        });
        return () => ref.off('value');
    },

    validateStopCode: async function (sessionId, code) {
        const session = await this.getSession(sessionId);
        return session && session.stopCode === code;
    },

    registerCustomerPhone: async function (sessionId, phoneNumber) {
        await firebase.database().ref(`sessions/${sessionId}`).update({
            customerPhone: phoneNumber,
            customerRegisteredAt: firebase.database.ServerValue.TIMESTAMP
        });
    }
};

// Export for use
if (typeof window !== 'undefined') {
    window.firebaseConfig = firebaseConfig;
    window.FirebaseHelpers = FirebaseHelpers;
}
