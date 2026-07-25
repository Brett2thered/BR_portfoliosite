# SEO and AI Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make brett.red a credible, crawlable, and easily-citable authority for Brett Red's product-design leadership, Apple experience, AI product design, and design-engineering work.

**Architecture:** Keep the static Vercel site as the canonical source of first-party evidence. Add durable entity pages and case studies, emit accurate JSON-LD, retain the sitemap/robots/Markdown discovery work, and use Search Console, Bing Webmaster Tools, and analytics to measure which evidence and query themes earn visibility.

**Tech Stack:** Static HTML in `export/`, Node.js sitemap generator, Vercel, JSON-LD/schema.org, Google Search Console, Bing Webmaster Tools, GA4 or a privacy-respecting analytics tool.

---

## Positioning and editorial guardrails

Use these phrases only where the underlying page proves them:

| Search theme | Approved positioning | Evidence required |
| --- | --- | --- |
| Product design | Product Design Leader; Product Designer | Role history, case studies, outcomes |
| Apple | Former Apple designer; product designer who worked at Apple | Exact role, dates, team/project details that can be publicly shared |
| AI | AI product designer; AI-first product designer | Specific AI products, problem framing, implementation, outcomes, limitations |
| Design engineering | Design engineer; design leader who prototypes in code | Shipped prototype/code examples and technical decisions |
| "Top 10" / "top talent" | Never self-label | Use only a reputable, independently published ranking or award, with a citation |

Never create thin city/state landing pages, keyword-stuffed headings, invented rankings, or unverified company/outcome claims. The goal is to be the best source about Brett's work, not to manufacture an unsupported superlative.

## File structure

- Create: `export/about.html` — primary entity/biography page for Brett Red.
- Create: `export/apple.html` — evidence-led Apple experience page, only after factual review.
- Create: `export/ai-product-design.html` — AI product design point-of-view and selected work.
- Create: `export/design-engineering.html` — design-engineering capabilities and implementation examples.
- Create: `export/insights/index.html` — index of authored, durable articles.
- Create: `export/insights/ai-first-product-design.html` — first pillar article.
- Create: `export/insights/design-engineering.html` — second pillar article.
- Create: `export/assets/brett-red-headshot.jpg` — licensed, stable author image.
- Create: `scripts/validate-seo.mjs` — validates titles, descriptions, canonicals, heading hierarchy, JSON-LD, and sitemap coverage.
- Modify: `export/index.html` — clarify the home-page value proposition, add text navigation and entity JSON-LD.
- Modify: every public `export/*.html` — use one absolute canonical URL, a unique title/description, and links to relevant entity/case-study pages.
- Modify: `scripts/generate-sitemap.mjs` — include only public canonical pages; reject duplicate canonical URLs and noindex pages.
- Modify: `package.json` — add `seo:check` and run it before publishing.
- Modify: `vercel.json` — preserve the existing discovery/Markdown behavior and set unambiguous clean URL behavior only after route testing.

### Task 1: Establish a defensible search baseline

**Files:**
- Create: `docs/seo/baseline-2026-07-24.md`
- Test: Google Search Console URL Inspection and Page Indexing reports; Bing Webmaster Tools Site Explorer

- [ ] **Step 1: Verify ownership and submit the canonical domain in Google Search Console and Bing Webmaster Tools**

Add the `https://www.brett.red/` property in both products. Verify with a DNS TXT record or Vercel-hosted verification file. Submit `https://www.brett.red/sitemap.xml` in each product.

- [ ] **Step 2: Record the starting data in `docs/seo/baseline-2026-07-24.md`**

Use this exact template:

```markdown
# Search baseline — 2026-07-24

## Indexing
- Google indexed pages:
- Bing indexed pages:
- Sitemap URLs submitted:
- Sitemap URLs indexed:
- Crawl errors:

## Last 28 days
- Organic clicks:
- Organic impressions:
- Average position:
- Branded-query clicks:
- Non-branded-query clicks:
- ChatGPT referral sessions:

## Priority queries and current position
| Query | Search engine | Position | Landing URL | Notes |
| --- | --- | --- | --- | --- |
| product design leader | Google | | | |
| Apple product designer | Google | | | |
| AI product designer | Google | | | |
| design engineer portfolio | Google | | | |
```

- [ ] **Step 3: Inspect the home page and five existing case-study URLs in both tools**

Record canonical selected by Google, rendered text, mobile usability, HTTP status, and whether each URL is indexed. Investigate and fix any non-user-selected canonical before publishing new content.

- [ ] **Step 4: Commit the baseline**

```bash
git add docs/seo/baseline-2026-07-24.md
git commit -m "docs: record SEO baseline"
```

### Task 2: Make the home page state the primary positioning in crawlable text

**Files:**
- Modify: `export/index.html`
- Test: `scripts/validate-seo.mjs`

- [ ] **Step 1: Write the failing home-page assertions in `scripts/validate-seo.mjs`**

```js
assert.match(home, /<title>Product Design Leader \| Brett Red<\/title>/);
assert.match(home, /<h1[^>]*>Product Design Leader and Design Engineer<\/h1>/);
assert.match(home, /<link rel="canonical" href="https:\/\/www\.brett\.red\/"/);
assert.match(home, /<meta name="description" content="[^\"]{120,160}"/);
```

- [ ] **Step 2: Run the assertion before the content change**

Run: `node scripts/validate-seo.mjs`

Expected: failure because the current home page does not contain the approved title, heading, and absolute canonical.

- [ ] **Step 3: Replace the home-page metadata and add the visible introduction**

Use this copy, editing only facts Brett confirms:

```html
<title>Product Design Leader | Brett Red</title>
<meta name="description" content="Brett Red is a product design leader and design engineer creating human-centered digital products, AI experiences, and high-craft prototypes.">
<link rel="canonical" href="https://www.brett.red/">

<h1>Product Design Leader and Design Engineer</h1>
<p>I help teams turn complex product, AI, and interaction challenges into useful, high-craft experiences. Explore selected work, my approach to AI-first product design, and the systems behind the work.</p>
```

Add crawlable links, with descriptive anchor text, to `/about`, `/ai-product-design`, `/design-engineering`, and each case study. Do not hide this text visually or put it only in JavaScript.

- [ ] **Step 4: Add factual `Person` JSON-LD to the home page**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": "https://www.brett.red/#person",
  "name": "Brett Red",
  "url": "https://www.brett.red/",
  "image": "https://www.brett.red/assets/brett-red-headshot.jpg",
  "jobTitle": "Product Design Leader and Design Engineer"
}
</script>
```

Add a `sameAs` array only after collecting Brett's verified public-profile URLs; omit it otherwise.

- [ ] **Step 5: Run the validator and Rich Results Test**

Run: `node scripts/validate-seo.mjs`

Expected: `SEO validation passed for 1 home page and N public pages`.

Then test the deployed home page with Google's Rich Results Test and request reindexing in Search Console.

- [ ] **Step 6: Commit**

```bash
git add export/index.html scripts/validate-seo.mjs export/assets/brett-red-headshot.jpg
git commit -m "feat: clarify product design positioning on home page"
```

### Task 3: Build the entity and specialty pages that answer high-intent queries

**Files:**
- Create: `export/about.html`
- Create: `export/ai-product-design.html`
- Create: `export/design-engineering.html`
- Create: `export/apple.html`
- Test: `scripts/validate-seo.mjs`

- [ ] **Step 1: Create `export/about.html` with a single-person profile**

Use the following structure. Fill bracketed facts only after Brett approves them:

```html
<title>About Brett Red | Product Design Leader</title>
<meta name="description" content="Learn about Brett Red, a product design leader and design engineer focused on human-centered products, AI experiences, and prototyping.">
<link rel="canonical" href="https://www.brett.red/about">
<h1>About Brett Red</h1>
<p>Brett Red is a product design leader and design engineer.</p>
<h2>How I work</h2>
<p>Describe leadership, research, systems, prototyping, and delivery with concrete, reviewable examples.</p>
<h2>Experience</h2>
```

Add an experience list item only when its company, title, date range, and public contribution are approved for publication.

Add `ProfilePage` JSON-LD whose `mainEntity` is the same `Person` `@id` as the home page.

- [ ] **Step 2: Create `export/ai-product-design.html` as proof, not a keyword page**

Require at least two specific examples. Each example must state: the user problem, the AI capability used, interaction/design decisions, privacy or safety constraints, Brett's role, and a measurable outcome or honest learning.

```html
<title>AI Product Designer | Brett Red</title>
<link rel="canonical" href="https://www.brett.red/ai-product-design">
<h1>AI Product Design</h1>
<p>I design AI product experiences that make capabilities understandable, controllable, and useful in real workflows.</p>
```

For every AI-project section, use the verified product name as the H2 and publish four short labelled paragraphs: Problem, Capability, Design decision, and Outcome.

- [ ] **Step 3: Create `export/design-engineering.html` with implementation evidence**

Include links to live prototypes, accessible code samples, or short technical walkthroughs. Describe concrete tools and decisions instead of claiming broad engineering expertise.

```html
<title>Design Engineer | Brett Red</title>
<link rel="canonical" href="https://www.brett.red/design-engineering">
<h1>Design Engineering</h1>
<p>I use code and prototyping to reduce ambiguity between interaction design and production implementation.</p>
```

- [ ] **Step 4: Create `export/apple.html` only after fact review**

Use the title `Apple Product Design Experience | Brett Red` rather than "Top Apple Designer." Include role, dates, public work, and what can be independently corroborated. Do not disclose confidential Apple work or use Apple branding in a way that implies endorsement.

- [ ] **Step 5: Add bidirectional internal links**

Each specialty page links to `/about`, two relevant case studies, and one insight article. The home page links to all specialty pages. Use descriptive anchors such as “AI product design approach,” not “click here.”

- [ ] **Step 6: Validate and commit**

Run: `node scripts/validate-seo.mjs`

Expected: every new page has one H1, one absolute canonical, one unique title, and one unique description.

```bash
git add export/about.html export/apple.html export/ai-product-design.html export/design-engineering.html scripts/validate-seo.mjs
git commit -m "feat: add product design entity and specialty pages"
```

### Task 4: Upgrade work pages into indexable case studies

**Files:**
- Modify: `export/anchormaps.html`
- Modify: `export/arya.html`
- Modify: `export/calendly.html`
- Modify: `export/doc-ai.html`
- Modify: `export/fb.html`
- Modify: `export/layer1.html`
- Modify: `export/levels.html`
- Modify: `export/navdy.html`
- Test: `scripts/validate-seo.mjs`

- [ ] **Step 1: Select four flagship case studies before changing all pages**

Score each candidate 1–5 for recognizability, evidence depth, relevant product-design/AI/design-engineering theme, and permission to publish metrics. Start with the four highest-scoring pages.

- [ ] **Step 2: Add a standard evidence-led case-study outline to each flagship page**

For each selected project, use an H1 that names the project and its specific outcome, followed by short labelled sections for Role, Team, Timeline, The problem, My contribution, Outcome, and What I learned. Publish only metrics, attribution, and timelines that are approved and independently supportable.

- [ ] **Step 3: Add `CreativeWork` JSON-LD to every upgraded case study**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "CreativeWork",
  "author": { "@id": "https://www.brett.red/#person" },
  "about": ["Product design"]
}
</script>
```

Set `headline`, `url`, and the company/product `about` value from the approved case-study facts before publishing each page.

- [ ] **Step 4: Correct page metadata**

Give every case study a unique `<title>`, description, absolute canonical, meaningful image alt text, and an Open Graph image. Avoid using the same `Brett Red` title across every page.

- [ ] **Step 5: Test and commit each case study separately**

Run: `node scripts/validate-seo.mjs`

Expected: the page passes the validator and no two pages share title, description, or canonical URL.

```bash
git add export/anchormaps.html scripts/validate-seo.mjs
git commit -m "feat: add evidence-led Anchor Maps case study"
```

### Task 5: Publish a small, high-quality insight library

**Files:**
- Create: `export/insights/index.html`
- Create: `export/insights/ai-first-product-design.html`
- Create: `export/insights/design-engineering.html`
- Test: `scripts/validate-seo.mjs`

- [ ] **Step 1: Publish `ai-first-product-design.html`**

Write an original 1,200–2,000 word article titled `AI-First Product Design: Designing for Trust, Control, and Useful Outcomes`. Include screenshots/diagrams from Brett's own work, explicit authorship, publish date, practical frameworks, and links to relevant work. Do not pad to a word count.

- [ ] **Step 2: Publish `design-engineering.html`**

Write an original 1,200–2,000 word article titled `What a Design Engineer Changes in a Product Team`. Include real prototype examples, decision trade-offs, and code/design handoff practices.

- [ ] **Step 3: Add `Article` JSON-LD to each insight**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "author": { "@id": "https://www.brett.red/#person" },
  "mainEntityOfPage": "https://www.brett.red/insights/ai-first-product-design"
}
</script>
```

Set the article's actual headline, publication date, and modification date when it is published; do not use generation time as the modification date unless the text changed.

- [ ] **Step 4: Add the articles to the insights index and specialty-page links**

The insights index needs a one-sentence summary, date, and descriptive link for each article. Link each article to one relevant case study and back to its specialty page.

- [ ] **Step 5: Validate and commit**

```bash
node scripts/validate-seo.mjs
git add export/insights
git commit -m "feat: publish AI design and design engineering insights"
```

### Task 6: Make technical SEO continuously verifiable

**Files:**
- Create: `scripts/validate-seo.mjs`
- Modify: `scripts/generate-sitemap.mjs`
- Modify: `package.json`
- Modify: `vercel.json`
- Test: `scripts/validate-seo.mjs`

- [ ] **Step 1: Implement `scripts/validate-seo.mjs`**

For every `export/**/*.html` page intended for indexing, fail when any of these are missing or duplicated: title, meta description, absolute canonical, one H1, valid JSON-LD, and sitemap URL. Fail when a URL listed in `sitemap.xml` has `noindex` or a robots disallow rule. Print each affected filename and field.

- [ ] **Step 2: Extend `scripts/generate-sitemap.mjs`**

Read an explicit `data-indexable="true"` marker or a maintained list of public pages. Exclude backups, prototypes, and any page with `noindex`. Continue to reject non-`https://www.brett.red/` canonical URLs.

- [ ] **Step 3: Add publishing checks to `package.json`**

```json
{
  "scripts": {
    "sitemap": "node scripts/generate-sitemap.mjs",
    "seo:check": "node scripts/validate-seo.mjs",
    "prepublishOnly": "npm run sitemap && npm run seo:check"
  }
}
```

- [ ] **Step 4: Test responsive rendering and core pages**

Run local Vercel preview or deployed preview checks for `/`, `/about`, every flagship case study, `/sitemap.xml`, `/robots.txt`, and Markdown negotiation. Confirm a normal request receives HTML and `Accept: text/markdown` receives Markdown.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-sitemap.mjs scripts/validate-seo.mjs package.json vercel.json export/sitemap.xml
git commit -m "chore: validate SEO before publishing"
```

### Task 7: Build authoritative off-site corroboration

**Files:**
- Modify: `docs/seo/baseline-2026-07-24.md`
- Test: monthly backlink/referral review

- [ ] **Step 1: Align entity profiles**

Ensure LinkedIn, a personal GitHub profile, relevant design-community profiles, and conference/podcast bios use the same name, role framing, headshot, and `https://www.brett.red/` URL. Link only real profiles from the `sameAs` array.

- [ ] **Step 2: Create four evidence-led outreach targets**

Pitch work that can earn citations: a design-engineering teardown, an AI product-design framework with examples, a podcast discussion about a verified case study, and a guest post for a recognized design publication. Each pitch must lead with an original insight, not a request for a generic backlink.

- [ ] **Step 3: Record each earned mention**

Append this table to the baseline document:

```markdown
| Date | Publisher | URL | Asset referenced | Referral sessions | Indexed? |
| --- | --- | --- | --- | --- |
```

- [ ] **Step 4: Review monthly**

Compare new referring domains, branded-query impressions, and non-branded-query impressions against the 28-day baseline. Keep sources that send qualified traffic; stop low-quality directory/link-scheme activity.

### Task 8: Run a 90-day measurement loop

**Files:**
- Create: `docs/seo/monthly-review-template.md`
- Test: monthly Search Console, Bing, and analytics review

- [ ] **Step 1: Create the monthly review template**

```markdown
# SEO and AI search review — YYYY-MM

## Outcomes
- Organic clicks / impressions / CTR / average position:
- ChatGPT referrals (`utm_source=chatgpt.com`):
- Bing referrals:
- Indexed public pages:

## Query clusters
| Cluster | Queries gaining impressions | Best landing page | Next content improvement |
| --- | --- | --- | --- |
| Product design leadership | | | |
| Apple experience | | | |
| AI product design | | | |
| Design engineering | | | |

## Decisions
- Keep:
- Improve:
- Remove or consolidate:
- Evidence needed before making a stronger claim:
```

- [ ] **Step 2: Define success milestones**

At 30 days: all public pages indexed or diagnosed; zero sitemap/canonical errors; Search Console and Bing data flowing.

At 60 days: four flagship case studies and two insight articles live; impressions grow for at least two non-branded query clusters.

At 90 days: track qualified referrals, earned citations, and top-20/top-50 movement for target terms. Do not set a promise of a "top 10 product designer in the USA" ranking; measure whether authoritative third parties begin citing the work.

- [ ] **Step 3: Commit the operational templates**

```bash
git add docs/seo/monthly-review-template.md docs/seo/baseline-2026-07-24.md
git commit -m "docs: add SEO measurement loop"
```

## Self-review

**Spec coverage:** The plan covers conventional SEO (crawlability, metadata, canonicals, internal links, performance checks, structured data, sitemap, Search Console), AI search discovery (OAI-SearchBot, Markdown negotiation, citation-ready text), entity authority (Person/ProfilePage markup and corroborating profiles), content strategy (case studies and original insights), and measurement. It explicitly declines unsupported superlative claims.

**Placeholder scan:** Bracketed values appear only where public facts need Brett's factual approval. They must be replaced or omitted before publishing; no placeholder is intended to ship.

**Consistency:** Every public page uses the `https://www.brett.red/` canonical host; every structured-data author reference uses `https://www.brett.red/#person`; sitemap and validator work from the same public-page inventory.
