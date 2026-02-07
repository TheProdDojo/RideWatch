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

    const filteredData = data.filter((row) =>
        columns.some((col) => {
            const value = row[col.key];
            return value?.toString().toLowerCase().includes(search.toLowerCase());
        })
    );

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <input
                    type="text"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                {onCreate && (
                    <button
                        onClick={onCreate}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition flex items-center gap-2"
                    >
                        <span>+</span> {createLabel}
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-700/50">
                        <tr>
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider"
                                >
                                    {col.label}
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
                        {filteredData.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={columns.length + (onEdit || onDelete ? 1 : 0)}
                                    className="px-6 py-12 text-center text-slate-400"
                                >
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            filteredData.map((row) => (
                                <tr key={row.id} className="hover:bg-slate-700/30 transition">
                                    {columns.map((col) => (
                                        <td key={col.key} className="px-6 py-4 text-sm">
                                            {col.render ? col.render(row[col.key], row) : row[col.key]}
                                        </td>
                                    ))}
                                    {(onEdit || onDelete) && (
                                        <td className="px-6 py-4 text-right space-x-2">
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

            <div className="text-sm text-slate-400">
                Showing {filteredData.length} of {data.length} records
            </div>
        </div>
    );
}
