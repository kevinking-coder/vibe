# Vibed

Vibed is an Expo-managed React Native app foundation for a mood-routed short-form video platform.

## App setup

1. Install Node.js LTS and npm.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` for local development. Set the same public client values in the EAS `preview` and `production` environments for cloud builds.
4. Start Expo with `npm start` and open the project in Expo Go or an Android emulator.
5. Run `npm run typecheck` for the TypeScript check.

The app includes email/password authentication, profile and vibe onboarding, a vibe-filtered feed, video and photo posts, likes and comments, creator discovery and follows, direct messages, profile editing, blocking, settings, and content reports. Live rooms can be discovered, but joining/hosting live video is not enabled yet.

### Supabase setup

The core schema creates the profile trigger, feed/engagement RPCs, and RLS policies for users, videos, follows, messages, reports, blocks, and live rooms. In the Supabase SQL Editor, run your existing core schema first, then apply:

1. [`supabase/app-functions.sql`](./supabase/app-functions.sql) adds the authenticated unlike RPC so video like counts stay consistent.
2. [`supabase/migrations/20261028020000_social_features.sql`](./supabase/migrations/20261028020000_social_features.sql) adds photo/video metadata, privacy, comments/replies/likes, saved posts, user settings, message attachments, report reasons, and the updated feed policy/function. It is designed to run once after the core schema.

Media uploads use Cloudinary unsigned upload presets. Create an unsigned preset in Cloudinary, configure allowed image/video formats and reasonable size limits, then set `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` and `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET` in `.env` and in both EAS build environments. Supabase stores only optimized media URLs and post metadata; keep service-role and Cloudinary API secrets out of the app.

The GitHub workflow builds an APK with the `preview` profile and an app bundle with the `production` profile. Keep the Supabase URL and anon key in EAS environment variables, not in source control.

## Environment variables

- `EXPO_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Supabase publishable/anon client key. Never put a service-role key in the app.
- `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME`: Cloudinary cloud name.
- `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET`: unsigned Cloudinary upload preset used by the app.

### Expo packages

Install SDK-compatible native packages with:

```sh
npx expo install expo-image-picker expo-video expo-video-thumbnails expo-haptics expo-clipboard expo-sharing expo-media-library expo-file-system expo-font expo-linear-gradient @expo/vector-icons
```

Live video is not enabled yet. If it is added later, Agora access tokens must be generated server-side and must not be stored in this app. Expo public variables are bundled into the client, so they must not contain secrets.
