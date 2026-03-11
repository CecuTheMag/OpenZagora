#!/bin/bash

# Podman Setup Script for Open Zagora
# This script ensures proper permissions for Podman rootless mode

echo "🐳 Setting up Podman for Open Zagora..."

# Set proper SELinux context for volumes (if SELinux is enabled)
if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce)" != "Disabled" ]; then
    echo "📋 Setting SELinux contexts..."
    sudo setsebool -P container_manage_cgroup true
    sudo setsebool -P virt_use_fusefs true
fi

# Create directories with proper permissions
echo "📁 Creating directories..."
mkdir -p server/uploads server/parsed admin-server/uploads admin-server/parsed
chmod 755 server/uploads server/parsed admin-server/uploads admin-server/parsed

# Fix ownership if needed
echo "🔧 Setting permissions..."
chown -R $(id -u):$(id -g) server/uploads server/parsed admin-server/uploads admin-server/parsed 2>/dev/null || true

echo "✅ Setup complete! You can now run:"
echo "   podman-compose -f docker-compose.dev.yml up --build"
echo ""
echo "🌐 Access points:"
echo "   Frontend (Dev): http://localhost:5173"
echo "   Admin (Dev): http://localhost:5174"
echo "   Backend API: http://localhost:5000"
echo "   Admin API: http://localhost:5001"