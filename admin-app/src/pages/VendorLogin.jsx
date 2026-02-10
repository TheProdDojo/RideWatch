import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function VendorLogin() {
    const { user, signInWithEmail, signInWithGoogle, resetPassword, role, isDemoMode } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState('login'); // 'login' or 'forgot'

    useEffect(() => {
        if (user && role === 'vendor') {
            navigate('/vendor');
        }
    }, [user, role, navigate]);

    const handleEmailLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await signInWithEmail(email, password);
            // Role check will happen in useEffect
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                setError('No account found with this email');
            } else if (error.code === 'auth/wrong-password') {
                setError('Incorrect password');
            } else {
                setError('Login failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError('');
        try {
            await signInWithGoogle();
        } catch (error) {
            setError('Google sign-in failed');
        }
    };

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);
        try {
            await resetPassword(email);
            setMessage('Password reset link sent! Check your email.');
        } catch (error) {
            setError('Failed to send reset email. ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-900 via-slate-900 to-slate-900 flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 w-full max-w-md relative">
                <Link to="/vendor" className="absolute top-6 left-6 text-slate-400 hover:text-white transition">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                </Link>
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">
                        <span className="text-green-400">Ride</span>Watch
                    </h1>
                    <p className="text-slate-400">Vendor Portal</p>
                </div>

                {isDemoMode && (
                    <div className="bg-amber-900/30 border border-amber-600 text-amber-400 rounded-lg p-4 mb-6 text-sm">
                        ⚠️ Demo Mode - Firebase not configured
                    </div>
                )}

                {error && (
                    <div className="bg-red-900/30 border border-red-600 text-red-400 rounded-lg p-4 mb-6 text-sm">
                        {error}
                    </div>
                )}

                {message && (
                    <div className="bg-green-900/30 border border-green-600 text-green-400 rounded-lg p-4 mb-6 text-sm">
                        {message}
                    </div>
                )}

                {mode === 'login' ? (
                    <>
                        {/* Google Sign-In */}
                        <button
                            onClick={handleGoogleLogin}
                            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white text-slate-900 font-medium rounded-lg hover:bg-slate-100 transition mb-6"
                        >
                            <img
                                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                                alt="Google"
                                className="w-5 h-5"
                            />
                            Sign in with Google
                        </button>

                        <div className="relative mb-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-600"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-4 bg-slate-800 text-slate-400">or with email</span>
                            </div>
                        </div>

                        <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                                    placeholder="vendor@example.com"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition disabled:opacity-50"
                            >
                                {loading ? 'Signing in...' : 'Sign In'}
                            </button>
                        </form>

                        <div className="text-center">
                            <button
                                onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}
                                className="text-sm text-slate-400 hover:text-green-400 transition"
                            >
                                Forgot password?
                            </button>
                        </div>
                    </>
                ) : (
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                        <p className="text-slate-400 text-sm mb-4">
                            Enter your email and we'll send you a reset link.
                        </p>
                        <div>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                                placeholder="vendor@example.com"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition"
                        >
                            Send Reset Link
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('login')}
                            className="w-full py-2 text-sm text-slate-400 hover:text-white transition"
                        >
                            ← Back to login
                        </button>
                    </form>
                )}

                <div className="mt-6 pt-6 border-t border-slate-700 text-center">
                    <p className="text-sm text-slate-400">
                        Don't have an account?{' '}
                        <Link to="/vendor/signup" className="text-green-400 hover:text-green-300">
                            Sign up here →
                        </Link>
                    </p>
                </div>

                <p className="mt-4 text-center text-xs text-slate-600">
                    A product of{' '}
                    <a href="https://theproductdojo.com" target="_blank" rel="noopener noreferrer" className="text-green-500 hover:text-green-400">
                        The Product Dojo
                    </a>
                </p>
            </div>
        </div>
    );
}
