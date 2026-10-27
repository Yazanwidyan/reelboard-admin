# ReelBoard Admin

The admin website for [ReelBoard](../Reelboard): a dashboard, users, movies and their Taste DNA vibes, collections and clubs. It's a React app (Vite, React Router, TanStack Query) that talks to the [backend](../Reelboard-backend)'s `/api/admin` endpoints, and the backend serves it at `/admin`.

## Who can sign in

Sign in with a normal ReelBoard account. Only accounts whose email is in the backend's `ADMIN_EMAILS` get past the sign-in page, and the backend checks it again on every admin request. In `Reelboard-backend/.env`:

```
ADMIN_EMAILS=you@example.com,someone@example.com
```

Restart the backend after changing it.

## Running it

**Through the backend (the usual way):** build it once, then open `http://localhost:4000/admin`.

```bash
npm install
npm run build        # into dist/, which the backend serves
```

Rebuild after changing the admin site's code. The backend picks up the new files without a restart.

**While working on it:** `npm run dev` serves it at `http://localhost:5174/admin/` with instant reloads. It passes `/api` requests to the backend on port 4000, so keep that running.

## What each section does

- **Dashboard:** accounts, active people (today / this week / this month), what's been watched, saved and tiered, sign-ups for the last 30 days, the most watched and most S-tiered movies, and how many people started and finished each saga.
- **Users:** search accounts by name, @handle or email (or list only Pro or suspended ones). Open one to see their level, library, tiers and recent activity, or to delete the account (you type their handle to confirm). You can't delete your own account here. Give or take away ReelBoard Pro there too (for a month, a year or with no end) — until the app stores sell it, this is how people get it.
- **Movies & vibes:** the pool, the other movies the server has stored, or a search across all of TMDB. Open a movie to:
  - hand-tune its six Taste DNA scores and up to three themes
  - set its franchise
  - put it in or take it out of the pool
- **Collections** ("sagas" to the API): every collection with its ranks and progress. Create, edit or delete one, with a preview of how it looks in the app:
  - its films: picked by hand (from the pool or any TMDB search), or a rule — a TMDB collection (or several), a director, an actor's lead roles or a studio, with a minimum vote count and how many to keep — previewed from TMDB as you build it
  - its ranks, each by film count or by a share of the films
  - its picture: automatic, or one of its films' backdrops, the franchise's backdrop or the person's photo
- **Clubs:** every club with its owner and size. Open one to rename it, change or clear its description, or take films off its shared board; or remove it.
- **Reports:** what people reported from the app (a person, one of a friend's lists, a club they're in), one case per reported thing, most-reported first, with a count by Reports in the sidebar. Close a case — and every report in it — by removing the list or club, suspending its owner, marking it handled (you fixed it yourself), or dismissing it.
- **Log:** everything admins changed here — who, what and when — filterable by kind (reports, accounts, lists, clubs, collections, movies).

## Where changes go

Edits to movies and collections are **live** in the app straight away. Everyone's XP and level is recomputed, since saga ranks are worth XP.

They're also written to `Reelboard-backend/data/curation.json`, so `npm run build-pool` keeps them, and git shows them as a reviewable diff. Commit that file to keep the changes.

- **A vibe or franchise** is saved with the movie's entry.
- **Taking a movie out of the pool** lists it under `excluded`, so build-pool leaves it out too.
- **A collection's films** are saved as its rule (`from: { tmdbCollections }`, `{ director }`…), which `npm run build-pool` resolves the same way, so new releases join on a rebuild; or, when picked by hand, as an explicit list (`from: { ids }`).
- **A picked picture** is saved as the collection's `art`, and **share ranks** as `{ share: 0.6 }`.
