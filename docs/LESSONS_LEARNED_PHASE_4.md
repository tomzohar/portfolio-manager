# Lessons Learned - Phase 4

## What worked well
- Removing the exclude-cash toggle simplified frontend state and UI wiring.
- Aligning DTOs and shared types early avoided repeated API contract drift.

## What didn't work
- Manual API verification was blocked by missing local Postgres/Docker.

## What we'd do differently
- Set up the local database container before manual endpoint validation.

## Questions that revealed issues
- Which environments still depend on the exclude-cash query parameter?
