#!/bin/bash
cd "/Users/srikanth/Documents/LP Management/water-tap-management"
echo "Starting server from: $(pwd)"
pkill -f "next dev" 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 2
npm run dev
