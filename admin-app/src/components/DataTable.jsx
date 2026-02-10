import { useState } from 'react';

export default function DataTable({
    columns,
    data,
    onEdit,
    onDelete,
    onCreate,
    createLabel = 'Add New',
    emptyMessage = 'No data found'
}) {
    const [search, setSearch] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // 1. Search
    const filteredData = data.filter((row) =>
        columns.some((col) => {
            const value = row[col.key];
            return value?.toString().toLowerCase().includes(search.toLowerCase());
        })
    );

    // 2. Sort
    const sortedData = [...filteredData].sort((a, b) => {
        if (!sortConfig.key) return 0;

        const key = sortConfig.key;
        const aValue = a[key] || '';
        const bValue = b[key] || '';

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // 3. Paginate
    const totalPages = Math.ceil(sortedData.length / itemsPerPage);
    const paginatedData = sortedData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key) => {
        if (sortConfig.key !== key) return <span className="text-slate-600">↕</span>;
        return sortConfig.direction === 'asc' ? <span className="text-green-400">↑</span> : <span className="text-green-400">↓</span>;
    };

    return (
        <div className="space-y-4">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <input
                    type="text"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                    className="w-full sm:w-64 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                />

                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <select
                        value={itemsPerPage}
                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                        <option value={5}>5 per page</option>
                        <option value={10}>10 per page</option>
                        <option value={20}>20 per page</option>
                        <option value={50}>50 per page</option>
                    </select>

                    {onCreate && (
                        <button
                            onClick={onCreate}
                            className="whitespace-nowrap px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition flex items-center gap-2"
                        >
                            <span>+</span> {createLabel}
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-700/50">
                            <tr>
                                {columns.map((col) => (
                                    <th
                                        key={col.key}
                                        onClick={() => handleSort(col.key)}
                                        className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-700 transition user-select-none"
                                    >
                                        <div className="flex items-center gap-2">
                                            {col.label}
                                            {getSortIndicator(col.key)}
                                        </div>
                                    </th>
                                ))}
                                {(onEdit || onDelete) && (
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">
                                        Actions
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {paginatedData.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={columns.length + (onEdit || onDelete ? 1 : 0)}
                                        className="px-6 py-12 text-center text-slate-400"
                                    >
                                        {emptyMessage}
                                    </td>
                                </tr>
                            ) : (
                                paginatedData.map((row, index) => (
                                    <tr key={row.id || index} className="hover:bg-slate-700/30 transition">
                                        {columns.map((col) => (
                                            <td key={col.key} className="px-6 py-4 text-sm">
                                                {col.render ? col.render(row[col.key], row) : row[col.key]}
                                            </td>
                                        ))}
                                        {(onEdit || onDelete) && (
                                            <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                                                {onEdit && (
                                                    <button
                                                        onClick={() => onEdit(row)}
                                                        className="px-3 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded transition"
                                                    >
                                                        Edit
                                                    </button>
                                                )}
                                                {onDelete && (
                                                    <button
                                                        onClick={() => onDelete(row)}
                                                        className="px-3 py-1 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded transition"
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination Footer */}
            {sortedData.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
                    <div>
                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedData.length)} of {sortedData.length} records
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 bg-slate-700 border border-slate-600 rounded disabled:opacity-50 hover:bg-slate-600 transition"
                        >
                            Previous
                        </button>
                        <div className="px-3 py-1 bg-slate-800 border border-slate-600 rounded">
                            Page {currentPage} of {totalPages}
                        </div>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 bg-slate-700 border border-slate-600 rounded disabled:opacity-50 hover:bg-slate-600 transition"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
