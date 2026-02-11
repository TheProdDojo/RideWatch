const GUEST_SESSIONS_KEY = 'ridetrack_guest_sessions';

export function getGuestSessions() {
    try {
        const data = localStorage.getItem(GUEST_SESSIONS_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export function saveGuestSession(session) {
    try {
        const sessions = getGuestSessions();
        // Avoid duplicates if possible, though 'id' should be unique
        const exists = sessions.find(s => s.id === session.id);
        if (exists) return;

        sessions.unshift(session);
        localStorage.setItem(GUEST_SESSIONS_KEY, JSON.stringify(sessions.slice(0, 50))); // Keep last 50
    } catch (e) {
        console.error('Error saving guest session', e);
    }
}

export function clearGuestSessions() {
    localStorage.removeItem(GUEST_SESSIONS_KEY);
}
