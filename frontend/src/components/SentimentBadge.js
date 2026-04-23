import { jsxs as _jsxs } from "react/jsx-runtime";
function getLabel(score) {
    if (score >= 0.3)
        return 'Positive';
    if (score <= -0.3)
        return 'Negative';
    return 'Neutral';
}
function getClasses(score) {
    if (score >= 0.3)
        return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    if (score <= -0.3)
        return 'bg-red-100 text-red-700 border border-red-200';
    return 'bg-amber-100 text-amber-700 border border-amber-200';
}
export default function SentimentBadge({ score, showScore = true }) {
    return (_jsxs("span", { className: `inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getClasses(score)}`, children: [getLabel(score), showScore && _jsxs("span", { className: "opacity-70", children: ["(", score >= 0 ? '+' : '', score.toFixed(2), ")"] })] }));
}
