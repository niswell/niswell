import dotenv from 'dotenv';
import { execSync } from 'child_process';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import app from './app';
import { prisma } from './lib/prisma';
import { webrtcService } from './services/webrtc.service';
import { socketService } from './services/socket.service';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

async function startServer() {
  try {
    // Test database connection
    await prisma.$executeRaw`SELECT 1`;
    console.log('✓ Database connection established');

    // Run database migrations
    try {
      console.log('🔧 Running database migrations...');
      execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
      console.log('✓ Database migrations completed');
    } catch (migrationError) {
      console.warn('⚠️ Migration warning:', migrationError);
    }

    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize Socket.io
    const io = new SocketServer(httpServer, {
      cors: {
        origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    // Initialize WebRTC and Socket services
    webrtcService.init(io);
    socketService.init(io);

    // Store io instance in services for access from routes
    (socketService as any).io = io;

    // Start server
    const server = httpServer.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT}`);
      console.log(`✓ Environment: ${NODE_ENV}`);
      console.log(`✓ API URL: http://localhost:${PORT}/api`);
      console.log(`✓ Health check: http://localhost:${PORT}/health`);
      console.log(`✓ WebSocket ready for streaming`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down gracefully...');
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT received, shutting down gracefully...');
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();
