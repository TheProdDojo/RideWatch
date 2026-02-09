import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Layout({ isVendorView = false }) {
    const { user, signOut, isDemoMode, isSuperAdmin, role, vendorProfile } = useAuth();
    const navigate = useNavigate();

    // Different nav items for vendors vs admins
    const vendorNavItems = [
        { path: '/vendor', label: 'Command Center', icon: '🎯' }
    ];

    const adminNavItems = [
        { path: '/', label: 'Dashboard', icon: '📊' },
        { path: '/vendors', label: 'Vendors', icon: '🏪' },
        { path: '/riders', label: 'Riders', icon: '🛵' },
        { path: '/customers', label: 'Customers', icon: '👤' },
        { path: '/deliveries', label: 'Deliveries', icon: '📦' }
    ];

    // Add admin management for super admin
    if (isSuperAdmin || isDemoMode) {
        adminNavItems.push({ path: '/admin-management', label: 'Admin Management', icon: '👑' });
    }

    const navItems = isVendorView ? vendorNavItems : adminNavItems;

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const getRoleBadge = () => {
        if (isSuperAdmin || (isDemoMode && role === 'superadmin')) {
            return <span className="text-xs bg-yellow-600 text-white px-2 py-0.5 rounded">Super Admin</span>;
        }
        if (role === 'admin') {
            return <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">Admin</span>;
        }
        if (role === 'vendor') {
            return <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">Vendor</span>;
        }
        return null;
    };

    const displayName = isVendorView && vendorProfile?.businessName
        ? vendorProfile.businessName
        : user?.displayName || user?.email?.split('@')[0] || 'User';

    return (
        <div className="min-h-screen bg-slate-900 text-white flex">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
                {/* Logo */}
                <div className="p-6 border-b border-slate-700">
                    <h1 className="text-xl font-bold">
                        <span className="text-green-400">Ride</span>Track
                        <span className="text-xs ml-2 text-slate-400">
                            {isVendorView ? 'Vendor' : 'Admin'}
                        </span>
                    </h1>
                </div>

                {/* Nav */}
                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/' || item.path === '/vendor'}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${isActive
                                    ? 'bg-green-600 text-white'
                                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                                }`
                            }
                        >
                            <span className="text-lg">{item.icon}</span>
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                {/* User */}
                <div className="p-4 border-t border-slate-700">
                    <div className="flex items-center gap-3 mb-3">
                        {user?.photoURL ? (
                            <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center font-bold">
                                {displayName[0]?.toUpperCase() || 'U'}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{displayName}</div>
                            <div className="text-xs text-slate-400 truncate">{user?.email}</div>
                        </div>
                    </div>
                    <div className="flex gap-2 mb-2">
                        {getRoleBadge()}
                        {isDemoMode && (
                            <span className="text-xs bg-amber-600 text-white px-2 py-0.5 rounded">Demo</span>
                        )}
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="w-full px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition"
                    >
                        Sign Out
                    </button>
                </div>

                {/* Footer Branding */}
                <div className="p-4 border-t border-slate-700 text-center">
                    <p className="text-xs text-slate-500">
                        A product of{' '}
                        <a
                            href="https://theproductdojo.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-400 hover:text-green-300 transition"
                        >
                            The Product Dojo
                        </a>
                    </p>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto p-8">
                <Outlet />
            </main>
        </div>
    );
}

