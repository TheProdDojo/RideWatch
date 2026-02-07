import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function VendorSignup() {
    const { user, signUpWithEmail, signInWithGoogle, isDemoMode } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            // If user exists, check if they have completed onboarding
            navigate('/vendor/onboarding');
        }
    }, [user, navigate]);

    const handleEmailSignup = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            await signUpWithEmail(email, password);
            navigate('/vendor/onboarding');
        } catch (error) {
            if (error.code === 'auth/email-already-in-use') {
                setError('An account with this email already exists');
            } else if (error.code === 'auth/weak-password') {
                setError('Password is too weak');
            } else {
                setError(error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignup = async () => {
        setError('');
        try {
            await signInWithGoogle();
            navigate('/vendor/onboarding');
        } catch (error) {
            setError('Google sign-up failed');
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">
                        <span className="text-green-400">Ride</span>Track
                    </h1>
                    <p className="text-slate-400">Vendor Registration</p>
                </div>

                {isDemoMode && (
                    <div className="bg-amber-900/30 border border-amber-600 text-amber-400 rounded-lg p-4 mb-6 text-sm">
                        ⚠️ Demo Mode - Registration won't be saved
                    </div>
                )}

                {error && (
                    <div className="bg-red-900/30 border border-red-600 text-red-400 rounded-lg p-4 mb-6 text-sm">
                        {error}
                    </div>
                )}

                <button
                    onClick={handleGoogleSignup}
                    className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white text-slate-900 font-medium rounded-lg hover:bg-slate-100 transition mb-6"
                >
                    <img
                        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                        alt="Google"
                        className="w-5 h-5"
                    />
                    Sign up with Google
                </button>

                <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-600"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-slate-800 text-slate-400">or with email</span>
                    </div>
                </div>

                <form onSubmit={handleEmailSignup} className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                            placeholder="business@example.com"
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
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Confirm Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
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
                        {loading ? 'Creating Account...' : 'Create Account'}
                    </button>
                </form>

                <div className="mt-6 pt-6 border-t border-slate-700 text-center">
                    <p className="text-sm text-slate-400">
                        Already have an account?{' '}
                        <Link to="/login" className="text-green-400 hover:text-green-300">
                            Sign in →
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
