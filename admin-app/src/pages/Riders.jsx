import { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import Modal, { FormField, Input, Select, Button } from '../components/Modal';
import { dbHelpers, isDemoMode, demoData } from '../services/firebase';

export default function Riders() {
    const [riders, setRiders] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingRider, setEditingRider] = useState(null);
    const [formData, setFormData] = useState({ name: '', phone: '', vendorId: '', status: 'active' });

    useEffect(() => {
        if (isDemoMode()) {
            setRiders(demoData.riders);
            setVendors(demoData.vendors);
            return;
        }
        const unsubRiders = dbHelpers.getRiders(setRiders);
        const unsubVendors = dbHelpers.getVendors(setVendors);
        return () => {
            unsubRiders?.();
            unsubVendors?.();
        };
    }, []);

    const getVendorName = (vendorId) => {
        const vendor = vendors.find(v => v.id === vendorId);
        return vendor?.businessName || vendorId || '-';
    };

    const columns = [
        { key: 'name', label: 'Name' },
        { key: 'phone', label: 'Phone' },
        { key: 'vendorId', label: 'Vendor', render: (v) => getVendorName(v) },
        {
            key: 'status',
            label: 'Status',
            render: (value) => (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${value === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-300'
                    }`}>
                    {value}
                </span>
            )
        },
        { key: 'totalDeliveries', label: 'Deliveries', render: (v) => v || 0 }
    ];

    const handleCreate = () => {
        setEditingRider(null);
        setFormData({ name: '', phone: '', vendorId: vendors[0]?.id || '', status: 'active' });
        setModalOpen(true);
    };

    const handleEdit = (rider) => {
        setEditingRider(rider);
        setFormData({
            name: rider.name,
            phone: rider.phone,
            vendorId: rider.vendorId,
            status: rider.status
        });
        setModalOpen(true);
    };

    const handleDelete = async (rider) => {
        if (!confirm(`Delete ${rider.name}?`)) return;
        if (isDemoMode()) {
            setRiders(riders.filter(r => r.id !== rider.id));
            return;
        }
        await dbHelpers.deleteRider(rider.id);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isDemoMode()) {
            if (editingRider) {
                setRiders(riders.map(r => r.id === editingRider.id ? { ...r, ...formData } : r));
            } else {
                setRiders([...riders, { id: 'r' + Date.now(), ...formData, createdAt: Date.now(), totalDeliveries: 0 }]);
            }
            setModalOpen(false);
            return;
        }

        if (editingRider) {
            await dbHelpers.updateRider(editingRider.id, formData);
        } else {
            await dbHelpers.createRider(formData);
        }
        setModalOpen(false);
    };

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">Riders</h1>
                <p className="text-slate-400">Manage platform riders</p>
            </div>

            <DataTable
                columns={columns}
                data={riders}
                onCreate={handleCreate}
                createLabel="Add Rider"
                onEdit={handleEdit}
                onDelete={handleDelete}
                emptyMessage="No riders yet"
            />

            <Modal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editingRider ? 'Edit Rider' : 'Add Rider'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <FormField label="Name">
                        <Input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Chidi Okonkwo"
                            required
                        />
                    </FormField>
                    <FormField label="Phone">
                        <Input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="08012345678"
                            required
                        />
                    </FormField>
                    <FormField label="Vendor">
                        <Select
                            value={formData.vendorId}
                            onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                        >
                            <option value="">Select vendor...</option>
                            {vendors.map((v) => (
                                <option key={v.id} value={v.id}>{v.businessName}</option>
                            ))}
                        </Select>
                    </FormField>
                    <FormField label="Status">
                        <Select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </Select>
                    </FormField>
                    <div className="flex gap-3 pt-4">
                        <Button type="button" variant="secondary" onClick={() => setModalOpen(false)} className="flex-1">
                            Cancel
                        </Button>
                        <Button type="submit" className="flex-1">
                            {editingRider ? 'Update' : 'Create'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
