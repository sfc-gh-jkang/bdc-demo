import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
function SkeletonRows({ cols }) {
    return (_jsx(_Fragment, { children: Array.from({ length: 6 }).map((_, i) => (_jsx("tr", { className: i % 2 === 0 ? 'bg-white' : 'bg-slate-50', children: Array.from({ length: cols }).map((_, j) => (_jsx("td", { className: "px-4 py-3", children: _jsx("div", { className: "h-4 bg-slate-200 rounded animate-pulse" }) }, j))) }, i))) }));
}
export default function DataTable({ columns, data, onRowClick, loading = false, emptyMessage = 'No data found.', }) {
    const [sortKey, setSortKey] = useState(null);
    const [sortDir, setSortDir] = useState('asc');
    function handleSort(key) {
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        }
        else {
            setSortKey(key);
            setSortDir('asc');
        }
    }
    const sorted = useMemo(() => {
        if (!sortKey)
            return data;
        return [...data].sort((a, b) => {
            const ra = a;
            const rb = b;
            const av = ra[sortKey];
            const bv = rb[sortKey];
            const cmp = av == null ? -1 : bv == null ? 1 : av < bv ? -1 : av > bv ? 1 : 0;
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [data, sortKey, sortDir]);
    return (_jsx("div", { className: "overflow-x-auto rounded-xl border border-slate-200 bg-white", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsx("tr", { className: "border-b border-slate-200 bg-slate-50", children: columns.map((col) => (_jsx("th", { className: `px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide ${col.sortable ? 'cursor-pointer hover:text-slate-800 select-none' : ''} ${col.className ?? ''}`, onClick: col.sortable ? () => handleSort(col.key) : undefined, children: _jsxs("div", { className: "flex items-center gap-1", children: [col.header, col.sortable && (_jsx("span", { className: "text-slate-300", children: sortKey === col.key ? (sortDir === 'asc' ? (_jsx(ChevronUp, { size: 13, className: "text-blue-500" })) : (_jsx(ChevronDown, { size: 13, className: "text-blue-500" }))) : (_jsx(ChevronsUpDown, { size: 13 })) }))] }) }, col.key))) }) }), _jsx("tbody", { children: loading ? (_jsx(SkeletonRows, { cols: columns.length })) : sorted.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: columns.length, className: "px-4 py-10 text-center text-slate-400", children: emptyMessage }) })) : (sorted.map((row, i) => (_jsx("tr", { className: `${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-b border-slate-100 last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-blue-50 transition-colors' : ''}`, onClick: onRowClick ? () => onRowClick(row) : undefined, children: columns.map((col) => (_jsx("td", { className: `px-4 py-3 text-slate-700 ${col.className ?? ''}`, children: col.render ? col.render(row) : String(row[col.key] ?? '') }, col.key))) }, i)))) })] }) }));
}
