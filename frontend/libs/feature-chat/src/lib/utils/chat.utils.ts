export function isValidThreadId(threadId: string): boolean {
  if (threadId.includes(':')) {
    const parts = threadId.split(':');
    return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
  }

  return false;
}