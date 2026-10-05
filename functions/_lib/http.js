/**
 * Helpers shared by the Pages Functions in functions/api/ (feedback and save codes).
 * The leading underscore keeps this folder out of the URL space: _routes.json only sends
 * /api/* to Functions, and this module exports no request handlers.
 */

export function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex'
        }
    });
}

// ─── Input cleaning ──────────────────────────────────────────

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Any run of digits with phone-style separators; it counts as a number when it holds 7+ digits
// (catches US, UK, AU, EU layouts alike — a rare long score or date is an acceptable casualty)
const NUMBER_RUN_RE = /\+?\(?\d[\d ().-]{5,}\d/g;

export function cleanText(value, max) {
    if (typeof value !== 'string') return '';
    return value
        .replace(/\r\n?/g, '\n')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .trim()
        .slice(0, max);
}

/** Kids sometimes type their email or phone number into the message — never store it. */
export function redactPersonalInfo(text) {
    return text
        .replace(EMAIL_RE, '[email removed]')
        .replace(NUMBER_RUN_RE, (m) => (m.replace(/\D/g, '').length >= 7 ? '[number removed]' : m));
}

/** True when text holds an email address or a phone-length run of digits. */
export function looksPersonal(text) {
    return redactPersonalInfo(text) !== text;
}

// ─── Requests ────────────────────────────────────────────────

/** Read at most `max` bytes of the body (Content-Length can be absent with chunked uploads). */
export async function readBodyCapped(request, max) {
    if (!request.body) return '';
    const reader = request.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > max) {
            await reader.cancel();
            return null;
        }
        chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) { bytes.set(c, offset); offset += c.byteLength; }
    return new TextDecoder().decode(bytes);
}

export function sameOrigin(request) {
    const origin = request.headers.get('Origin');
    if (!origin) return true; // non-browser clients; the JSON content type still blocks plain HTML form posts
    try {
        return new URL(origin).host === new URL(request.url).host;
    } catch (e) {
        return false;
    }
}
