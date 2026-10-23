# Pre-freeze verification, Pass 2 (2026-10-23)

Date: 2026-10-23. Read-only: production page and API reads against `https://sparkfare.com`. Covers Addendum K (Brand v1), Addendum G (G19 Blog Posts), and Addendum M (M0–M7 Growth Pack).

---

## 1. Package Status Summary (All on `main`)

- **Addendum K (Brand v1)**: K-A1 to K-A6, K-B1 to K-B5, K-B8, K-B10, K-C1 merged. K-C2 built dark. K-B6/K-B7/K-B9 deferred post-Nov 9.
- **G19 Blog Articles**: All 8 educational articles converted to Brand v1 HTML in `blog/`, indexed in `blog/index.html` and `sitemap.xml` (merged #363).
- **Addendum M (Growth Pack)**: All 7 packages (M0–M7) merged:
  - M1 (Measurement): Live on production (`5f228a4a`), UTM + sub-path attribution verified (`fc8af023`).
  - M2 (Referral Prompt): Merged behind `ENABLE_REFERRAL_PROMPT="false"` (`db9de1a5`).
  - M3 (`/check` Share Image): Merged behind `ENABLE_SHARE_IMAGE="false"` (`3b9a13c5`).
  - M4 (2027 PTO Page): Live on production (`20484fb0`).
  - M5 (Holiday Fare Report): Merged behind `ENABLE_REPORTS="false"` (`756bd3e2`).
  - M6 (Answer-Engine Basics): Live on production (`b0f9deeb`).
  - M7 (Conversion Additions): Live on production (`c2acc549`).

---

## 2. Production Sweep: 25 Endpoints

| Surface / Endpoint | Status | H1 | Main | Tokens | Self-hosted Fonts | Google Fonts | Response Time |
|---|---|---|---|---|---|---|---|
| `/` (Homepage) | 200 OK | 1 | 1 | Yes | Yes | 0 | 239ms |
| `/check` (Price Checker) | 200 OK | 1 | 1 | Yes | Yes | 0 | 298ms |
| `/time-off` (Time-off National) | 200 OK | 1 | 1 | Yes | Yes | 0 | 53ms |
| `/time-off/den` (Time-off Origin) | 200 OK | 1 | 1 | Yes | Yes | 0 | 45ms |
| `/how-it-works` (Methodology, M6) | 200 OK | 1 | 1 | Yes | Yes | 0 | 132ms |
| `/away-mode` (Away Mode) | 200 OK | 1 | 1 | Yes | Yes | 0 | 111ms |
| `/leave` (Leave-Ready Checklist) | 200 OK | 1 | 1 | Yes | Yes | 0 | 108ms |
| `/data/` (Routes Directory) | 200 OK | 1 | 1 | Yes | Yes | 0 | 220ms |
| `/data/jfk-to-prague-czechia` (Static Route) | 200 OK | 1 | 1 | Yes | Yes | 0 | 201ms |
| `/flight/JFK/Prague,%20Czechia` (Worker Route) | 200 OK | 1 | 1 | Yes | Yes | 0 | 309ms |
| `/hub` (Member Hub) | 200 OK | 1 | 1 | Yes | Yes | 0 | 200ms |
| `/blog/` (Blog Index) | 200 OK | 1 | 1 | Yes | Yes | 0 | 205ms |
| `/blog/leaving-home-for-30-days` (G19 Article) | 200 OK | 1 | 1 | Yes | Yes | 0 | 203ms |
| `/privacy` (Privacy Policy) | 200 OK | 1 | 1 | Yes | Yes | 0 | 200ms |
| `/disclosure` (Affiliate Disclosure) | 200 OK | 1 | 1 | Yes | Yes | 0 | 203ms |
| `/reward-terms` (Referral Terms) | 200 OK | 1 | 1 | Yes | Yes | 0 | 161ms |
| `/pricing` (Plus Waitlist) | 200 OK | 1 | 1 | Yes | Yes | 0 | 29ms |
| `/sign-in` (Auth / Sign-in) | 200 OK | 1 | 1 | Yes | Yes | 0 | 128ms |
| `/reports/holiday-2026` (M5 Report) | 404 (Flagged) | — | — | — | — | — | 27ms |
| `/llms.txt` (Root LLM context) | 200 OK | — | — | — | — | — | 144ms |
| `/c07b7b13e9a149c5950d24490f058097.txt` (IndexNow Key) | 200 OK | — | — | — | — | — | 25ms |
| `/robots.txt` | 200 OK | — | — | — | — | — | 114ms |
| `/sitemap.xml` | 200 OK | — | — | — | — | — | 126ms |
| `/api/partners` | 200 OK | — | — | — | — | — | 106ms |
| `/admin/growth` | 200 OK | 1 | Shell | Yes | — | 0 | 14ms |

---

## 3. Brand & Accessibility Compliance

1. **Heading & Semantic Structure**:
   - Every consumer HTML page has exactly one `<h1>` tag and exactly one `<main>` container.
   - Skip links (`<a class="skip-link" href="#main">`) verified on every consumer surface.
2. **Design Tokens & Fonts**:
   - `tokens.css` and `fonts.css` linked sitewide.
   - Zero external Google Fonts requests; all Space Grotesk, Inter, and IBM Plex Mono fonts are self-hosted from sparkfare.com.
3. **Gold & Color Integrity**:
   - Brand gold (`#E8B930`) restricted exclusively to the Deal chip, the logo mark dot, and `--spark`.
   - All text links and primary CTAs are styled with `--sage` (`#2F6B47`).
4. **Mobile Tap Targets**:
   - Navigation links and interactive targets comply with the minimum tap-target standard.

---

## 4. Partner Registry & Crawl Policies

1. **Partner API (`/api/partners`)**:
   - Returns 13 live partners.
   - Petcube is successfully hidden (status `pending`, D-032).
2. **Crawl Rules (`robots.txt`)**:
   - Disallows `/out/`, `/go/`, `/card/`, `/welcome`.
   - Allows public content, blog, route directory, and methodology.
3. **Sitemap (`sitemap.xml`)**:
   - 200 OK (77.7 KB). Accurately indexes core hubs, `/how-it-works`, `/time-off`, and all 78 published blog articles.

---

## 5. Feature Flag State & Upcoming Flips

| Flag | Current Value | Target Flip Date | Purpose |
|---|---|---|---|
| `ENABLE_REFERRAL_PROMPT` | `"false"` | By Nov 4 | Show referral prompt blocks in confirmation, welcome email, and digest footer |
| `ENABLE_SHARE_IMAGE` | `"false"` | Nov 4 / Post Nov 9 | Enable `/check` social share image and shareable link |
| `ENABLE_REPORTS` | `"false"` | Nov 11 (fallback Nov 18) | Make `/reports/holiday-2026` live and linked |
| `ENABLE_LEAVE_BY_PLAN` | `"false"` | Nov 9+ (Wave 1) | Away Mode leave-by plan |
| `ENABLE_PASSPORT_CHECK` | `"false"` | Nov 9+ (Wave 1) | Passport check |
| `ENABLE_PLAN_REMINDERS` | `"false"` | Nov 9+ (Wave 1) | Plan reminders |
| `ENABLE_HOME_CARD` | `"false"` | Nov 9+ (Wave 1) | Home card for house sitter |
| `ENABLE_RULE_WATCHER` | `"false"` | Nov 9+ (Wave 1) | Official rule watcher |
