import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
// ── Hooks ────────────────────────────────────────────────────────────────────
export function usePipelineLive() {
    return useQuery({
        queryKey: ['pipeline-live'],
        queryFn: () => apiFetch('/pipeline-live'),
        refetchInterval: 30_000,
    });
}
export function useRunTask() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => apiFetch('/pipeline/run-task', { method: 'POST' }),
        onSuccess: () => {
            // Refetch pipeline data after task triggers
            setTimeout(() => qc.invalidateQueries({ queryKey: ['pipeline-live'] }), 3000);
        },
    });
}
