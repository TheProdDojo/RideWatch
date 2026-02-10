import { useState, useEffect, useRef } from 'react';

export default function AddressAutocomplete({
    label,
    value,
    onChange,
    onUseMyLocation,
    placeholder,
    isLoadingLocation,
    className
}) {
    const [query, setQuery] = useState(value || '');
    const [suggestions, setSuggestions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Refs
    const wrapperRef = useRef(null);
    const skipFetch = useRef(false);

    // Update internal query when prop changes (e.g. from "Use My Location" or manual typing in parent)
    useEffect(() => {
        if (value !== query) {
            skipFetch.current = true;
            setQuery(value || '');
        }
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchSuggestions = async (input) => {
        // Don't search for short queries
        if (!input || input.length < 3) {
            setSuggestions([]);
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(input)}&addressdetails=1&limit=5&countrycodes=ng`,
                { headers: { 'User-Agent': 'RideWatch/1.0' } }
            );
            const data = await response.json();
            setSuggestions(data);
            setIsOpen(true);
        } catch (error) {
            console.error('Autocomplete error:', error);
        } finally {
            setLoading(false);
        }
    };

    // Debounce search
    useEffect(() => {
        // If we should skip this fetch (because it came from prop update or selection), reset flag and return
        if (skipFetch.current) {
            skipFetch.current = false;
            return;
        }

        const timer = setTimeout(() => {
            if (query) {
                fetchSuggestions(query);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [query]);

    const handleSelect = (suggestion) => {
        const address = suggestion.display_name;
        const lat = parseFloat(suggestion.lat);
        const lng = parseFloat(suggestion.lon);

        // Prevent immediate re-fetch
        skipFetch.current = true;

        setQuery(address);
        setSuggestions([]); // Clear suggestions
        setIsOpen(false);

        onChange({ address, lat, lng });
    };

    const handleInputChange = (e) => {
        const newVal = e.target.value;
        setQuery(newVal);
        // Also update parent with just text (lat/lng will be null until selection)
        onChange({ address: newVal, lat: null, lng: null });
    };

    return (
        <div className={`relative ${className} ${isOpen ? 'z-50' : 'z-20'}`} ref={wrapperRef}>
            <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-slate-400">{label}</label>
                {onUseMyLocation && (
                    <button
                        type="button"
                        onClick={onUseMyLocation}
                        disabled={isLoadingLocation}
                        className="text-xs text-green-400 hover:text-green-300 disabled:text-slate-500 transition-colors"
                    >
                        {isLoadingLocation ? '📍 Getting location...' : '📍 Use My Location'}
                    </button>
                )}
            </div>

            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={handleInputChange}
                    onFocus={() => {
                        // Re-open if we have suggestions or if query is long enough
                        if (suggestions.length > 0) setIsOpen(true);
                        else if (query.length >= 3) fetchSuggestions(query);
                    }}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500 placeholder-slate-500 transition-colors"
                    placeholder={placeholder}
                />

                {loading && (
                    <div className="absolute right-3 top-3.5">
                        <div className="animate-spin h-5 w-5 border-2 border-green-500 border-t-transparent rounded-full"></div>
                    </div>
                )}

                {isOpen && suggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                        {suggestions.map((suggestion) => (
                            <button
                                type="button"
                                key={suggestion.place_id}
                                onClick={() => handleSelect(suggestion)}
                                className="w-full text-left px-4 py-3 hover:bg-slate-700 hover:text-green-400 border-b border-slate-700/50 last:border-0 transition-colors flex items-start gap-3 group"
                            >
                                <span className="mt-1 text-slate-500 group-hover:text-green-500 transition-colors">📍</span>
                                <div>
                                    <div className="font-medium text-slate-200 group-hover:text-white text-sm">
                                        {suggestion.name || suggestion.address.road || suggestion.display_name.split(',')[0]}
                                    </div>
                                    <div className="text-xs text-slate-500 group-hover:text-slate-400 truncate max-w-[280px]">
                                        {suggestion.display_name}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
            {/* Attribution for OpenStreetMap */}
            {isOpen && suggestions.length > 0 && (
                <div className="text-[10px] text-slate-600 text-right mt-1 px-1">
                    Powered by OpenStreetMap
                </div>
            )}
        </div>
    );
}
