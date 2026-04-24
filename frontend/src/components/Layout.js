import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Trophy, Phone, GitBranch, ChevronDown, Bot, Snowflake } from 'lucide-react';
import { useDealer } from '@/context/DealerContext';
import { useDashboard } from '@/api/dashboard';
const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { to: '/calls', label: 'Calls', icon: Phone },
    { to: '/pipeline', label: 'Pipeline', icon: GitBranch },
    { to: '/analyst', label: 'Agent', icon: Bot },
];
export default function Layout() {
    const { dealerId, setDealerId } = useDealer();
    const { data } = useDashboard(null);
    const dealers = data?.dealers ?? [];
    return (_jsxs("div", { className: "flex h-screen overflow-hidden", children: [_jsxs("aside", { className: "flex flex-col w-60 min-h-screen bg-[#1e293b] text-slate-300 shrink-0", children: [_jsx("div", { className: "px-6 py-5 border-b border-slate-700", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center", children: _jsx(Snowflake, { className: "text-white", size: 18, strokeWidth: 2.5 }) }), _jsxs("div", { children: [_jsx("p", { className: "text-white font-semibold text-sm leading-none", children: "BDC" }), _jsx("p", { className: "text-slate-400 text-xs mt-0.5", children: "BDC Coaching" })] })] }) }), _jsx("nav", { className: "flex-1 px-3 py-4 space-y-0.5", children: navItems.map(({ to, label, icon: Icon, end }) => (_jsxs(NavLink, { to: to, end: end, className: ({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`, children: [_jsx(Icon, { size: 18 }), label] }, to))) }), _jsx("div", { className: "px-4 py-4 border-t border-slate-700", children: _jsx("p", { className: "text-slate-500 text-xs", children: "Powered by Snowflake" }) })] }), _jsxs("div", { className: "flex flex-col flex-1 overflow-hidden", children: [_jsxs("header", { className: "h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0", children: [_jsx("h1", { className: "text-slate-800 font-semibold text-base", children: "Agent Coaching Dashboard" }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("label", { className: "text-sm text-slate-500", children: "Dealer:" }), _jsxs("div", { className: "relative", children: [_jsxs("select", { value: dealerId ?? '', onChange: (e) => setDealerId(e.target.value || null), className: "appearance-none pl-3 pr-8 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer", children: [_jsx("option", { value: "", children: "All Dealers" }), dealers.map((d) => (_jsx("option", { value: d.dealer_id, children: d.dealer_name }, d.dealer_id)))] }), _jsx(ChevronDown, { size: 14, className: "absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" })] })] })] }), _jsx("main", { className: "flex-1 overflow-auto bg-slate-50", children: _jsx(Outlet, {}) })] })] }));
}
