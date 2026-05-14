import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, CheckCircle2 } from 'lucide-react';

const CustomDropdown = ({ options, value, onChange, placeholder, renderOption = null, inputStyle, disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt => 
        (opt.label || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedOption = options.find(opt => String(opt.value) === String(value));

    return (
        <div className="relative" ref={dropdownRef}>
            <div 
                onClick={() => { if (!disabled) { setIsOpen(!isOpen); setSearchTerm(''); } }} 
                className={`${inputStyle} flex justify-between items-center select-none ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'cursor-pointer hover:border-indigo-300'}`}
            >
                <span className={selectedOption ? "text-slate-800 font-bold text-sm truncate mr-2" : "text-slate-400 text-sm truncate mr-2"}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}/>
            </div>
            
            {isOpen && (
                <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[70] max-h-64 flex flex-col animate-in slide-in-from-top-2 fade-in duration-200">
                    <div className="p-2 border-b border-slate-50 shrink-0">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                autoFocus
                                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50 transition-all placeholder:text-slate-400"
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar p-1.5 flex-1 space-y-1">
                        {filteredOptions.length > 0 ? filteredOptions.map(opt => (
                            <div 
                                key={opt.value} 
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }} 
                                className={`p-3 rounded-xl cursor-pointer flex justify-between items-center transition-all ${String(value) === String(opt.value) ? 'bg-indigo-50 border border-indigo-100 shadow-sm' : 'hover:bg-slate-50 border border-transparent'}`}
                            >
                                {renderOption ? renderOption(opt) : <span className={`text-sm font-bold truncate mr-2 ${String(value) === String(opt.value) ? 'text-indigo-700' : 'text-slate-700'}`}>{opt.label}</span>}
                                {String(value) === String(opt.value) && <CheckCircle2 size={16} className="text-indigo-600 shrink-0"/>}
                            </div>
                        )) : (
                            <div className="p-6 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">No se encontraron resultados</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomDropdown;
