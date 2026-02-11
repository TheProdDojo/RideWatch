import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icons
const createRiderIcon = (status) => {
    const color = status === 'active' ? '#22c55e' : status === 'lost' ? '#ef4444' : '#f59e0b';
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="background: ${color}; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 16px;">🛵</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
    });
};

const createPickupIcon = () => L.divIcon({
    className: 'custom-marker',
    html: `<div style="background: #f97316; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 12px;">📦</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
});

const createDropoffIcon = () => L.divIcon({
    className: 'custom-marker',
    html: `<div style="background: #ef4444; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 12px;">📍</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
});

// Component to handle map bounds and focus
function MapLogic({ sessions, focusedSession }) {
    const map = useMap();

    useEffect(() => {
        if (!map) return;

        // 1. If a specific session is focused, ZOOM to the RIDER (or pickup)
        if (focusedSession && (focusedSession.lat || focusedSession.pickup?.lat)) {
            if (focusedSession.lat && focusedSession.lng) {
                map.flyTo([focusedSession.lat, focusedSession.lng], 16, { duration: 1.5 });
            } else if (focusedSession.pickup?.lat && focusedSession.pickup?.lng) {
                map.flyTo([focusedSession.pickup.lat, focusedSession.pickup.lng], 16, { duration: 1.5 });
            }
            return;
        }

        // 2. Otherwise, fit bounds to show ALL active sessions
        try {
            const bounds = L.latLngBounds();
            let hasPoints = false;

            sessions.forEach(session => {
                if (!session) return;
                if (session.lat && session.lng) { bounds.extend([session.lat, session.lng]); hasPoints = true; }
                if (session.pickup?.lat && session.pickup?.lng) { bounds.extend([session.pickup.lat, session.pickup.lng]); hasPoints = true; }
                if (session.dropoff?.lat && session.dropoff?.lng) { bounds.extend([session.dropoff.lat, session.dropoff.lng]); hasPoints = true; }
            });

            if (hasPoints && bounds.isValid()) {
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
            }
        } catch (error) {
            console.error('Error in MapLogic bounds calculation:', error);
        }
    }, [sessions, focusedSession, map]);

    return (
        <>
            {sessions.map(session => (
                <React.Fragment key={session.id}>
                    {/* Rider Marker */}
                    {session.lat && session.lng && (
                        <Marker position={[session.lat, session.lng]} icon={createRiderIcon(session.status)}>
                            <Popup>
                                <div className="text-slate-800">
                                    <strong>{session.riderName}</strong><br />
                                    🛵 Rider<br />
                                    Status: {session.status}
                                </div>
                            </Popup>
                        </Marker>
                    )}
                    {/* Pickup Marker */}
                    {session.pickup?.lat && session.pickup?.lng && (
                        <Marker position={[session.pickup.lat, session.pickup.lng]} icon={createPickupIcon()}>
                            <Popup>
                                <div className="text-slate-800">
                                    <strong>{session.riderName}</strong><br />
                                    📦 Pickup<br />
                                    {session.pickup.address}
                                </div>
                            </Popup>
                        </Marker>
                    )}
                    {/* Dropoff Marker */}
                    {session.dropoff?.lat && session.dropoff?.lng && (
                        <Marker position={[session.dropoff.lat, session.dropoff.lng]} icon={createDropoffIcon()}>
                            <Popup>
                                <div className="text-slate-800">
                                    <strong>{session.riderName}</strong><br />
                                    📍 Dropoff<br />
                                    {session.dropoff.address}
                                </div>
                            </Popup>
                        </Marker>
                    )}
                </React.Fragment>
            ))}
        </>
    );
}

export default function DashboardMap({ sessions, focusedSession }) {
    return (
        <div className="bg-slate-800 rounded-2xl overflow-hidden shadow-xl border border-slate-700 h-[600px] relative z-0">
            <MapContainer
                center={[6.5244, 3.3792]} // Default to Lagos
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <MapLogic sessions={sessions} focusedSession={focusedSession} />
            </MapContainer>

            {/* Map Controls Overlay */}
            <div className="absolute top-4 right-4 z-[400] bg-slate-800/90 text-white p-3 rounded-lg border border-slate-600 shadow-lg text-xs">
                <div className="font-bold mb-2">Map Legend</div>
                <div className="flex items-center gap-2 mb-1">
                    <span className="w-3 h-3 rounded-full border-2 border-white bg-green-500"></span> Rider (Active)
                </div>
                <div className="flex items-center gap-2 mb-1">
                    <span className="w-3 h-3 rounded-full border-2 border-white bg-amber-500"></span> Rider (Idle)
                </div>
                <div className="flex items-center gap-2 mb-1">
                    <span className="w-3 h-3 rounded-full border-2 border-white bg-orange-500"></span> Pickup
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full border-2 border-white bg-red-500"></span> Dropoff
                </div>
            </div>
        </div>
    );
}
