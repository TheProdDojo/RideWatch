import { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import { dbHelpers, isDemoMode, demoData } from '../services/firebase';

export default function Customers() {
    const [customers, setCustomers] = useState([]);

    useEffect(() => {
        if (isDemoMode()) {
            setCustomers(demoData.customers);
            return;
        }
        return dbHelpers.getCustomers(setCustomers);
    }, []);

    const columns = [
        { key: 'phone', label: 'Phone Number' },
        { key: 'orderCount', label: 'Orders', render: (v) => v || 0 },
        {
            key: 'firstSeen',
            label: 'First Seen',
            render: (v) => v ? new Date(v).toLocaleDateString() : '-'
        }
    ];

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">Customers</h1>
                <p className="text-slate-400">View platform customers</p>
            </div>

            <DataTable
                columns={columns}
                data={customers}
                emptyMessage="No customers yet"
            />
        </div>
    );
}
