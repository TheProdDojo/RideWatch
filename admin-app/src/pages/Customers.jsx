import { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import { dbHelpers, isDemoMode, demoData } from '../services/firebase';

export default function Customers() {
    const [customers, setCustomers] = useState([]);
    const [vendors, setVendors] = useState([]);

    useEffect(() => {
        if (isDemoMode()) {
            setCustomers(demoData.customers);
            setVendors(demoData.vendors);
            return;
        }
        const unsubCustomers = dbHelpers.getCustomers(setCustomers);
        const unsubVendors = dbHelpers.getVendors(setVendors);
        return () => {
            unsubCustomers?.();
            unsubVendors?.();
        };
    }, []);

    const getVendorName = (vendorId) => {
        const vendor = vendors.find(v => v.id === vendorId);
        return vendor?.businessName || vendorId || '-';
    };

    const columns = [
        { key: 'name', label: 'Name', render: (v) => v || '-' },
        { key: 'phone', label: 'Phone Number' },
        { key: 'defaultAddress', label: 'Address', render: (v) => v || '-' },
        { key: 'vendorId', label: 'Vendor', render: (v) => getVendorName(v) },
        { key: 'orderCount', label: 'Orders', render: (v) => v || 0 },
        {
            key: 'createdAt',
            label: 'First Seen',
            render: (v, item) => {
                const date = v || item.firstSeen;
                return date ? new Date(date).toLocaleDateString() : '-';
            }
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
