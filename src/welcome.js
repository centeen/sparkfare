// K-B2 (ROADMAP step 124): the confirmation page after a visitor verifies their email.
//
// The homepage signup asks only for an email (and carries the airport). Trip length and the number of travelers are asked here, once the
// address is verified, with a link that proves who is asking: /api/verify redirects to /welcome?t=<token>, where the token is an HMAC over
// the user's id (signed with UNSUBSCRIBE_SECRET, the same Worker secret the unsubscribe and plan links use). The form posts the token back;
// the Worker checks it and updates only that user. The token carries an id and nothing else, no email and no date.
//
// Why not just resubmit the signup form: /api/signup on an unverified address sends a new verification email and replaces the token, so a
// second submit would double-email and break the first link.

const enc = new TextEncoder();
const b64u = {
  encode(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  decode(str) { return Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)); },
};
const hmacKey = (secret) => crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

export async function signWelcomeToken(secret, userId) {
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode('welcome:' + userId)));
  return `${b64u.encode(enc.encode(userId))}.${b64u.encode(sig)}`;
}

// Returns the user id, or null for anything that is not a token this Worker signed.
export async function verifyWelcomeToken(secret, token) {
  if (!secret || typeof token !== 'string' || token.length > 400 || !token.includes('.')) return null;
  try {
    const [idPart, sigPart] = token.split('.');
    const userId = new TextDecoder().decode(b64u.decode(idPart));
    if (!userId || userId.length > 120) return null;
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify('HMAC', key, b64u.decode(sigPart), enc.encode('welcome:' + userId));
    return ok ? userId : null;
  } catch {
    return null;
  }
}

export function welcomeUrl(appUrl, token) {
  return `${appUrl}/welcome?t=${encodeURIComponent(token)}`;
}
