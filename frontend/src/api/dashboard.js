import { useQuery } from '@tanstack/react-query';
import { apiFetch, buildQuery } from './client';
export function useDashboard(dealerId) {
    return useQuery({
        queryKey: ['dashboard', dealerId],
        queryFn: () => apiFetch(`/dashboard${buildQuery({ dealer_id: dealerId })}`),
    });
}
