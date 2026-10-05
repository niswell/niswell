import dotenv from 'dotenv';
import { execSync } from 'child_process';
import app from './app';
import { prisma } from './lib/prisma';

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

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT}`);
      console.log(`✓ Environment: ${NODE_ENV}`);
      console.log(`✓ API URL: http://localhost:${PORT}/api`);
      console.log(`✓ Health check: http://localhost:${PORT}/health`);
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
