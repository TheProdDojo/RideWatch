import { useState, useCallback, createContext, useContext } from 'react';

/**
 * Reusable alert/confirm modals that replace native browser dialogs.
 * 
 * Usage:
 *   const { showAlert, showConfirm } = useModal();
 *   await showAlert('Something happened');
 *   const ok = await showConfirm('Are you sure?');
 */

const ModalContext = createContext(null);

export const useModal = () => {
    const context = useContext(ModalContext);
    if (!context) throw new Error('useModal must be used within ModalProvider');
    return context;
};

export const ModalProvider = ({ children }) => {
    const [modal, setModal] = useState(null);

    const showAlert = useCallback((message, { title = 'Notice', type = 'info' } = {}) => {
        return new Promise(resolve => {
            setModal({ type: 'alert', title, message, alertType: type, onClose: () => { setModal(null); resolve(); } });
        });
    }, []);

    const showConfirm = useCallback((message, { title = 'Confirm', confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = {}) => {
        return new Promise(resolve => {
            setModal({
                type: 'confirm', title, message, confirmText, cancelText, danger,
                onConfirm: () => { setModal(null); resolve(true); },
                onCancel: () => { setModal(null); resolve(false); }
            });
        });
    }, []);

    return (
        <ModalContext.Provider value={{ showAlert, showConfirm }}>
            {children}
            {modal && <ModalOverlay modal={modal} />}
        </ModalContext.Provider>
    );
};

function ModalOverlay({ modal }) {
    const iconMap = {
        info: { icon: 'ℹ️', color: 'blue' },
        success: { icon: '✅', color: 'green' },
        warning: { icon: '⚠️', color: 'amber' },
        error: { icon: '❌', color: 'red' },
    };

    const { icon, color } = iconMap[modal.alertType || 'info'] || iconMap.info;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-800 p-6 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-700 transform transition-all scale-100 mx-4">
                <div className="flex items-start gap-3 mb-4">
                    <div className={`w-10 h-10 shrink-0 rounded-xl bg-${color}-500/20 flex items-center justify-center text-xl`}>
                        {icon}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">{modal.title}</h3>
                        <p className="text-sm text-slate-300 mt-1 leading-relaxed">{modal.message}</p>
                    </div>
                </div>

                {modal.type === 'alert' && (
                    <button
                        onClick={modal.onClose}
                        className="w-full py-3 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600 transition"
                    >
                        OK
                    </button>
                )}

                {modal.type === 'confirm' && (
                    <div className="flex gap-3">
                        <button
                            onClick={modal.onCancel}
                            className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 font-medium hover:bg-slate-600 transition"
                        >
                            {modal.cancelText}
                        </button>
                        <button
                            onClick={modal.onConfirm}
                            className={`flex-1 py-3 rounded-xl font-medium transition shadow-lg ${modal.danger
                                    ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-900/20'
                                    : 'bg-green-600 text-white hover:bg-green-500 shadow-green-900/20'
                                }`}
                        >
                            {modal.confirmText}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
