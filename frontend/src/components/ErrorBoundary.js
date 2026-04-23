import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from 'react';
export default class ErrorBoundary extends Component {
    state = { hasError: false };
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    render() {
        if (this.state.hasError) {
            return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-slate-950 text-white", children: _jsxs("div", { className: "max-w-md text-center space-y-4", children: [_jsx("h1", { className: "text-2xl font-bold text-red-400", children: "Something went wrong" }), _jsx("p", { className: "text-slate-400 text-sm", children: this.state.error?.message || 'An unexpected error occurred.' }), _jsx("button", { onClick: () => window.location.reload(), className: "px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium", children: "Reload page" })] }) }));
        }
        return this.props.children;
    }
}
