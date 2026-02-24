import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { verifyResetCode, confirmReset } from '../services/firebase';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const oobCode = searchParams.get('oobCode');

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState('verifying'); // verifying, ready, success, error, expired
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!oobCode) {
            setStatus('error');
            setError('Invalid or missing reset link.');
            return;
        }

        // Verify the code is valid
        verifyResetCode(oobCode)
            .then((userEmail) => {
                setEmail(userEmail);
                setStatus('ready');
            })
            .catch((err) => {
                console.error('Invalid reset code:', err);
                if (err.code === 'auth/expired-action-code') {
                    setStatus('expired');
                } else {
                    setStatus('error');
                    setError('This reset link is invalid or has already been used.');
                }
            });
    }, [oobCode]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            await confirmReset(oobCode, password);
            setStatus('success');
        } catch (err) {
            console.error('Reset failed:', err);
            if (err.code === 'auth/expired-action-code') {
                setStatus('expired');
            } else if (err.code === 'auth/weak-password') {
                setError('Password is too weak. Use at least 6 characters.');
            } else {
                setError('Failed to reset password. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-900 via-slate-900 to-slate-900 flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">
                        <span className="text-green-400">Ride</span>Watch
                    </h1>
                </div>

                {/* Verifying State */}
                {status === 'verifying' && (
                    <div className="text-center py-12">
                        <div className="inline-block w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-slate-400">Verifying your reset link...</p>
                    </div>
                )}

                {/* Ready - Show form */}
                {status === 'ready' && (
                    <>
                        <div className="text-center mb-6">
                            <div className="w-14 h-14 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-2xl">🔐</span>
                            </div>
                            <h2 className="text-xl font-semibold text-white mb-2">Set New Password</h2>
                            <p className="text-sm text-slate-400">
                                Enter a new password for <span className="text-slate-200 font-medium">{email}</span>
                            </p>
                        </div>

                        {error && (
                            <div className="bg-red-900/30 border border-red-600 text-red-400 rounded-lg p-4 mb-6 text-sm">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">New Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500 transition"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Confirm Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500 transition"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition disabled:opacity-50"
                            >
                                {loading ? 'Resetting...' : 'Reset Password'}
                            </button>
                        </form>
                    </>
                )}

                {/* Success */}
                {status === 'success' && (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">✅</span>
                        </div>
                        <h2 className="text-xl font-semibold text-white mb-2">Password Reset!</h2>
                        <p className="text-slate-400 mb-6">
                            Your password has been updated successfully. You can now sign in with your new password.
                        </p>
                        <Link
                            to="/vendor/login"
                            className="inline-block w-full py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition text-center"
                        >
                            Sign In
                        </Link>
                    </div>
                )}

                {/* Expired */}
                {status === 'expired' && (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 bg-amber-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">⏱</span>
                        </div>
                        <h2 className="text-xl font-semibold text-white mb-2">Link Expired</h2>
                        <p className="text-slate-400 mb-6">
                            This password reset link has expired. Please request a new one.
                        </p>
                        <Link
                            to="/vendor/login"
                            className="inline-block w-full py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition text-center"
                        >
                            Back to Login
                        </Link>
                    </div>
                )}

                {/* Generic Error */}
                {status === 'error' && (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">❌</span>
                        </div>
                        <h2 className="text-xl font-semibold text-white mb-2">Invalid Link</h2>
                        <p className="text-slate-400 mb-6">
                            {error || 'This reset link is invalid or has already been used.'}
                        </p>
                        <Link
                            to="/vendor/login"
                            className="inline-block w-full py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition text-center"
                        >
                            Back to Login
                        </Link>
                    </div>
                )}

                {/* Footer */}
                <p className="mt-6 text-center text-xs text-slate-600">
                    A product of{' '}
                    <a href="https://deproductdojo.com" target="_blank" rel="noopener noreferrer" className="text-green-500 hover:text-green-400">
                        The Product Dojo
                    </a>
                </p>
            </div>
        </div>
    );
}
