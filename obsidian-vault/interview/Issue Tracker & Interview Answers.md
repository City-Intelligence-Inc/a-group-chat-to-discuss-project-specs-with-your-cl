# Issue Tracker & Interview Answers

> All 17 GitHub issues implemented and closed.

---

## Status Overview

| # | Issue | Status | Priority |
|---|-------|--------|----------|
| 1 | Clerk Auth in Next.js | ✅ DONE | Critical |
| 2 | Discord-Style UI Layout | ✅ DONE | Critical |
| 3 | FastAPI Backend + WS | ✅ DONE | Critical |
| 4 | Database Schema (DynamoDB) | ✅ DONE | Critical |
| 5 | Clerk JWT Middleware | ✅ DONE | Critical |
| 6 | Room Management API | ✅ DONE | Critical |
| 7 | Real-Time Messaging (SSE+WS) | ✅ DONE | Critical |
| 8 | Message History & Persistence | ✅ DONE | High |
| 9 | Active Users & Presence | ✅ DONE | High |
| 10 | Frontend: Room Sidebar | ✅ DONE | Critical |
| 11 | Frontend: Chat Area | ✅ DONE | Critical |
| 12 | AWS App Runner Deployment | ✅ DONE | High |
| 13 | FastAPI Routes for DynamoDB | ✅ DONE | Critical |
| 14 | Typing Indicators & Receipts | ✅ DONE | Medium |
| 15 | Message Search | ✅ DONE | Low |
| 16 | Rich Media (Markdown) | ✅ DONE | Low |
| 17 | Moderation Tools | ✅ DONE | Low |

---

## ✅ COMPLETED ISSUES (12/17)

---

### #1 — Clerk Auth in Next.js Frontend

**What we built:**
- `ClerkProvider` wraps entire app in `frontend/app/layout.tsx`
- Sign-in/sign-up pages at `/sign-in`, `/sign-up` using Clerk's pre-built components
- Clerk middleware in `frontend/proxy.ts` protects `/chat` route — unauthenticated users redirect to `/sign-in`
- `useUser()` hook provides user state throughout the app
- `UserButton` in sidebar for profile management + sign-out

**Key files:** `layout.tsx`, `proxy.ts`, `app/sign-in/[[...sign-in]]/page.tsx`, `app/sign-up/[[...sign-up]]/page.tsx`

**Interview answer:**
> "Clerk handles all auth — sign-up, sign-in, sessions, JWTs, OAuth, MFA. I chose it over custom JWT because it's a take-home — I wanted to spend time on the interesting parts like real-time messaging and data modeling, not reimplementing auth. Clerk middleware protects the /chat route, and useUser() gives me the authenticated user's ID which I sync to DynamoDB on every login."

**If they probe:** "The user sync is an upsert — POST /api/users/ with Clerk ID. If user exists, update username/avatar. If new, create. This means profile changes in Clerk propagate to our DB automatically."

---

### #2 — Discord-Style UI Layout

**What we built:**
- Three-panel layout: sidebar (260px) | chat (flex-1) | members (240px, toggleable)
- Tailwind CSS + shadcn/ui components
- Message grouping by date with "Today" / "Yesterday" / date dividers
- Compact messages for same-author within 5 min, full display otherwise
- 5-step onboarding tour for new users (localStorage flag `townhall_onboarded`)

**Key files:** `components/chat/sidebar.tsx`, `components/chat/chat-area.tsx`, `components/chat/members-panel.tsx`, `components/chat/onboarding.tsx`

**Interview answer:**
> "Discord's three-panel layout is proven UX for chat apps — left for navigation, center for content, right for context. I compact consecutive messages from the same author within a 5-minute window, like Discord does, so conversations feel natural rather than cluttered. The right panel toggles off to give more space."

**Note:** Implemented as light theme (white/neutral), not dark. Would be a CSS variable swap to add dark mode.

---

### #3 — FastAPI Backend Setup

**What we built:**
- FastAPI with CORS middleware (`allow_origins=["*"]` for demo)
- 7 route modules: users, rooms, members, messages, connections, sse, ws
- Auto-generated Swagger docs at `/docs`
- Health endpoint: `GET /api/health`
- Docker container (Python 3.13-slim) for deployment

**Key file:** `backend/app/main.py`

**Interview answer:**
> "FastAPI over Express because: auto-generated Swagger docs (great for a take-home — you can test any endpoint interactively), async-native (critical for SSE streaming), Pydantic validation on every request, and Python is readable in an interview. CORS is `*` for the demo — production would whitelist my frontend domain only."

---

### #4 — Database Schema (DynamoDB)

**What we built — 5 tables via Terraform (`infra/main.tf`):**

| Table | PK | SK | GSIs | Purpose |
|-------|----|----|------|---------|
| `chatroom-dev-users` | userId | — | email-index, username-index | User profiles |
| `chatroom-dev-chat-rooms` | roomId | — | createdBy-index | Room definitions |
| `chatroom-dev-room-members` | roomId | userId | userId-index | Membership + roles |
| `chatroom-dev-messages` | roomId | sortKey (ISO#UUID) | senderId-index | Messages |
| `chatroom-dev-connections` | connectionId | — | userId-index, roomId-index | Presence |

All PAY_PER_REQUEST billing (zero idle cost).

**Interview answer:**
> "DynamoDB over Postgres because: serverless with zero idle cost (PAY_PER_REQUEST), auto-scaling, single-digit ms latency, and chat data is naturally key-value — I don't need JOINs. The trade-off is no JOINs, so I do N+1 enrichment for member lists (fetch room_members, then batch-get user profiles). At scale I'd use BatchGetItem or cache in Redis."

**Deep dive — sortKey design:**
> "sortKey = `{ISO timestamp}#{UUID}`. ISO strings sort lexicographically in DynamoDB, so I get time-ordered messages for free. UUID suffix prevents same-millisecond collisions. Range queries like 'messages after X' use `sortKey > :timestamp`."

See: [[interview/Hot Partition Problem]] for scaling implications.

---

### #6 — Room Management API (CRUD)

**Endpoints:**
- `GET /api/rooms/` — list all rooms
- `POST /api/rooms/` — create room (auto-joins creator as `admin`)
- `GET /api/rooms/{room_id}` — room details
- `PUT /api/rooms/{room_id}` — update name/description
- `DELETE /api/rooms/{room_id}` — delete room
- `GET /api/rooms/by-creator/{user_id}` — GSI lookup

**Key file:** `backend/app/routes/rooms.py`

**Interview answer:**
> "Room creation is a two-step write: put_item to chat_rooms, then put_item to room_members with role=admin. It's not transactional — in production I'd use DynamoDB TransactWriteItems to make it atomic. Auto-join on room switch is a silent catch — if you're already a member, the 409 is swallowed by the frontend."

---

### #7 — Real-Time Messaging (SSE + WebSocket)

**Dual transport architecture:**

| Transport | Endpoint | Use Case | How It Works |
|-----------|----------|----------|-------------|
| **SSE** | `GET /api/sse/{room_id}` | Production (App Runner) | asyncio.Queue per subscriber, 30s keepalive |
| **WebSocket** | `WS /ws/{room_id}/{user_id}` | Local dev only | Full-duplex, typing events |

**Data flow:**
```
User sends message → POST /api/messages/{room_id}
                     → DynamoDB put_item
                     → publish() to all SSE subscribers in that room
                     → EventSource on each client receives "new_message"
```

**Key files:** `backend/app/routes/sse.py`, `backend/app/routes/ws.py`

**Interview answer:**
> "App Runner doesn't support WebSocket upgrades — it's plain HTTP only. SSE works over HTTP so it's my production transport. Messages are sent via REST POST, received via SSE — two half-duplex channels. WebSocket exists in the code for local dev where it works. The in-memory pub/sub (asyncio.Queue per subscriber) works for single-instance. For multi-instance I'd use Redis Pub/Sub as the message broker."

**If they ask "why not API Gateway WebSocket API?":**
> "That's the right production answer — API Gateway WebSocket API with Lambda or ECS behind it. I kept it simple with SSE for the take-home since it works with App Runner out of the box."

---

### #8 — Message History & Persistence

**Endpoints:**
- `GET /api/messages/{room_id}?limit=50&cursor=...` — paginated history (newest first)
- `POST /api/messages/{room_id}` — send message + publish to SSE
- `PUT /api/messages/{room_id}/{sort_key}` — edit message
- `DELETE /api/messages/{room_id}/{sort_key}` — delete message

**Cursor-based pagination:** Uses DynamoDB's `LastEvaluatedKey` → URL-encoded as `cursor` param. `ScanIndexForward=False` returns newest messages first.

**Key file:** `backend/app/routes/messages.py`

**Frontend integration:**
- Load last 50 messages on room switch (REST)
- New messages arrive via SSE
- Optimistic UI: message appears instantly, SSE confirms
- Dedup: checks messageId AND (same user + same content + within 5s)

**Interview answer:**
> "Cursor-based over offset pagination because DynamoDB doesn't support OFFSET — and even in SQL, OFFSET is O(n) on the skipped rows. LastEvaluatedKey is a constant-time operation. Frontend gets newest 50 messages on room switch, then SSE streams new ones. Optimistic rendering makes it feel instant."

---

### #9 — Active Users & Presence

**Endpoints:**
- `POST /api/connections/` — register connection (user in room)
- `DELETE /api/connections/{connection_id}` — remove connection
- `GET /api/connections/room/{room_id}` — active users in room (GSI)
- `GET /api/connections/user/{user_id}` — user's active connections

**Key file:** `backend/app/routes/connections.py`

**How presence works:**
1. User opens room → frontend POSTs to `/api/connections/` with userId + roomId
2. MembersPanel fetches `/api/members/{room_id}` → enriched with user data
3. Online users shown with green dot, offline with gray

**Interview answer:**
> "The connections table (PK: connectionId, GSIs on userId and roomId) is a lightweight presence system. It doesn't have heartbeats yet — I'd add a 30s heartbeat from the SSE client and a TTL-based cleanup for stale connections. DynamoDB TTL can auto-delete expired connections."

---

### #10 — Frontend: Room Sidebar

**What we built:**
- 260px sidebar with `# channel-name` list (sorted alphabetically)
- Active room highlighted with dark background
- "+" button → CreateChannel modal (name auto-slugified: "Plan Budget" → "plan-budget")
- Clerk UserButton at bottom for profile/sign-out

**Key file:** `frontend/components/chat/sidebar.tsx`

**Interview answer:**
> "Auto-slugification converts the display name to a URL-safe room name in real-time as you type. Frontend auto-seeds a 'general' room if no rooms exist — so new users never see an empty state."

---

### #11 — Frontend: Chat Area & Message Components

**What we built:**
- Message grouping by date: "Today", "Yesterday", or full date dividers
- Compact display: consecutive messages from same user within 5 min show only content (no avatar/name)
- Full display: avatar + colored username + relative timestamp
- Auto-sizing textarea input (grows up to 150px, then scrolls)
- Enter to send, Shift+Enter for newline
- Auto-scroll to latest message on new messages

**Key file:** `frontend/components/chat/chat-area.tsx`

**Interview answer:**
> "Message compacting is the same pattern Discord uses — if the same person sends multiple messages within 5 minutes, we hide the avatar and name to reduce visual noise. Date dividers group messages into logical days. The auto-scroll only triggers if the user is already at the bottom — if they've scrolled up to read history, we don't yank them down."

---

### #12 — AWS App Runner Deployment

**Architecture:**
```
Browser → App Runner (FastAPI) → DynamoDB (5 tables)
            ↑ Docker (Python 3.13-slim)
            ↑ 0.25 vCPU, 512 MB
            ↑ IAM: ECR pull + DynamoDB access
```

**Live endpoints:**
- API: `https://9rjvhfdkqt.us-west-2.awsapprunner.com`
- Docs: `https://9rjvhfdkqt.us-west-2.awsapprunner.com/docs`

**Key files:** `backend/Dockerfile`, `infra/main.tf`

**Interview answer:**
> "App Runner over ECS Fargate because it's simpler — no VPC config, no ALB, automatic HTTPS, built-in auto-scaling. Trade-off: no WebSocket support (HTTP only), so I use SSE. For production I'd move to ECS Fargate with an ALB that supports WebSocket upgrades, or use API Gateway WebSocket API."

---

### #13 — FastAPI Routes for DynamoDB

**30 total endpoints across 7 modules:**

| Module | Endpoints | Key Operations |
|--------|-----------|---------------|
| `users.py` | 7 | CRUD, upsert from Clerk, GSI lookups (email, username) |
| `rooms.py` | 7 | CRUD, auto-join creator, GSI lookup by creator |
| `members.py` | 5 | Join, leave, kick (admin-only), list with enrichment |
| `messages.py` | 5 | Send + SSE publish, paginated history, edit, delete |
| `connections.py` | 4 | Presence CRUD, GSI lookups by room/user |
| `sse.py` | 1 | EventSource streaming + publish function |
| `ws.py` | 1 | WebSocket with typing events |

**Key file:** `backend/app/db.py` — boto3 DynamoDB resource + table references

**Interview answer:**
> "All routes use boto3's DynamoDB resource client. I chose resource over client because the API is more Pythonic — `table.put_item()` vs `client.put_item(TableName=...)`. Every write operation that creates a message also calls `publish()` to fan out via SSE. The member enrichment is an N+1 pattern — one query for members, then one get_item per member to the users table. At scale, I'd use BatchGetItem (up to 100 items per call) or cache user profiles in Redis."

---

## RECENTLY COMPLETED ISSUES (5/17)

---

### #5 — Clerk JWT Verification Middleware ✅ DONE

**What we built:**
- `backend/app/auth.py` — JWKS-based RS256 JWT verification
- Fetches keys from Clerk's `/.well-known/jwks.json`, caches for 1 hour
- `get_current_user` FastAPI dependency extracts `sub` claim as userId
- `get_optional_user` for endpoints that work with or without auth
- Applied to: message send, message delete, room create, room delete
- Frontend sends `Bearer` token via `setTokenProvider()` from Clerk's `getToken()`
- Graceful degradation: dev mode trusts `X-User-Id` header when `CLERK_JWKS_URL` not set

**Interview answer:**
> "The auth middleware fetches Clerk's JWKS endpoint, caches keys for 1 hour with TTL refresh, and verifies RS256 JWT signatures. It's a FastAPI dependency — `Depends(get_current_user)` — that extracts the Clerk user ID from the `sub` claim. In dev mode, when no JWKS URL is configured, it falls back to trusting an X-User-Id header. The frontend gets the token from Clerk's `getToken()` and includes it as a Bearer token in every API call."

---

### #14 — Typing Indicators & Read Receipts ✅ DONE

**What we built:**
- **Backend:** `POST /api/sse/{room_id}/typing` and `/stop_typing` endpoints publish to SSE
- In-memory typing state with 5s auto-expiry per user
- **Frontend:** 3s debounce — sends typing on first keypress, stop after 3s idle or on send
- SSE listeners handle `typing` and `stop_typing` events
- "alice is typing..." / "alice and bob are typing..." display
- **Read receipts:** `PATCH /api/members/{room_id}/read/{user_id}` updates `lastReadAt`
- Frontend marks read on room switch + after sending
- **Unread badges:** Red count on sidebar channels based on `lastReadAt` vs message timestamps

**Interview answer:**
> "Typing indicators work over SSE — since SSE is server→client only, typing events are sent via REST POST and broadcast via SSE to all room subscribers. 3-second debounce on the client, 5-second auto-expiry on the server. Read receipts track lastReadAt per user per room — frontend updates it on room switch and after sending. Unread count = messages newer than lastReadAt from other users."

---

### #15 — Message Search ✅ DONE

**What we built:**
- **Backend:** `GET /api/search/?q=hello&room_id=optional` — DynamoDB scan with `contains()` filter, sorted by createdAt descending, limited to 20 results
- **Frontend (sidebar):** Search button toggles inline search panel with 300ms debounced input, results show room/sender/content/date, click navigates to room
- **Frontend (modal):** Cmd+K style search modal component for full-screen search experience

**Interview answer:**
> "Search uses a DynamoDB scan with contains() filter — it's O(n) on total messages but fine for take-home scale. For production, I'd pipe DynamoDB Streams to OpenSearch for proper full-text search with tokenization and relevance ranking. The frontend debounces input at 300ms and shows results with room context so you can navigate directly to the conversation."

---

### #16 — Rich Media (Markdown) ✅ DONE

**What we built:**
- `react-markdown` + `remark-gfm` for rendering: **bold**, *italic*, `code`, ```code blocks```, [links], lists, > blockquotes
- Smart detection: only renders markdown when content contains markdown characters, otherwise plain text (avoids false rendering)
- Toolbar buttons (B, I, Code, Link, Quote) wrap selected text with markdown syntax
- Styled inline code (rose-colored), code blocks (neutral background with border), links (blue, opens new tab)

**Not implemented:** Link previews (Open Graph), file uploads (S3 presigned URLs) — documented as future work.

**Interview answer:**
> "Messages render as markdown using react-markdown with remark-gfm for GitHub-flavored markdown. Smart detection only activates the parser when content contains markdown characters — plain text messages skip the parser entirely for performance. The toolbar buttons wrap selected text with markdown syntax. I'd add file uploads via S3 presigned URLs — client uploads directly to S3, message stores the URL with a type field."

---

### #17 — Moderation Tools ✅ DONE

**What we built:**
- **Message deletion:** Hover trash icon on own messages → optimistic remove + DELETE API + SSE `message_deleted` broadcast to all clients
- **Kick:** `DELETE /api/members/{room_id}/kick/{user_id}` — admin verification + SSE broadcast
- **Mute:** `POST /api/members/{room_id}/mute/{user_id}` — sets `mutedUntil` timestamp, message send handler checks mute status and rejects with 403 if muted. Unmute endpoint to clear.
- **Ban:** `POST /api/members/{room_id}/ban/{user_id}` — marks user as banned in membership + SSE broadcast

**Interview answer:**
> "Moderation works at multiple levels. Message deletion is optimistic — the message disappears instantly and a `message_deleted` SSE event broadcasts to all clients so everyone sees it removed. Muting sets a `mutedUntil` timestamp in room_members — the message handler checks this before accepting a new message and returns 403 if the user is muted. Kick and ban are admin-only with server-side role verification."

---

## Quick Reference: What to Say When Asked

| Question | Answer |
|----------|--------|
| "Walk me through the architecture" | Browser → Clerk auth → FastAPI (App Runner) → DynamoDB. SSE for real-time. 5 tables, 35+ endpoints, JWT verification. |
| "Why DynamoDB?" | Serverless, zero idle cost, auto-scales, chat data is key-value. Trade-off: no JOINs → N+1 enrichment. |
| "Why SSE not WebSocket?" | App Runner doesn't support WS upgrades. SSE works over HTTP. WS exists for local dev. |
| "What would you do differently?" | Redis pub/sub for multi-instance, API Gateway WS API, BatchGetItem for enrichment, OpenSearch for search. |
| "How do you handle auth?" | Clerk JWT → JWKS verification on backend. Token sent as Bearer header. Dev mode degrades gracefully. |
| "How does it scale?" | Hot partition problem on messages table. See [[Hot Partition Problem]]. Redis cache + request coalescing. |
| "What about testing?" | Tested all endpoints via curl + Swagger docs. Would add pytest + moto (DynamoDB mock) + Playwright E2E. |
| "What was hardest?" | Getting SSE reliable — keepalive timing, queue cleanup for dead subscribers, deduplication with optimistic UI. |

---

## Related
- [[interview/Talking Points]]
- [[interview/Design Decisions]]
- [[interview/Hot Partition Problem]]
- [[architecture/Overview]]
- [[data-model/Tables Overview]]
- [[backend/API Reference]]
