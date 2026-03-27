# Frontend Components

## Component Tree

```
RootLayout (layout.tsx)
  └── ClerkProvider
        ├── LandingPage (page.tsx)         — "/" route
        ├── SignIn (sign-in/page.tsx)       — "/sign-in"
        ├── SignUp (sign-up/page.tsx)       — "/sign-up"
        └── ChatPage (chat/page.tsx)        — "/chat" (protected)
              ├── SearchModal (Cmd+K)
              ├── SettingsModal (font chooser)
              ├── Sidebar (+ settings gear button)
              ├── ChatArea
              │     ├── MessageActions (hover toolbar)
              │     │     ├── EmojiPicker (reaction)
              │     │     ├── Reply button
              │     │     ├── Edit button (own msgs)
              │     │     └── Delete button (own msgs)
              │     ├── ReactionBar (per message)
              │     └── ReplyBar (input area)
              └── MembersPanel (toggleable)
```

## ChatPage (`app/chat/page.tsx`)

**The brain of the app.** All state lives here and flows down as props.

### State

| State | Type | Purpose |
|-------|------|---------|
| `rooms` | `Room[]` | All chat rooms (with unread counts) |
| `activeRoomId` | `string \| null` | Currently selected room |
| `messages` | `Message[]` | Messages in active room (with reactions, edit status, reply) |
| `members` | `Member[]` | Members of active room |
| `showMembers` | `boolean` | Toggle right panel |
| `loading` | `boolean` | Initial load spinner |
| `typingUsers` | `string[]` | Usernames currently typing |
| `searchOpen` | `boolean` | Cmd+K search modal |
| `settingsOpen` | `boolean` | Settings modal (font chooser) |
| `replyingTo` | `Message \| null` | Message being replied to |
| `sseRef` | `useRef<EventSource>` | SSE connection ref |
| `userMapRef` | `useRef<Map>` | Cache of userId → {username, avatar} |
| `lastReadRef` | `useRef<Map>` | Cache of roomId → lastReadAt |

### Effects

1. **Cmd+K shortcut** — Global keyboard listener for search
2. **Sync user** — Upserts Clerk user to DynamoDB on load
3. **Load rooms** — Fetches rooms + computes unread counts per room
4. **Load room data** — On room change: auto-join, register presence, mark as read, fetch messages+members
5. **Presence polling** — Every 10s re-fetch members + connections for online status
6. **Mark as read** — Calls `markRead()` on room enter, clears unread badge
7. **SSE subscription** — Listens for 6 event types: new_message, message_deleted, message_edited, typing, stop_typing, reaction_update

### Key Handlers

| Handler | What it does |
|---------|-------------|
| `handleSend(content)` | Optimistic add (with reply data) + `api.sendMessage()` + stop typing |
| `handleDeleteMessage(id, sortKey)` | Optimistic remove + `api.deleteMessage()` |
| `handleEditMessage(id, sortKey, content)` | Optimistic update + `api.editMessage()` |
| `handleToggleReaction(id, sortKey, emoji)` | Optimistic toggle + `api.toggleReaction()` |
| `handleTypingStart()` | Send typing indicator, auto-stop after 3s idle |
| `handleCreateRoom(name, desc)` | Creates room, joins, switches to it |

## Sidebar (`components/chat/sidebar.tsx`)

**260px left panel.**

### Props
```typescript
{ rooms, activeRoomId, onSelectRoom, onCreateRoom, onOpenSearch }
```

### Features
- **Header**: "Townhall" title + search button (opens Cmd+K modal)
- **Channel list**: Scrollable, active = black bg, unread = bold + red badge
- **Unread badges**: Red pill with count (99+ cap)
- **Create channel**: Modal with name (auto-slugified) + description
- **User panel**: Clerk `<UserButton>`, full name, green "Active" dot

## ChatArea (`components/chat/chat-area.tsx`)

**The main content area.**

### Props
```typescript
{ roomName, roomDescription, messages, onSendMessage, onDeleteMessage,
  onEditMessage, onToggleReaction, onToggleMembers, showMembers,
  typingUsers, onTyping, currentUserId, replyingTo, onReply, onCancelReply }
```

### Message Rendering

**Grouping rules** (Discord-style):
- Messages grouped by date (divider: "Today", "Yesterday", "Monday, March 23")
- Within a date, same author within 5 min AND no reply → **compact** (no avatar, time on hover)
- Different author or >5 min gap or has reply → **full** (avatar + name + timestamp)

### Hover Actions Toolbar

On message hover, a floating toolbar appears with:
- **React** — Opens emoji picker (8 quick emojis: thumbs up, heart, joy, party, eyes, fire, pray, check)
- **Reply** — Sets `replyingTo` state, shows reply bar above input
- **Edit** (own messages) — Switches to inline edit mode
- **Delete** (own messages) — Removes message

### Reactions (ReactionBar)

Emoji reactions displayed below message content:
- Pill badges: emoji + count
- Blue highlight if current user reacted
- Click to toggle own reaction

### Inline Editing

When edit mode active on a message:
- Text content replaced with input field
- Enter to confirm, Escape to cancel
- (edited) label shown on edited messages

### Reply

- Reply bar appears above input with quoted preview
- Messages with replies show reply badge above content
- Escape to cancel reply

### Typing Indicators

Animated bouncing dots + "{name} is typing" below messages.

### Input

- Auto-sizing `<textarea>` (grows up to 150px)
- Enter to send, Shift+Enter for newline, Escape to cancel reply
- Rich text toolbar: Bold, Italic, Code, Link, Blockquote
- File upload via paperclip button
- Calls `onTyping()` on input change

## SearchModal (`components/chat/search-modal.tsx`)

**Cmd+K search overlay.**

### Props
```typescript
{ open, onClose, onNavigate, rooms }
```

### Features
- Debounced search (300ms) against `api.searchMessages()`
- Results show: room name, sender, content, date
- Click result → navigates to that room
- ESC to close
- Loading spinner during search

## MembersPanel (`components/chat/members-panel.tsx`)

**240px right panel (toggleable).**

### Sections
- **Online** — Green dot, full opacity
- **Offline** — Gray dot, 50% opacity
- Counts shown next to section headers

## Onboarding (`components/chat/onboarding.tsx`)

5-step interactive tour. Sets `localStorage` flag on completion.

## Feature Status

| Feature | Status |
|---------|--------|
| CRUD rooms | Done |
| Send/receive messages | Done (optimistic + SSE) |
| Delete messages | Done (hover action + SSE broadcast) |
| Edit messages | Done (inline edit + SSE broadcast) |
| Message reactions | Done (emoji picker + SSE broadcast) |
| Reply/threading | Done (reply bar + preview badge) |
| Typing indicators | Done (SSE typing events) |
| Message search | Done (Cmd+K modal) |
| Unread badges | Done (count on sidebar) |
| Mark as read | Done (auto on room enter) |
| Presence/online status | Done (polling every 10s) |
| File uploads | Done (S3 + presigned URLs) |
| Rich text (markdown) | Done |
| Onboarding | Done (5-step tour) |

## Related
- [[frontend/API Client]]
- [[frontend/Feature Status]]
- [[architecture/Overview]]
