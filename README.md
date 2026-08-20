# CircleStore

A secondhand marketplace where **the sell form is data, not code**.

Different categories need different information — a phone has storage and battery health, a sofa has
seating capacity and material. CircleStore stores those field definitions in the database and renders
them through a single form engine, so adding a category or a field is an admin action rather than a
deploy.

There are **no per-category form components anywhere in this codebase.**

---

## Table of contents

- [Quick start](#quick-start)
- [Live deployment](#live-deployment)
- [What you can try](#what-you-can-try)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Common vs category-specific](#common-vs-category-specific-the-decision-rule)
- [The schema engine](#the-schema-engine)
- [API](#api)
- [Design decisions (ADRs)](#design-decisions-adrs)
- [Edge cases handled](#edge-cases-handled)
- [Testing](#testing)
- [Out of scope & known trade-offs](#out-of-scope--known-trade-offs)

---

## Quick start

**Prerequisites:** Node 22+, and either Docker or a local/Postgres hosted database.

```bash
# 1. Database
docker compose up -d           # Postgres 17 on localhost:5433

# 2. Backend
cd backend
cp .env.example .env           # defaults already match docker-compose
npm install
npm run db:init                # create and apply the first migration
npm run seed                   # 35 categories, 60 fields, 11 listings
npm run dev                    # http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev                    # http://localhost:3000
```

**Image uploads (optional).** Add your Cloudinary `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and
`CLOUDINARY_API_SECRET` to `backend/.env`. Without them the app runs fine — the sell flow simply
accepts pasted image URLs instead of file uploads.

**Not using Docker?** Point `DATABASE_URL` in `backend/.env` at any Postgres instance and run the
same commands.

| Command | What it does |
|---|---|
| `npm run dev` | Start with hot reload |
| `npm run build` | Build backend and frontend |
| `npm test` | Schema-engine unit tests (backend) |
| `npm --prefix backend run db:setup` | Apply migrations, generate Prisma client, and seed safely |
| `npm run seed` | Seed sample data — **safe**, skips if data already exists |
| `npm run seed:fresh` | Wipe and reseed (destructive) |
| `npm run db:reset` | Drop, migrate and reseed |
| `npm run prisma:studio` | Browse the database |

---

## Live deployment

- **Frontend:** https://frontend-pi-vert-67.vercel.app
- **Backend API:** https://circlestore-api-wog9.onrender.com
- **Source code:** https://github.com/TanmayGupta17/CircleStore

The deployed frontend runs on Vercel. The backend API runs on Render, with PostgreSQL hosted on
Render. Cloudinary direct uploads are enabled only when credentials are configured; otherwise the
sell flow falls back to pasted image URLs.

### Backend: Render

The backend is deployed as a Render Web Service from the `backend/` folder.

```txt
Root Directory: backend
Build Command: npm install && npm run db:setup && npm run build
Start Command: npm run start
Health Check Path: /health
```

Required Render environment variables:

```env
DATABASE_URL=<Render internal PostgreSQL URL>
NODE_ENV=production
CORS_ORIGINS=https://frontend-pi-vert-67.vercel.app
DEMO_SELLER_ID=demo-seller
DEMO_SELLER_NAME=Demo Seller
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=circlestore/listings
CLOUDINARY_UPLOAD_PRESET=
UPLOAD_MAX_BYTES=5242880
```

`DATABASE_URL` is the only required secret for the API to boot. Cloudinary variables are optional.

### Frontend: Vercel

The frontend is deployed from the `frontend/` folder. In the Vercel project's
**Settings → Build and Deployment**, set **Root Directory** to `frontend` so
Vercel installs and builds only the Next.js application. The root `vercel.json`
also preserves this behaviour for an existing project whose Root Directory is
still the repository root.

For local development, `frontend/.env.local` should contain:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

For Vercel production, the configured value is:

```env
NEXT_PUBLIC_API_URL=https://circlestore-api-wog9.onrender.com/api
```

---

## What you can try

The interesting demo is the one that proves the architecture:

1. **Add a field without deploying.** Go to `/admin/fields` → *New field* → make a `NUMBER` field
   called "Frame Size" with min/max. Then `/admin/categories` → *Configure fields* on any category →
   attach it. Open `/sell`, pick that category — the field is there, validated, with no code change.

2. **Watch the live preview.** On the category builder, the right-hand pane renders the *real* form
   component fed by the *real* API. Toggle "Required", reorder a field, add a rule — the seller's
   view updates beside you.

3. **Nothing is unsellable.** The seed ships 29 sellable categories across 7 groups — phones,
   scooters, fridges, shoes, guitars, books. For anything that still does not fit, **Everything
   Else** asks only "what is it?" plus free-form details, so a seller is never turned away by a form
   that does not match their item.

4. **Conditional fields.** Mobile Phone and Laptop inherit a warranty block from Electronics.
   Answer "Under Warranty: Yes" in `/sell` and the expiry date appears; switch to "No" and it
   vanishes — *and its value is discarded*, not silently submitted.

5. **Cross-category carry-over.** Fill in a Mobile Phone listing, then go back and switch to Laptop.
   Brand, RAM and storage carry over; phone-only answers are parked and told to you, not destroyed.

6. **Snapshot integrity.** Publish a listing, then deactivate one of its fields in the admin. The
   PDP still shows it correctly, because the listing froze the definitions it used at publish time.

7. **Guardrails.** Try attaching a conditional rule that points at a field lower down the form —
   the API rejects it with an explanation instead of shipping a broken form.

---

## Architecture

```
CircleStore/
├── backend/          Express + TypeScript + Prisma      (layered MVC)
└── frontend/         Next.js 16 App Router + Tailwind   (server + client components)
```

### Backend — layered MVC

```
src/
├── routes/           HTTP route table
├── controllers/      parse request → delegate → present         (C)
├── presenters/       domain records → API JSON                  (V)
├── services/         business rules and use cases
├── core/             ← THE DOMAIN. Pure. No Prisma, no Express.
│   ├── field-types/    one strategy per field type + registry
│   └── schema/         resolver, validator, visibility, snapshot, config-validator
├── repositories/     interfaces + Prisma implementations        (M)
├── models/           Prisma client
├── validators/       Zod request schemas
├── middlewares/      error handling, async wrapper
├── config/           env access, in one place
└── container.ts      composition root — the only file that wires concretes
```

**The rule that makes this work:** `src/core` imports nothing from Express, Prisma or React. It takes
plain objects and returns plain objects. That is why the engine is unit-testable without a database,
and why the same logic would survive a move to any other transport.

### SOLID, concretely

| Principle | Where it shows up |
|---|---|
| **S**ingle responsibility | Controllers do HTTP. Services do rules. Repositories do SQL. Presenters do JSON. |
| **O**pen/closed | A new field type = one new strategy file + one registry line. No existing file is edited. |
| **L**iskov | Every strategy is substitutable behind `FieldTypeStrategy`; the validator never type-switches. |
| **I**nterface segregation | `FieldTypeStrategy` covers only data integrity (4 methods). Presentation lives in the frontend's own registry, so the backend never grows a rendering concern. |
| **D**ependency inversion | Services depend on `IFieldRepository`, never on Prisma. `container.ts` is the only place that knows the implementation. |

The OCP claim is **compiler-enforced**, not aspirational:

```ts
const STRATEGIES = { TEXT: …, NUMBER: …, /* … */ } satisfies Record<FieldType, FieldTypeStrategy>;
```

Add a value to `FieldType` without a strategy and the build fails. The frontend registry uses the
same trick for components.

### Frontend

```
src/
├── app/              routes (Server Components fetch; Client Components interact)
├── components/
│   ├── ui/             generic primitives — every surface composes these
│   ├── fields/         one component per field type + registry + DynamicForm
│   ├── listings/       card, gallery
│   ├── sell/           the seller flow
│   └── admin/          field library, category builder
└── lib/              api client, types, visibility, validation, formatting
```

`DynamicForm` is the single renderer. The sell flow, and the admin's live preview, both use it.

---

## Data model

```
categories ──┐  (self-referencing tree; children inherit parents' fields)
             ├── category_fields ──── fields ──── field_options
listings ────┘  (join table carries    (global      (relational so they can be
                 per-category config)   library)     reordered / soft-deleted)
```

**The field library is global.** `RAM` is one row used by both Mobile Phone and Laptop. This is the
most important modelling decision in the project — it is what makes cross-category answer carry-over
possible and means a field is edited in exactly one place.

**Per-category behaviour lives on the join table**, not on the field:

```
category_fields (
  is_required,        -- RAM required on Laptop, optional on Mobile Phone
  sort_order,
  section,            -- "Specifications" / "Condition"
  show_in_card,       -- surface on the product card without becoming a column
  visibility_rule,    -- conditional display
  overrides           -- per-category validation overrides
)
```

**Listings** keep common information in real columns and category answers in `attributes` (JSONB),
alongside a `schema_snapshot` of the definitions used at publish time.

---

## Common vs category-specific: the decision rule

> **If application code needs to know a field exists, it is common — give it a column.**
> **If only a human reader needs to know, it is category-specific — put it in the field library.**

"Application code needs to know" means search ranks on it, the card renders it, sorting uses it,
moderation reads it. Those cannot be written against a field that might not exist.

| Common (columns on `listings`) | Category-specific (field library → JSONB) |
|---|---|
| title, description, price, currency | brand, model, storage, RAM, battery health |
| condition — the defining axis of a *secondhand* market | processor, graphics card, screen size |
| city, status, seller, timestamps | material, seating capacity, pet friendly, dimensions |
| images — every listing has them, and they need their own lifecycle | warranty status/expiry, accessories |

Two escape valves keep the boundary from becoming a trap:

- **`show_in_card`** lets a category-specific value appear on the homepage card without promotion.
- **A promotion path**: if `brand` later needs to be a platform-wide facet, add a column and backfill
  from `attributes->>'brand'`. Getting this slightly wrong costs one migration.

**Bias when unsure: put it in the field library.** A common field costs a migration and a deploy; a
dynamic field costs an admin clicking a button.

---

## The schema engine

One contract drives everything:

```
GET /api/categories/mobile-phone/form-schema
   → { category, ancestors, sections: [...], fields: [...] }
```

The seller form renders it. The server validates against it. The admin previews it. The PDP renders
the snapshot taken from it.

### Write pipeline (`POST /api/listings`)

```
1. resolve      category + ancestors → merged, ordered field definitions
2. strip        drop keys not in the schema             (junk / stale category data)
3. normalise    "89" → 89, "no" → false                 (per field-type strategy)
4. defaults     apply configured defaults               (so they can drive conditionals)
5. visibility   forward pass, cascading, strips hidden  ← the bug everyone ships
6. required     only on fields that are actually visible
7. validate     per-field, delegated to the strategy
8. snapshot     freeze definitions used
9. persist      listing + images in one transaction
```

Steps 1–8 are pure functions over data. **No step knows about any specific category** — that is why
a new one needs no code.

### Conditional rules

Stored as JSON on the attachment:

```json
{ "all": [ { "field": "under_warranty", "op": "eq", "value": "yes" } ] }
```

Rules nest (`all` / `any` / `not`) and support 11 operators. One evaluator is used by the validator
(to decide what is required and what to strip) and mirrored on the client (to decide what to render).

---

## API

```
Public
  GET  /api/categories
  GET  /api/categories/:slug/form-schema     ← the contract
  GET  /api/field-types
  GET  /api/uploads/capabilities             ← is storage configured?
  POST /api/uploads/signature                ← short-lived direct-upload credentials
  GET  /api/listings?category=&q=&condition=&limit=&offset=
  POST /api/listings
  GET  /api/listings/:slug

Admin
  GET/POST/PATCH  /api/admin/categories
  PATCH           /api/admin/categories/:id/active
  GET/POST        /api/admin/categories/:id/fields
  PATCH           /api/admin/categories/:id/fields/order
  PATCH/DELETE    /api/admin/field-attachments/:attachmentId
  GET/POST/PATCH  /api/admin/fields
  GET             /api/admin/fields/:id/impact
  PATCH           /api/admin/fields/:id/active
```

Every error uses one envelope, so a form can map errors straight onto inputs:

```json
{ "error": { "code": "VALIDATION_FAILED",
             "message": "Some category details need attention.",
             "fieldErrors": { "attributes.battery_health": "Battery Health must be at most 100 %." } } }
```

---

## Design decisions (ADRs)

### ADR-001 — Global field library, not category-owned fields

*Alternative:* fields defined per category.
*Chosen:* one global library, attached to categories via a join table that carries the per-category
configuration.

Category-owned fields duplicate "RAM" for every category that needs it, so an edit must be repeated
and answers cannot be recognised as the same question across categories. The join table gives per-
category behaviour (required, order, section, rules, validation overrides) without duplication — and
it is what makes carry-over in the sell flow possible at all.

### ADR-002 — JSONB for attributes, not EAV

*Alternative:* a normalised `listing_attributes` table with typed columns.

| | JSONB | EAV |
|---|---|---|
| Write a listing | 1 insert | N inserts |
| Read for PDP | free, on the row | join + pivot in app code |
| Filtering | GIN index, `attributes @> '{"brand":"Apple"}'` | trivial |
| Type safety | enforced by the engine | needs 5 typed columns |

EAV is the textbook-normalised answer but genuinely worse here: every read becomes a join-and-pivot,
and it buys no referential integrity that we do not already have — the *definitions* are fully
normalised in `fields` / `category_fields`. GIN indexing recovers the only thing EAV would have won.

Values are still typed: strategies normalise before write, so `battery_health` is a JSON number, not
the string `"89"`.

### ADR-003 — Two validation mechanisms, deliberately

Common fields use a static Zod schema; category answers are validated dynamically against the
database. This is not an inconsistency — they are different kinds of data. Common fields are part of
the application's contract with itself; category answers are user-configured. Forcing both through
one mechanism would either make common fields dynamically typed or make category fields impossible.

### ADR-004 — Snapshot field definitions onto each listing

A listing is a historical record; field definitions are mutable. Without a snapshot, deactivating
"Battery Health" would silently erase that row from every existing PDP, and renaming a select option
would retroactively rewrite what a seller said.

So publishing freezes label, type, unit, section and option labels into `schema_snapshot`, and the
PDP renders from that. Admins can edit fields fearlessly, and history stays accurate. This is the
cheapest high-value correctness decision in the project.

### ADR-005 — Reject invalid configurations at write time

Admin-authored conditional rules are user-supplied control flow, so they get the same treatment as
code. Before any category-field mutation is persisted, the prospective configuration is assembled in
memory and checked for circular rules, forward references, dangling dependencies, duplicate keys and
contradictory bounds. Invalid configurations are unreachable rather than a production surprise.

### ADR-006 — `key` and `type` are immutable

Changing `key` orphans every stored value; changing `type` invalidates them (`89` as a NUMBER is not
meaningfully a DATE). Both are absent from `FieldUpdateInput`, so this is enforced by the type system
rather than a runtime guard. The intended path is deprecate-and-replace. Deletes are soft everywhere,
including individual select options.

### ADR-007 — Image bytes never pass through the API

Photos upload **directly from the browser to Cloudinary**, using a short-lived signature minted by
`POST /api/uploads/signature`. The API authorises the write; it never receives the file.

```
Browser ──1. POST /api/uploads/signature ──▶ API      (SHA-1 signs folder + timestamp)
Browser ──2. POST multipart ───────────────▶ Cloudinary
Browser ──3. { secure_url, public_id, width, height }
Browser ──4. POST /api/listings with images[] ──▶ API persists rows
```

*Alternative:* proxy uploads through Express with `multer`. Rejected — it puts multi-megabyte bodies
through the API process, hits serverless body-size limits and request timeouts, and pays egress
twice, all to add nothing.

Cloudinary specifically, because its upload response returns exactly what `listing_images` stores:
`secure_url` → `url`, `public_id` → `storage_key`, plus `width`/`height`. Dimensions therefore cost
no server-side image decoding, and transformations live in the URL (`f_auto,q_auto,w_400`), so one
stored original serves cards and the PDP at the right size and format.

Signing is a sorted-parameter SHA-1 via `node:crypto` — no SDK dependency, which keeps the provider
small and the swap-out cost honest. Everything sits behind a `StorageProvider` interface, and when
credentials are absent the app still boots and the sell flow degrades to pasted URLs rather than
showing an upload box that cannot work.

### ADR-008 — Separate frontend and backend deployables

A single Next.js app would have been fewer moving parts, and Route Handlers are Node. Splitting them
was chosen for a clearer layered backend and independent deploys; the cost is a duplicated visibility
evaluator (see below) and CORS configuration.

---

## Edge cases handled

| Case | Behaviour |
|---|---|
| Seller answers a conditional field, then flips the condition | Stale value **stripped** before save, client and server |
| Conditional field is required but hidden | Not required — visibility resolves first |
| Controlling field is itself hidden | Hiding **cascades** to dependants |
| `false` answer on a required yes/no | Accepted — `false` is an answer, not a blank |
| `"false"` submitted as a string | Coerced to `false`, not truthy (`z.coerce.boolean()` would get this wrong) |
| `"89"` submitted for a number | Coerced to `89` so filters and comparisons work |
| Circular rule `A ⇄ B` | Rejected at admin save with the cycle named |
| Rule pointing at a later field | Rejected — the seller must answer the controlling question first |
| Detaching a field another rule depends on | Rejected as a dangling dependency |
| Admin deletes a field after listings exist | Soft delete; PDPs unaffected via snapshot |
| Admin removes a select option in use | Option deactivated; historical listings still show its label |
| Impossible date like `2024-02-31` | Rejected — passes the regex, fails the calendar check |
| `min > max` configured | Rejected at configuration time, not on the seller's submit |
| Client posts unknown attribute keys | Silently dropped |
| Seller switches category mid-form | Shared answers carry over; others parked and reported |
| Browser refresh mid-listing | Draft restored from localStorage, with a "start fresh" escape |
| Two listings with the same title | Slug gets a random suffix, retried on collision |
| Backend down | Every page renders an explanatory panel rather than a stack trace |

---

## Testing

```bash
cd backend && npm test        # 53 tests, ~350ms, no database required
```

Deliberately narrow and deep. Every test targets `src/core`, because it is pure and it is where the
bugs that matter live:

- **visibility** — operators, nesting, cascade, stripping, numeric-vs-lexicographic comparison
- **validator** — required/hidden interaction, coercion, per-type rules, unknown-key stripping
- **resolver** — inheritance, child-overrides-parent, ordering, sectioning, inactive filtering
- **config-validator** — cycles, forward references, dangling dependencies, contradictory bounds
- **snapshot** — captures only answered visible fields, freezes option labels
- **registry** — every declared field type resolves to a strategy

CRUD routes are not unit-tested; the information per line is low.

---

## Out of scope & known trade-offs

Being explicit about what was deliberately not built:

- **Authentication.** `/admin` is unauthenticated and every listing is attributed to a demo seller.
  It sits behind its own route prefix and layout so adding authorisation is one middleware. Real auth
  demonstrates nothing about this problem.
- **Orphaned uploads.** Files are uploaded before the listing exists, so an abandoned draft leaves
  them behind. They are namespaced under `circlestore/listings/{draftId}/` so a sweep is a prefix
  query, but no cleanup job is implemented.
- **Duplicated visibility evaluator.** `frontend/src/lib/visibility.ts` mirrors
  `backend/src/core/schema/visibility.ts`. The server is authoritative; the client copy exists purely
  so fields appear and disappear as you type. A shared workspace package would remove the duplication
  and is the right fix if this grew.
- **Search** is `ILIKE` on title and description. No full-text, no faceted filtering on `attributes`
  yet — the GIN index is in place for it.
- **Per-category option subsets.** `brand` currently offers one combined list. Filtering options per
  category is a natural extension of the existing `overrides` mechanism.
- **Pagination** is offset-based. Correct at this scale; cursors would be right at a larger one.
- **Orphaned images.** Uploads are keyed by draft id so a sweep is possible, but no cleanup job is
  implemented.

### What I would do next

1. Faceted filtering on `attributes` using the GIN index — the schema already supports it.
2. Extract the shared visibility/validation core into a workspace package consumed by both apps.
3. Real uploads behind the existing `StorageProvider` seam.
4. An `ESLint no-restricted-imports` rule forbidding `core/` from importing Prisma or Express —
   boundaries that are not enforced decay.
