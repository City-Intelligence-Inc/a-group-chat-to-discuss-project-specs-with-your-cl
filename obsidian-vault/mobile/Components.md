# Mobile Components

## Component Tree

```
App.tsx
  └── ClerkProvider
        └── SafeAreaProvider
              └── AppNavigator
                    ├── [signed out] SignInScreen
                    ├── [signed out] SignUpScreen
                    └── [signed in]  ChatScreen
                          ├── ChatArea (main screen)
                          ├── Sidebar (left drawer modal)
                          └── MembersPanel (right drawer modal)
```

## ChatScreen (`screens/ChatScreen.tsx`)

**The state management hub** — same role as `chat/page.tsx` on web.

### State

| State | Type | Purpose |
|-------|------|---------|
| `rooms` | `Room[]` | All chat rooms |
| `activeRoomId` | `string \| null` | Currently selected room |
| `messages` | `Message[]` | Messages in active room |
| `members` | `Member[]` | Members of active room |
| `showSidebar` | `boolean` | Left drawer visibility |
| `showMembers` | `boolean` | Right drawer visibility |
| `loading` | `boolean` | Initial load spinner |

### Effects

1. **Sync user + load rooms** — On mount, upserts Clerk user, fetches rooms, seeds "general" if empty
2. **Load room data + WebSocket** — When `activeRoomId` changes, fetches messages + members, opens WS, registers connection
3. **Cleanup** — Closes WS and removes connection on room change / unmount

### Key Behaviors

| Behavior | Detail |
|----------|--------|
| Optimistic sends | Message added instantly, rolled back on failure |
| WebSocket real-time | Listens for new messages, deduplicates by ID |
| Auto-join | Joins room on create |
| Connection tracking | Registers presence per room |

## Sidebar (`components/chat/Sidebar.tsx`)

**Drawer from left side (modal).**

### Props
```typescript
{ rooms, activeRoomId, onSelectRoom, onCreateRoom, userName, userAvatar, onClose, onSignOut }
```

### Features
- "Townhall" header with close button
- Channel list with `#` prefix, active = dark pill (neutral-900)
- Create channel modal (name with # prefix + optional description)
- User footer: avatar with online dot, name, "Active" status, sign-out button

## ChatArea (`components/chat/ChatArea.tsx`)

**Full screen — the main view.**

### Props
```typescript
{ roomName, roomDescription, messages, onSendMessage, onToggleMembers, onOpenSidebar, showMembers, typingUsers }
```

### Header
- Hamburger menu (opens sidebar) + `# channel-name` + description + people icon (toggles members)

### Message Rendering (FlatList)

Uses a flat list with mixed item types:
- `welcome` — Empty channel banner with `# roomName`
- `date` — Date divider ("Today", "Yesterday", "Monday, March 23")
- `message` — Full (avatar + name + time) or compact (indented, time only)

**Compact rule**: Same author within 5 minutes, same date.

### Input
- Multiline `<TextInput>` (max 120px height)
- Send button (dark, disabled when empty)
- `KeyboardAvoidingView` for iOS keyboard handling

## MembersPanel (`components/chat/MembersPanel.tsx`)

**Drawer from right side (modal).**

### Props
```typescript
{ members: Member[], onClose: () => void }
```

### Sections
- **Online** — Emerald green dot, full opacity
- **Offline** — Gray dot, 50% opacity
- Separator between sections
- Count per section in header

## Design System (theme.ts)

Matches web's Townhall light theme:

| Token | Value | Usage |
|-------|-------|-------|
| `text` | `#171717` | Primary text |
| `textMuted` | `#a3a3a3` | Placeholders, timestamps |
| `sidebar` | `#fafafa` | Sidebar background |
| `sidebarActive` | `#171717` | Active channel pill |
| `border` | `#e5e5e5` | All borders |
| `green` | `#10b981` | Online dots |
| `white` | `#ffffff` | Main background |
| `primary` | `#171717` | Buttons |

## Related
- [[mobile/Overview]]
- [[frontend/Components]] (web equivalent)
