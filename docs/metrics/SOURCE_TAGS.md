# Source tags for links Sparkfare posts (Addendum S, S1)

Put these three tags on every link to sparkfare.com that goes into a post, comment, email or article, so a signup can be traced to the moment and place it came from. Use lowercase letters, numbers, `_` and `-` only.

| Tag | Meaning | Values |
|---|---|---|
| `utm_source` | The channel (20 characters at most) | `producthunt`, `hackernews`, `reddit`, `linkedin`, `bluesky`, `press`, `newsletter`, `community`, `podcast`, `directory`, `founding` |
| `utm_campaign` | The moment (16 characters at most) | `launch_nov7`, `report_nov11`, `aaa_wave`, `vfr_<corridor>` (for example `vfr_ord_krk`), `sale_check` |
| `utm_medium` | The kind of placement (12 characters at most) | `post`, `comment`, `email`, `article` |

Example: `https://sparkfare.com/check?utm_source=linkedin&utm_medium=post&utm_campaign=launch_nov7`

## What is stored, and what is not
- Source and campaign are stored as written, after lowercasing and removing any other character. A value over the limit is cut, not rejected, so keep to the lengths above.
- `utm_medium` is kept in the signup event only. A value that is not one of the four above is stored as `other`.
- The landing counter (visits by channel) counts source and campaign only, not the medium.
- First touch wins within a browser session: a visitor's later pages do not change the tag.
- A link with no `utm_source` is counted by where the visitor came from (search, social, email, other site) or `direct`. Mobile apps often send no referrer, so an untagged post reads as `direct`. Tag every link.
- No personal data in any tag: no names, emails, dates or trip details.
