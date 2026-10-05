import express from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { AppError } from '../utils/errors';
import { webrtcService } from '../services/webrtc.service';
import { socketService } from '../services/socket.service';

const router = express.Router();

// Middleware
router.use(authenticateToken);

/**
 * Start a stream
 */
router.post('/start', async (req: AuthRequest, res) => {
  try {
    const { title, description, isPrivate = false } = req.body;
    const userId = req.user!.userId;

    if (!title) {
      throw new AppError(400, 'MISSING_PARAMS', 'Stream title required');
    }

    // Verify creator profile exists
    const creatorProfile = await prisma.creatorProfile.findUnique({
      where: { userId },
    });

    if (!creatorProfile) {
      throw new AppError(403, 'NOT_CREATOR', 'User is not a creator');
    }

    // Create stream
    const stream = await prisma.stream.create({
      data: {
        creatorProfileId: userId,
        title,
        description: description || '',
        status: 'live',
        startedAt: new Date(),
      },
    });

    // Notify via Socket.io
    socketService.notifyStream(stream.id, 'stream:started', {
      streamId: stream.id,
      creatorId: userId,
      title,
    });

    res.status(201).json({
      message: 'Stream started',
      stream: {
        id: stream.id,
        title: stream.title,
        status: stream.status,
        startedAt: stream.startedAt,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      console.error('[Stream] Start error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * End a stream
 */
router.post('/end', async (req: AuthRequest, res) => {
  try {
    const { streamId } = req.body;
    const userId = req.user!.userId;

    if (!streamId) {
      throw new AppError(400, 'MISSING_PARAMS', 'streamId required');
    }

    // Verify ownership
    const stream = await prisma.stream.findUnique({
      where: { id: streamId },
    });

    if (!stream) {
      throw new AppError(404, 'STREAM_NOT_FOUND', 'Stream not found');
    }

    if (stream.creatorProfileId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'Cannot end this stream');
    }

    // Update stream
    const updatedStream = await prisma.stream.update({
      where: { id: streamId },
      data: {
        status: 'ended',
        endedAt: new Date(),
      },
    });

    // Notify viewers
    socketService.notifyStream(streamId, 'stream:ended', {
      streamId,
    });

    res.json({
      message: 'Stream ended',
      stream: {
        id: updatedStream.id,
        status: updatedStream.status,
        endedAt: updatedStream.endedAt,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      console.error('[Stream] End error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * Get active streams
 */
router.get('/active', async (req: AuthRequest, res) => {
  try {
    const streams = await prisma.stream.findMany({
      where: {
        status: 'live',
      },
      select: {
        id: true,
        title: true,
        description: true,
        creatorProfileId: true,
        startedAt: true,
        viewerCount: true,
        peakViewerCount: true,
      },
      orderBy: {
        viewerCount: 'desc',
      },
    });

    res.json({
      streams,
      total: streams.length,
    });
  } catch (error) {
    console.error('[Stream] Active streams error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get stream details
 */
router.get('/:streamId', async (req: AuthRequest, res) => {
  try {
    const { streamId } = req.params;

    const stream = await prisma.stream.findUnique({
      where: { id: streamId },
      include: {
        _count: {
          select: {
            messages: true,
            viewers: true,
            recordings: true,
          },
        },
      },
    });

    if (!stream) {
      throw new AppError(404, 'STREAM_NOT_FOUND', 'Stream not found');
    }

    res.json({
      stream: {
        ...stream,
        messageCount: stream._count.messages,
        viewerCount: stream._count.viewers,
        recordingCount: stream._count.recordings,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      console.error('[Stream] Details error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * Send chat message
 */
router.post('/:streamId/messages', async (req: AuthRequest, res) => {
  try {
    const { streamId } = req.params;
    const { message } = req.body;
    const userId = req.user!.userId;

    if (!message) {
      throw new AppError(400, 'MISSING_PARAMS', 'message required');
    }

    // Verify stream exists
    const stream = await prisma.stream.findUnique({
      where: { id: streamId },
    });

    if (!stream) {
      throw new AppError(404, 'STREAM_NOT_FOUND', 'Stream not found');
    }

    // Save message
    const chatMessage = await prisma.chatMessage.create({
      data: {
        streamId,
        senderProfileId: userId,
        message,
        messageType: 'text',
      },
    });

    // Get sender info
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    // Broadcast via Socket.io
    if (socketService.io) {
      socketService.io.to(`stream:${streamId}`).emit('chat:message', {
        id: chatMessage.id,
        streamId,
        senderProfileId: userId,
        senderName: user?.displayName || user?.email || 'Anonymous',
        message,
        timestamp: chatMessage.createdAt,
      });
    }

    res.status(201).json({
      message: 'Message sent',
      chatMessage,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      console.error('[Stream] Message error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * Get chat messages
 */
router.get('/:streamId/messages', async (req: AuthRequest, res) => {
  try {
    const { streamId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const messages = await prisma.chatMessage.findMany({
      where: { streamId },
      select: {
        id: true,
        message: true,
        messageType: true,
        senderProfileId: true,
        createdAt: true,
        isPinned: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.chatMessage.count({
      where: { streamId },
    });

    res.json({
      messages: messages.reverse(),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Stream] Messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Join stream as viewer
 */
router.post('/:streamId/join', async (req: AuthRequest, res) => {
  try {
    const { streamId } = req.params;
    const userId = req.user!.userId;

    // Verify stream exists
    const stream = await prisma.stream.findUnique({
      where: { id: streamId },
    });

    if (!stream) {
      throw new AppError(404, 'STREAM_NOT_FOUND', 'Stream not found');
    }

    // Record viewer
    const viewer = await prisma.streamViewer.create({
      data: {
        streamId,
        viewerProfileId: userId,
        joinedAt: new Date(),
      },
    });

    // Update viewer count
    await prisma.stream.update({
      where: { id: streamId },
      data: {
        viewerCount: { increment: 1 },
      },
    });

    // Notify others
    socketService.notifyStream(streamId, 'viewer:joined', {
      streamId,
      viewerId: userId,
    });

    res.json({
      message: 'Joined stream',
      viewer: {
        id: viewer.id,
        joinedAt: viewer.joinedAt,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      console.error('[Stream] Join error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * Leave stream
 */
router.post('/:streamId/leave', async (req: AuthRequest, res) => {
  try {
    const { streamId, viewerId } = req.body;
    const userId = req.user!.userId;

    if (!streamId || !viewerId) {
      throw new AppError(400, 'MISSING_PARAMS', 'streamId and viewerId required');
    }

    // Update viewer record
    const viewer = await prisma.streamViewer.findFirst({
      where: { streamId, viewerProfileId: viewerId },
    });

    if (viewer && !viewer.leftAt) {
      await prisma.streamViewer.update({
        where: { id: viewer.id },
        data: {
          leftAt: new Date(),
          watchDuration: Math.floor(
            (new Date().getTime() - viewer.joinedAt.getTime()) / 1000
          ),
        },
      });
    }

    // Decrement viewer count
    await prisma.stream.update({
      where: { id: streamId },
      data: {
        viewerCount: { decrement: 1 },
      },
    });

    // Notify others
    socketService.notifyStream(streamId, 'viewer:left', {
      streamId,
      viewerId,
    });

    res.json({ message: 'Left stream' });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      console.error('[Stream] Leave error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * Get viewer count
 */
router.get('/:streamId/viewers', async (req: AuthRequest, res) => {
  try {
    const { streamId } = req.params;

    const stream = await prisma.stream.findUnique({
      where: { id: streamId },
      select: {
        viewerCount: true,
        peakViewerCount: true,
      },
    });

    if (!stream) {
      throw new AppError(404, 'STREAM_NOT_FOUND', 'Stream not found');
    }

    res.json({
      streamId,
      currentViewers: stream.viewerCount,
      peakViewers: stream.peakViewerCount,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      console.error('[Stream] Viewers error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
