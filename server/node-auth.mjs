import { AsyncLocalStorage } from 'node:async_hooks';
const requests = new AsyncLocalStorage();
export function withRequest(request, callback) { return requests.run(request, callback); }
export async function getChatGPTUser() {
  const request = requests.getStore();
  const url = request ? new URL(request.url) : null;
  // A synthetic identity only activates the existing admin key verification.
  // Public quote submissions always use IP rate limiting on this runtime.
  if (url?.pathname.startsWith('/api/admin/') && /^Bearer \S+$/i.test(request.headers.get('authorization') || '')) {
    return { userId: 'node-key-admin', email: 'admin@localhost', displayName: 'Yönetici', fullName: null };
  }
  return null;
}
