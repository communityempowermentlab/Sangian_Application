#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=========================================="
echo "   SANGIAN APP - LOCAL BUILD AUTOMATION   "
echo "=========================================="
echo ""

echo "[1/2] Building the React Frontend..."
cd client
npm install
npm run build
cd ..
echo "✅ Frontend build successful!"
echo ""

echo "=========================================="
echo "               NEXT STEPS                 "
echo "=========================================="
echo "1. FRONTEND: Upload the entire contents of the './client/build/' folder to your live web server's public html directory."
echo "   (This replaces the old files and forces the browser to pull your new styles and routes)."
echo ""
echo "2. BACKEND: Upload the latest './server' folder to your live Node.js environment."
echo ""
echo "3. RESTART: SSH into your live server, go to the backend folder, and restart the Node process:"
echo "   e.g., pm2 restart sangian-api"
echo ""
echo "4. DATABASE: Ensure the MySQL user in your live server/.env has permissions to execute ALTER TABLE so setup can complete!"
echo "=========================================="
