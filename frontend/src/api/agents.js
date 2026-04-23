import { useQuery } from '@tanstack/react-query';
import { apiFetch, buildQuery } from './client';
// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
export function useAgents(dealerId) {
    return useQuery({
        queryKey: ['agents', dealerId],
        queryFn: async () => {
            const res = await apiFetch(`/agents${buildQuery({ dealer_id: dealerId })}`);
            return res.agents;
        },
    });
}
export function useAgent(agentId) {
    return useQuery({
        queryKey: ['agent', agentId],
        queryFn: () => apiFetch(`/agents/${agentId}`),
        enabled: !!agentId,
    });
}
export function useAgentSummary(agentId) {
    return useQuery({
        queryKey: ['agent-summary', agentId],
        queryFn: () => apiFetch(`/agents/${agentId}/summary`),
        enabled: !!agentId,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes — LLM calls are expensive
        retry: 1,
    });
}
/**
 * Stream the agent summary via SSE (same pattern as chat).
 * Falls back to JSON for non-SPCS environments.
 */
export async function streamAgentSummary(agentId, onChunk, onStatus) {
    const res = await fetch(`/api/agents/${agentId}/summary`);
    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`HTTP ${res.status}: ${text}`);
    }
    // JSON fallback (non-SPCS)
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data.summary)
            onChunk(data.summary);
        return data.metadata;
    }
    // SSE streaming
    const reader = res.body?.getReader();
    if (!reader)
        throw new Error('Response body is not readable');
    const decoder = new TextDecoder();
    let buffer = '';
    let metadata;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n\n');
            buffer = parts.pop() ?? '';
            for (const part of parts) {
                if (!part.trim())
                    continue;
                let eventType = 'message';
                let data = '';
                for (const line of part.split('\n')) {
                    if (line.startsWith('event: '))
                        eventType = line.slice(7).trim();
                    else if (line.startsWith('data: '))
                        data = line.slice(6);
                }
                if (eventType === 'delta' && data) {
                    try {
                        const p = JSON.parse(data);
                        if (p.text)
                            onChunk(p.text);
                    }
                    catch { /* skip */ }
                }
                else if (eventType === 'status' && data) {
                    try {
                        const p = JSON.parse(data);
                        if (p.message && onStatus)
                            onStatus(p.message);
                    }
                    catch { /* skip */ }
                }
                else if (eventType === 'metadata' && data) {
                    try {
                        metadata = JSON.parse(data);
                    }
                    catch { /* skip */ }
                }
                else if (eventType === 'error' && data) {
                    try {
                        const p = JSON.parse(data);
                        onChunk(`\n\n[Error: ${p.message}]`);
                    }
                    catch {
                        onChunk('\n\n[Error]');
                    }
                }
                else if (eventType === 'done') {
                    break;
                }
            }
        }
    }
    finally {
        reader.releaseLock();
    }
    return metadata;
}
export async function sendChatMessage(agentId, message, history, onChunk, onStatus) {
    console.log(`[Chat] Sending to /api/agents/${agentId}/chat`, { message, historyLen: history.length });
    const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        console.error(`[Chat] HTTP ${res.status}:`, text);
        throw new Error(`HTTP ${res.status}: ${text}`);
    }
    // SSE streaming: read the response body as a stream of events
    const reader = res.body?.getReader();
    if (!reader) {
        throw new Error('Response body is not readable');
    }
    const decoder = new TextDecoder();
    let buffer = '';
    let metadata;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            // Process complete SSE events (separated by double newline)
            const parts = buffer.split('\n\n');
            // Keep the last incomplete part in the buffer
            buffer = parts.pop() ?? '';
            for (const part of parts) {
                if (!part.trim())
                    continue;
                let eventType = 'message';
                let data = '';
                for (const line of part.split('\n')) {
                    if (line.startsWith('event: ')) {
                        eventType = line.slice(7).trim();
                    }
                    else if (line.startsWith('data: ')) {
                        data = line.slice(6);
                    }
                }
                if (eventType === 'delta' && data) {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.text) {
                            onChunk(parsed.text);
                        }
                    }
                    catch {
                        console.warn('[Chat] Failed to parse delta:', data);
                    }
                }
                else if (eventType === 'status' && data) {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.message && onStatus)
                            onStatus(parsed.message);
                    }
                    catch {
                        console.warn('[Chat] Failed to parse status:', data);
                    }
                }
                else if (eventType === 'metadata' && data) {
                    try {
                        metadata = JSON.parse(data);
                        console.log('[Chat] Metadata:', metadata);
                    }
                    catch {
                        console.warn('[Chat] Failed to parse metadata:', data);
                    }
                }
                else if (eventType === 'error' && data) {
                    try {
                        const parsed = JSON.parse(data);
                        throw new Error(parsed.message || 'Unknown agent error');
                    }
                    catch (e) {
                        if (e instanceof Error && e.message !== 'Unknown agent error')
                            throw e;
                        throw new Error(data);
                    }
                }
                else if (eventType === 'done') {
                    // Stream complete
                    console.log('[Chat] Stream done');
                }
            }
        }
    }
    finally {
        reader.releaseLock();
    }
    return metadata;
}
