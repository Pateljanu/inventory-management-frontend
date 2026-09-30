# Changes to vendored shadcn components

`components/ui` holds shadcn CLI output (Base UI, `base-nova` style) and is treated as vendored
code. Allowed edits are added variants and accessibility fixes, each logged here. Before
upgrading a component, run `npx shadcn@latest add <name> --diff` and re-apply these edits.

| File | Change | Why |
|---|---|---|
| `sonner.tsx` | Reads the theme from `usePreferences()` instead of `next-themes` | The app has its own theme provider (light / dark / system + Sunlight); `next-themes` is not installed |
| `scroll-area.tsx` | Removed the unused `import * as React` | Fails `tsc` with `noUnusedLocals` |
| `combobox.tsx` | `aria-label` on `ComboboxTrigger` ("Show options") and `ComboboxClear` ("Clear") (overridable via props) | Icon-only buttons had no accessible name |
