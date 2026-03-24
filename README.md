# Mechanize Take-Home Challenge: Chat Room — Townhall

**Live app**: https://frontend-5a7kdkgs6-city-intelligence-inc.vercel.app
**API docs**: https://9rjvhfdkqt.us-west-2.awsapprunner.com/docs

Thank you for taking the time to interview with Mechanize!
This repo contains your assignment for the final phase of our interview process,
an open-ended take-home assignment.

The take-home begins with **three hours** in which you can complete the task as described below.
Afterwards, there will be a ten-minute break followed by a **fifty-minute video call**.
In total, the process will take four hours.

## Getting Started

1. **Clone this repo** (do _not_ fork it):
   ```bash
   git clone <this-repo-url>
   cd chat-room
   ```
2. Do all of your work on the **`main` branch**. Commit early and often.
3. **Push your commits directly to `main`** — do not open a pull request.
   ```bash
   git push origin main
   ```
4. Your **final commit must be pushed no later than three hours** after your start time.
   Anything pushed after the deadline will not be considered.

## Task

Your task is to create a real-time chat room application similar to Discord, Slack, or Telegram.
It should support at least

- creating and joining chat rooms;
- sending and receiving messages in real time;
- displaying a list of active users in a room; and
- seperate user accounts and authentication.

Once you have these basic features, use any remaining time to make your app more usable.
This is intentionally open-ended, but here are some possibilities you could explore (in no particular order):

- Add message history and persistence so messages survive server restarts.
- Add message search functionality.
- Add support for message notifications and unread message indication.
- Support rich media: file uploads, images, link previews, markdown formatting, etc.
- Add typing indicators, read receipts, online/AFK indication, and other presence features.
- Make the UI beautiful and responsive.
- Deploy your code so it can be accessed by others.
- Add moderation tools such as muting, banning, or message deletion.
- Add other modalities such as voice and video chat.
- Implement end-to-end encryption.

## Guidelines

**Tech Stack**: Use whatever stack you prefer.
We want to see what you can do with whatever tools you are most comfortable with.
That said, please use tools which allow us to understand your abilities --
for example, completing this challenge by deploying an off-the-shelf chat platform would make it very difficult for us to evaluate your skills.

**Use of AI**: Use whatever AI tools you like.
If you can one-shot the entire project, that's great!
Just know that you will be expected to demonstrate understanding of your code during the call.

---

## Arihant's Submission — Townhall

### Architecture
```
Browser (Next.js 16 + Clerk) → FastAPI (App Runner) → DynamoDB (5 tables) + S3
Mobile (Expo + Clerk)       ↗        ↑
                               SSE real-time
```

### Stack
| Layer | Tech |
|-------|------|
| Frontend | Next.js 16, React 19, Tailwind v4, shadcn/ui, Clerk auth |
| Backend | FastAPI, Python 3.13, SSE pub/sub |
| Database | DynamoDB (5 tables, PAY_PER_REQUEST) |
| Storage | S3 (file uploads with presigned URLs) |
| Infra | Terraform, AWS App Runner, Docker, ECR |

### Requirement Checklist

#### Core (all done)
| Requirement | Implementation |
|---|---|
| Creating and joining chat rooms | `POST /api/rooms/` + auto-join creator, `POST /api/members/{id}/join` |
| Sending and receiving messages in real time | `POST /api/messages/{id}` + SSE stream on `/api/sse/{id}`, optimistic UI |
| Displaying active users in a room | Members panel with online/offline dots, 60s heartbeat staleness |
| Separate user accounts and authentication | Clerk (Google, GitHub, Apple, email), JWT, protected routes |

#### Stretch goals (8 of 10 done)
| Feature | Status | Notes |
|---|---|---|
| Message history & persistence | ✅ | DynamoDB, cursor-based pagination, survives restarts |
| Message search | ✅ | Cmd+K modal, debounced search across all messages |
| Notifications / unread indication | ✅ | Red badges on channels, `lastReadAt` tracking |
| Rich media (files, images, markdown) | ✅ | S3 uploads, drag-and-drop, ReactMarkdown + GFM, file preview cards |
| Typing indicators, read receipts, presence | ✅ | SSE typing events, `lastReadAt`, heartbeat presence |
| Beautiful & responsive UI | ✅ | Slack-inspired dark/light, mobile responsive, onboarding tour |
| Deploy so others can access | ✅ | Vercel (frontend) + App Runner (backend) + Terraform (infra) |
| Moderation tools | ✅ | Message delete, kick, mute, ban (backend), delete UI (frontend) |
| Voice/video chat | ❌ | Would use WebRTC + TURN/STUN server |
| End-to-end encryption | ❌ | Would use Signal Protocol (Double Ratchet) |

### Additional features built
- Emoji reactions (toggle, counts, live updates via SSE)
- Inline replies with quoted preview
- Message editing with SSE broadcast
- File attachment preview cards (color-coded icons, image thumbnails, content preview)
- First-time onboarding tutorial
- Mobile app (React Native / Expo)

### Data Model
| Table | PK | SK | GSIs |
|-------|----|----|------|
| users | userId | — | email, username |
| chat_rooms | roomId | — | createdBy |
| room_members | roomId | userId | userId-index |
| messages | roomId | sortKey (`timestamp#uuid`) | senderId |
| connections | connectionId | — | userId, roomId |

### Key Design Decisions
| Decision | Choice | Why |
|----------|--------|-----|
| Real-time | SSE (not WebSocket) | App Runner doesn't support WebSocket upgrades |
| Database | DynamoDB | Serverless, zero idle cost, auto-scales |
| Auth | Clerk | Focus on the interesting parts, not reimplementing auth |
| Backend | FastAPI | Auto OpenAPI docs, async-native, Pydantic validation |
| IaC | Terraform | Multi-cloud, better DX, state management |
| File storage | S3 | Cheaper, CDN-ready, presigned URLs |

### Running locally
```bash
# Frontend
cd frontend && pnpm install && pnpm dev

# Backend
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload

# Infrastructure
cd infra && terraform init && terraform apply
```

### Scaling considerations
- **Hot partition problem**: Popular rooms overwhelm one DynamoDB partition. Fix: Redis cache + request coalescing (like Discord's approach).
- **Multi-instance SSE**: Currently in-memory pub/sub. At scale: Redis Pub/Sub to fan events across instances.
- **File uploads at scale**: S3 multipart upload + CloudFront CDN for delivery.
