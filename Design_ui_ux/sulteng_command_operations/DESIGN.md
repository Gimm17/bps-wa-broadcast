---
name: Sulteng Command Operations
colors:
  surface: '#FFFFFF'
  surface-dim: '#d2dcdb'
  surface-bright: '#f2fbfb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#ecf6f5'
  surface-container: '#e6f0ef'
  surface-container-high: '#e0eae9'
  surface-container-highest: '#dbe4e4'
  on-surface: '#141d1d'
  on-surface-variant: '#564239'
  inverse-surface: '#293232'
  inverse-on-surface: '#e9f3f2'
  outline: '#8a7267'
  outline-variant: '#ddc1b4'
  surface-tint: '#9e4200'
  primary: '#9e4200'
  on-primary: '#ffffff'
  primary-container: '#e37434'
  on-primary-container: '#4e1d00'
  inverse-primary: '#ffb691'
  secondary: '#006a6a'
  on-secondary: '#ffffff'
  secondary-container: '#97f2f1'
  on-secondary-container: '#007070'
  tertiary: '#006a6a'
  on-tertiary: '#ffffff'
  tertiary-container: '#00a4a4'
  on-tertiary-container: '#003232'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcb'
  primary-fixed-dim: '#ffb691'
  on-primary-fixed: '#341100'
  on-primary-fixed-variant: '#793100'
  secondary-fixed: '#97f2f1'
  secondary-fixed-dim: '#7bd5d5'
  on-secondary-fixed: '#002020'
  on-secondary-fixed-variant: '#004f4f'
  tertiary-fixed: '#7bf5f5'
  tertiary-fixed-dim: '#5bd9d8'
  on-tertiary-fixed: '#002020'
  on-tertiary-fixed-variant: '#004f50'
  background: '#f2fbfb'
  on-background: '#141d1d'
  surface-variant: '#dbe4e4'
  action-orange: '#E37434'
  authority-teal: '#007979'
  operational-teal: '#24B1B1'
  warm-sand: '#FFE2AF'
  warm-sand-subtle: '#FFF8EC'
  canvas: '#F7F7F3'
  charcoal-ink: '#172020'
  muted-slate: '#66706F'
  structural-border: '#DCE2DF'
  error-red: '#B42318'
  error-red-subtle: '#FEF3F2'
typography:
  headline-xl:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Geist
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Geist
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  caption:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  code-lg:
    fontFamily: Geist Mono
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  code-md:
    fontFamily: Geist Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  code-sm:
    fontFamily: Geist Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

The design system establishes a focused, trustworthy, and authoritative operational command environment tailored specifically for the official statistical institution of Central Sulawesi (BPS Provinsi Sulawesi Tengah). The platform serves as an internal operational engine for scheduling, validating, and monitoring broadcast communications via the Meta WhatsApp Cloud API to public citizens and internal civil servants.

The visual style blends **Corporate Modern** with **Structural Utility**:
- **High-Clarity Density:** Calibrated at 7/10 density to maximize information throughput for data operators without visual friction or cognitive fatigue.
- **Structural Orthogonality:** Relying on structural lines, precise tabular grouping, persistent status indicators, and clean content boundaries rather than decorative floating cards or generic container nesting.
- **Authoritative Restraint:** Visual variance remains low (4/10) to reinforce predictable operational scanning, reserving chromatic accents solely for active tasks, systemic warnings, or urgent anomalies.
- **Tone & Copy:** Rigorous, sober, humane, and institutional. Copy strictly adopts Indonesian sentence case, explicit system feedback, explicit timezone stamping (`WITA / Asia/Makassar`), and zero empty marketing prose.

## Colors

The palette delivers visual hierarchy through strictly governed functional roles. It enforces clear boundaries between structural authority, high-intent actions, analytical visualization, and diagnostic states.

- **Primary Action (Action Orange `#E37434`):** Exclusively reserved for primary call-to-actions (e.g., "Buat Campaign", "Kirim Sekarang"), active inputs, selection confirmations, and critical focus outlines. Never used decoratively or across large filled surfaces.
- **Structural Authority (Authority Teal `#007979`):** Represents institutional permanence and organizational structure. Dictates the left navigation rail, active sidebar menu items, primary section tags, and anchored dashboard banners.
- **Data & Telemetry (Operational Teal `#24B1B1`):** Represents steady-state health, delivery/read analytical metrics, funnel visualizations, and secondary data readouts. Distinct from Action Orange to prevent conflating data summaries with interactive buttons.
- **Attention & Highlight (Warm Sand `#FFE2AF` / Subtle `#FFF8EC`):** Indicates low-severity operational warnings, selected table rows, deadline proximity, and manual intervention reminders.
- **Surfaces & Borders:** The default background Canvas (`#F7F7F3`) provides a warm, low-fatigue base, complemented by crisp Surface white (`#FFFFFF`) for tables and forms. Structural lines and boundaries strictly utilize Structural Border (`#DCE2DF`).
- **Typography & Diagnostics:** Charcoal Ink (`#172020`) ensures high-contrast readability without the harshness of pure black. Secondary metadata uses Muted Slate (`#66706F`). Error Red (`#B42318`) is strictly deployed with explicit icons and descriptive labels.

## Typography

The typography strategy leverages two precise typeface families: **Geist** for systemic UI hierarchies and **Geist Mono** for operational data density and technical telemetry.

- **Primary Interface (Geist):** Handles headings, administrative controls, navigation menus, labels, and standard narrative text. Designed for modern screen rendering with tight tracking and balanced x-height.
- **Telemetry & Identity (Geist Mono):** Dedicated to technical metrics, phone masks (e.g. `+62 811-450-XXXX`), webhook timestamps, transaction tokens (`#51193`), API payloads, and queue numbers. Fixed tabular figures guarantee vertical alignment inside data grids.
- **Hierarchy Guidelines:** Page titles use `headline-lg` (28px desktop, 22px mobile). Section titles use `headline-md` (20px). Tabular content and body forms use `body-md` (14px). Secondary captions and operational metadata are fixed to `caption` or `label-sm` (12px minimum).

## Layout & Spacing

The application shell uses an asymmetric, high-efficiency desktop-first structure engineered for data scanning:
- **Application Shell:** A persistent 260px fixed left sidebar anchored in Authority Teal, a compact 56px sticky operational top bar, and a centered content area spanning a maximum width of 1440px.
- **Grid Structure:** A 12-column layout governed by an 8/4 asymmetric division for operational views. The 8-column segment prioritizes queues, message logs, and tables, while the 4-column segment houses timeline telemetry, batch verification panels, and context drawers.
- **Responsive Adaptations:**
  - **Desktop (>= 1024px):** Persistent sidebar, 24px content margin, 24px column gutters, full horizontal data grids.
  - **Tablet (768px - 1023px):** Collapsible sidebar rail (72px icons), 16px margins, selective table columns.
  - **Mobile (< 768px):** Sidebar collapses into an accessible slide-over drawer, top bar collapses to 52px, layouts reflow to a strict single-column flow, and complex tables morph into stacked tabular summary cards. Horizontal scrolling at the viewport level is strictly prohibited.

## Elevation & Depth

To prevent visual clutter, this design system rejects heavy drop shadows, neon glows, glassmorphic blurs, and decorative gradients. Visual separation is achieved through **structural containment and low-contrast boundaries**:

- **Layer 0 (Canvas):** The base background `#F7F7F3` provides a grounded foundation.
- **Layer 1 (Contained Surfaces):** Data tables, operational forms, and metric groups rest on `#FFFFFF`, framed with a precise 1px solid border (`#DCE2DF`).
- **Layer 2 (Elevated Interactive Surfaces & Floating Drawers):** Contextual detail inspectors, filter popovers, and dialogs utilize `#FFFFFF` surrounded by a 1px border (`#DCE2DF`) and an ambient, teal-tinted shadow: `0 4px 20px -2px rgba(0, 121, 121, 0.08), 0 2px 6px -1px rgba(23, 32, 32, 0.04)`.
- **Status Strips:** Embedded status bars use a 4px left-edge structural line or background tints (`#FFF8EC` for alerts, `#FEF3F2` for failures) rather than dimensional elevations.

## Shapes

The design system adopts a calibrated **Rounded** baseline (`roundedness: 2`) with intentional, component-specific scale refinements:

- **Buttons & Interactive Controls:** 10px to 12px border radius (`rounded-md` to `rounded-lg`), ensuring button surfaces feel defined without looking pill-like.
- **Cards & Data Containers:** 16px border radius (`rounded-xl`), creating soft structural frames around dense table contents and metrics panels.
- **Status Chips & Badges:** 6px radius (`rounded-sm`), maintaining a crisp, architectural stamp aesthetic suitable for metadata tags.
- **Form Controls:** 10px radius, matching the button curvature for visual rhythm across input groupings.

## Components

### Buttons
- **Primary:** Background Action Orange (`#E37434`), text `#FFFFFF`, font-weight 500, radius 10px, min-height 40px (desktop) / 44px (touch). On press, physical micro-translation down by 1px (`transform: translateY(1px)`).
- **Secondary / Outline:** Background transparent, border 1px solid `#DCE2DF`, text Charcoal Ink (`#172020`). Hover background `#F7F7F3`.
- **Destructive:** Background `#FEF3F2`, border 1px solid `#FECDCA`, text Error Red (`#B42318`). On focus/active, background `#FEE4E2`.

### Status Chips
- Compact, 24px height, 6px border radius, font-size 12px (`Geist Mono` or `Geist Medium`).
- Must strictly pair an icon with a localized text label. Color alone is never permitted.
- **States:**
  - *Terjadwal:* Neutral Slate fill (`#F2F4F7`), Slate text (`#344054`), Clock icon.
  - *Antrean:* Sand fill (`#FFF8EC`), Amber text (`#B54708`), Hourglass icon.
  - *Mengirim:* Authority Teal subtle fill (`#E6F2F2`), Teal text (`#007979`), Refresh/Spin icon.
  - *Terkirim:* Operational Teal subtle fill (`#E9F8F8`), Teal text (`#198787`), Checkmark icon.
  - *Dibaca:* Operational Teal fill (`#24B1B1`), White text (`#FFFFFF`), Double Checkmark icon.
  - *Gagal:* Error Red subtle fill (`#FEF3F2`), Red text (`#B42318`), Alert Triangle icon.
  - *Dibatalkan / Dihentikan:* Charcoal Ink subtle fill (`#F0F2F2`), Slate text (`#66706F`), Slash/Stop icon.

### Tables (Core Information Engine)
- Sticky table headers with background `#F7F7F3`, uppercase 12px labels (`label-sm`), border-bottom 1px solid `#DCE2DF`.
- Cell density: 48px row height for standard records, 40px for high-density log views.
- Active or selected rows display a Warm Sand tint (`#FFF8EC`) with a 3px vertical indicator line in Action Orange on the far left.
- Numeric columns, identifiers, and timestamps align right and utilize `Geist Mono`.

### Form Controls & Inputs
- Text inputs, selects, and textareas utilize a white background, 1px border (`#DCE2DF`), 10px radius, and 40px height.
- Labels are persistently visible above inputs in Charcoal Ink (`13px Geist Medium`), with mandatory fields marked by an orange asterisk (`*`).
- Focus state: Border color transitions to Action Orange (`#E37434`) accompanied by an outer ring of `0 0 0 3px rgba(227, 116, 52, 0.15)`.

### Operational Status Strip
- A horizontal health matrix situated above operational views displaying Meta WABA API, Cron Worker, API Absensi, and Silastik connectors.
- Each node exhibits connection status, last sync timestamp in `WITA`, and a direct diagnostic action button for quick recovery.