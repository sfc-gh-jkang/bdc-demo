// Analyst API — SSE streaming from Cortex Agent
/**
 * Stream a natural-language query to the Cortex Agent.
 * Reads SSE events (delta, metadata, done, error) from the backend.
 */
export async function streamAnalystQuery(question, onChunk, onStatus) {
    const res = await fetch('/api/analyst/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`HTTP ${res.status}: ${text}`);
    }
    // If the response is JSON (non-SPCS fallback), handle it directly
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data.answer)
            onChunk(data.answer);
        return undefined;
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
            // Process complete SSE events (separated by double newline)
            const parts = buffer.split('\n\n');
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
                        if (parsed.text)
                            onChunk(parsed.text);
                    }
                    catch {
                        // skip unparseable chunks
                    }
                }
                else if (eventType === 'status' && data) {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.message && onStatus)
                            onStatus(parsed.message);
                    }
                    catch {
                        // skip
                    }
                }
                else if (eventType === 'metadata' && data) {
                    try {
                        metadata = JSON.parse(data);
                    }
                    catch {
                        // skip
                    }
                }
                else if (eventType === 'error' && data) {
                    try {
                        const parsed = JSON.parse(data);
                        onChunk(`\n\n[Error: ${parsed.message}]`);
                    }
                    catch {
                        onChunk('\n\n[Error: Unknown error]');
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
