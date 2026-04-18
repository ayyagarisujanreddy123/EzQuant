---
name: design-system
description: Generate consistent design system for project. Run once at start of hackathon to establish tokens.
---

# Design System Generation

Source: ui-ux-pro-max plugin (v2.5.0)

## Generate full design system
```
/design-system create for [product type] in [style]
```

## Token structure
```
colors/
  primary: [brand color]
  secondary: [accent]
  neutral: [grays]
  semantic: success/warning/error/info

typography/
  scale: xs/sm/base/lg/xl/2xl/3xl/4xl
  weight: regular(400)/medium(500)/semibold(600)/bold(700)

spacing/
  scale: 4px base unit (4/8/12/16/24/32/48/64/96)

radius/
  sm: 4px | md: 8px | lg: 12px | xl: 16px | full: 9999px

shadows/
  sm/md/lg/xl + colored glow variants
```

## Tailwind config
Run `/design-system tailwind` to generate tailwind.config.js with custom tokens.

## Component defaults
- Buttons: 3 variants (primary/secondary/ghost) × 3 sizes
- Inputs: consistent height (36px sm / 40px md / 44px lg)
- Cards: consistent padding + shadow + radius
