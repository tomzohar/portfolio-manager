/**
 * Simple JSON Pointer implementation for A2UI data binding.
 * Supports basic path resolution (e.g., "/portfolio/totalValue").
 */
export function resolveJsonPointer(obj: any, pointer: string): any {
    if (!pointer || pointer === "" || pointer === "/") return obj;

    // Normalize pointer: remove leading $ or . and ensure / separator logic
    let cleanPointer = pointer;
    if (cleanPointer.startsWith('$')) cleanPointer = cleanPointer.substring(1);
    if (cleanPointer.startsWith('.')) cleanPointer = cleanPointer.substring(1);

    // Handle specific JSONPath style binding like "history" or ".history" -> treated as "/history"
    if (!cleanPointer.startsWith('/')) cleanPointer = '/' + cleanPointer;

    const parts = cleanPointer.split("/").slice(1);
    let current = obj;

    for (const part of parts) {
        if (current === null || typeof current !== "object") return undefined;

        // Unescape JSON Pointer special characters (~1 -> /, ~0 -> ~)
        const key = part.replace(/~1/g, "/").replace(/~0/g, "~");
        current = current[key];
    }

    return current;
}
