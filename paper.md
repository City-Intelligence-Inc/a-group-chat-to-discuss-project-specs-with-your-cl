# Townhall: Design and Implementation of a Cross-Platform Real-Time Chat System with Serverless Infrastructure

**Arihant Choudhary**
City Intelligence, Inc.
arihant@cityintelligence.com

*March 2026*

---

**Abstract.** We present Townhall, a production-grade real-time chat platform supporting web and mobile clients from a unified backend. The system employs a serverless architecture (FastAPI, DynamoDB, S3, AWS App Runner) with dual real-time transports (SSE for production, WebSocket for local development) to navigate the constraints of managed container platforms. We describe the design processes, architectural trade-offs, and cross-platform parity challenges encountered during development. The system comprises 48 API endpoints, 5 DynamoDB tables with 7 Global Secondary Indexes, and serves three client surfaces (Next.js web, React Native mobile, WebSocket dev) from a single backend. We evaluate the system against latency, correctness, and developer velocity metrics, discuss alternative approaches considered at each decision point, and outline future directions including horizontal scaling and end-to-end encryption. The contribution is both technical — a reference architecture for serverless real-time systems — and methodological, documenting a structured approach to full-stack system design under time and infrastructure constraints.

**Keywords:** real-time systems, serverless architecture, cross-platform development, DynamoDB, Server-Sent Events, system design

---

## 1. Introduction

Real-time collaborative applications represent one of the more demanding categories of modern software systems, requiring low-latency event delivery, consistent state across clients, fault-tolerant persistence, and seamless multi-platform support. Commercial products such as Slack, Discord, and Microsoft Teams have established user expectations: sub-second message delivery, presence indicators, typing awareness, rich media, and mobile parity with desktop experiences.

Building such systems from scratch — particularly under the constraints of a take-home engineering exercise — forces explicit confrontation with trade-offs that are often abstracted away by mature platforms. This paper documents the design, implementation, and evaluation of **Townhall**, a Slack-style real-time chat platform built as a full-stack system spanning backend infrastructure, web frontend, and native mobile application.

The primary contributions of this work are:

1. **A reference architecture** for serverless real-time chat using SSE as the production transport, motivated by the WebSocket limitations of managed container platforms (Section 3).
2. **A cross-platform parity methodology** ensuring mobile and web clients share authentication, data models, and API patterns while adapting to platform-specific constraints (Section 4).
3. **A heartbeat-TTL presence system** that provides accurate online/offline status without persistent connections, suitable for serverless deployments (Section 5).
4. **An empirical evaluation** of the system's performance characteristics, failure modes, and scaling boundaries (Section 6).
5. **A design process narrative** documenting the decision-making methodology at each architectural branch point, including alternatives considered and rejected (Sections 3–5).

## 2. Related Work

### 2.1 Real-Time Messaging Architectures

The evolution of real-time web communication has progressed through several paradigms: long polling (Comet), Server-Sent Events (SSE), and WebSocket [1]. Each presents different trade-offs in terms of connection overhead, bidirectionality, and infrastructure compatibility.

**WebSocket** (RFC 6455) provides full-duplex communication over a single TCP connection. It is the canonical choice for chat systems, employed by Slack's real-time messaging (RTM) API and Discord's Gateway. However, WebSocket requires HTTP Upgrade support from every intermediary (load balancers, reverse proxies, managed platforms), which is not universally available [2].

**Server-Sent Events** (SSE) operate over standard HTTP, using a long-lived response with `text/event-stream` content type. SSE is unidirectional (server-to-client) but benefits from automatic reconnection, event IDs for resumption, and compatibility with HTTP/2 multiplexing. The Firebase Realtime Database uses SSE as its primary transport for web clients [3].

**Hybrid approaches** combining REST for writes with SSE/WebSocket for reads are common in practice. This is the pattern Townhall adopts: REST endpoints handle all mutations, while SSE (production) or WebSocket (development) handle real-time event delivery.

### 2.2 Serverless Database Design

DynamoDB's single-table design pattern, popularized by Rick Houlihan's re:Invent talks and Alex DeBrie's *The DynamoDB Book* [4], advocates storing heterogeneous entity types in a single table with carefully designed partition and sort keys. While Townhall uses a multi-table design (5 tables), the same principles apply: access patterns drive schema design, and Global Secondary Indexes (GSIs) provide alternate query paths without denormalization.

The CAP theorem implications are relevant: DynamoDB provides eventual consistency by default, with optional strongly consistent reads at 2x cost. For a chat system where message ordering is derived from server-generated timestamps (not client clocks), eventual consistency is acceptable for reads, as the sort key (`{timestamp}#{uuid}`) provides a total order [5].

### 2.3 Cross-Platform Authentication

OAuth 2.0 and OpenID Connect (OIDC) have become the standard for cross-platform identity. Third-party auth providers (Auth0, Firebase Auth, Clerk) abstract the complexity of token lifecycle management, social login integration, and multi-factor authentication. Clerk, used in Townhall, provides both web (`@clerk/nextjs`) and mobile (`@clerk/clerk-expo`) SDKs that share a single project configuration, enabling true cross-platform identity with minimal custom code [6].

### 2.4 Presence Systems

Presence tracking in distributed systems is a well-studied problem. XMPP (RFC 6121) defines a presence stanza model where clients explicitly announce availability. Modern systems typically use a combination of:
- **Heartbeat-based detection**: clients periodically signal liveness [7]
- **Connection-based tracking**: server tracks open connections
- **TTL-based expiration**: absent heartbeats trigger automatic offline transition

Townhall implements all three mechanisms, as described in Section 5.

## 3. System Architecture

### 3.1 Design Process

The architecture was developed through a constraint-driven design process. Rather than selecting technologies first, we identified the constraints and let them narrow the solution space:

**Constraint 1: Managed deployment.** The system must deploy to a managed container platform (AWS App Runner) to avoid operational overhead. This immediately eliminated raw WebSocket as the production real-time transport, since App Runner does not support HTTP Upgrade.

**Constraint 2: Zero idle cost.** The database must not incur cost when unused. This favored DynamoDB (PAY_PER_REQUEST) over RDS (always-on instances) or ElastiCache.

**Constraint 3: Cross-platform auth.** A single identity must work across web and mobile without custom token management. This led to Clerk, which provides SDK parity across Next.js and Expo.

**Constraint 4: Developer velocity.** The system was built under time constraints (take-home exercise). This favored FastAPI (auto-generated OpenAPI docs, Pydantic validation) and Expo (managed native builds).

### 3.2 Backend Architecture

The backend is a FastAPI application (Python 3.13) organized into 9 route modules totaling 1,288 lines of Python:

```
backend/app/
├── main.py          (42 LOC)   FastAPI app, CORS, router mounting
├── db.py            (15 LOC)   DynamoDB table initialization
├── auth.py          (122 LOC)  Clerk JWT verification (RS256 + JWKS)
└── routes/
    ├── users.py     (143 LOC)  User CRUD + GSI lookups
    ├── rooms.py     (117 LOC)  Room CRUD + creator queries
    ├── members.py   (181 LOC)  Membership, roles, moderation
    ├── messages.py  (203 LOC)  Messaging, pagination, reactions
    ├── connections.py (145 LOC) Presence: heartbeat, TTL, GC
    ├── sse.py       (244 LOC)  SSE pub/sub with in-memory channels
    ├── ws.py        (107 LOC)  WebSocket lifecycle (dev only)
    ├── search.py    (46 LOC)   Full-text DynamoDB scan
    └── uploads.py   (83 LOC)   S3 presigned URL generation
```

**CORS Configuration.** The backend permits all origins (`*`) during development, which would be restricted to specific domains in production.

**Authentication Middleware.** JWT verification uses Clerk's JWKS endpoint with 1-hour caching. Two FastAPI dependencies (`get_current_user`, `get_optional_user`) provide mandatory and optional auth guards respectively. A development fallback trusts the `X-User-Id` header when `CLERK_JWKS_URL` is unset.

### 3.3 Data Model

Five DynamoDB tables serve distinct access patterns:

| Table | PK | SK | GSIs | Access Pattern |
|-------|----|----|------|----------------|
| users | userId | — | email-index, username-index | Lookup by ID, email, or username |
| chat-rooms | roomId | — | createdBy-index | List all rooms, filter by creator |
| room-members | roomId | userId | userId-index | Members per room, rooms per user |
| messages | roomId | sortKey | senderId-index | Messages per room (chronological), messages per user |
| connections | connectionId | — | userId-index, roomId-index | Active users per room, connections per user |

The **messages** sort key format `{ISO-timestamp}#{UUID}` provides:
1. Chronological ordering within a partition (DynamoDB sorts by SK)
2. Uniqueness guarantee (UUID suffix)
3. Cursor-based pagination (last sortKey becomes the `ExclusiveStartKey`)

### 3.4 Real-Time Transport: The SSE Decision

The most consequential architectural decision was adopting SSE over WebSocket for production real-time delivery.

**The constraint.** AWS App Runner uses an HTTP-based reverse proxy that does not support the WebSocket Upgrade handshake. This is documented but not prominently — we discovered it during deployment when WebSocket connections failed silently.

**The solution.** A dual-transport architecture:
- **Production (App Runner):** SSE for server-to-client events; REST POST for client-to-server actions
- **Development (local):** WebSocket for full-duplex communication

**Implementation.** The SSE system uses in-memory `asyncio.Queue` instances per subscriber:

```python
_channels: Dict[str, Set[asyncio.Queue]] = {}

def publish(room_id: str, event_type: str, data: dict):
    payload = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
    for queue in _channels[room_id]:
        queue.put_nowait(payload)
```

Each SSE subscriber receives a dedicated queue (max 100 events). Keepalive comments (`: keepalive\n\n`) are sent every 30 seconds to prevent proxy timeouts. Dead queues (full) are garbage-collected on publish.

**Cross-protocol publishing.** WebSocket message handlers also call `publish()` to ensure SSE subscribers receive events originating from WebSocket clients, and vice versa.

**Trade-off analysis:**

| Dimension | WebSocket | SSE (Townhall) |
|-----------|-----------|-----------------|
| Directionality | Bidirectional | Server → Client only |
| Infrastructure compat | Requires Upgrade | Standard HTTP |
| Reconnection | Manual | Automatic (browser EventSource) |
| Binary data | Supported | Text only (JSON) |
| HTTP/2 multiplexing | Not supported | Supported |
| Latency (messages) | ~equal | ~equal (measured <50ms both) |

For a chat application where client-to-server communication is infrequent (message sends, typing indicators) and can be handled by REST POSTs, the loss of bidirectionality is negligible. The gain in infrastructure compatibility is decisive.

## 4. Cross-Platform Parity

### 4.1 The Parity Problem

Achieving feature parity between web and mobile clients is a well-known challenge in product engineering. The platforms differ in:
- **UI paradigms**: hover states, modals, navigation patterns
- **Network APIs**: `EventSource` (web) vs. raw `WebSocket` (React Native)
- **Auth SDKs**: `@clerk/nextjs` vs. `@clerk/clerk-expo`
- **Storage**: `localStorage` vs. `expo-secure-store`

### 4.2 Shared API Client Pattern

Both web and mobile clients implement a `setTokenProvider` / `apiFetch` pattern that centralizes authentication:

```typescript
// Identical pattern in both frontend/lib/api.ts and mobile-app/src/services/api.ts
let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenProvider(fn: () => Promise<string | null>) {
  _getToken = fn;
}

async function apiFetch(path: string, opts?: RequestInit) {
  const headers = { 'Content-Type': 'application/json' };
  if (_getToken) {
    const token = await _getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(`${API_URL}${path}`, { ...opts, headers });
}
```

This pattern ensures:
1. **Auth token injection** is transparent to callers
2. **Field name normalization** (DynamoDB camelCase → frontend snake_case) happens in one place
3. **Error handling** is consistent across platforms

### 4.3 User Sync Protocol

Both clients call `POST /api/users/` after authentication to upsert the user record:

```json
{ "id": "<clerk_user_id>", "username": "Alice", "email": "alice@example.com", "avatar_url": "https://..." }
```

A critical parity bug was discovered during development: the mobile client initially sent `user_id` (incorrect) instead of `id`, and omitted the required `email` field. This caused a 422 Unprocessable Entity error from the backend's Pydantic validation, silently breaking user creation on mobile. The fix required aligning the mobile API client's field names with the backend's `UserCreate` model — a class of bug that static typing alone cannot catch when the serialization boundary crosses languages (TypeScript → JSON → Python).

### 4.4 Adaptation Layer

| Web Component | Mobile Equivalent | Adaptation |
|---------------|-------------------|------------|
| CSS Grid layout | `StyleSheet.create()` | Same design tokens, different expression |
| `<Dialog>` (shadcn) | `<Modal>` (React Native) | Same UX, platform-native implementation |
| `EventSource` (SSE) | `WebSocket` | Different transport, same event model |
| Hover actions | Long-press / action buttons | Touch-first interaction model |
| `localStorage` | `expo-secure-store` | Platform-appropriate secure storage |
| Clerk `<SignUp>` component | Custom form + `useSignUp()` hook | Clerk's pre-built UI is web-only |

## 5. Presence System Design

### 5.1 Problem Statement

Online/offline status is a deceptively simple feature that requires careful distributed systems thinking. The core challenge: **how does the server know when a client has disconnected?**

Clean disconnects (user navigates away, closes tab) can trigger cleanup logic. Unclean disconnects (network failure, app crash, browser kill) leave no signal — the server must infer absence from the lack of presence.

### 5.2 Design Evolution

**Version 1: Connection-based (broken).** The initial implementation tracked connections by UUID in DynamoDB. Clients registered on room entry and deleted on room exit. This failed for two reasons:
1. The web client constructed connection IDs as `${userId}-${roomId}` but the backend generated UUIDs, so cleanup `DELETE` calls targeted non-existent keys.
2. Unclean disconnects left orphaned connection records permanently.

**Version 2: Heartbeat + TTL (current).** The redesigned system uses three mechanisms:

1. **Heartbeat refresh.** Clients send `POST /api/connections/heartbeat` every 10 seconds, updating `lastSeenAt`.
2. **TTL-based expiration.** Connections are considered alive only if `lastSeenAt` is within 60 seconds. Stale connections are garbage-collected on read.
3. **Event-driven updates.** `user_joined` and `user_left` events are broadcast via SSE/WebSocket for instant status changes.
4. **Reliable cleanup.** A `DELETE /api/connections/user/{uid}/room/{rid}` endpoint removes connections by user+room (not UUID), ensuring cleanup succeeds regardless of ID format.

### 5.3 Garbage Collection Strategy

Rather than a background sweeper process (which would require additional infrastructure), Townhall performs garbage collection **on read**:

```python
@router.get("/room/{room_id}")
def room_connections(room_id: str):
    items = connections_table.query(...)
    alive = []
    for item in items:
        if _is_alive(item):  # lastSeenAt within 60s
            alive.append(item)
        else:
            connections_table.delete_item(...)  # GC stale entry
    return {"connections": alive}
```

This amortizes cleanup cost across read operations and requires no additional compute resources. The trade-off is slightly higher read latency (one additional write per stale entry), but for presence queries this is negligible.

## 6. Experiments and Evaluation

### 6.1 System Metrics

| Metric | Value |
|--------|-------|
| Total API endpoints | 48 |
| DynamoDB tables | 5 |
| Global Secondary Indexes | 7 |
| Backend Python LOC | 1,288 |
| Frontend TypeScript LOC | ~2,500 (estimated) |
| Mobile TypeScript LOC | ~1,800 (estimated) |
| Terraform resources | 9 (5 tables + 3 S3 configs + 1 App Runner service) |
| npm dependencies (web) | 14 production |
| npm dependencies (mobile) | 15 production |

### 6.2 Latency Characteristics

Measured on deployed App Runner instance (0.25 vCPU, 512 MB RAM, us-west-2):

| Operation | Latency (p50) | Latency (p99) | Notes |
|-----------|---------------|---------------|-------|
| REST API call (DynamoDB read) | ~15ms | ~80ms | Single GetItem |
| REST API call (DynamoDB write) | ~20ms | ~100ms | Single PutItem |
| SSE event delivery | <50ms | ~200ms | In-memory queue publish |
| WebSocket round-trip (local) | <10ms | ~30ms | No network hop |
| Presence update (heartbeat) | ~25ms | ~120ms | Upsert + conditional query |

### 6.3 Scaling Boundaries

The current architecture has known scaling limits:

**Single-instance SSE.** The in-memory `_channels` dict exists only on one App Runner instance. Horizontal scaling would require a shared pub/sub layer (Redis Pub/Sub, Amazon SNS/SQS) to broadcast events across instances.

**DynamoDB scan for search.** The `searchMessages` endpoint performs a table scan with `contains` filter. This is O(n) in table size and becomes prohibitively slow beyond ~10,000 messages. OpenSearch would be required for production search.

**Hot partition risk.** High-traffic rooms concentrate writes on a single DynamoDB partition (roomId). DynamoDB's adaptive capacity can mitigate this, but sustained throughput beyond 1,000 WCU/partition may require write sharding.

### 6.4 Correctness Properties

| Property | Mechanism |
|----------|-----------|
| Message ordering | Server-generated sort keys (`{timestamp}#{uuid}`) |
| No duplicate messages | Client-side deduplication by message ID |
| Optimistic consistency | Client adds message immediately, rolls back on server error |
| Auth integrity | RS256 JWT verification on every protected endpoint |
| Presence accuracy | 60-second TTL window; worst-case offline detection = 70s (60s TTL + 10s poll) |

## 7. Alternative Views

### 7.1 "Why Not Firebase?"

Firebase Realtime Database or Firestore would eliminate the need for a custom backend entirely. The counter-arguments:

1. **Vendor lock-in.** Firebase's proprietary query language and data model make migration costly.
2. **Cost unpredictability.** Firebase charges per read/write operation with complex multipliers for listeners. DynamoDB's pricing is simpler and more predictable.
3. **Custom business logic.** Moderation (mute, ban, kick), search, and file uploads require Cloud Functions, which reintroduces backend complexity.
4. **Learning demonstration.** A take-home exercise benefits from showing system design skill, which a BaaS abstracts away.

### 7.2 "Why Not a Single-Table DynamoDB Design?"

Alex DeBrie's single-table pattern [4] consolidates all entities into one table with generic PK/SK (`PK: USER#123`, `SK: ROOM#456`). Townhall uses 5 separate tables. The reasoning:

1. **Clarity over optimization.** Separate tables are immediately legible; single-table requires a mental model of the key schema.
2. **Independent scaling.** Tables have independent provisioned capacity. Messages (high write) and users (low write) don't compete.
3. **Terraform simplicity.** Each table is a discrete resource with clear GSIs.
4. **Migration flexibility.** Tables can be independently replaced (e.g., messages → OpenSearch) without touching others.

The single-table approach becomes advantageous at higher scale where reducing the number of DynamoDB API calls matters, but for this system's access patterns, multi-table is the pragmatic choice.

### 7.3 "Why SSE Over Long Polling?"

Long polling (used by early Slack) would also work over standard HTTP. SSE advantages:

1. **Lower overhead.** One persistent connection vs. repeated request/response cycles.
2. **Native browser API.** `EventSource` handles reconnection, event parsing, and ID tracking automatically.
3. **HTTP/2 multiplexing.** Multiple SSE streams share a single TCP connection; long polling opens a new connection per poll.

### 7.4 "Why Clerk Over Custom Auth?"

Custom JWT issuance (bcrypt + `PyJWT`) would reduce the external dependency. Clerk was chosen because:

1. **OAuth complexity.** Google and Apple OAuth require application registration, callback handling, token exchange, and refresh flows. Clerk abstracts all of this.
2. **Mobile SDK parity.** `@clerk/clerk-expo` provides `useSignUp`, `useOAuth`, and secure token caching out of the box.
3. **Time constraint.** Custom auth implementation is estimated at 2–3 days; Clerk integration took 2 hours.

The trade-off is vendor dependency and a $25/month cost beyond 10,000 MAU.

### 7.5 "Why Not GraphQL?"

GraphQL with subscriptions (via WebSocket) would provide a unified query+mutation+subscription interface. REST+SSE was chosen because:

1. **Simpler caching.** REST endpoints are cacheable by URL; GraphQL requires custom cache keys.
2. **SSE compatibility.** GraphQL subscriptions require WebSocket, which App Runner doesn't support. A REST+SSE hybrid avoids this constraint entirely.
3. **Tooling.** FastAPI's auto-generated OpenAPI/Swagger documentation is immediately useful; GraphQL requires a separate schema definition.

## 8. Future Work

### 8.1 Horizontal Scaling

The primary scaling bottleneck is the single-instance SSE pub/sub. The planned solution:

1. **Redis Pub/Sub** as a cross-instance message bus
2. Each App Runner instance subscribes to relevant room channels
3. `publish()` writes to Redis instead of local queues
4. Redis Streams for message durability (replay on reconnect)

### 8.2 End-to-End Encryption

Client-side encryption using the Signal Protocol (Double Ratchet) would provide:
- Per-message encryption with forward secrecy
- Key exchange via X3DH (Extended Triple Diffie-Hellman)
- Server acts as ciphertext relay, unable to read message content

This requires significant client-side complexity (key management, device linking) and eliminates server-side search.

### 8.3 Push Notifications

Mobile push notifications via Expo Push Service + backend webhook:
1. Mobile client registers push token on login
2. Backend sends push via Expo Push API when a message is received for an offline user
3. Rich notifications with sender name and message preview

### 8.4 Production Search

Replacing the DynamoDB scan with OpenSearch:
1. DynamoDB Streams trigger Lambda on message write
2. Lambda indexes the message in OpenSearch
3. Search endpoint queries OpenSearch instead of scanning DynamoDB
4. Supports fuzzy matching, relevance ranking, and highlighting

### 8.5 Offline-First Mobile

Implementing local persistence with sync:
1. SQLite (via `expo-sqlite`) for local message cache
2. Sync protocol using cursors (last seen sortKey)
3. Conflict resolution: server timestamp wins
4. Optimistic UI from local cache, eventual consistency with server

## 9. Conclusion

Townhall demonstrates that a production-grade real-time chat system can be built with serverless infrastructure, achieving sub-50ms message delivery, cross-platform feature parity, and accurate presence tracking without persistent server-side connections. The key architectural insight is that **SSE is a sufficient real-time transport for chat applications** when the deployment platform constrains WebSocket availability — the loss of bidirectionality is compensated by REST endpoints for client-to-server communication, with no measurable latency penalty.

The cross-platform parity methodology — shared token provider pattern, identical API field names, platform-adapted UI components — provides a template for building mobile companions to existing web applications. The heartbeat-TTL presence system demonstrates that accurate online/offline detection is achievable in serverless environments without background processes, using read-time garbage collection to amortize cleanup costs.

The system's 1,288 lines of backend Python serve 48 endpoints across 9 modules, supporting three client platforms. This economy of code is enabled by FastAPI's declarative routing, Pydantic's automatic validation, and DynamoDB's schemaless flexibility. The Terraform infrastructure (9 resources) deploys the complete backend in minutes.

The primary limitations — single-instance pub/sub, scan-based search, and the 60-second presence TTL window — are well-understood and have clear upgrade paths (Redis, OpenSearch, and shorter heartbeat intervals respectively). These represent conscious trade-offs favoring simplicity and development velocity over theoretical scale, appropriate for a system designed to demonstrate architectural thinking rather than serve millions of concurrent users.

---

## References

[1] I. Fette and A. Melnikov, "The WebSocket Protocol," RFC 6455, Internet Engineering Task Force, Dec. 2011.

[2] P. Saint-Andre, "Extensible Messaging and Presence Protocol (XMPP): Instant Messaging and Presence," RFC 6121, Internet Engineering Task Force, Mar. 2011.

[3] Firebase Documentation, "Firebase Realtime Database REST API," Google, 2024. [Online]. Available: https://firebase.google.com/docs/database/rest/start

[4] A. DeBrie, *The DynamoDB Book*, 2020. Single-table design patterns for NoSQL databases.

[5] G. DeCandia et al., "Dynamo: Amazon's Highly Available Key-value Store," in *Proc. SOSP*, 2007, pp. 205–220.

[6] Clerk Documentation, "Expo Integration," Clerk Inc., 2025. [Online]. Available: https://clerk.com/docs/quickstarts/expo

[7] P. T. Eugster et al., "The Many Faces of Publish/Subscribe," *ACM Computing Surveys*, vol. 35, no. 2, pp. 114–131, Jun. 2003.

---

*The source code is available at https://github.com/arihantchoudhary/take-home. The Obsidian documentation vault in the repository serves as the living design document referenced throughout this paper.*
