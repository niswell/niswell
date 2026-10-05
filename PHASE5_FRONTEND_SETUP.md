# Phase 5: Frontend Development

## 🎯 Objective
Build a complete React-based frontend for the adult live streaming platform with real-time video/audio streaming, live chat, creator dashboard, and viewer interface.

---

## 📦 Tech Stack

### Core
- **React 18+** with TypeScript
- **Vite** for fast build tooling
- **Socket.io Client** for real-time communication
- **WebRTC Adapter** for video/audio streaming

### Styling & UI
- **Tailwind CSS** for responsive design
- **Headless UI** for accessible components
- **React Icons** for UI icons

### State Management & Routing
- **Redux Toolkit** for global state
- **React Router v6** for navigation
- **RTK Query** for API calls

### Video & Media
- **simple-peer** for WebRTC peer connections
- **react-use-gesture** for touch controls
- **browser-image-compression** for media optimization

---

## 🏗️ Project Structure

```
niswell-frontend/
├── src/
│   ├── components/
│   │   ├── Streaming/
│   │   │   ├── VideoPlayer.tsx
│   │   │   ├── StreamHeader.tsx
│   │   │   ├── ViewerCount.tsx
│   │   │   └── StreamControls.tsx
│   │   ├── Chat/
│   │   │   ├── ChatWindow.tsx
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   └── TypingIndicator.tsx
│   │   ├── Dashboard/
│   │   │   ├── CreatorDashboard.tsx
│   │   │   ├── StreamSettings.tsx
│   │   │   ├── AnalyticsPanel.tsx
│   │   │   └── StreamSetup.tsx
│   │   ├── Auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── MFASetup.tsx
│   │   ├── Layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Footer.tsx
│   │   └── Common/
│   │       ├── Modal.tsx
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       └── Notification.tsx
│   ├── services/
│   │   ├── api.ts
│   │   ├── socket.ts
│   │   ├── webrtc.ts
│   │   ├── auth.ts
│   │   └── storage.ts
│   ├── store/
│   │   ├── store.ts
│   │   ├── slices/
│   │   │   ├── authSlice.ts
│   │   │   ├── streamSlice.ts
│   │   │   ├── chatSlice.ts
│   │   │   └── uiSlice.ts
│   │   └── hooks.ts
│   ├── hooks/
│   │   ├── useWebRTC.ts
│   │   ├── useSocket.ts
│   │   ├── useStream.ts
│   │   └── useAuth.ts
│   ├── types/
│   │   ├── index.ts
│   │   ├── stream.ts
│   │   ├── chat.ts
│   │   └── user.ts
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── StreamPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   └── NotFoundPage.tsx
│   ├── utils/
│   │   ├── validators.ts
│   │   ├── formatters.ts
│   │   ├── constants.ts
│   │   └── helpers.ts
│   ├── App.tsx
│   └── index.tsx
├── public/
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── vite.config.ts
```

---

## 🚀 Setup Instructions

### 1. Create React App
```bash
cd /home/user
npx create-react-app niswell-frontend --template typescript
cd niswell-frontend
```

### 2. Install Dependencies
```bash
npm install \
  socket.io-client \
  webrtc-adapter \
  simple-peer \
  @reduxjs/toolkit \
  react-redux \
  react-router-dom \
  @hookform/resolvers \
  react-hook-form \
  zod \
  axios \
  clsx \
  tailwindcss \
  postcss \
  autoprefixer \
  @headlessui/react \
  react-icons

npm install --save-dev tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 3. Configure Tailwind
Update `tailwind.config.js`:
```javascript
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          50: '#f9fafb',
          900: '#0f0f0f',
        },
      },
    },
  },
  plugins: [],
}
```

### 4. Update API Base URL
Create `.env.local`:
```
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_WS_URL=http://localhost:3000
```

### 5. Create Environment-Specific Config
```bash
VITE_API_URL=https://your-render-app.onrender.com/api
VITE_WS_URL=https://your-render-app.onrender.com
```

---

## 📋 Component Development Phases

### Phase 5A: Core Components (Days 1-3)
- [ ] Layout components (Header, Sidebar, Footer)
- [ ] Authentication pages (Login, Register, MFA)
- [ ] Common UI components (Button, Input, Modal)

### Phase 5B: Streaming Components (Days 4-6)
- [ ] Video player with WebRTC
- [ ] Stream header with creator info
- [ ] Viewer count display
- [ ] Stream controls (quality, fullscreen, settings)

### Phase 5C: Chat System (Days 7-8)
- [ ] Chat window with message history
- [ ] Real-time message delivery
- [ ] Typing indicators
- [ ] User mentions and moderation

### Phase 5D: Creator Dashboard (Days 9-10)
- [ ] Stream setup and configuration
- [ ] Live analytics and statistics
- [ ] Earnings and payment info
- [ ] Stream history and VOD management

### Phase 5E: Integration & Polish (Days 11-14)
- [ ] Socket.io integration across components
- [ ] WebRTC peer connections
- [ ] State management with Redux
- [ ] Error handling and loading states
- [ ] Responsive design testing
- [ ] Performance optimization

---

## 🔌 API Integration Points

### Authentication
```typescript
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
POST /api/auth/mfa/setup
POST /api/auth/mfa/verify
```

### Streaming
```typescript
POST /api/streams/start
POST /api/streams/end
GET /api/streams/active
GET /api/streams/:id
POST /api/streams/:id/join
POST /api/streams/:id/leave
GET /api/streams/:id/viewers
```

### Chat
```typescript
POST /api/streams/:id/messages
GET /api/streams/:id/messages
DELETE /api/streams/:id/messages/:msgId
PUT /api/streams/:id/messages/:msgId/pin
```

### Creator Profile
```typescript
GET /api/creator/profile
PUT /api/creator/profile
GET /api/creator/settings
POST /api/creator/streams
GET /api/creator/analytics
```

---

## 🎯 Key Features

### For Viewers
- [ ] Browse live streams
- [ ] Join stream with one click
- [ ] Real-time chat participation
- [ ] Viewer count display
- [ ] Send tips to creators
- [ ] Watch quality selection
- [ ] Fullscreen and picture-in-picture

### For Creators
- [ ] Start/stop streaming
- [ ] Stream settings (title, description, privacy)
- [ ] Live analytics (viewer count, duration, engagement)
- [ ] Chat moderation (pin/delete messages)
- [ ] Monetization settings
- [ ] Stream history and VOD
- [ ] Earnings dashboard

### For All Users
- [ ] Secure authentication (JWT + TOTP MFA)
- [ ] Account settings
- [ ] Privacy controls
- [ ] Notification preferences
- [ ] Profile customization

---

## 🔒 Security Considerations

1. **Token Management**
   - Store JWT in memory (not localStorage)
   - Use httpOnly cookies for refresh tokens
   - Implement token refresh on 401 responses

2. **WebRTC Privacy**
   - Verify peer identities before connecting
   - Use STUN servers only (no TURN unless necessary)
   - Implement connection quality monitoring

3. **Input Validation**
   - Validate all form inputs client-side
   - Sanitize chat messages
   - Implement rate limiting on frontend

4. **HTTPS/WSS**
   - Enforce HTTPS in production
   - Use WSS for WebSocket connections
   - Implement HSTS headers

---

## 📱 Responsive Design

### Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

### Layout Variations
- **Mobile**: Stacked video/chat, collapsed sidebar
- **Tablet**: Side-by-side layout, collapsed controls
- **Desktop**: Full layout with all features visible

---

## 🧪 Testing Strategy

### Unit Tests
- Component rendering
- State management
- Utility functions

### Integration Tests
- API calls
- Socket.io events
- Authentication flow

### E2E Tests
- Complete streaming flow
- Chat functionality
- Creator dashboard operations

---

## 📊 Performance Optimization

1. **Code Splitting**
   - Lazy load route components
   - Dynamic imports for heavy features

2. **Image Optimization**
   - Compress avatar images
   - Use WebP with fallbacks

3. **WebRTC Optimization**
   - Adaptive bitrate streaming
   - Connection quality monitoring
   - Graceful degradation

4. **Bundle Size**
   - Tree-shake unused code
   - Minify and compress assets
   - Monitor bundle size

---

## 🚀 Deployment

### Build & Deploy
```bash
npm run build
# Deploy dist folder to Vercel, Netlify, or AWS S3
```

### Environment Configuration
```bash
# Production .env
VITE_API_URL=https://api.niswell.com
VITE_WS_URL=https://api.niswell.com
VITE_ENV=production
```

---

## 📅 Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| 5A: Core Components | 3 days | 📋 Planning |
| 5B: Streaming | 3 days | 📋 Planning |
| 5C: Chat | 2 days | 📋 Planning |
| 5D: Dashboard | 2 days | 📋 Planning |
| 5E: Integration | 4 days | 📋 Planning |
| **Total** | **14 days** | 📋 Ready |

---

## ✅ Success Criteria

- [ ] Users can authenticate securely
- [ ] Creators can start streams
- [ ] Viewers can join and watch
- [ ] Real-time chat works smoothly
- [ ] Video quality adapts to connection
- [ ] Dashboard shows accurate analytics
- [ ] All pages are mobile responsive
- [ ] No console errors or warnings
- [ ] Performance score > 90
- [ ] Accessibility score > 90

---

**Ready to build the frontend!** 🎬

