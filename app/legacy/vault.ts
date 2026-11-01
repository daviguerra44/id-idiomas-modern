import { LegacyError } from './protocol';
const encoder = new TextEncoder();
export async function seal(value: unknown, secret: string, owner: string) {
  const key = await crypto.subtle.importKey('raw', decode(secret), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(owner) }, key, encoder.encode(JSON.stringify(value))));
  return encode(iv) + '.' + encode(encrypted);
}
export async function unseal<T>(value: string, secret: string, owner: string): Promise<T> {
  try {
    const [iv, data] = value.split('.'), key = await crypto.subtle.importKey('raw', decode(secret), 'AES-GCM', false, ['decrypt']);
    const text = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv), additionalData: encoder.encode(owner) }, key, decode(data));
    return JSON.parse(new TextDecoder().decode(text));
  } catch { throw new LegacyError('SESSION_UNREADABLE', 'Conecte sua conta novamente para renovar a sessão.', 401); }
}
function encode(bytes: Uint8Array) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
function decode(s: string) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
export function validKey(key?: string) { try { return !!key && decode(key).length === 32; } catch { return false; } }
export async function stableId(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  const hex = [...bytes].map(b => b.toString(16).padStart(2,'0')).join('').slice(0,32);
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
