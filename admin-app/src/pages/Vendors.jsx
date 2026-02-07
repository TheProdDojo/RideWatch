import { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import Modal, { FormField, Input, Select, Button } from '../components/Modal';
import { dbHelpers, isDemoMode, demoData } from '../services/firebase';

export default function Vendors() {
    const [vendors, setVendors] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingVendor, setEditingVendor] = useState(null);
    const [formData, setFormData] = useState({ displayName: '', email: '', status: 'active' });

    useEffect(() => {
        if (isDemoMode()) {
            setVendors(demoData.vendors);
            return;
        }
        return dbHelpers.getVendors(setVendors);
    }, []);

    const columns = [
        { key: 'displayName', label: 'Name' },
        { key: 'email', label: 'Email' },
        {
            key: 'status',
            label: 'Status',
            render: (value) => (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${value === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                    {value}
                </span>
            )
        },
        { key: 'sessionCount', label: 'Sessions', render: (v) => v || 0 },
        {
            key: 'createdAt',
            label: 'Created',
            render: (v) => v ? new Date(v).toLocaleDateString() : '-'
        }
    ];

    const handleCreate = () => {
        setEditingVendor(null);
        setFormData({ displayName: '', email: '', status: 'active' });
        setModalOpen(true);
    };

    const handleEdit = (vendor) => {
        setEditingVendor(vendor);
        setFormData({
            displayName: vendor.displayName,
            email: vendor.email,
            status: vendor.status
        });
        setModalOpen(true);
    };

    const handleDelete = async (vendor) => {
        if (!confirm(`Delete ${vendor.displayName}?`)) return;
        if (isDemoMode()) {
            setVendors(vendors.filter(v => v.id !== vendor.id));
            return;
        }
        await dbHelpers.deleteVendor(vendor.id);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isDemoMode()) {
            if (editingVendor) {
                setVendors(vendors.map(v => v.id === editingVendor.id ? { ...v, ...formData } : v));
            } else {
                setVendors([...vendors, { id: 'v' + Date.now(), ...formData, createdAt: Date.now(), sessionCount: 0 }]);
            }
            setModalOpen(false);
            return;
        }

        if (editingVendor) {
            await dbHelpers.updateVendor(editingVendor.id, formData);
        } else {
            await dbHelpers.createVendor(formData);
        }
        setModalOpen(false);
    };

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">Vendors</h1>
                <p className="text-slate-400">Manage platform vendors</p>
            </div>

            <DataTable
                columns={columns}
                data={vendors}
                onCreate={handleCreate}
                createLabel="Add Vendor"
                onEdit={handleEdit}
                onDelete={handleDelete}
                emptyMessage="No vendors yet"
            />

            <Modal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editingVendor ? 'Edit Vendor' : 'Add Vendor'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <FormField label="Display Name">
                        <Input
                            type="text"
                            value={formData.displayName}
                            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                            placeholder="QuickMeds Pharmacy"
                            required
                        />
                    </FormField>
                    <FormField label="Email">
                        <Input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="vendor@example.com"
                            required
                        />
                    </FormField>
                    <FormField label="Status">
                        <Select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        >
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                        </Select>
                    </FormField>
                    <div className="flex gap-3 pt-4">
                        <Button type="button" variant="secondary" onClick={() => setModalOpen(false)} className="flex-1">
                            Cancel
                        </Button>
                        <Button type="submit" className="flex-1">
                            {editingVendor ? 'Update' : 'Create'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
