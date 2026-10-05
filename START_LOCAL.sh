#!/bin/bash

# Niswell Local Development Startup Script

echo "🚀 Starting Niswell Platform Locally"
echo "===================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker not found. Installing PostgreSQL locally..."
    echo ""
    echo "If you have PostgreSQL installed, ensure it's running with:"
    echo "  brew services start postgresql  (Mac)"
    echo "  sudo service postgresql start   (Linux)"
    echo "  pg_ctl -D /usr/local/var/postgres start (Mac alternate)"
    echo ""
else
    echo "✅ Docker found. Starting PostgreSQL container..."
    echo ""

    # Check if container already exists
    if docker ps -a --format '{{.Names}}' | grep -q '^niswell-db$'; then
        echo "   Removing old niswell-db container..."
        docker stop niswell-db 2>/dev/null
        docker rm niswell-db 2>/dev/null
    fi

    # Start PostgreSQL container
    docker run --name niswell-db \
        -e POSTGRES_USER=niswell \
        -e POSTGRES_PASSWORD=niswell \
        -e POSTGRES_DB=niswell \
        -p 5432:5432 \
        -d postgres:15

    echo "   ✓ PostgreSQL container started"
    echo "   Waiting 5 seconds for DB to be ready..."
    sleep 5

    # Test connection
    if docker exec niswell-db psql -U niswell -d niswell -c "SELECT 1" > /dev/null 2>&1; then
        echo "   ✓ Database connection verified"
    else
        echo "   ✗ Database connection failed"
        exit 1
    fi
    echo ""
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 16+"
    exit 1
fi

echo "✓ Node.js found: $(node --version)"
echo ""

# Start backend
echo "📦 Starting Backend..."
echo "   Location: /home/user/niswell"
echo "   Command: npm run dev"
echo ""
cd /home/user/niswell

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "   Installing dependencies..."
    npm install > /dev/null 2>&1
fi

# Start backend in background
npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "   ✓ Backend started (PID: $BACKEND_PID)"
echo ""

# Wait for backend to be ready
echo "   Waiting for backend to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo "   ✓ Backend is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "   ✗ Backend failed to start. Check /tmp/backend.log"
        kill $BACKEND_PID
        exit 1
    fi
    sleep 1
done
echo ""

# Start frontend
echo "📱 Starting Frontend..."
echo "   Location: /home/user/niswell-frontend"
echo "   Command: npm start"
echo "   URL: http://localhost:3000"
echo ""
cd /home/user/niswell-frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "   Installing dependencies..."
    npm install > /dev/null 2>&1
fi

# Start frontend (this runs in foreground)
echo "   🎉 Frontend starting... (opens browser automatically)"
echo ""
npm start

# Cleanup on exit
trap "kill $BACKEND_PID; docker stop niswell-db 2>/dev/null" EXIT
