"""K-B7 (ROADMAP step 130): responsive Unsplash image attributes for the generated pages.

Mirrors the unsplashVariant()/imgAttrs() functions in index.html. tests/k_b7_image_pipeline.test.js runs both on the same inputs
(when Python is available) and fails if they ever disagree. The query string is edited as plain text, not re-encoded, so the
signed parts of an Unsplash URL (ixid) stay byte-for-byte as stored.
"""

UNSPLASH = "https://images.unsplash.com/"
# parameters this module sets; any existing copy is dropped first
STRIP = {"fm", "q", "w", "h", "fit", "crop"}
# webp quality by width: the 720 px step is a little lower so a retina phone card stays near 120 KB
QUALITY = {480: 70, 720: 60, 960: 70}


def unsplash_variant(url, w):
    """The same photo as a 4:3 webp crop w pixels wide."""
    if not url.startswith(UNSPLASH):
        return url
    base, _, query = url.partition("?")
    keep = [p for p in query.split("&") if p and p.split("=")[0] not in STRIP]
    keep += ["fm=webp", "q=%d" % QUALITY[w], "w=%d" % w, "h=%d" % round(w * 3 / 4), "fit=crop", "crop=entropy"]
    return base + "?" + "&".join(keep)


def img_attrs(url, widths, sizes):
    """src, srcset, sizes, width and height for an <img> (4:3, the smallest width is the fallback src)."""
    if not url.startswith(UNSPLASH):
        return 'src="%s"' % url
    first = widths[0]
    srcset = ", ".join("%s %dw" % (unsplash_variant(url, w), w) for w in widths)
    return 'src="%s" srcset="%s" sizes="%s" width="%d" height="%d"' % (
        unsplash_variant(url, first), srcset, sizes, first, round(first * 3 / 4))
