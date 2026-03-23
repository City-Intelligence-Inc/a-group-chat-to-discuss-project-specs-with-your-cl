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

## ⚠️ OPEN ISSUES (5/17)

---

### #5 — Clerk JWT Verification Middleware ❌ NOT DONE

**What's missing:** Backend has ZERO auth validation. All 30 API endpoints are publicly accessible. Frontend sends `sender_id` in the request body but the server doesn't verify it came from the actual user.

**Security impact:** Anyone with the API URL can impersonate any user, send messages as them, delete their messages, or kick members.

**How I'd implement it:**
1. Fetch Clerk's JWKS from `https://{clerk-domain}/.well-known/jwks.json`
2. Cache JWKS with 1-hour TTL, refresh on key rotation
3. Verify RS256 JWT signature + expiry on every request
4. FastAPI `Depends(get_current_user)` dependency extracts `sub` claim as userId
5. For WebSocket: token passed as `?token=` query param, verified on connect
6. On first auth request, upsert user into DynamoDB (Clerk ID → userId)

**Interview answer:**
> "I know the backend has no JWT verification — it's the biggest security gap. In production, I'd add a FastAPI dependency that fetches Clerk's JWKS endpoint, caches the keys, and verifies RS256 signatures on every request. The `sub` claim gives me the Clerk user ID. I'd also add rate limiting per user to prevent abuse."

---

### #14 — Typing Indicators & Read Receipts ⚠️ PARTIAL

**What exists:**
- WebSocket handler accepts `type: "typing"` and `type: "stop_typing"` messages
- ChatArea component has a `typingUsers` prop (always empty)
- `lastReadAt` field in room_members table schema

**What's missing:**
- SSE transport for typing events (only works via WebSocket, which doesn't work in production)
- Frontend not wired to send/receive typing events
- Read receipts not implemented in frontend

**How I'd finish it:**
- Add `POST /api/rooms/{room_id}/typing` REST endpoint (since SSE is server→client only)
- Broadcast typing state via SSE events
- 3s debounce on client, 5s auto-expire on server
- Frontend: "alice is typing..." / "alice and bob are typing..." / "3 people are typing..."
- Read receipts: `PATCH /api/rooms/{room_id}/read` on scroll-to-bottom, compute unread as messages with `createdAt > lastReadAt`

**Interview answer:**
> "Typing indicators are half-built — the WebSocket handler supports them but they don't work in production because App Runner only supports HTTP. I'd add a REST POST endpoint for typing status and broadcast via SSE. For read receipts, I'd update lastReadAt in room_members on scroll-to-bottom, then compute unread count as messages newer than that timestamp."

---

### #15 — Message Search ❌ NOT DONE

**What exists:** Search icon in sidebar (placeholder, non-functional)

**How I'd implement it:**
- **Small scale:** DynamoDB `scan` + `FilterExpression` with `contains(content, :query)` — O(n) full table scan but fine for <10K messages
- **Production:** DynamoDB Streams → Lambda → OpenSearch for full-text search with relevance ranking
- **Frontend:** Slide-in search panel, 300ms debounced input, results with room name + message snippet + highlight

**Interview answer:**
> "Search isn't implemented but I have two approaches. For take-home scale, a DynamoDB scan with contains() filter — it's a full table scan but fine for small data. For production, I'd pipe DynamoDB Streams to OpenSearch for proper full-text search with tokenization, stemming, and relevance ranking. The scan approach is O(n) on total messages; OpenSearch is O(1) per query after indexing."

---

### #16 — Rich Media (Markdown, Link Previews, File Uploads) ❌ NOT DONE

**What exists:** Message `type` field supports "text" (extensible)

**How I'd implement each:**
- **Markdown:** `react-markdown` + `remark-gfm` + `rehype-sanitize` for safe rendering (bold, italic, code, links, lists, blockquotes). Sanitization prevents XSS via injected HTML.
- **Link previews:** Detect URLs in message content, `GET /api/link-preview?url=...` fetches Open Graph metadata (title, description, image), render preview card below message. Server-side fetch to avoid CORS.
- **File uploads:** `POST /api/upload` returns S3 presigned URL, client uploads directly to S3 (no backend bandwidth cost), store S3 URL in message with `message_type: "file"`, render based on file type (inline image, PDF icon, download link).

**Interview answer:**
> "Rich media wasn't prioritized but the message type field is extensible. For markdown I'd use react-markdown with sanitization to prevent XSS. For file uploads, S3 presigned URLs — the client uploads directly to S3 so the backend doesn't bottleneck on file transfer bandwidth. The message stores the S3 URL and a type field ('image', 'file') so the frontend knows how to render it."

---

### #17 — Moderation Tools ⚠️ PARTIAL

**What exists (API only, no frontend UI):**
- `DELETE /api/messages/{room_id}/{sort_key}` — message deletion (works)
- `DELETE /api/members/{room_id}/kick/{user_id}` — kick user (admin-only, works)

**What's missing:**
- No frontend buttons/modals for delete or kick
- No mute (would need `muted_until` field in room_members, WS/SSE handler checks before broadcasting)
- No ban (would need ban list in room metadata, prevent rejoining, force-disconnect WebSocket)
- No `message_deleted` real-time event (deleted messages just disappear on next load)

**Interview answer:**
> "Delete and kick APIs work — I just didn't have time for the frontend UI. For mute, I'd add a `muted_until` timestamp to room_members and check it in the message handler before broadcasting. For ban, a ban list in room metadata that's checked on join attempts. The missing piece is real-time propagation — I'd broadcast a `message_deleted` SSE event so clients remove the message without refreshing."

---

## Quick Reference: What to Say When Asked

| Question | Answer |
|----------|--------|
| "Walk me through the architecture" | Browser → Clerk auth → FastAPI (App Runner) → DynamoDB. SSE for real-time. 5 tables, 30 endpoints. |
| "Why DynamoDB?" | Serverless, zero idle cost, auto-scales, chat data is key-value. Trade-off: no JOINs → N+1 enrichment. |
| "Why SSE not WebSocket?" | App Runner doesn't support WS upgrades. SSE works over HTTP. WS exists for local dev. |
| "What would you do differently?" | Add JWT middleware (#5), Redis pub/sub for multi-instance, API Gateway WS API, BatchGetItem for enrichment. |
| "What's the biggest security gap?" | No backend JWT verification. All endpoints are public. Would add Clerk JWKS verification. |
| "How does it scale?" | Hot partition problem on messages table. See [[Hot Partition Problem]]. Redis cache + request coalescing. |
| "What about testing?" | Tested all 30 endpoints via curl + Swagger docs. Would add pytest + moto (DynamoDB mock) + Playwright E2E. |
| "What was hardest?" | Getting SSE reliable — keepalive timing, queue cleanup for dead subscribers, deduplication with optimistic UI. |

---

## Related
- [[interview/Talking Points]]
- [[interview/Design Decisions]]
- [[interview/Hot Partition Problem]]
- [[architecture/Overview]]
- [[data-model/Tables Overview]]
- [[backend/API Reference]]
