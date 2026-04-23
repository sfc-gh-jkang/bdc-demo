import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, } from 'recharts';
export default function TrendChart({ data, lines, xDataKey = 'date', height = 260 }) {
    return (_jsx(ResponsiveContainer, { width: "100%", height: height, children: _jsxs(LineChart, { data: data, margin: { top: 4, right: 16, left: 0, bottom: 0 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#f1f5f9" }), _jsx(XAxis, { dataKey: xDataKey, tick: { fontSize: 11, fill: '#94a3b8' }, tickLine: false, axisLine: { stroke: '#e2e8f0' } }), _jsx(YAxis, { tick: { fontSize: 11, fill: '#94a3b8' }, tickLine: false, axisLine: false, width: 40 }), _jsx(Tooltip, { contentStyle: {
                        background: '#1e293b',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                        fontSize: 12,
                    }, itemStyle: { color: '#cbd5e1' }, labelStyle: { color: '#f1f5f9', fontWeight: 600 } }), _jsx(Legend, { wrapperStyle: { fontSize: 12, color: '#64748b' } }), lines.map((l) => (_jsx(Line, { type: "monotone", dataKey: l.dataKey, name: l.label ?? l.dataKey, stroke: l.color, strokeWidth: 2, dot: false, activeDot: { r: 4, strokeWidth: 0 } }, l.dataKey)))] }) }));
}
