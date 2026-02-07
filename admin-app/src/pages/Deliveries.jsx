import { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import { dbHelpers, isDemoMode, demoData } from '../services/firebase';

export default function Deliveries() {
    const [sessions, setSessions] = useState([]);
    const [filter, setFilter] = useState('all');
    const [dateRange, setDateRange] = useState('week');

    useEffect(() => {
        if (isDemoMode()) {
            setSessions(demoData.sessions);
            return;
        }
        return dbHelpers.getSessions(setSessions);
    }, []);

    // Filter by status
    let filteredSessions = filter === 'all'
        ? sessions
        : sessions.filter(s => s.status === filter);

    // Filter by date range
    const now = Date.now();
    const ranges = {
        today: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
        all: Infinity
    };

    if (dateRange !== 'all') {
        filteredSessions = filteredSessions.filter(
            s => s.createdAt && (now - s.createdAt) < ranges[dateRange]
        );
    }

    // Export to CSV
    const exportCSV = () => {
        const headers = ['Order ID', 'Rider', 'Stop Code', 'Status', 'Created'];
        const rows = filteredSessions.map(s => [
            s.refId,
            s.riderName,
            s.stopCode,
            s.status,
            s.createdAt ? new Date(s.createdAt).toISOString() : ''
        ]);

        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ridetrack-deliveries-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const columns = [
        { key: 'refId', label: 'Order ID' },
        { key: 'riderName', label: 'Rider' },
        { key: 'stopCode', label: 'Stop Code', render: (v) => <span className="font-mono">{v}</span> },
        {
            key: 'status',
            label: 'Status',
            render: (value) => (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${value === 'active' ? 'bg-green-500/20 text-green-400' :
                    value === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                        value === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-slate-600 text-slate-300'
                    }`}>
                    {value}
                </span>
            )
        },
        {
            key: 'createdAt',
            label: 'Created',
            render: (v) => v ? new Date(v).toLocaleString() : '-'
        }
    ];

    return (
        <div className="p-8">
            <div className="mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Deliveries</h1>
                    <p className="text-slate-400">View all delivery sessions ({filteredSessions.length} results)</p>
                </div>
                <div className="flex flex-wrap gap-4">
                    {/* Date Range Filter */}
                    <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
                        {[
                            { key: 'today', label: 'Today' },
                            { key: 'week', label: '7 Days' },
                            { key: 'month', label: '30 Days' },
                            { key: 'all', label: 'All Time' }
                        ].map((r) => (
                            <button
                                key={r.key}
                                onClick={() => setDateRange(r.key)}
                                className={`px-3 py-1.5 rounded text-xs font-medium transition ${dateRange === r.key
                                    ? 'bg-slate-600 text-white'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>

                    {/* Status Filter */}
                    <div className="flex gap-2">
                        {['all', 'active', 'pending', 'completed'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === f
                                    ? 'bg-green-600 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                    }`}
                            >
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* Export Button */}
                    <button
                        onClick={exportCSV}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2"
                    >
                        <span>📥</span>
                        Export CSV
                    </button>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={filteredSessions}
                emptyMessage="No deliveries found for the selected filters"
            />
        </div>
    );
}
