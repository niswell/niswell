import { Server as SocketServer } from 'socket.io';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/errors';

interface StreamSession {
  streamId: string;
  userId: string;
  username: string;
  role: 'creator' | 'viewer';
}

export class SocketService {
  io: SocketServer | null = null;
  private activeSessions: Map<string, StreamSession> = new Map();

  /**
   * Initialize Socket.io service
   */
  init(io: SocketServer) {
    this.io = io;
    this.setupChatHandlers();
    this.setupNotificationHandlers();
  }

  /**
   * Setup chat event handlers
   */
  private setupChatHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      // Chat events
      socket.on('chat:send-message', (data) => this.handleChatMessage(socket, data));
      socket.on('chat:delete-message', (data) => this.handleDeleteMessage(socket, data));
      socket.on('chat:pin-message', (data) => this.handlePinMessage(socket, data));

      // Typing indicator
      socket.on('chat:typing-start', (data) => this.handleTypingStart(socket, data));
      socket.on('chat:typing-stop', (data) => this.handleTypingStop(socket, data));
    });
  }

  /**
   * Handle chat message
   */
  private async handleChatMessage(socket: any, data: any) {
    try {
      const { streamId, userId, message } = data;

      if (!streamId || !userId || !message) {
        throw new AppError(400, 'MISSING_PARAMS', 'streamId, userId, and message required');
      }

      // Get user display name
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

      // Save to database
      const savedMessage = await prisma.chatMessage.create({
        data: {
          streamId,
          senderProfileId: userId,
          message,
          messageType: 'text',
        },
      });

      // Broadcast to stream
      this.io!.to(`stream:${streamId}`).emit('chat:message', {
        id: savedMessage.id,
        streamId,
        senderProfileId: userId,
        senderName: user.displayName || user.email,
        message,
        timestamp: savedMessage.createdAt,
      });

      console.log(`[Chat] Message in stream ${streamId}: ${message.substring(0, 50)}`);
    } catch (error) {
      socket.emit('error', { message: (error as any).message });
    }
  }

  /**
   * Handle message deletion
   */
  private async handleDeleteMessage(socket: any, data: any) {
    try {
      const { streamId, messageId, userId } = data;

      // Verify ownership
      const message = await prisma.chatMessage.findUnique({
        where: { id: messageId },
      });

      if (!message || message.senderProfileId !== userId) {
        throw new AppError(403, 'FORBIDDEN', 'Cannot delete this message');
      }

      // Delete from database
      await prisma.chatMessage.delete({ where: { id: messageId } });

      // Notify stream
      this.io!.to(`stream:${streamId}`).emit('chat:message-deleted', {
        messageId,
      });

      console.log(`[Chat] Message deleted: ${messageId}`);
    } catch (error) {
      socket.emit('error', { message: (error as any).message });
    }
  }

  /**
   * Handle message pin
   */
  private async handlePinMessage(socket: any, data: any) {
    try {
      const { streamId, messageId, isPinned } = data;

      // Update database
      await prisma.chatMessage.update({
        where: { id: messageId },
        data: { isPinned },
      });

      // Notify stream
      this.io!.to(`stream:${streamId}`).emit('chat:message-pinned', {
        messageId,
        isPinned,
      });
    } catch (error) {
      socket.emit('error', { message: (error as any).message });
    }
  }

  /**
   * Handle typing start
   */
  private handleTypingStart(socket: any, data: any) {
    const { streamId, userId, username } = data;
    if (streamId && userId) {
      socket.to(`stream:${streamId}`).emit('chat:typing-start', {
        userId,
        username,
      });
    }
  }

  /**
   * Handle typing stop
   */
  private handleTypingStop(socket: any, data: any) {
    const { streamId, userId } = data;
    if (streamId && userId) {
      socket.to(`stream:${streamId}`).emit('chat:typing-stop', {
        userId,
      });
    }
  }

  /**
   * Setup notification event handlers
   */
  private setupNotificationHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      // Notification events
      socket.on('notification:subscribe', (data) => this.handleNotificationSubscribe(socket, data));
      socket.on('notification:unsubscribe', (data) => this.handleNotificationUnsubscribe(socket, data));
    });
  }

  /**
   * Handle notification subscription
   */
  private handleNotificationSubscribe(socket: any, data: any) {
    const { userId, streamId } = data;
    if (userId) {
      socket.join(`user:${userId}`);
      console.log(`[Notifications] User subscribed: ${userId}`);
    }
    if (streamId) {
      socket.join(`stream-notifications:${streamId}`);
    }
  }

  /**
   * Handle notification unsubscription
   */
  private handleNotificationUnsubscribe(socket: any, data: any) {
    const { userId, streamId } = data;
    if (userId) {
      socket.leave(`user:${userId}`);
    }
    if (streamId) {
      socket.leave(`stream-notifications:${streamId}`);
    }
  }

  /**
   * Send notification to user
   */
  notifyUser(userId: string, event: string, data: any) {
    if (this.io) {
      this.io.to(`user:${userId}`).emit('notification', {
        event,
        data,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Send notification to stream
   */
  notifyStream(streamId: string, event: string, data: any) {
    if (this.io) {
      this.io.to(`stream-notifications:${streamId}`).emit('notification', {
        event,
        data,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Send system message to stream
   */
  async sendSystemMessage(streamId: string, message: string) {
    try {
      const systemMessage = await prisma.chatMessage.create({
        data: {
          streamId,
          senderProfileId: 'system',
          message,
          messageType: 'system',
        },
      });

      this.io!.to(`stream:${streamId}`).emit('chat:message', {
        id: systemMessage.id,
        streamId,
        senderName: 'System',
        message,
        messageType: 'system',
        timestamp: systemMessage.createdAt,
      });
    } catch (error) {
      console.error('[Chat] System message error:', error);
    }
  }

  /**
   * Get active sessions in stream
   */
  getStreamSessions(streamId: string): StreamSession[] {
    return Array.from(this.activeSessions.values()).filter(s => s.streamId === streamId);
  }

  /**
   * Register active session
   */
  registerSession(socketId: string, session: StreamSession) {
    this.activeSessions.set(socketId, session);
  }

  /**
   * Unregister session
   */
  unregisterSession(socketId: string) {
    this.activeSessions.delete(socketId);
  }
}

export const socketService = new SocketService();
