import { Server as SocketServer } from 'socket.io';
import { AppError } from '../utils/errors';

interface Peer {
  peerId: string;
  userId: string;
  role: 'creator' | 'viewer';
  socket: any;
  offer?: any;
  answer?: any;
  iceCandidates: any[];
}

interface Stream {
  streamId: string;
  creatorId: string;
  creatorPeerId: string;
  peers: Map<string, Peer>;
  createdAt: Date;
}

export class WebRTCService {
  private streams: Map<string, Stream> = new Map();
  private peers: Map<string, Peer> = new Map();
  private io: SocketServer | null = null;

  /**
   * Initialize WebRTC service with Socket.io server
   */
  init(io: SocketServer) {
    this.io = io;
    this.setupSocketHandlers();
  }

  /**
   * Setup Socket.io event handlers for WebRTC signaling
   */
  private setupSocketHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      console.log(`[WebRTC] Peer connected: ${socket.id}`);

      // Join stream
      socket.on('stream:join', (data: any) => this.handleStreamJoin(socket, data));

      // WebRTC signaling
      socket.on('webrtc:offer', (data: any) => this.handleOffer(socket, data));
      socket.on('webrtc:answer', (data: any) => this.handleAnswer(socket, data));
      socket.on('webrtc:ice-candidate', (data: any) => this.handleIceCandidate(socket, data));

      // Stream events
      socket.on('stream:leave', (data: any) => this.handleStreamLeave(socket, data));
      socket.on('disconnect', () => this.handleDisconnect(socket));
    });
  }

  /**
   * Handle stream join request
   */
  private async handleStreamJoin(socket: any, data: any) {
    try {
      const { streamId, userId, role } = data;

      if (!streamId || !userId) {
        throw new AppError(400, 'MISSING_PARAMS', 'streamId and userId required');
      }

      const peerId = socket.id;
      const peer: Peer = {
        peerId,
        userId,
        role,
        socket,
        iceCandidates: [],
      };

      // Get or create stream
      let stream = this.streams.get(streamId);
      if (!stream) {
        stream = {
          streamId,
          creatorId: '',
          creatorPeerId: '',
          peers: new Map(),
          createdAt: new Date(),
        };
        this.streams.set(streamId, stream);
      }

      // Add peer to stream
      stream.peers.set(peerId, peer);
      this.peers.set(peerId, peer);

      // Track creator
      if (role === 'creator') {
        stream.creatorId = userId;
        stream.creatorPeerId = peerId;
      }

      // Notify others in stream
      socket.join(`stream:${streamId}`);
      socket.to(`stream:${streamId}`).emit('stream:peer-joined', { peerId, userId, role });

      // Send existing peers to new peer
      const existingPeers = Array.from(stream.peers.values())
        .filter(p => p.peerId !== peerId)
        .map(p => ({ peerId: p.peerId, userId: p.userId, role: p.role }));

      socket.emit('stream:existing-peers', { peers: existingPeers });

      console.log(`[WebRTC] ${role} joined stream ${streamId}: ${peerId}`);
      socket.emit('stream:joined', { peerId, streamId });
    } catch (error) {
      socket.emit('error', { message: (error as any).message });
    }
  }

  /**
   * Handle WebRTC offer
   */
  private handleOffer(socket: any, data: any) {
    try {
      const { streamId, toPeerId, offer } = data;
      const peer = this.peers.get(socket.id);

      if (!peer || !streamId) return;

      peer.offer = offer;

      const targetPeer = this.peers.get(toPeerId);
      if (targetPeer) {
        targetPeer.socket.emit('webrtc:offer', {
          fromPeerId: socket.id,
          offer,
        });
      }

      console.log(`[WebRTC] Offer sent from ${socket.id} to ${toPeerId}`);
    } catch (error) {
      console.error('[WebRTC] Offer error:', error);
    }
  }

  /**
   * Handle WebRTC answer
   */
  private handleAnswer(socket: any, data: any) {
    try {
      const { toPeerId, answer } = data;
      const peer = this.peers.get(socket.id);

      if (!peer) return;

      peer.answer = answer;

      const targetPeer = this.peers.get(toPeerId);
      if (targetPeer) {
        targetPeer.socket.emit('webrtc:answer', {
          fromPeerId: socket.id,
          answer,
        });
      }

      console.log(`[WebRTC] Answer sent from ${socket.id} to ${toPeerId}`);
    } catch (error) {
      console.error('[WebRTC] Answer error:', error);
    }
  }

  /**
   * Handle ICE candidate
   */
  private handleIceCandidate(socket: any, data: any) {
    try {
      const { toPeerId, candidate } = data;
      const peer = this.peers.get(socket.id);

      if (!peer || !candidate) return;

      peer.iceCandidates.push(candidate);

      const targetPeer = this.peers.get(toPeerId);
      if (targetPeer) {
        targetPeer.socket.emit('webrtc:ice-candidate', {
          fromPeerId: socket.id,
          candidate,
        });
      }
    } catch (error) {
      console.error('[WebRTC] ICE candidate error:', error);
    }
  }

  /**
   * Handle stream leave
   */
  private handleStreamLeave(socket: any, data: any) {
    try {
      const { streamId } = data;
      const stream = this.streams.get(streamId);

      if (stream) {
        stream.peers.delete(socket.id);
        socket.to(`stream:${streamId}`).emit('stream:peer-left', { peerId: socket.id });

        if (stream.peers.size === 0) {
          this.streams.delete(streamId);
        }
      }

      this.peers.delete(socket.id);
      socket.leave(`stream:${streamId}`);

      console.log(`[WebRTC] Peer left stream ${streamId}: ${socket.id}`);
    } catch (error) {
      console.error('[WebRTC] Leave error:', error);
    }
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(socket: any) {
    try {
      const peer = this.peers.get(socket.id);

      if (peer) {
        // Find and remove from stream
        for (const stream of this.streams.values()) {
          if (stream.peers.has(socket.id)) {
            stream.peers.delete(socket.id);
            socket.to(`stream:${stream.streamId}`).emit('stream:peer-left', { peerId: socket.id });

            if (stream.peers.size === 0) {
              this.streams.delete(stream.streamId);
            }
            break;
          }
        }

        this.peers.delete(socket.id);
      }

      console.log(`[WebRTC] Peer disconnected: ${socket.id}`);
    } catch (error) {
      console.error('[WebRTC] Disconnect error:', error);
    }
  }

  /**
   * Get stream info
   */
  getStream(streamId: string): Stream | undefined {
    return this.streams.get(streamId);
  }

  /**
   * Get peer count for stream
   */
  getPeerCount(streamId: string): number {
    return this.streams.get(streamId)?.peers.size ?? 0;
  }

  /**
   * Broadcast message to stream
   */
  broadcastToStream(streamId: string, event: string, data: any) {
    if (this.io) {
      this.io.to(`stream:${streamId}`).emit(event, data);
    }
  }
}

export const webrtcService = new WebRTCService();
