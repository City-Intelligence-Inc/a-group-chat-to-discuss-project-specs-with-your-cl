# Architecture Overview

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Web Frontend | Next.js 16 + React 19 + TypeScript | Latest React, SSR, file-based routing |
| Mobile Frontend | React Native (Expo SDK 55) + TypeScript | Cross-platform iOS/Android |
| Styling (web) | Tailwind CSS 4 + shadcn/ui | Utility-first, consistent component library |
| Auth | Clerk (web + mobile) | Drop-in auth, handles JWT, OAuth, user management |
| Backend | FastAPI (Python) | Async, auto-generates OpenAPI docs, fast |
| Database | DynamoDB (5 tables) | Serverless, zero idle cost, scales automatically |
| Real-time | SSE + WebSocket | SSE for App Runner (no WS upgrade), WS for local |
| Infra | Terraform | Declarative, reproducible infrastructure |
| Backend Deploy | Docker + ECR + AWS App Runner | Managed container hosting, auto-scaling |
| Mobile Deploy | EAS Build + TestFlight | Cloud build for iOS distribution |

## Data Flow

### Message Send Flow
```
1. User types message, hits Enter
2. Frontend adds message optimistically (instant UI)
3. POST /api/messages/{room_id} → FastAPI
4. FastAPI writes to DynamoDB (messages table)
5. FastAPI publishes to SSE subscribers via publish()
6. All connected clients receive SSE "new_message" event
7. Frontend deduplicates (checks messageId + content + timestamp)
```

### Auth Flow
```
1. User signs up/in via Clerk (frontend)
2. Clerk issues JWT, manages session
3. On first load of /chat, frontend calls POST /api/users/
4. Backend upserts user in DynamoDB (Clerk ID = userId)
5. All subsequent API calls include sender_id = Clerk user ID
```

### Room Join Flow
```
1. User creates room → POST /api/rooms/
2. Backend auto-adds creator to room_members (role=admin)
3. Other users join → POST /api/members/{room_id}/join
4. Frontend loads members → GET /api/members/{room_id}
5. Backend enriches member list with user data (username, avatar)
```

## Key Files

| File | Purpose |
|------|---------|
| `infra/main.tf` | All 5 DynamoDB tables |
| `backend/app/main.py` | FastAPI app entry point |
| `backend/app/db.py` | DynamoDB client config |
| `backend/app/routes/*.py` | All API route handlers |
| `frontend/app/chat/page.tsx` | Main chat page (state management) |
| `frontend/lib/api.ts` | API client (field normalization) |
| `frontend/components/chat/*` | Sidebar, ChatArea, MembersPanel |
| `mobile-app/App.tsx` | Mobile app entry (Clerk + Navigation) |
| `mobile-app/src/screens/*` | Chat, SignIn, SignUp screens |
| `mobile-app/src/components/chat/*` | Mobile Sidebar, ChatArea, MembersPanel |
| `mobile-app/src/services/api.ts` | Mobile API client |

## Related
- [[data-model/Tables Overview]]
- [[backend/API Reference]]
- [[interview/Design Decisions]]
- [[mobile/Overview]]
