import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dbHelpers, sendAdminInviteLink } from '../services/firebase';
import { useNavigate } from 'react-router-dom';

export default function AdminManagement() {
    const { user, isSuperAdmin, isDemoMode } = useAuth();
    const navigate = useNavigate();
    const [admins, setAdmins] = useState([]);
    const [invites, setInvites] = useState([]);
    const [newEmail, setNewEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        // Only super admin can access this page
        if (!isSuperAdmin && !isDemoMode) {
            navigate('/');
            return;
        }

        if (isDemoMode) {
            setAdmins([
                { id: 'a1', email: 'admin1@example.com', name: 'Admin One', createdAt: Date.now() - 86400000 },
                { id: 'a2', email: 'admin2@example.com', name: 'Admin Two', createdAt: Date.now() - 172800000 }
            ]);
            setInvites([
                { id: 'i1', email: 'pending@example.com', status: 'pending', createdAt: Date.now() - 3600000 }
            ]);
            return;
        }

        const unsubAdmins = dbHelpers.getAdmins(setAdmins);
        const unsubInvites = dbHelpers.getAdminInvites(setInvites);

        return () => {
            unsubAdmins();
            unsubInvites();
        };
    }, [isSuperAdmin, isDemoMode, navigate]);

    const handleInvite = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (!newEmail.trim()) return;

        // Check if already an admin
        if (admins.some(a => a.email === newEmail)) {
            setError('This email is already an admin');
            return;
        }

        // Check if invite already exists
        if (invites.some(i => i.email === newEmail && i.status === 'pending')) {
            setError('An invite is already pending for this email');
            return;
        }

        setLoading(true);
        try {
            if (!isDemoMode) {
                // Create invite record
                await dbHelpers.createAdminInvite(newEmail, user.uid);
                // Send magic link
                await sendAdminInviteLink(newEmail);
            }
            setMessage(`Invite sent to ${newEmail}`);
            setNewEmail('');
        } catch (error) {
            setError('Failed to send invite');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveAdmin = async (adminId) => {
        if (!confirm('Are you sure you want to remove this admin?')) return;

        try {
            if (!isDemoMode) {
                await dbHelpers.removeAdmin(adminId);
            }
            setAdmins(admins.filter(a => a.id !== adminId));
        } catch (error) {
            setError('Failed to remove admin');
        }
    };

    const handleDeleteInvite = async (inviteId) => {
        try {
            if (!isDemoMode) {
                await dbHelpers.deleteAdminInvite(inviteId);
            }
            setInvites(invites.filter(i => i.id !== inviteId));
        } catch (error) {
            setError('Failed to delete invite');
        }
    };

    const formatDate = (timestamp) => {
        return new Date(timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white mb-2">Admin Management</h1>
                <p className="text-slate-400">Invite and manage platform administrators</p>
            </div>

            {/* Invite Form */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">
                    📧 Invite New Admin
                </h2>

                {message && (
                    <div className="bg-green-900/30 border border-green-600 text-green-400 rounded-lg p-3 mb-4 text-sm">
                        ✓ {message}
                    </div>
                )}

                {error && (
                    <div className="bg-red-900/30 border border-red-600 text-red-400 rounded-lg p-3 mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleInvite} className="flex gap-3">
                    <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="admin@example.com"
                        className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                        required
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition disabled:opacity-50"
                    >
                        {loading ? 'Sending...' : 'Send Invite'}
                    </button>
                </form>
                <p className="mt-3 text-sm text-slate-500">
                    The invitee will receive a magic link to sign in and become an admin.
                </p>
            </div>

            {/* Pending Invites */}
            {invites.filter(i => i.status === 'pending').length > 0 && (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">
                        ⏳ Pending Invites
                    </h2>
                    <div className="space-y-3">
                        {invites.filter(i => i.status === 'pending').map((invite) => (
                            <div
                                key={invite.id}
                                className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                            >
                                <div>
                                    <p className="text-white">{invite.email}</p>
                                    <p className="text-xs text-slate-400">
                                        Invited {formatDate(invite.createdAt)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleDeleteInvite(invite.id)}
                                    className="px-3 py-1 text-sm text-red-400 hover:bg-red-900/30 rounded transition"
                                >
                                    Cancel
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Current Admins */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">
                    👥 Current Admins
                </h2>

                {/* Super Admin (you) */}
                <div className="flex items-center justify-between p-3 bg-green-900/20 border border-green-800 rounded-lg mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                            👑
                        </div>
                        <div>
                            <p className="text-white font-medium">{user?.displayName || 'Super Admin'}</p>
                            <p className="text-xs text-green-400">{user?.email} • Super Admin</p>
                        </div>
                    </div>
                </div>

                {admins.length === 0 ? (
                    <p className="text-slate-400 text-center py-6">
                        No other admins yet. Send an invite above!
                    </p>
                ) : (
                    <div className="space-y-3">
                        {admins.map((admin) => (
                            <div
                                key={admin.id}
                                className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center text-white font-bold">
                                        {admin.name?.charAt(0) || admin.email?.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-white">{admin.name || admin.email}</p>
                                        <p className="text-xs text-slate-400">
                                            {admin.email} • Joined {formatDate(admin.createdAt)}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleRemoveAdmin(admin.id)}
                                    className="px-3 py-1 text-sm text-red-400 hover:bg-red-900/30 rounded transition"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
