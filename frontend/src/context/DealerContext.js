import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState } from 'react';
const DealerContext = createContext(null);
export function DealerProvider({ children }) {
    const [dealerId, setDealerId] = useState(null);
    return (_jsx(DealerContext.Provider, { value: { dealerId, setDealerId }, children: children }));
}
export function useDealer() {
    const ctx = useContext(DealerContext);
    if (!ctx)
        throw new Error('useDealer must be used within DealerProvider');
    return ctx;
}
