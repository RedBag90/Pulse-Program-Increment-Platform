# Design Tokens — Layout

Page-level spacing, sizing and rhythm tokens. Defined in `src/app/globals.css`
under `:root` (theme-independent — same in light and dark). Always use the
`<Page>`, `<PageHeader>` and `<PageSection>` primitives from
`src/components/layout/` instead of raw padding classes — the primitives wrap
these tokens.

## Tokens

| Token                  | Value    | Used for                                                                |
| ---------------------- | -------- | ----------------------------------------------------------------------- |
| `--page-pad-x`         | `2rem`   | Horizontal padding on the page main wrapper (≈ `p-8`).                  |
| `--page-pad-x-sm`      | `1.5rem` | Horizontal padding on narrow viewports.                                 |
| `--page-pad-y`         | `2rem`   | Vertical padding on the page main wrapper.                              |
| `--page-max-w`         | `1400px` | Max content width — page is centered above this.                        |
| `--page-section-gap`   | `1.5rem` | Vertical gap between `<PageSection>` blocks (≈ `space-y-6`).            |
| `--section-inner-gap`  | `1rem`   | Vertical gap between children inside a `<PageSection>` (≈ `space-y-4`). |
| `--page-header-gap`    | `0.5rem` | Gap between `<PageHeader>` title and subtitle.                          |
| `--page-header-margin` | `1.5rem` | Gap between `<PageHeader>` and the first section below.                 |

## Tailwind equivalence

Approximate Tailwind class equivalences — useful when reading existing code
that has not been migrated yet:

| Token                 | Tailwind equivalent |
| --------------------- | ------------------- |
| `--page-pad-x`        | `px-8`              |
| `--page-pad-x-sm`     | `px-6`              |
| `--page-pad-y`        | `py-8`              |
| `--page-section-gap`  | `space-y-6`         |
| `--section-inner-gap` | `space-y-4`         |

## How to use

Prefer the primitives:

```tsx
import { Page, PageHeader, PageSection } from "@/components/layout";

<Page>
  <PageHeader
    title="Drive ART"
    subtitle="Mobility Value Stream"
    breadcrumb={<Breadcrumbs items={...} />}
    actions={<><EditBtn /><DeleteBtn /></>}
  />
  <PageSection title="Program Increments" actions={<NewPiBtn />}>
    <PiList ... />
  </PageSection>
</Page>;
```

For special cases (Gantt charts, full-bleed boards) where the page must not
have outer padding, use `variant="flush"`:

```tsx
<Page variant="flush">
  <RoadmapGantt ... />
</Page>;
```

`variant="flush"` removes `--page-pad-x`/`--page-pad-y` but keeps
`--page-max-w` centering. Document the reason in a comment when using it.

## Don't

- Don't add `p-6`, `p-8`, `p-6 md:p-8`, `space-y-6` etc. directly on `<main>` or
  `<div>` page wrappers. The primitives own the page rhythm.
- Don't override the tokens locally on a page — change the token or use
  `variant="flush"` and document why.
