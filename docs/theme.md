# HideZero Website Theme

Source of truth for the site's color palette, logo usage, and favicon. CSS stays inlined
per-page (no shared stylesheet) — when editing any page in `site/`, pull the hex values from
here rather than re-deriving them.

## Origin

Palette extracted directly from `Images/HideZero new logo.png` by sampling pixels:

| Sample | Hex | Source |
|---|---|---|
| Icon's dark block (also the wordmark) | `#54707b` | left half of the icon mark |
| Icon's light block | `#51888d` | right half of the icon mark, split from the dark block by a white diagonal cutout |

The hero gradient's darkest stop is deliberately darker than the sampled logo color — the
logo tone alone (`#54707b`) is too light to hold white hero text at good contrast. Same
relationship the old green theme used (`#0f5c31` hero vs `#1a6b3c` headings).

## Palette

| Token | Hex | Role | Was (old green theme) |
|---|---|---|---|
| `--slate-900` | `#22343a` | Darkest — nav bar bg, hero gradient start, `btn-primary` text, `btn-green` hover | `#0f5c31` |
| `--slate-700` | `#34505a` | Section headings, `section-label`, `step-num` bg, hero gradient mid stop (55%), `btn-green` bg | `#1a6b3c` |
| `--teal-500` | `#4f8890` | Hero gradient end stop — matches the icon's light block exactly | `#22844b` |
| `--teal-300` | `#8cd1d9` | Hero `<h1 span>` highlight word | `#7fffa8` |
| `--teal-100` | `#cfe8ea` | Hero badge pill text | `#c6f0d6` |
| `--tint-bg` | `#f5fafb` | Feature card background | `#f8fdf9` |
| `--tint-border` | `#d7e7e9` | Feature card border, cta-strip border | `#d4edd9` |
| `--tint-bg-2` | `#f0f7f8` | CTA strip background | `#f3faf5` |
| `--tint-divider` | `#e5eef0` | `<hr class="divider">`, FAQ item borders | `#e8f2ea` |

Neutral grays (`#111`, `#444`, `#555`, `#777`, `#999`, `#333`) are unchanged — only the brand
hue shifted from green to slate-teal.

Hero gradient: `linear-gradient(135deg, #22343a 0%, #34505a 55%, #4f8890 100%)`

## Logo & favicon

- `site/logo.png` — full lockup (icon + wordmark), 480×170, resized from
  `Images/HideZero new logo.png`. Has an opaque white background baked in (not transparent),
  so it's placed inside a white rounded chip when it sits on a dark nav bar — don't drop it
  directly on a colored background.
- `site/favicon.png` — 128×128, cropped to just the icon mark (no wordmark) from the same
  source file, bbox `[44,198] × [74,228]` in the original 858×303 image.
- Nav pattern (all 4 pages): dark `.site-nav` strip (`#22343a`) containing a white chip
  (`border-radius: 10px`, `padding: 8px 18px`) wrapping `logo.png` at `height: 32px`, linking
  to `/`.

## Pages using this theme

`index.html`, `privacy.html`, `terms.html`, `support.html` — each inlines its own `<style>`
block; keep all four in sync when a token changes here.
