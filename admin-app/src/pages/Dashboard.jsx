import { useState, useEffect } from 'react';
import { dbHelpers, isDemoMode, demoData } from '../services/firebase';

// Simple bar chart component using CSS
function BarChart({ data, title }) {
    const maxValue = Math.max(...data.map(d => d.value), 1);

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h3 className="text-lg font-semibold mb-4">{title}</h3>
            <div className="flex items-end justify-between gap-2 h-40">
                {data.map((item, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2">
                        <div
                            className="w-full bg-gradient-to-t from-green-600 to-green-400 rounded-t transition-all duration-500"
                            style={{ height: `${(item.value / maxValue) * 100}%`, minHeight: item.value > 0 ? '8px' : '0' }}
                        />
                        <span className="text-xs text-slate-400">{item.label}</span>
                        <span className="text-xs font-medium text-white">{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Simple donut chart using CSS
function DonutChart({ data, title }) {
    const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
    let cumulativePercent = 0;
    const colors = ['#22c55e', '#f59e0b', '#3b82f6', '#a855f7', '#ef4444'];

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h3 className="text-lg font-semibold mb-4">{title}</h3>
            <div className="flex items-center gap-6">
                <div className="relative w-32 h-32">
                    <svg viewBox="0 0 36 36" className="w-full h-full">
                        {data.map((item, index) => {
                            const percent = (item.value / total) * 100;
                            const dashArray = `${percent} ${100 - percent}`;
                            const rotation = cumulativePercent * 3.6 - 90;
                            cumulativePercent += percent;

                            return (
                                <circle
                                    key={index}
                                    cx="18"
                                    cy="18"
                                    r="15.5"
                                    fill="none"
                                    stroke={colors[index % colors.length]}
                                    strokeWidth="5"
                                    strokeDasharray={dashArray}
                                    strokeDashoffset="25"
                                    style={{ transform: `rotate(${rotation}deg)`, transformOrigin: 'center' }}
                                />
                            );
                        })}
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold">{total}</span>
                    </div>
                </div>
                <div className="flex-1 space-y-2">
                    {data.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: colors[index % colors.length] }}
                            />
                            <span className="text-slate-400">{item.label}</span>
                            <span className="font-medium ml-auto">{item.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function Dashboard() {
    const [stats, setStats] = useState({
        vendors: 0,
        riders: 0,
        customers: 0,
        activeSessions: 0,
        completedToday: 0
    });
    const [recentSessions, setRecentSessions] = useState([]);
    const [dailyDeliveries, setDailyDeliveries] = useState([]);
    const [statusDistribution, setStatusDistribution] = useState([]);

    useEffect(() => {
        if (isDemoMode()) {
            setStats({
                vendors: demoData.vendors.length,
                riders: demoData.riders.length,
                customers: demoData.customers.length,
                activeSessions: demoData.sessions.filter(s => s.status === 'active').length,
                completedToday: demoData.sessions.filter(s => s.status === 'completed').length
            });
            setRecentSessions(demoData.sessions.slice(0, 5));

            // Mock daily data
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            setDailyDeliveries(days.map(label => ({
                label,
                value: Math.floor(Math.random() * 20) + 5
            })));

            setStatusDistribution([
                { label: 'Completed', value: 45 },
                { label: 'Active', value: 12 },
                { label: 'Pending', value: 8 }
            ]);
            return;
        }

        // Real Firebase subscriptions
        const unsubVendors = dbHelpers.getVendors(v => setStats(s => ({ ...s, vendors: v.length })));
        const unsubRiders = dbHelpers.getRiders(r => setStats(s => ({ ...s, riders: r.length })));
        const unsubCustomers = dbHelpers.getCustomers(c => setStats(s => ({ ...s, customers: c.length })));
        const unsubSessions = dbHelpers.getSessions(sessions => {
            setStats(s => ({
                ...s,
                activeSessions: sessions.filter(x => x.status === 'active').length,
                completedToday: sessions.filter(x => x.status === 'completed').length
            }));
            setRecentSessions(sessions.slice(-5).reverse());

            // Calculate status distribution
            const active = sessions.filter(x => x.status === 'active').length;
            const completed = sessions.filter(x => x.status === 'completed').length;
            const pending = sessions.filter(x => x.status === 'pending').length;
            setStatusDistribution([
                { label: 'Completed', value: completed },
                { label: 'Active', value: active },
                { label: 'Pending', value: pending }
            ]);
        });

        return () => {
            unsubVendors?.();
            unsubRiders?.();
            unsubCustomers?.();
            unsubSessions?.();
        };
    }, []);

    const statCards = [
        { label: 'Total Vendors', value: stats.vendors, icon: '🏪', color: 'from-blue-500 to-blue-600' },
        { label: 'Total Riders', value: stats.riders, icon: '🛵', color: 'from-green-500 to-green-600' },
        { label: 'Total Customers', value: stats.customers, icon: '👤', color: 'from-purple-500 to-purple-600' },
        { label: 'Active Deliveries', value: stats.activeSessions, icon: '📍', color: 'from-amber-500 to-amber-600' },
        { label: 'Completed Today', value: stats.completedToday, icon: '✅', color: 'from-emerald-500 to-emerald-600' }
    ];

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                <p className="text-slate-400">Welcome to RideWatch Admin</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                {statCards.map((stat) => (
                    <div
                        key={stat.label}
                        className={`bg-gradient-to-br ${stat.color} rounded-xl p-6 text-white`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-3xl">{stat.icon}</span>
                            <span className="text-3xl font-bold">{stat.value}</span>
                        </div>
                        <div className="text-sm opacity-90">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <BarChart data={dailyDeliveries} title="📊 This Week's Deliveries" />
                <DonutChart data={statusDistribution} title="📈 Delivery Status" />
            </div>

            {/* Recent Activity */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h2 className="text-lg font-semibold mb-4">Recent Deliveries</h2>
                <div className="space-y-3">
                    {recentSessions.length === 0 ? (
                        <p className="text-slate-400 text-center py-4">No recent activity</p>
                    ) : (
                        recentSessions.map((session) => (
                            <div
                                key={session.id}
                                className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg"
                            >
                                <div className="flex items-center gap-4">
                                    <span className="text-2xl">
                                        {session.status === 'active' ? '🛵' : '✅'}
                                    </span>
                                    <div>
                                        <div className="font-medium">{session.refId}</div>
                                        <div className="text-sm text-slate-400">Rider: {session.riderName}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span
                                        className={`px-2 py-1 rounded-full text-xs font-medium ${session.status === 'active'
                                            ? 'bg-green-500/20 text-green-400'
                                            : 'bg-slate-600 text-slate-300'
                                            }`}
                                    >
                                        {session.status}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
