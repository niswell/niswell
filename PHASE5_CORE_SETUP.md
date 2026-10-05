# Phase 5: Core Setup & Configuration

## Frontend Dependencies to Install

```bash
cd niswell-frontend

# Core React & TypeScript
npm install react-router-dom@latest

# State Management
npm install @reduxjs/toolkit react-redux

# Real-time Communication
npm install socket.io-client webrtc-adapter simple-peer

# API & Data Fetching
npm install axios

# Form Handling & Validation
npm install react-hook-form @hookform/resolvers zod

# Styling
npm install tailwindcss postcss autoprefixer
npm install -D @tailwindcss/forms @tailwindcss/typography

# UI Components
npm install @headlessui/react @floating-ui/react
npm install react-icons

# Utilities
npm install clsx class-variance-authority
npm install date-fns
npm install js-cookie

npm install --save-dev typescript @types/react @types/react-dom @types/node
```

## Environment Variables (.env.local)

```
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_WS_URL=http://localhost:3000
REACT_APP_ENV=development
```

## TypeScript Types to Create

### Stream Types
```typescript
// types/stream.ts
export interface Stream {
  id: string;
  title: string;
  description?: string;
  status: 'scheduled' | 'live' | 'ended' | 'archived';
  creatorProfileId: string;
  creatorName: string;
  creatorAvatar?: string;
  startedAt?: Date;
  endedAt?: Date;
  viewerCount: number;
  peakViewerCount: number;
  isPrivate: boolean;
  thumbnail?: string;
  duration?: number;
}

export interface StreamViewerMetrics {
  currentViewers: number;
  peakViewers: number;
  averageWatchDuration: number;
  totalEngagements: number;
}
```

### Chat Types
```typescript
// types/chat.ts
export interface ChatMessage {
  id: string;
  streamId: string;
  senderProfileId: string;
  senderName: string;
  senderAvatar?: string;
  message: string;
  messageType: 'text' | 'tip_notification' | 'system';
  isPinned: boolean;
  createdAt: Date;
}

export interface TypingIndicator {
  userId: string;
  username: string;
}
```

### User Types
```typescript
// types/user.ts
export interface User {
  id: string;
  email: string;
  displayName: string;
  avatar?: string;
  role: 'viewer' | 'creator' | 'admin';
}

export interface CreatorProfile {
  userId: string;
  displayName: string;
  bio?: string;
  avatar?: string;
  banner?: string;
  isVerified: boolean;
  followerCount: number;
  totalEarnings: number;
  streams: Stream[];
}

export interface ViewerProfile {
  userId: string;
  displayName: string;
  avatar?: string;
}
```

### WebRTC Types
```typescript
// types/webrtc.ts
export interface PeerConnection {
  peerId: string;
  userId: string;
  role: 'creator' | 'viewer';
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
}

export interface StreamSettings {
  videoEnabled: boolean;
  audioEnabled: boolean;
  quality: 'low' | 'medium' | 'high';
  resolution: '360p' | '720p' | '1080p';
}
```

## Redux Store Structure

```typescript
// store/store.ts
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import streamReducer from './slices/streamSlice';
import chatReducer from './slices/chatSlice';
import uiReducer from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    stream: streamReducer,
    chat: chatReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

## Key Redux Slices

### Auth Slice
```typescript
// store/slices/authSlice.ts
- State: user, accessToken, isAuthenticated, loading, error
- Actions: login, register, logout, refreshToken, verifyMFA
- Selectors: selectUser, selectIsAuthenticated, selectUserRole
```

### Stream Slice
```typescript
// store/slices/streamSlice.ts
- State: activeStream, streams, isStreaming, streamSettings, metrics
- Actions: startStream, endStream, updateStreamSettings, fetchStreams
- Selectors: selectActiveStream, selectIsStreaming, selectMetrics
```

### Chat Slice
```typescript
// store/slices/chatSlice.ts
- State: messages, typingUsers, pinnedMessages, isLoading
- Actions: addMessage, deleteMessage, pinMessage, addTypingIndicator
- Selectors: selectMessages, selectTypingUsers, selectPinnedMessages
```

### UI Slice
```typescript
// store/slices/uiSlice.ts
- State: sidebarOpen, theme, notifications, modals
- Actions: toggleSidebar, setTheme, addNotification, showModal
- Selectors: selectSidebarOpen, selectNotifications
```

## API Service Structure

```typescript
// services/api.ts
export const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Authentication endpoints
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  refreshToken: () => api.post('/auth/refresh'),
};

// Streaming endpoints
export const streamAPI = {
  startStream: (data) => api.post('/streams/start', data),
  endStream: (data) => api.post('/streams/end', data),
  getActiveStreams: () => api.get('/streams/active'),
  getStream: (id) => api.get(`/streams/${id}`),
  joinStream: (id) => api.post(`/streams/${id}/join`),
  leaveStream: (id, data) => api.post(`/streams/${id}/leave`, data),
};

// Chat endpoints
export const chatAPI = {
  sendMessage: (streamId, data) => api.post(`/streams/${streamId}/messages`, data),
  getMessages: (streamId, limit, offset) => 
    api.get(`/streams/${streamId}/messages`, { params: { limit, offset } }),
  deleteMessage: (streamId, msgId) => api.delete(`/streams/${streamId}/messages/${msgId}`),
  pinMessage: (streamId, msgId, isPinned) => 
    api.put(`/streams/${streamId}/messages/${msgId}/pin`, { isPinned }),
};
```

## Socket.io Service Setup

```typescript
// services/socket.ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const initializeSocket = (token: string) => {
  socket = io(process.env.REACT_APP_WS_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => console.log('Socket connected'));
  socket.on('disconnect', () => console.log('Socket disconnected'));
  socket.on('error', (error) => console.error('Socket error:', error));

  return socket;
};

// Chat events
export const onChatMessage = (callback: (msg: ChatMessage) => void) => {
  socket?.on('chat:message', callback);
};

export const sendChatMessage = (streamId: string, message: string) => {
  socket?.emit('chat:send-message', { streamId, message });
};

// Stream events
export const onStreamStarted = (callback: (data: any) => void) => {
  socket?.on('stream:started', callback);
};

export const onStreamEnded = (callback: (data: any) => void) => {
  socket?.on('stream:ended', callback);
};
```

## WebRTC Service Setup

```typescript
// services/webrtc.ts
import SimplePeer from 'simple-peer';

export class WebRTCService {
  private peers: Map<string, SimplePeer.Instance> = new Map();
  private localStream: MediaStream | null = null;
  private socket: Socket;

  constructor(socket: Socket) {
    this.socket = socket;
    this.setupSignaling();
  }

  async getLocalStream(constraints?: MediaStreamConstraints) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(
        constraints || { video: true, audio: true }
      );
      return this.localStream;
    } catch (error) {
      console.error('Failed to get media stream:', error);
      throw error;
    }
  }

  createPeerConnection(peerId: string, initiator: boolean) {
    const peer = new SimplePeer({
      initiator,
      stream: this.localStream || undefined,
      config: {
        iceServers: [
          { urls: ['stun:stun.l.google.com:19302'] },
        ],
      },
    });

    peer.on('signal', (data) => {
      if (initiator) {
        this.socket.emit('webrtc:offer', { toPeerId: peerId, offer: data });
      } else {
        this.socket.emit('webrtc:answer', { toPeerId: peerId, answer: data });
      }
    });

    peer.on('connect', () => {
      console.log(`Connected to peer ${peerId}`);
    });

    this.peers.set(peerId, peer);
    return peer;
  }

  private setupSignaling() {
    this.socket.on('webrtc:offer', ({ fromPeerId, offer }) => {
      let peer = this.peers.get(fromPeerId);
      if (!peer) {
        peer = this.createPeerConnection(fromPeerId, false);
      }
      peer.signal(offer);
    });

    this.socket.on('webrtc:answer', ({ fromPeerId, answer }) => {
      const peer = this.peers.get(fromPeerId);
      if (peer) peer.signal(answer);
    });

    this.socket.on('webrtc:ice-candidate', ({ fromPeerId, candidate }) => {
      const peer = this.peers.get(fromPeerId);
      if (peer) peer.signal(candidate);
    });
  }

  async stopLocalStream() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }
}
```

## Custom Hooks

```typescript
// hooks/useAuth.ts
export const useAuth = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  
  const login = async (email: string, password: string) => {
    return dispatch(loginUser({ email, password }));
  };

  const logout = () => {
    dispatch(logoutUser());
  };

  return { user, login, logout };
};

// hooks/useWebRTC.ts
export const useWebRTC = (streamId: string) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Map<string, SimplePeer.Instance>>(new Map());
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;
    
    const webrtc = new WebRTCService(socket);
    
    webrtc.getLocalStream()
      .then(stream => setLocalStream(stream))
      .catch(console.error);

    return () => {
      webrtc.stopLocalStream();
    };
  }, [socket]);

  return { localStream, peers };
};

// hooks/useSocket.ts
export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const user = useAppSelector(selectUser);

  useEffect(() => {
    if (!user?.accessToken) return;

    const newSocket = initializeSocket(user.accessToken);
    setSocket(newSocket);

    return () => {
      newSocket?.disconnect();
    };
  }, [user?.accessToken]);

  return { socket };
};
```

## Component Development Order

1. **Layout & Common Components** (Days 1-2)
   - Header with navigation
   - Sidebar for navigation
   - Common UI elements (Button, Input, Modal)
   - Notification system

2. **Authentication** (Days 3-4)
   - Login form
   - Register form
   - MFA setup
   - Protected routes

3. **Streaming UI** (Days 5-7)
   - Video player with WebRTC
   - Stream header with info
   - Viewer count display
   - Quality selector

4. **Chat System** (Days 8-9)
   - Chat window
   - Message input
   - Typing indicators
   - Message history

5. **Creator Dashboard** (Days 10-12)
   - Stream setup form
   - Live analytics
   - Stream controls
   - Earnings display

6. **Integration & Polish** (Days 13-14)
   - Connect all components
   - Error handling
   - Loading states
   - Responsive testing

---

**Ready to implement Phase 5!** 🚀
