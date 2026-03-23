# Townhall — Chat Room Application

> Mechanize take-home challenge. Discord/Slack-style real-time chat.
> Web + Mobile (React Native). Last synced: 2026-03-23

## Quick Links

| What | Where |
|------|-------|
| Live API | `https://9rjvhfdkqt.us-west-2.awsapprunner.com` |
| Swagger Docs | `https://9rjvhfdkqt.us-west-2.awsapprunner.com/docs` |
| Frontend (local) | `http://localhost:3000` |
| Mobile (EAS) | `@arihantchoudhary/chatroom-mobile` |
| AWS Region | `us-west-2` |
| AWS Account | `050451400186` |
| Tech Design Doc | `TECHNICAL_DESIGN.md` (repo root) |

## Architecture at a Glance

```
┌─────────────────────────────────────────┐
│              Clients                    │
│                                         │
│   Browser (Next.js 16 + Clerk)          │
│   Mobile (React Native / Expo + Clerk)  │
│                                         │
└───────────────┬─────────────────────────┘
                │
                ├── REST (CRUD) ---------> FastAPI (App Runner)
                ├── SSE (real-time) -----> FastAPI /api/sse/{room_id}
                └── WebSocket (local) ---> FastAPI /ws/{room_id}/{user_id}
                                               │
                                               v
                                         DynamoDB (5 tables)
```

## Map of This Vault

### Architecture
- [[architecture/Overview]] — Full system architecture

### Data
- [[data-model/Tables Overview]] — All 5 DynamoDB tables

### Backend
- [[backend/API Reference]] — Every endpoint
- [[backend/Real-time]] — SSE + WebSocket design

### Frontend (Web)
- [[frontend/Components]] — React component tree
- [[frontend/API Client]] — How frontend talks to backend
- [[frontend/Feature Status]] — What's working vs TODO

### Mobile
- [[mobile/Overview]] — React Native app architecture
- [[mobile/Components]] — Mobile component tree
- [[mobile/Auth]] — Clerk + OAuth on mobile

### Infrastructure
- [[infrastructure/Terraform]] — IaC and deployment
- [[infrastructure/Deployment]] — Docker + ECR + App Runner

### Interview
- [[interview/Talking Points]] — What to say in the call
- [[interview/Hot Partition Problem]] — Discord system design deep dive
- [[interview/Design Decisions]] — Why we chose what we chose
