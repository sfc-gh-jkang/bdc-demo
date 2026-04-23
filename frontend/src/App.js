import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Routes, Route } from 'react-router-dom';
import { DealerProvider } from '@/context/DealerContext';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Leaderboard from '@/pages/Leaderboard';
import Calls from '@/pages/Calls';
import CallDetail from '@/pages/CallDetail';
import AgentDetail from '@/pages/AgentDetail';
import Pipeline from '@/pages/Pipeline';
import Analyst from '@/pages/Analyst';
export default function App() {
    return (_jsx(DealerProvider, { children: _jsx(Routes, { children: _jsxs(Route, { element: _jsx(Layout, {}), children: [_jsx(Route, { path: "/", element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "/leaderboard", element: _jsx(Leaderboard, {}) }), _jsx(Route, { path: "/agents/:id", element: _jsx(AgentDetail, {}) }), _jsx(Route, { path: "/calls", element: _jsx(Calls, {}) }), _jsx(Route, { path: "/calls/:id", element: _jsx(CallDetail, {}) }), _jsx(Route, { path: "/pipeline", element: _jsx(Pipeline, {}) }), _jsx(Route, { path: "/analyst", element: _jsx(Analyst, {}) })] }) }) }));
}
