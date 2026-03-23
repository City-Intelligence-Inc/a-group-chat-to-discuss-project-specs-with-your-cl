# Mobile App Overview

> React Native (Expo SDK 55) — iOS + Android from one codebase.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo SDK 55 |
| Language | TypeScript |
| Auth | Clerk (`@clerk/clerk-expo`) + Google/Apple OAuth |
| Navigation | React Navigation (Stack) |
| Token Storage | `expo-secure-store` (iOS Keychain / Android Keystore) |
| Icons | `@expo/vector-icons` (Ionicons) |
| Build | EAS Build (cloud) |
| Distribution | TestFlight (iOS) / Play Store (Android) |

## Project Structure

```
mobile-app/
├── App.tsx                     # ClerkProvider + SafeAreaProvider + Navigation
├── app.json                    # Expo config (bundle ID, EAS project ID)
├── eas.json                    # Build profiles (dev, preview, production)
├── src/
│   ├── navigation/
│   │   └── AppNavigator.tsx    # Auth guard: signed in → Chat, out → SignIn
│   ├── screens/
│   │   ├── ChatScreen.tsx      # Main chat (state hub, drawers)
│   │   ├── SignInScreen.tsx    # Email/password + Google/Apple OAuth
│   │   └── SignUpScreen.tsx    # Sign-up + email verification + OAuth
│   ├── components/chat/
│   │   ├── Sidebar.tsx         # Channel list drawer (left)
│   │   ├── ChatArea.tsx        # Messages + input (main screen)
│   │   └── MembersPanel.tsx    # Members drawer (right)
│   ├── services/
│   │   └── api.ts              # API client (shared with web patterns)
│   ├── constants/
│   │   ├── theme.ts            # Color palette (matches web Townhall theme)
│   │   ├── types.ts            # Room, Message, Member interfaces
│   │   └── api.ts              # API_URL, WS_URL config
│   └── hooks/
│       └── useTokenCache.ts    # Clerk token persistence (SecureStore)
└── ios/                        # Native iOS project (from expo prebuild)
```

## How It Maps to Web

| Web Component | Mobile Equivalent | Adaptation |
|---------------|-------------------|------------|
| `sidebar.tsx` (260px panel) | `Sidebar.tsx` (modal drawer from left) | Swipe/hamburger to open |
| `chat-area.tsx` (flex center) | `ChatArea.tsx` (full screen) | FlatList instead of div scroll |
| `members-panel.tsx` (240px panel) | `MembersPanel.tsx` (modal drawer from right) | Tap people icon to open |
| Clerk `<UserButton>` | Sign-out button in sidebar footer | No Clerk UI component on mobile |
| shadcn `<Dialog>` | React Native `<Modal>` | Native modal for create channel |
| Tailwind classes | `StyleSheet.create()` | Same colors, converted to RN styles |

## EAS Build

| Profile | Purpose | Distribution |
|---------|---------|-------------|
| `development` | Dev client with hot reload | Internal (device) |
| `preview` | Simulator build for testing | Internal |
| `production` | App Store / TestFlight | Store |

- **EAS Project**: `@arihantchoudhary/chatroom-mobile`
- **Bundle ID**: `com.chatroom.mobile`
- **App Name**: "Chat Room"

## Related
- [[mobile/Components]]
- [[mobile/Auth]]
- [[architecture/Overview]]
