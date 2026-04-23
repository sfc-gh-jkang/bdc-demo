import { useQuery } from '@tanstack/react-query';
import { apiFetch, buildQuery } from './client';
export function useCalls(filters) {
    return useQuery({
        queryKey: ['calls', filters],
        queryFn: () => apiFetch(`/calls${buildQuery({ ...filters })}`),
    });
}
export function useCallDetail(callId) {
    return useQuery({
        queryKey: ['call', callId],
        queryFn: () => apiFetch(`/calls/${callId}`),
        enabled: !!callId,
    });
}
