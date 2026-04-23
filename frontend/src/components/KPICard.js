import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
function formatValue(value) {
    if (typeof value === 'number') {
        if (Math.abs(value) >= 1000) {
            return value.toLocaleString();
        }
        return String(value);
    }
    return value;
}
export default function KPICard({ icon: Icon, label, value, trend, iconColor = 'text-blue-500' }) {
    const trendUp = trend !== undefined && trend > 0;
    const trendDown = trend !== undefined && trend < 0;
    const trendNeutral = trend !== undefined && trend === 0;
    return (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5", style: { boxShadow: 'var(--card-shadow)' }, children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-slate-500 text-sm font-medium", children: label }), _jsx("p", { className: "text-slate-900 text-2xl font-bold mt-1", children: formatValue(value) })] }), _jsx("div", { className: `p-2.5 rounded-lg bg-slate-100 ${iconColor}`, children: _jsx(Icon, { size: 20 }) })] }), trend !== undefined && (_jsxs("div", { className: "mt-3 flex items-center gap-1", children: [trendUp && (_jsxs(_Fragment, { children: [_jsx(TrendingUp, { size: 14, className: "text-emerald-500" }), _jsxs("span", { className: "text-emerald-600 text-xs font-medium", children: ["+", trend.toFixed(1), "%"] })] })), trendDown && (_jsxs(_Fragment, { children: [_jsx(TrendingDown, { size: 14, className: "text-red-500" }), _jsxs("span", { className: "text-red-600 text-xs font-medium", children: [trend.toFixed(1), "%"] })] })), trendNeutral && (_jsxs(_Fragment, { children: [_jsx(Minus, { size: 14, className: "text-slate-400" }), _jsx("span", { className: "text-slate-500 text-xs font-medium", children: "0%" })] })), _jsx("span", { className: "text-slate-400 text-xs ml-0.5", children: "vs last period" })] }))] }));
}
