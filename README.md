# Vibed

Vibed is an Expo-managed React Native app foundation for a mood-routed short-form video platform.

## App setup

1. Install Node.js LTS and npm.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` for local development. Set the same public client values in the EAS `preview` and `production` environments for cloud builds.
4. Start Expo with `npm start` and open the project in Expo Go or an Android emulator.
5. Run `npm run typecheck` for the TypeScript check.

The app includes email/password authentication, profile and vibe onboarding, a personalized short-video feed, likes and comments, creator discovery and follows, video uploads, direct messages, profile editing, blocking, and content reports. Live rooms can be discovered, but joining/hosting live video is not enabled yet.

### Supabase setup

The core schema creates the profile trigger, feed/engagement RPCs, and RLS policies for users, videos, follows, messages, reports, blocks, and live rooms. Run the core schema first, then run these additional SQL files in the Supabase SQL Editor:

1. [`supabase/app-functions.sql`](./supabase/app-functions.sql) adds the authenticated unlike RPC so video like counts stay consistent.
2. [`supabase/comments.sql`](./supabase/comments.sql) adds comments with authenticated read access and owner-only write/delete policies.
3. [`supabase/storage.sql`](./supabase/storage.sql) creates public-read `videos` and `avatars` buckets. Upload, update, and delete policies restrict writes to the authenticated user’s own folder.

Video uploads are stored at `videos/<user-id>/...`; profile photos are stored at `avatars/<user-id>/...`. Public read access is needed for feed playback and profile photos. Never put a Supabase service-role key in the app.

The GitHub workflow builds an APK with the `preview` profile and an app bundle with the `production` profile. Keep the Supabase URL and anon key in EAS environment variables, not in source control.

## Environment variables

- `EXPO_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Supabase publishable/anon client key. Never put a service-role key in the app.

Live video is not enabled yet. If it is added later, Agora access tokens must be generated server-side and must not be stored in this app. Expo public variables are bundled into the client, so they must not contain secrets.
