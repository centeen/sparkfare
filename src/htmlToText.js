// Plain-text twin of an HTML email. Many senders and spam filters expect a text part, and a plain-text reader
// gets nothing from an HTML-only message. sendEmailWithGuard uses this for any email whose caller did not
// supply its own text. Links become "label (url)"; styles, tags and entities are removed; blocks become lines.

const NAMED = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ', '&rarr;': '->', '&mdash;': '-', '&ndash;': '-' };

const decode = (v) => v.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&[a-z]+;/gi, (e) => NAMED[e.toLowerCase()] ?? e);

export function htmlToText(html) {
  if (typeof html !== 'string') return '';
  const t = html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<a\s[^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, rawHref, label) => {
      const text = decode(label.replace(/<[^>]+>/g, '').trim());
      const href = decode(rawHref);
      if (!text) return '';
      return !href || /^(mailto:|#)/i.test(href) || text === href ? text : `${text} (${href})`;
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|tr|table|ul|ol)>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(td|th)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&[a-z]+;/gi, (e) => NAMED[e.toLowerCase()] ?? e);
  return t.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
