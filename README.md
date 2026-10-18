# Vibed

Vibed is an Expo-managed React Native app foundation for a mood-routed short-form video platform.

## Phase A setup

1. Install Node.js LTS and npm.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env` and set the Supabase project URL and anon key.
4. Start Expo with `npm start` and open the project in Expo Go or an Android emulator.
5. Run `npm run typecheck` for the TypeScript check.

NativeWind v4 is wired through `global.css`, Babel, Tailwind, and Metro. React Navigation, Zustand, Supabase, AsyncStorage, and the React Native URL polyfill are included in the dependency foundation. The initial screen is intentionally only a Phase A shell; feature flows start in later phases.

## Environment variables

- `EXPO_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Supabase publishable/anon client key. Never put a service-role key in the app.
- `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME`: Cloudinary cloud name, needed in Phase E.
- `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET`: unsigned upload preset for client uploads, needed in Phase E.
- `EXPO_PUBLIC_AGORA_APP_ID`: Agora project App ID, needed in Phase I.

Agora access tokens must be generated server-side and must not be stored in this app. Expo public variables are bundled into the client, so they must not contain secrets.
