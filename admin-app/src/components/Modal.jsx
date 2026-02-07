export default function Modal({ isOpen, onClose, title, children }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-white">{title}</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                {children}
            </div>
        </div>
    );
}

export function FormField({ label, children }) {
    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">{label}</label>
            {children}
        </div>
    );
}

export function Input({ ...props }) {
    return (
        <input
            {...props}
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
    );
}

export function Select({ children, ...props }) {
    return (
        <select
            {...props}
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
        >
            {children}
        </select>
    );
}

export function Button({ variant = 'primary', children, ...props }) {
    const variants = {
        primary: 'bg-green-600 hover:bg-green-700 text-white',
        secondary: 'bg-slate-600 hover:bg-slate-500 text-white',
        danger: 'bg-red-600 hover:bg-red-700 text-white'
    };

    return (
        <button
            {...props}
            className={`px-4 py-3 font-medium rounded-lg transition ${variants[variant]} ${props.className || ''}`}
        >
            {children}
        </button>
    );
}
