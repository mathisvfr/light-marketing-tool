# Marketing Automation Tool — Workflow & Architecture

A hosted, multi-user marketing automation platform that generates brand-consistent
content and publishes it across multiple channels — always after human approval.
Nothing goes live without sign-off.

Built for staffing agencies and recruitment firms, the tool handles three distinct
content pipelines: job postings, social media marketing, and website/blog content.

---

## How It Works

```
 ┌─────────────┐
 │  User fills  │    AI generates brand-consistent content
 │  a short     │──► using company profile, tone of voice,
 │  briefing    │    and channel-specific guidelines
 └─────────────┘
        │
        ▼
 ┌─────────────┐
 │  Quality     │    A second AI pass checks the draft against
 │  Control     │──► brand rules: tone, factual accuracy,
 │  ("Criticus")│    no fabricated claims, correct language
 └─────────────┘
        │
        ▼
 ┌─────────────┐
 │  Human       │    Owner reviews, edits if needed,
 │  Approval    │──► then approves for publication
 └─────────────┘
        │
        ▼
 ┌─────────────┐
 │  Publish     │    Content is routed to the right channel(s)
 │  to channels │──► automatically (see below)
 └─────────────┘
```

---

## Three Content Pipelines

### 1. Job Postings (candidate-facing)

Designed for high-volume recruitment. A recruiter fills in a short form
(job title, location, hours, brief description) and the AI generates a
complete, structured job posting — including localized versions (e.g. Dutch
and Polish).

```
Briefing form
  → AI generates structured job posting (title, description,
    requirements, benefits — per language)
  → Quality check (Criticus)
  → Owner approves
  → Job appears in hosted XML feed
  → Multiposter (e.g. Jobit) pulls the feed automatically
  → Distributed to 30+ job boards:
      Indeed, Nationale Vacaturebank, Werk.nl,
      Jobbird, and more
```

**Key detail:** The tool hosts a standards-compliant XML feed at a fixed URL.
The multiposter service polls this feed on its own schedule and handles
distribution to all connected job boards. Closing a job in the tool removes
it from the feed, and the multiposter takes it offline everywhere.

No direct API integration with individual job boards is needed.

### 2. Marketing Posts (brand / awareness content)

Social media content aimed at potential clients (companies looking for staffing
solutions) or general brand awareness. The AI generates platform-specific copy
— a professional LinkedIn post reads differently from a casual Facebook post.

```
Briefing form (topic, target audience, channels)
  → AI generates per-platform copy
     (LinkedIn, Facebook, Instagram — each tailored)
  → Branded image generated automatically (Satori rendering engine)
     or manually uploaded
  → Quality check (Criticus)
  → Owner approves
  → Published via Buffer API to selected channels:
      ├── LinkedIn company page
      ├── Facebook page
      └── Instagram business account
  → Can be published immediately or scheduled for a future date/time
```

**Key detail:** Social media publishing is handled through
[Buffer](https://buffer.com). Buffer manages all platform OAuth connections
(LinkedIn, Meta, Instagram) — the tool never touches platform credentials
directly. This eliminates the need for Meta App Review or LinkedIn developer
portal access.

### 3. Website & Blog Content

SEO-focused articles and pages published directly to the company website.

```
Briefing form (topic, target audience)
  → AI generates blog title + full HTML article
  → Quality check (Criticus)
  → Owner approves
  → Published via WordPress REST API
  → Optional: branded Open Graph image via Satori
```

---

## Integration Map

```
┌──────────────────────────────────────────────────────┐
│                 MARKETING TOOL                       │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Content  │  │ AI       │  │ Image Rendering   │  │
│  │ Editor   │  │ Engine   │  │ (Satori)          │  │
│  │          │  │ (Claude) │  │ HTML/CSS → PNG     │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
│                                                      │
└──────────┬──────────┬─────────────────┬──────────────┘
           │          │                 │
     ┌─────┘    ┌─────┘           ┌─────┘
     ▼          ▼                 ▼
┌─────────┐ ┌────────┐    ┌────────────┐
│ XML     │ │ Buffer │    │ WordPress  │
│ Feed    │ │ API    │    │ REST API   │
└────┬────┘ └───┬────┘    └─────┬──────┘
     │          │               │
     ▼          ▼               ▼
┌─────────┐ ┌────────┐    ┌────────────┐
│ Jobit / │ │LinkedIn│    │ Company    │
│ Multi-  │ │Facebook│    │ Website    │
│ poster  │ │Insta-  │    │ (WP)      │
│         │ │gram    │    │            │
└────┬────┘ └────────┘    └────────────┘
     │
     ▼
┌──────────────────┐
│ 30+ job boards   │
│ Indeed, NVB,     │
│ Werk.nl, etc.    │
└──────────────────┘
```

---

## AI-Powered Content Generation

The tool uses **Anthropic Claude** as its AI engine. Content generation is
not a black box — it follows a structured, two-step process:

**Step 1 — Generation**
The AI receives the company's brand profile (tone of voice, target audiences,
certifications, do's and don'ts) together with the user's briefing. It produces
structured output tailored to each channel. For job postings, this means
separate fields (description, requirements, benefits) rather than a single
text blob — making each section independently editable.

**Step 2 — Quality Control (Criticus)**
A second, independent AI review checks the generated content against brand
guidelines:
- Correct tone of voice for the channel
- No fabricated claims (salaries, certifications, results)
- Correct language and grammar
- Call-to-action present
- Compliance with anti-discrimination rules

Only content that passes both steps enters the approval queue.

---

## Branded Image Generation

Social media posts include automatically generated branded images using
**Satori**, a rendering engine that converts HTML/CSS templates into PNG
images. This ensures every post matches the company's visual identity
(colors, fonts, logo placement) without needing a designer.

Users can also upload their own images to override the generated ones.

---

## User Roles & Approval Flow

| Role       | Can do                                                  |
|------------|---------------------------------------------------------|
| Owner      | Everything: approve, publish, manage users and settings |
| Recruiter  | Create and submit drafts for approval                   |
| Viewer     | Read-only access to published content and history       |

The approval flow is a core safety mechanism:
- Recruiters create content but **cannot publish**.
- Only owners can approve and trigger publication.
- All actions are logged with user attribution.

---

## Technical Stack (high level)

| Layer              | Technology                                     |
|--------------------|------------------------------------------------|
| Frontend           | React (Single Page Application)                |
| Backend            | Node.js + Express REST API                     |
| Database           | PostgreSQL (hosted via Supabase)                |
| AI Engine          | Anthropic Claude API                           |
| Image Generation   | Satori (HTML → PNG)                            |
| Social Publishing  | Buffer API (GraphQL)                           |
| Job Distribution   | Self-hosted XML feed → Jobit/Multiposter       |
| Website Publishing | WordPress REST API                             |
| Authentication     | JWT-based, role-enforced                        |
| Hosting            | Docker Compose + Caddy (auto-HTTPS)            |

---

## Multi-Language Support

Job postings can be generated in multiple languages from a single briefing.
Currently supported: **Dutch** and **Polish**, with the architecture ready
to add more languages (Bulgarian, Slovak, Latvian, English, Hungarian,
Romanian, Ukrainian).

Marketing posts and website content are generated in Dutch.

---

## What Makes This Reusable

The tool is built as a **white-label platform**. The brand profile, tone of
voice, target audiences, and channel configuration are all stored as settings
— not hardcoded. This means the same system can be deployed for a different
company by:

1. Loading a new brand profile (company name, values, tone, do's and don'ts)
2. Connecting their Buffer account (for social channels)
3. Connecting their WordPress site (for blog/website content)
4. Connecting their multiposter service (for job distribution)
5. Updating the AI prompt templates to match their industry

No code changes required for a new deployment.

---

## Security & Control

- All data flows through the backend — the frontend never talks to external
  services directly.
- Authentication via secure HTTP-only cookies (not localStorage).
- Role-based access control enforced at the API level, not just the UI.
- External service credentials stored encrypted in the database.
- Nothing is published without explicit human approval.

---

*For technical integration details or a demo, get in touch.*
