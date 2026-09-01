<div align="center">
  <img src="frontend/assets/images/focusflow_logo.png" alt="EventFlow Logo" width="150" />
  <h1>EventFlow</h1>
  <p>A comprehensive event scheduling, task management, and productivity tracking application.</p>
</div>

---

## About The App

EventFlow (also known as FocusFlow) is a full-stack mobile application designed to help users take control of their time. It combines calendar event scheduling, task prioritization, location-based tracking, and social connections into a single, seamless brutalist-styled interface.

Whether you are managing daily routines, organizing community events, or collaborating with friends, EventFlow keeps you on track with real-time notifications and smart priority algorithms.

---

## App Preview

<div align="center">

| Welcome | Login | Home | Calendar |
|:-:|:-:|:-:|:-:|
| <img src="frontend/assets/images/image1.png" width="180" alt="Welcome Page"/> | <img src="frontend/assets/images/image2.png" width="180" alt="Login Page"/> | <img src="frontend/assets/images/image3.png" width="180" alt="Home Page"/> | <img src="frontend/assets/images/image4.png" width="180" alt="Calendar Page"/> |

| Statistics | Settings | Community | Friends |
|:-:|:-:|:-:|:-:|
| <img src="frontend/assets/images/image5.png" width="180" alt="Stats Page"/> | <img src="frontend/assets/images/image6.png" width="180" alt="Settings Page"/> | <img src="frontend/assets/images/image7.png" width="180" alt="Community Page"/> | <img src="frontend/assets/images/image8.png" width="180" alt="Friends Page"/> |

</div>

---

## Tech Stack

### Frontend (Mobile App)
![React Native](https://img.shields.io/badge/react_native-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Expo](https://img.shields.io/badge/expo-1C1E24?style=for-the-badge&logo=expo&logoColor=#D04A37)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Expo Router](https://img.shields.io/badge/Expo%20Router-CA4245.svg?style=for-the-badge&logo=react-router&logoColor=white)
<br/>
**Libraries:** Clerk Auth (`@clerk/expo`), Zustand, Axios, Socket.io-client, React Native Maps, Custom Brutalist UI

### Backend (REST API)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-%234ea94b.svg?style=for-the-badge&logo=mongodb&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
<br/>
**Features:** JWT Auth, bcrypt, Multer (Uploads), Socket.io (Real-time), Express Rate Limit

---

## Workflow Structure

### Full Stack System Design

The platform operates on a **4-tier mobile architecture** spanning the mobile client, authentication provider, API server, and MongoDB database cluster. Every component is purpose-built for high-performance event and task management at scale.

```mermaid
flowchart TD
    subgraph Client["Client Tier (React Native & Expo)"]
        A["Expo Router (File-based Navigation)"]
        B["UI Components (Screens & Layouts)"]
        C["Zustand Stores (Events, Auth, Theme)"]
        D["Axios & Socket.io-client (REST & Real-time)"]
        A --> B --> C --> D
    end

    subgraph Auth["Auth Tier (Clerk Provider)"]
        E["Clerk Auth (Sign In, Sign Up, JWT)"]
        F["Secure Token Cache (tokenCache.ts)"]
        E --> F
    end

    subgraph API["API Tier (Node.js & Express)"]
        G["Routes Layer (event, task, user, auth)"]
        J["Middleware (Auth, Rate Limit, Uploads)"]
        H["Controllers Layer (Request Handling)"]
        I["Services Layer (Priority Engine, Analytics)"]
        G --> J --> H --> I
    end

    subgraph Database["Data Tier (MongoDB)"]
        L[("Mongoose Models (Schema Validation)")]
        K[("MongoDB Atlas (Database Cluster)")]
        L --> K
    end

    D -->|"HTTPS REST API / WebSocket"| G
    B -.->|"Token Auth"| E
    I --> L
```

The project is organized into a clean mono-repo structure containing both the frontend and backend applications, designed for independent scaling and development.

### Frontend Workflow

```mermaid
flowchart TD
    A["Entry Point: _layout.tsx"] -->|"Initializes"| B["ClerkProvider & Themes"]
    B --> C{"Is User Authenticated?"}
    C -->|"No"| D["Auth Flow (welcome.tsx)"]
    D --> E["Login / Register (login.tsx)"]
    C -->|"Yes"| F["Main Dashboard (tabs)"]
    
    subgraph CoreScreens["Core Screens"]
        G["Home (index.tsx)"]
        H["Calendar (calendar.tsx)"]
        I["Statistics (statistics.tsx)"]
        J["Profile (profile.tsx)"]
    end
    
    subgraph StateServices["State & Services"]
        K["Zustand Stores (Events, Auth, Theme)"]
        L["Custom Hooks (Location, Notifications)"]
    end

    F --> G
    F --> H
    F --> I
    F --> J
    
    F -.-> K
    F -.-> L
```

### Backend Workflow

```mermaid
flowchart LR
    A["Entry (server.js)"] -->|"Initializes"| B["Express & Socket.io"]
    
    subgraph Pipeline["Request Pipeline"]
        C["routes/"]
        D["controllers/"]
        E["services/"]
        C -->|"Delegates"| D
        D -->|"Business Logic"| E
    end
    
    subgraph Storage["Data & Middleware"]
        F[("MongoDB Models")]
        G["Middleware (Auth, Error, Upload)"]
    end

    B -->|"Matches Route"| C
    G -.->|"Intercepts"| C
    D -.->|"Validates"| F
    E -->|"Reads / Writes"| F
```

---

## API Endpoints

> All protected routes require a valid **JWT Bearer Token** in the `Authorization` header.

### Auth — `/api/auth`

| Method | Endpoint | Auth | Description |
|:---:|---|:---:|---|
| `POST` | `/api/auth/register` | No | Register a new user |
| `POST` | `/api/auth/login` | No | Login with email and password |
| `POST` | `/api/auth/google` | No | Login with Google OAuth |
| `POST` | `/api/auth/sync` | No | Sync Clerk user with database |
| `POST` | `/api/auth/forgot-password` | No | Send password reset email |
| `GET` | `/api/auth/profile` | Yes | Get logged-in user profile |

### User — `/api/users`

| Method | Endpoint | Auth | Description |
|:---:|---|:---:|---|
| `GET` | `/api/users/profile` | Yes | Get current user's profile |
| `PUT` | `/api/users/profile` | Yes | Update user profile details |
| `POST` | `/api/users/push-token` | Yes | Register Expo push token |

### Events — `/api/events`

| Method | Endpoint | Auth | Description |
|:---:|---|:---:|---|
| `POST` | `/api/events` | Yes | Create a new event |
| `GET` | `/api/events` | Yes | Get all events for current user |
| `GET` | `/api/events/friends` | Yes | Get events from friends |

### Tasks — `/api/tasks`

| Method | Endpoint | Auth | Description |
|:---:|---|:---:|---|
| `GET` | `/api/tasks` | Yes | Get all tasks |
| `GET` | `/api/tasks/recommendation` | Yes | Get AI priority recommendations |
| `POST` | `/api/tasks` | Yes | Create a new task |
| `GET` | `/api/tasks/:id` | Yes | Get a specific task by ID |
| `PUT` | `/api/tasks/:id` | Yes | Update a task |
| `PATCH` | `/api/tasks/:id/status` | Yes | Update task completion status |
| `DELETE` | `/api/tasks/:id` | Yes | Delete a task |

### Friends — `/api/friends`

| Method | Endpoint | Auth | Description |
|:---:|---|:---:|---|
| `POST` | `/api/friends/search` | Yes | Search for a user by name/email |
| `POST` | `/api/friends/request` | Yes | Send a friend request |
| `GET` | `/api/friends/requests` | Yes | View incoming friend requests |
| `POST` | `/api/friends/accept` | Yes | Accept a friend request |
| `POST` | `/api/friends/reject` | Yes | Reject a friend request |
| `GET` | `/api/friends` | Yes | Get full friends list |
| `GET` | `/api/friends/events` | Yes | Get friends' events |
| `POST` | `/api/friends/message` | Yes | Send a message to a friend |
| `GET` | `/api/friends/messages/:friendId` | Yes | Get messages with a friend |
| `DELETE` | `/api/friends/remove` | Yes | Remove a friend |

### Reviews — `/api/reviews`

| Method | Endpoint | Auth | Description |
|:---:|---|:---:|---|
| `POST` | `/api/reviews` | Yes | Create an event review |
| `GET` | `/api/reviews` | Yes | Get all community reviews |
| `POST` | `/api/reviews/:id/like` | Yes | Toggle like on a review |

### Analytics — `/api/analytics`

| Method | Endpoint | Auth | Description |
|:---:|---|:---:|---|
| `GET` | `/api/analytics/dashboard` | Yes | Get dashboard summary statistics |
| `GET` | `/api/analytics/weekly` | Yes | Get weekly productivity data |
| `GET` | `/api/analytics/categories` | Yes | Get task category breakdown |

### Uploads — `/api/upload`

| Method | Endpoint | Auth | Description |
|:---:|---|:---:|---|
| `POST` | `/api/upload/image` | Yes | Upload an image file |
| `POST` | `/api/upload/video` | Yes | Upload a video file |
| `DELETE` | `/api/upload/:id` | Yes | Delete an uploaded file |

---

## Getting Started

Follow the steps below to run this project locally on your machine.

### Prerequisites

Make sure you have the following installed:

| Tool | Version | Download |
|---|---|---|
| Node.js | v18 or higher | [nodejs.org](https://nodejs.org) |
| npm | v9 or higher | Comes with Node.js |
| Expo CLI | Latest | `npm install -g expo-cli` |
| MongoDB | Local or Atlas | [mongodb.com](https://www.mongodb.com) |
| Expo Go App | Latest | Install on your phone from App Store / Play Store |

---

### Clone the Repository

```bash
git clone https://github.com/priyabratasahoo780/EventFlow.git
cd EventFlow
```

---

### Backend Setup

```bash
# Navigate to the backend directory
cd backend

# Install dependencies
npm install

# Create a .env file and add your environment variables
# Example .env:
# PORT=5000
# MONGO_URI=your_mongodb_connection_string
# JWT_SECRET=your_jwt_secret

# Start the development server
npm run dev
```

> The backend server will start on `http://localhost:5000`

---

### Frontend Setup

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start the Expo development server
npm run start

# To run on specific platforms:
npm run android    # Android emulator or device
npm run ios        # iOS simulator (macOS only)
npm run web        # Web browser
```

> Scan the QR code shown in your terminal with the **Expo Go** app on your phone.

---

### Project Structure

```
EventFlow/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Route handler logic
│   │   ├── middleware/      # Auth, rate limit, upload
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/          # API route definitions
│   │   ├── services/        # Business logic layer
│   │   ├── utils/           # Utility helpers
│   │   └── validators/      # Input validation
│   └── server.js            # Entry point
│
└── frontend/
    ├── app/
    │   ├── (auth)/          # Welcome, Login, Register
    │   ├── (tabs)/          # Home, Calendar, Stats, Profile
    │   ├── event/           # Event detail screen
    │   └── friends/         # Friend management screens
    ├── components/          # Reusable UI components
    ├── constants/           # Colors, themes
    ├── hooks/               # Custom React hooks
    ├── services/            # API client, notifications
    └── store/               # Zustand state management
```

---

## Future Roadmap

- [ ] Push Notifications for event reminders and task deadlines
- [ ] Group Events and Collaborative task lists
- [ ] Advanced AI scheduling using machine learning models
- [ ] Offline mode with robust local-first sync
- [ ] Dark Mode refined themes

---

## Contact & Support

If you have any questions, suggestions, or just want to say hi, feel free to reach out!

**Developer:** Priyabrata Sahoo  
**GitHub:** [@priyabratasahoo780](https://github.com/priyabratasahoo780)  
**Issues:** [Report a bug or request a feature](https://github.com/priyabratasahoo780/EventFlow/issues)

---

<div align="center">
  <b>Built with passion and dedication.</b><br><br>
  <img src="https://img.shields.io/badge/Made%20with-React%20Native-blue?style=for-the-badge&logo=react" alt="Made with React Native">
  <img src="https://img.shields.io/badge/Powered%20by-Node.js-green?style=for-the-badge&logo=nodedotjs" alt="Powered by Node.js">
  <br><br>
  <p>© 2026 EventFlow. All rights reserved.</p>
</div>