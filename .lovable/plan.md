## Goal
Make the YouTube main player load the channel's latest video without needing a `VITE_*` build secret (not available on free plan). Move the API call from the browser to a server function that reads a runtime secret.

## Steps

1. **Add runtime secret `YOUTUBE_API_KEY`**
   - Use the secrets tool to request the key.
   - Runtime secrets are available on the free plan (unlike `VITE_*` build secrets, which are baked into the browser bundle and require a paid plan).
   - Bonus: the key stays server-side and is never exposed to visitors.

2. **Extend `src/lib/youtube.functions.ts`** with a new `getLatestVideo` server function:
   - Reads `process.env.YOUTUBE_API_KEY`.
   - Calls `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=UC7eDkZaMYbiURgdv042M2pg&order=date&type=video&maxResults=1&key=...`.
   - Returns `{ videoId: string | null, error: string | null }`.
   - On missing key / network error / empty result, returns a typed error message instead of throwing.

3. **Update `src/components/YouTubeSection.tsx`**:
   - Remove the `useEffect` + `fetch` + `import.meta.env.VITE_YOUTUBE_API_KEY` block.
   - Add `const fetchLatest = useServerFn(getLatestVideo)` and a second `useQuery({ queryKey: ["youtube-latest"], queryFn: () => fetchLatest() })`.
   - On success, set `embedUrl` to `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0` (only if user hasn't clicked a playlist yet).
   - On error, keep the existing `AlertCircle` + fallback message UI.

## What does NOT change
Design, gradient background, social links, podcast section, playlist list, layout, animations — all untouched. Only the data source for the main player changes (browser fetch → server function).

## Why this works
- `import.meta.env.VITE_*` = build-time replacement → requires paid Build Secrets.
- `process.env.*` inside `createServerFn().handler()` = runtime → free plan ✅, same mechanism already used by `getPlaylists`.
