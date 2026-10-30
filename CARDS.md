# Home-screen cards — cheat sheet

The home page (`export/index.html`) is a Framer masonry of **27 cards** across 3 columns.
Each card's **name** is its Framer layer name (`data-framer-name`). The small pill on each
card is its **category chip** (Work / Stats / Reference …) — chips repeat, so the name is
the real identifier.

- **Visual key:** `export/cards-cheatsheet.png` — same layout with `#number  Name` overlaid on every card.
- **Source of truth:** enumerated from the live DOM with the exact card-root logic the site
  itself uses (`export/hover-animation.js:50-56`, `verify-hover.js:89-104`) at 1800px. All 27 are visible.

Numbering is reading order: Column 1 top→bottom, then Column 2, then Column 3.

---

## Column 1

| # | Card name | Chip | Links to | Cover | Notes |
|---|-----------|------|----------|-------|-------|
| 1 | **Text Card** | Hello | — | — | Intro headline: "I'm Brett Red, a hands-on product design leader…" |
| 2 | **Brett Player** | — | — | (video) | Intro video, no chip/link |
| 3 | **Anchor Player** | Maps | Anchor Maps (App Store) | (video) | Anchor Maps app promo video |
| 4 | **Arya Works** | Work | aryahealth.ai | `img_1.png` | Arya Health |
| 5 | **Reference Card** | Reference | linkedin.com/in/mrshakur | `img_0.jpg` | Testimonial — **Abdullah** |
| 6 | **Ranked Designer** | Stats | — | — | Stat: "top 1% of Designers" (AngelList/Wellfound) |
| 7 | **Navdy** | Work | youtu.be/pKL4PJICS40 | `img_6.png` | Navdy |
| 8 | **Intel** | Work | intel.html | `img_4.png` | Intel / GE energy-saving animation campaign |

## Column 2

| # | Card name | Chip | Links to | Cover | Notes |
|---|-----------|------|----------|-------|-------|
| 9 | **New Project** | Hustle | 1prm.ai | `1PRM_cover_boomerang.mp4` | The "Hustle" card → 1PRM |
| 10 | **Levels** | Wearable | levels.html | `img_13.png` | Levels |
| 11 | **Triton Player** | Transport | tritonsubs.com (T3300-6) | (video) | Triton submarine |
| 12 | **Stats Card** | Stats | — | — | Stat: "$22.8 million in capital raised" |
| 13 | **Meta** | Work | fb.html | `img_9.gif` | Meta / Facebook |
| 14 | **Reference Card** | Reference | nirandfar.com | `img_12.png` | Testimonial — **Nir Eyal** |
| 15 | **Reference Card** | Reference | — | — | Testimonial — **Scott Snibbe** |
| 16 | **Hack** | Hack | — | `img_10.png` | Hackathon |
| 17 | **Levels** | Wearable | levels.html | `img_13.png` | ⚠️ Duplicate of #10 (same name/link/cover) |
| 18 | **Resident Designer Video** | Social | — | (video) | "Resident Designer" video |

## Column 3

| # | Card name | Chip | Links to | Cover | Notes |
|---|-----------|------|----------|-------|-------|
| 19 | **Cloud People** | work | confident-article-208320.framer.app | — | chip is lowercase "work" |
| 20 | **Doc.ai** | Ai | doc-ai.html | — | Doc.ai |
| 21 | **Hiro** | Work | hiroscience.vercel.app | `img_15.png` | Hiro Science |
| 22 | **Stats w/ Dark Stars** | Stats | — | — | Stat: "highest ranked AR app in the Apple App Store" |
| 23 | **Reference Card** | Reference | linkedin.com/in/tedgoldstein | `img_21.png` | Testimonial — **Ted Goldstein** |
| 24 | **Education Card** | Hello | — | `img_18.png` | chip "Hello" looks mislabeled (vs "Education") |
| 25 | **Anthem** | Work | anthem.html | `img_22.jpg` | Anthem / Health OS case study |
| 26 | **TedX** | Public Speaking | youtu.be/yFmuxjGLdQI | `img_19.png` | TEDx talk |
| 27 | **Wonder** | Work | makewonder.com/dash/ | `img_23.png` | Wonder Workshop |

---

## Distinct card names (for quick lookup)

Text Card · Brett Player · Anchor Player · Arya Works · Reference Card ×4 · Ranked Designer ·
Navdy · Intel · New Project (1PRM) · Levels ×2 · Triton Player · Stats Card · Meta · Hack ·
Resident Designer Video · Cloud People · Doc.ai · Hiro · Stats w/ Dark Stars · Education Card ·
Anthem · TedX · Wonder

## Things worth a look
- **#10 / #17 Levels are duplicates** — identical name, link (`levels.html`) and cover (`img_13.png`), both visible. Likely an accidental repeat in the masonry.
- **Repeated names** are by design in Framer but ambiguous in code: 4× "Reference Card", 2× "Levels". Disambiguated above by person/link/cover.
- **Chip inconsistencies:** `#19 Cloud People` chip is lowercase "work"; `#24 Education Card` chip says "Hello" (probably should be "Education").
