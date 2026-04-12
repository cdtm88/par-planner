# Technology Stack

**Analysis Date:** 2026-04-12

## Languages

**Primary:**
- TypeScript 5.9.2 - Full app codebase and configuration
- JavaScript - Runtime execution (Expo/React Native)

**Secondary:**
- JSON - Configuration and fixtures (app.json, tsconfig.json, package.json)

## Runtime

**Environment:**
- Node.js (v23.11.0 or compatible)
- Expo SDK 54.0.33 - React Native app framework

**Package Manager:**
- npm (lockfile present: package-lock.json)

## Frameworks & Core Libraries

**UI/Navigation:**
- React 19.1.0 - Component framework
- React Native 0.81.5 - Cross-platform mobile UI
- Expo Router 6.0.23 - File-based routing (Expo)
- Expo 54.0.33 - EAS build, native modules, development server

**State Management:**
- Zustand 5.0.12 - Lightweight state store with middleware (persist)

**Status/Platform:**
- Expo Status Bar 3.0.9 - App status bar handling
- React Native Safe Area Context 5.6.0 - Safe area layout support
- React Native Screens 4.16.0 - Navigation performance optimization

**Async Storage:**
- @react-native-async-storage/async-storage 2.2.0 - Persistent device storage (JSON serialization)

## Development & Testing

**Testing:**
- Jest 29.7.0 - Test runner
- jest-expo 54.0.17 - Jest configuration preset for Expo
- @testing-library/react-native 13.3.3 - Component testing utilities
- @testing-library/jest-native 5.4.3 - Jest matchers for React Native

**Type Checking:**
- TypeScript 5.9.2 (extends expo/tsconfig.base with strict mode enabled)

**Build/Dev Tools:**
- Expo CLI (via expo package) - Development server, builds, deployment

## Key Dependencies by Purpose

**Data Persistence:**
- AsyncStorage (via @react-native-async-storage) - On-device JSON storage with Zustand middleware

**HTTP Client:**
- Fetch API (native) - Course search and course detail requests

**Deep Linking:**
- expo-linking 8.0.11 - URL scheme handling for deep links and navigation

**Configuration:**
- expo-constants 18.0.13 - Runtime configuration and environment access

## Configuration

**Environment:**
- Expo-specific configuration in `app.json`
- TypeScript with strict mode enabled (`tsconfig.json`)
- Private npm package (not published)

**Environment Variables:**
- `EXPO_PUBLIC_MAPS4GOLF_API_KEY` - Maps4Golf API authentication (optional in development, required for production)
- Expo's `EXPO_PUBLIC_*` prefix allows public environment variables in bundled app code

**Build Configuration:**
- Expo new architecture enabled (`newArchEnabled: true` in app.json)
- iOS tablet support enabled
- Android edge-to-edge display enabled
- Light UI style (configurable)

## Platform Requirements

**Development:**
- Node.js v23 or compatible
- npm package manager
- Expo CLI (installed via npm)
- iOS/Android development tools (optional, for native builds)
- Xcode (for iOS) or Android Studio (for Android)

**Runtime - iOS:**
- iOS 13+ (inferred from Expo SDK 54 requirements)

**Runtime - Android:**
- Android API 24+ (minimum)

**Runtime - Web:**
- Modern browser with ES2020+ support

## Database & Storage

**Primary Storage:**
- AsyncStorage (local device) - Player profile, cached courses
- No backend database server configured

**Offline Capability:**
- Permanent course cache via Zustand persist + AsyncStorage
- Player profile persistence on device
- Game plans stored locally with permanent cache pattern

## Architecture Notes

**Fixture-based Development:**
- Development mode uses JSON fixtures when `EXPO_PUBLIC_MAPS4GOLF_API_KEY` is not set
- `fixtures/search-sample.json` - Course search results
- `fixtures/course-sample.json` - Full course detail with holes and geodata
- `fixtures/strategy-sample.json` - Game plan strategies
- Simulated 300-500ms network delays in fixture mode for UX testing

**App Schema:**
- Scheme registered as "parplanner" for deep linking

---

*Stack analysis: 2026-04-12*
