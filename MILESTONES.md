# Cannon Math — must-read (do not over-engineering)

Keep this file current after every slice. Do not add auth, extra shops, or new systems unless a milestone below says so.

## Decision (locked)

- Auth: **OFF**. Device gets a random callsign. No sign-in.
- Database: **ON**, unowned rows (opaque `user_id`, generated names only).
- Identity / gems / local best: **localStorage** (`cannon-math-pilot` + `cannon-math-save-v1`).
- Global week board + crowns: Postgres (`pilots`, `weekly_scores`, `legends`).
- Dock: Stats / Board / Daily / Shop. **No Upgrade.**

## Milestones

| # | Item | Status |
|---|---|---|
| 0 | Glance existing garage / title / save | **done** |
| 1 | Remove Upgrade (same as Shop) | **done** |
| 2 | Stable device name + gems + local best | **done** in code — verify reload |
| 3 | Weekly global board, you can see your row | **in progress** — post uses best score |
| 4 | Monday wipe; Top 3 crowns stay until beaten | **done** (`week_id` + `legends` cap 3) |
| 5 | Typecheck + build + smoke | **going to** |

## Out of scope

- Sign-in, rename UI, friend lists, seasons UI, extra currencies
- Rewriting the 3D runner, themes, or garage
