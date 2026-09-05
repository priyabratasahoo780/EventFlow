<div align="center">

  <img src="frontend/assets/images/focusflow_logo.png" alt="EventFlow Logo" width="120" />

  <h1>EventFlow</h1>

  <p>
    A full-stack, production-ready mobile productivity platform —<br/>
    smart event scheduling, AI priority ranking, real-time social features, and native alarm management.
  </p>

  <p>
    <a href="https://github.com/priyabratasahoo780/EventFlow/stargazers">
      <img src="https://img.shields.io/github/stars/priyabratasahoo780/EventFlow?style=flat-square&color=f97316&label=Stars" alt="GitHub Stars" />
    </a>
    <a href="https://github.com/priyabratasahoo780/EventFlow/commits/main">
      <img src="https://img.shields.io/github/last-commit/priyabratasahoo780/EventFlow?style=flat-square&color=6366f1&label=Last+Commit" alt="Last Commit" />
    </a>
    <a href="https://github.com/priyabratasahoo780/EventFlow/blob/main/LICENSE">
      <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License: MIT" />
    </a>
    <img src="https://img.shields.io/badge/Platform-Android%20%7C%20iOS%20%7C%20Web-blue?style=flat-square" alt="Platforms" />
    <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Expo%20SDK-57-1C1E24?style=flat-square&logo=expo" alt="Expo SDK 57" />
  </p>

  <br/>

  | Welcome | Login | Home | Calendar |
  |:-:|:-:|:-:|:-:|
  | <img src="frontend/assets/images/image1.png" width="175" alt="Welcome"/> | <img src="frontend/assets/images/image2.png" width="175" alt="Login"/> | <img src="frontend/assets/images/image3.png" width="175" alt="Home"/> | <img src="frontend/assets/images/image4.png" width="175" alt="Calendar"/> |

  | Statistics | Settings | Community | Friends |
  |:-:|:-:|:-:|:-:|
  | <img src="frontend/assets/images/image5.png" width="175" alt="Statistics"/> | <img src="frontend/assets/images/image6.png" width="175" alt="Settings"/> | <img src="frontend/assets/images/image7.png" width="175" alt="Community"/> | <img src="frontend/assets/images/image8.png" width="175" alt="Friends"/> |

</div>

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Folder Structure Deep Dive](#folder-structure-deep-dive)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Author](#author)

---

## Overview

**EventFlow** is a production-grade mobile application that goes far beyond a simple to-do list. It combines **smart event scheduling**, a **priority scoring engine**, **native Android alarm management**, **geofence-based location reminders**, and **real-time social features** into a single cohesive experience.

Built on a **React Native + Expo** frontend and a **Node.js + Express + MongoDB** backend, with a clean domain-driven folder architecture and zero TypeScript errors.

---

## Key Features

### 📅 Event & Task Management
- Create events with **rich metadata**: category, priority, estimated duration, color, icon, linked contact, media (image/video)
- **Multi-reminder system** per event: `before`, `exact`, `daily`, `weekly`, `monthly`, `yearly`
- Smart status tracking: `pending → in_progress → completed → overdue`

### 🧠 AI Priority Engine
- Dynamic priority scoring based on **deadline proximity**, **user-defined importance**, and **location distance**
- Auto-ranked task list and **Hero Focus Card** carousel on the home screen
- Backend `/api/tasks/recommendation` endpoint for server-side priority suggestions

### 🔔 Native Alarm & Notification System
- **Dual-layer alert system**: `expo-notifications` for push/local banners + native `AlarmManagerModule` (Kotlin) for **exact Android alarms** that wake the device
- Alarm modal with custom sound, haptic feedback, and snooze-like dismiss
- Graceful fallback on iOS and Expo Go

### 📍 Geofence Location Reminders
- Enable a **location trigger** per event: fire a reminder when you **arrive at** or **leave** the event location
- Powered by `expo-location` background task + custom geofencing engine
- Visual `LocationArrivalModal` with navigation shortcut

### 👥 Social & Friends
- Add friends by username/email with a **request → accept → connect** flow
- Share events with friends (visibility: `onlyMe`, `friends`, `selectedFriends`)
- Real-time friend event feed via **Socket.io**
- In-app DM messaging between friends

### 📊 Analytics Dashboard
- Weekly productivity charts (gifted-charts)
- Category breakdown and completion trends
- Daily momentum progress bar on home screen

### 🎨 Premium UI
- Brutalist-inspired design system with custom `BrutalCard` and `BrutalButton` components
- Dark/Light theme via `useThemeStore`
- Smooth animations (Reanimated 4), haptic feedback on every interaction
- Hero card carousel with auto-scroll, category chips, status filter pills

---

## Tech Stack

### Frontend

| Technology | Version | Role |
|:---|:---:|:---|
| ![React Native](https://img.shields.io/badge/React_Native-20232A?style=flat-square&logo=react&logoColor=61DAFB) | 0.86 | Core mobile framework |
| ![Expo](https://img.shields.io/badge/Expo_SDK-57-1C1E24?style=flat-square&logo=expo) | 57 | Build, OTA, native modules |
| ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) | 6.x | Strict type safety |
| ![Expo Router](https://img.shields.io/badge/Expo_Router-v4-CA4245?style=flat-square) | v4 | File-based navigation |
| ![Zustand](https://img.shields.io/badge/Zustand-5.x-orange?style=flat-square) | 5.x | Lightweight global state |
| ![Clerk](https://img.shields.io/badge/Clerk_Expo-Auth-6C47FF?style=flat-square&logo=clerk) | 4.x | Authentication & JWT |
| ![Socket.io](https://img.shields.io/badge/Socket.io_Client-4.x-010101?style=flat-square&logo=socket.io) | 4.x | Real-time events |
| Axios | 1.x | HTTP client |
| React Native Maps | 1.27 | Maps + geofence display |
| Reanimated | 4.x | Smooth animations |

**Key Expo modules:** `expo-notifications`, `expo-location`, `expo-task-manager`, `expo-video`, `expo-audio`, `expo-haptics`, `expo-image-picker`, `expo-secure-store`

### Backend

| Technology | Version | Role |
|:---|:---:|:---|
| ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white) | 18+ | Runtime |
| ![Express](https://img.shields.io/badge/Express-5.x-404D59?style=flat-square&logo=express) | 5.x | REST framework |
| ![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white) | Atlas | Primary database |
| ![Mongoose](https://img.shields.io/badge/Mongoose-9.x-880000?style=flat-square) | 9.x | ODM / schema validation |
| ![Socket.io](https://img.shields.io/badge/Socket.io-4.x-010101?style=flat-square&logo=socket.io) | 4.x | WebSocket server |
| JWT | 9.x | Stateless auth tokens |
| bcryptjs | 3.x | Password hashing |
| Multer | 2.x | File upload handling |
| expo-server-sdk | 7.x | Expo push notifications |
| express-rate-limit | 8.x | API rate limiting |

---

## Architecture

### System Overview

```mermaid
flowchart TD
    subgraph Client["📱 Client — React Native / Expo"]
        A["Expo Router (File-based Navigation)"]
        B["Screen Components (app/ directory)"]
        C["Zustand Stores (Events, Auth, Theme)"]
        D["src/ — Hooks, Services, Components"]
        A --> B --> C --> D
    end

    subgraph Auth["🔐 Auth — Clerk Provider"]
        E["Clerk OAuth / Email Auth"]
        F["Secure Token Cache (expo-secure-store)"]
        E --> F
    end

    subgraph API["⚙️ API — Node.js / Express 5"]
        G["Routes (*.routes.js)"]
        J["Middleware (auth, rate-limit, error)"]
        H["Controllers (business logic)"]
        I["Services (priority engine, analytics)"]
        G --> J --> H --> I
    end

    subgraph Realtime["⚡ Real-time — Socket.io"]
        S["WebSocket Server (src/config/socket.js)"]
        S2["JWT Auth Middleware (per socket)"]
        S --> S2
    end

    subgraph Database["🗄️ Data — MongoDB Atlas"]
        L[("Mongoose Models")]
        K[("MongoDB Atlas Cluster")]
        L --> K
    end

    D -->|"HTTPS REST"| G
    D -->|"WebSocket"| S
    B -.->|"Token Auth"| E
    I --> L
    S2 --> H
```

### Frontend Request Flow

```mermaid
sequenceDiagram
    participant Screen
    participant Store (Zustand)
    participant Service
    participant API (Axios)
    participant Backend

    Screen->>Store (Zustand): dispatch action (e.g. addEvent)
    Store (Zustand)->>Service: call service method
    Service->>API (Axios): HTTP request with JWT header
    API (Axios)->>Backend: POST /api/events
    Backend-->>API (Axios): 201 Created { event }
    API (Axios)-->>Service: response.data
    Service-->>Store (Zustand): update state
    Store (Zustand)-->>Screen: re-render with new data
```

### Backend Request Pipeline

```mermaid
flowchart LR
    A["server.js\n(HTTP + Socket.io)"] --> B["src/config/env.js\n(Env validation)"]
    B --> C["src/app.js\n(Express + CORS + Middlewares)"]
    C --> D["routes/*.routes.js\n(URL matching)"]
    D --> E["middleware/auth.middleware.js\n(JWT verification)"]
    E --> F["controllers/*.controller.js\n(Request handling)"]
    F --> G["services/*.service.js\n(Business logic)"]
    G --> H[("MongoDB\nvia Mongoose")]
```

---

## Project Structure

```
EventFlow/                              # Mono-repo root
├── backend/                            # Node.js + Express API
│   ├── server.js                       # Entry point (HTTP + Socket.io bootstrap)
│   └── src/
│       ├── config/
│       │   ├── db.js                   # MongoDB connection
│       │   ├── env.js                  # Env validation (fail-fast)
│       │   └── socket.js               # Socket.io setup (extracted from server)
│       ├── constants/
│       │   └── index.js                # HTTP codes, error messages, status enums
│       ├── controllers/                # One file per domain, dot.notation naming
│       │   ├── auth.controller.js
│       │   ├── event.controller.js
│       │   ├── friend.controller.js
│       │   ├── task.controller.js
│       │   ├── analytics.controller.js
│       │   ├── review.controller.js
│       │   ├── upload.controller.js
│       │   └── user.controller.js
│       ├── middleware/
│       │   ├── auth.middleware.js      # JWT verification
│       │   ├── error.middleware.js     # Global error handler
│       │   ├── rateLimiter.js          # API + auth rate limits
│       │   └── upload.middleware.js    # Multer config
│       ├── models/                     # Mongoose schemas
│       │   ├── Event.js
│       │   ├── FriendRequest.js
│       │   ├── Message.js
│       │   ├── Review.js
│       │   └── User.js
│       ├── routes/                     # Consistent *.routes.js naming
│       │   ├── auth.routes.js
│       │   ├── event.routes.js
│       │   ├── friend.routes.js
│       │   ├── task.routes.js
│       │   ├── analytics.routes.js
│       │   ├── review.routes.js
│       │   ├── upload.routes.js
│       │   └── user.routes.js
│       ├── services/
│       │   ├── analytics.service.js
│       │   └── priority.service.js     # Dynamic priority scoring engine
│       ├── utils/
│       │   ├── ApiError.js             # Custom error class
│       │   └── logger.js               # Structured logger (ISO timestamps)
│       └── validators/
│           ├── auth.validator.js
│           └── task.validator.js
│
└── frontend/                           # React Native + Expo app
    ├── app/                            # Expo Router file-based routing
    │   ├── (auth)/                     # Auth group: welcome, login, register
    │   ├── (tabs)/                     # Tab group: home, calendar, stats, profile, settings
    │   ├── event/[id].tsx              # Dynamic event detail screen
    │   ├── friends/                    # Friends: connect, list, requests
    │   ├── community/                  # Community reviews
    │   ├── map.tsx                     # Full-screen map view
    │   └── _layout.tsx                 # Root layout (ClerkProvider, fonts, themes)
    │
    ├── src/                            # All application source code
    │   ├── components/                 # Domain-grouped UI components
    │   │   ├── alarm/                  # AlarmModal
    │   │   ├── events/                 # EventCard, FocusRecommendationCard, CategoryChip
    │   │   ├── home/                   # Home screen sub-components (extracted god file)
    │   │   ├── location/               # LocationArrivalModal, LocationSelector, MapViewWrapper
    │   │   ├── media/                  # MediaPicker
    │   │   └── ui/                     # Generic: BrutalButton, BrutalCard, Input, Header…
    │   │
    │   ├── constants/                  # Colors, theme tokens, responsive helpers
    │   ├── hooks/                      # Custom React hooks (useLocation, useHomeScreen…)
    │   ├── lib/                        # Third-party wrappers (notifications.ts shim)
    │   ├── services/                   # API calls + native services
    │   │   └── alarm/                  # alarmService.ts, alarmSoundService.ts
    │   ├── store/                      # Zustand stores (useEventStore, useAuthStore…)
    │   └── types/                      # Shared TypeScript types (event.types.ts)
    │
    ├── assets/                         # Fonts, images, icons
    ├── plugins/                        # Expo config plugins (AlarmManager native)
    ├── babel.config.js                 # @/* path aliases via module-resolver
    ├── tsconfig.json                   # Strict TS + path aliases
    ├── metro.config.js                 # Metro bundler config + web shims
    └── app.json                        # Expo app config (EAS, permissions)
```

---

## Getting Started

### Prerequisites

| Tool | Version | Notes |
|:---|:---|:---|
| Node.js | **≥ 18.x** | [nodejs.org](https://nodejs.org) |
| npm | **≥ 9.x** | Bundled with Node.js |
| MongoDB | Local or Atlas | [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) |
| Expo Go App | Latest | Scan QR for quick testing (Android/iOS) |
| Android Studio | Optional | For full native build / emulator |

> **Important:** The native `AlarmManagerModule` (exact Android alarms) only works in a custom development build or APK, **not** in Expo Go. All other features run in Expo Go.

---

### Clone the Repository

```bash
git clone https://github.com/priyabratasahoo780/EventFlow.git
cd EventFlow
```

---

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
# → Edit .env with your values (see Environment Variables section below)

# Start development server with hot-reload
npm run dev
# → Server starts at http://localhost:5000
```

**Available scripts:**

| Script | Description |
|:---|:---|
| `npm run dev` | Start with nodemon (hot-reload) |
| `npm start` | Start in production mode |

---

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the Expo development server (with cache clear)
npx expo start -c

# Platform-specific launchers:
npm run android   # Android emulator / physical device
npm run ios       # iOS simulator (macOS only)
npm run web       # Web browser (limited native features)

# Production build (EAS):
npm run build:apk  # Android APK via EAS Build
```

**Available scripts:**

| Script | Description |
|:---|:---|
| `npm start` | Start Expo dev server |
| `npm run android` | Run on Android |
| `npm run ios` | Run on iOS |
| `npm run web` | Run in browser |
| `npm run build:apk` | EAS build (Android APK) |

> Scan the QR code shown in the terminal with the **Expo Go** app to test instantly on a physical device.

---

### Environment Variables

#### Backend — `backend/.env`

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/eventflow

# Authentication
JWT_SECRET=your_super_secret_jwt_key_min_32_chars

# Expo Push Notifications (optional)
EXPO_ACCESS_TOKEN=your_expo_access_token
```

> **Required fields** (server will throw at startup if missing): `MONGO_URI`, `JWT_SECRET`

#### Frontend — `frontend/.env` (if needed)

```env
EXPO_PUBLIC_API_URL=http://localhost:5000
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_key
```

> Variables prefixed with `EXPO_PUBLIC_` are safe to embed in the client bundle.

---

## API Reference

> All protected endpoints require: `Authorization: Bearer <jwt_token>`

### Auth — `/api/auth`

| Method | Endpoint | Protected | Description |
|:---:|:---|:---:|:---|
| `POST` | `/api/auth/register` | ✗ | Register a new user (email + password) |
| `POST` | `/api/auth/login` | ✗ | Login and receive JWT |
| `POST` | `/api/auth/google` | ✗ | Login with Google OAuth |
| `POST` | `/api/auth/sync` | ✗ | Sync Clerk user with MongoDB |
| `POST` | `/api/auth/forgot-password` | ✗ | Send password reset email |
| `GET` | `/api/auth/profile` | ✓ | Get authenticated user's profile |

### Users — `/api/users`

| Method | Endpoint | Protected | Description |
|:---:|:---|:---:|:---|
| `GET` | `/api/users/profile` | ✓ | Get current user profile |
| `PUT` | `/api/users/profile` | ✓ | Update user profile |
| `POST` | `/api/users/push-token` | ✓ | Register Expo push notification token |

### Events — `/api/events`

| Method | Endpoint | Protected | Description |
|:---:|:---|:---:|:---|
| `POST` | `/api/events` | ✓ | Create a new event |
| `GET` | `/api/events` | ✓ | Get all events for current user |
| `GET` | `/api/events/friends` | ✓ | Get shared events from friends |

### Tasks — `/api/tasks`

| Method | Endpoint | Protected | Description |
|:---:|:---|:---:|:---|
| `GET` | `/api/tasks` | ✓ | Get all tasks (sorted by priority) |
| `GET` | `/api/tasks/recommendation` | ✓ | Get top AI-ranked task recommendation |
| `POST` | `/api/tasks` | ✓ | Create a new task |
| `GET` | `/api/tasks/:id` | ✓ | Get task by ID |
| `PUT` | `/api/tasks/:id` | ✓ | Update task details |
| `PATCH` | `/api/tasks/:id/status` | ✓ | Update task status only |
| `DELETE` | `/api/tasks/:id` | ✓ | Delete a task |

### Friends — `/api/friends`

| Method | Endpoint | Protected | Description |
|:---:|:---|:---:|:---|
| `POST` | `/api/friends/search` | ✓ | Search user by name or email |
| `POST` | `/api/friends/request` | ✓ | Send a friend request |
| `GET` | `/api/friends/requests` | ✓ | Get incoming friend requests |
| `POST` | `/api/friends/accept` | ✓ | Accept a friend request |
| `POST` | `/api/friends/reject` | ✓ | Reject a friend request |
| `GET` | `/api/friends` | ✓ | Get full friends list |
| `GET` | `/api/friends/events` | ✓ | Get friends' shared events |
| `POST` | `/api/friends/message` | ✓ | Send a DM to a friend |
| `GET` | `/api/friends/messages/:friendId` | ✓ | Get message history with a friend |
| `DELETE` | `/api/friends/remove` | ✓ | Remove a friend |

### Reviews — `/api/reviews`

| Method | Endpoint | Protected | Description |
|:---:|:---|:---:|:---|
| `POST` | `/api/reviews` | ✓ | Create a community review |
| `GET` | `/api/reviews` | ✓ | Get all community reviews |
| `POST` | `/api/reviews/:id/like` | ✓ | Toggle like on a review |

### Analytics — `/api/analytics`

| Method | Endpoint | Protected | Description |
|:---:|:---|:---:|:---|
| `GET` | `/api/analytics/dashboard` | ✓ | Dashboard summary statistics |
| `GET` | `/api/analytics/weekly` | ✓ | Weekly productivity chart data |
| `GET` | `/api/analytics/categories` | ✓ | Task breakdown by category |

### Uploads — `/api/upload`

| Method | Endpoint | Protected | Description |
|:---:|:---|:---:|:---|
| `POST` | `/api/upload/image` | ✓ | Upload image (50MB max) |
| `POST` | `/api/upload/video` | ✓ | Upload video (50MB max) |
| `DELETE` | `/api/upload/:id` | ✓ | Delete an uploaded file |

---

## Folder Structure Deep Dive

### Path Aliases (Frontend)

The frontend uses Babel `module-resolver` so imports are clean and refactor-safe:

```typescript
// ❌ Before (brittle relative paths)
import { useEventStore } from '../../../../store/useEventStore';
import BrutalButton from '../../components/BrutalButton';

// ✅ After (clean path aliases)
import { useEventStore } from '@/store';
import { BrutalButton } from '@/components/ui';
```

| Alias | Resolves to |
|:---|:---|
| `@/*` | `./src/*` |
| `@/components` | `./src/components` |
| `@/store` | `./src/store` |
| `@/hooks` | `./src/hooks` |
| `@/services` | `./src/services` |
| `@/types` | `./src/types` |
| `@/constants` | `./src/constants` |
| `@/lib` | `./src/lib` |

### Barrel Exports

Every `src/` subdirectory has an `index.ts` barrel for clean tree-shakable imports:

```typescript
// Single import for all UI primitives
import { BrutalButton, BrutalCard, LoadingScreen, EmptyState } from '@/components/ui';

// Single import for all stores
import { useEventStore, useAuthStore, useThemeStore } from '@/store';
```

### Notification Architecture

```
Notification triggered
  ├── expo-notifications → Banner + sound (all platforms, foreground)
  └── AlarmManagerModule (Kotlin) → Exact alarm (Android, even background/killed)
        └── AlarmModal fires on exact time match via 1-second foreground poll
```

---

## Roadmap

- [x] Multi-reminder system (before/exact/daily/weekly/monthly/yearly)
- [x] Native Android AlarmManager integration
- [x] Geofence location reminders (arrive/leave)
- [x] Real-time friend events via Socket.io
- [x] AI priority scoring engine
- [x] Production-ready folder structure with path aliases
- [ ] Push notifications via Expo server SDK
- [ ] Group events and collaborative task lists
- [ ] Offline mode with AsyncStorage-first sync
- [ ] EAS Update (OTA updates in production)
- [ ] End-to-end encrypted DMs
- [ ] Widget support (Android/iOS)

---

## Contributing

Contributions are what make open source amazing. Any contribution you make is **greatly appreciated**.

1. **Fork** the repository
2. Create your feature branch: `git checkout -b feat/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feat/amazing-feature`
5. Open a **Pull Request**

**Commit message format** (Conventional Commits):

| Prefix | When to use |
|:---|:---|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `refactor:` | Code restructure (no feature change) |
| `docs:` | Documentation only |
| `chore:` | Build/tooling changes |

---

## License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

---

## Author

<div align="center">

**Priyabrata Sahoo**

[![GitHub](https://img.shields.io/badge/GitHub-priyabratasahoo780-181717?style=for-the-badge&logo=github)](https://github.com/priyabratasahoo780)
[![Issues](https://img.shields.io/badge/Report_a_Bug-Issues-f97316?style=for-the-badge&logo=github)](https://github.com/priyabratasahoo780/EventFlow/issues)

---

<sub>Built with ❤️ passion and precision.</sub>

<img src="https://img.shields.io/badge/Made%20with-React%20Native-61DAFB?style=for-the-badge&logo=react" alt="Made with React Native" />
<img src="https://img.shields.io/badge/Powered%20by-Node.js-339933?style=for-the-badge&logo=nodedotjs" alt="Powered by Node.js" />
<img src="https://img.shields.io/badge/Database-MongoDB-47A248?style=for-the-badge&logo=mongodb" alt="MongoDB" />

<br/><br/>
<sub>© 2026 EventFlow — All rights reserved.</sub>

</div>