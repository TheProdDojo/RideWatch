import { useState, useEffect, useRef } from 'react';

export default function SearchableSelect({
    label,
    options,
    value,
    onChange,
    onSelect,
    placeholder,
    className
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [filteredOptions, setFilteredOptions] = useState([]);
    const wrapperRef = useRef(null);

    // Filter options based on input value
    useEffect(() => {
        if (!options) {
            setFilteredOptions([]);
            return;
        }

        // If the current value matches an option exactly, don't show it in dropdown (optional)
        // or just filter properly.
        const lowerValue = (value || '').toLowerCase();
        const filtered = options.filter(option =>
            option.label.toLowerCase().includes(lowerValue) ||
            (option.subLabel && option.subLabel.toLowerCase().includes(lowerValue))
        );
        setFilteredOptions(filtered);
    }, [value, options]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (option) => {
        onSelect(option);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className} z-30`} ref={wrapperRef}>
            {label && <label className="block text-sm text-slate-400 mb-2">{label}</label>}

            <div className="relative">
                <input
                    type="text"
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500 placeholder-slate-500 transition-colors"
                    placeholder={placeholder}
                />

                {isOpen && filteredOptions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                        {filteredOptions.map((option) => (
                            <button
                                type="button"
                                key={option.id}
                                onClick={() => handleSelect(option)}
                                className="w-full text-left px-4 py-3 hover:bg-slate-700 hover:text-green-400 border-b border-slate-700/50 last:border-0 transition-colors flex items-start gap-3 group"
                            >
                                <span className="mt-1 text-slate-500 group-hover:text-green-500 transition-colors">
                                    {option.icon || '👤'}
                                </span>
                                <div>
                                    <div className="font-medium text-slate-200 group-hover:text-white text-sm">
                                        {option.label}
                                    </div>
                                    {option.subLabel && (
                                        <div className="text-xs text-slate-500 group-hover:text-slate-400">
                                            {option.subLabel}
                                        </div>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
