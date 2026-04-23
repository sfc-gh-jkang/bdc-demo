import { useQuery } from '@tanstack/react-query';
import { apiFetch, buildQuery } from './client';
export function useLeaderboard(dealerId, sortBy = 'composite_score') {
    return useQuery({
        queryKey: ['leaderboard', dealerId, sortBy],
        queryFn: async () => {
            const res = await apiFetch(`/leaderboard${buildQuery({ dealer_id: dealerId, sort_by: sortBy })}`);
            return res.agents;
        },
    });
}
