#!/bin/bash

# Signal Equalizer - Development Setup Script
# This script sets up both frontend and backend for local development

set -e

echo "🚀 Setting up Signal Equalizer..."
echo ""

# Frontend Setup
echo "📦 Setting up Frontend..."
cd frontend
echo "  - Installing Node.js dependencies..."
npm install
echo "  ✅ Frontend dependencies installed"
cd ..
echo ""

# Backend Setup
echo "🐍 Setting up Backend..."
cd backend

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "  ❌ Python 3 is not installed. Please install Python 3.11 or later."
    exit 1
fi

# Create virtual environment
echo "  - Creating Python virtual environment..."
python3 -m venv venv

# Activate virtual environment and install dependencies
echo "  - Installing Python dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "  - Creating .env file from example..."
    cp .env.example .env
fi

echo "  ✅ Backend setup complete"
cd ..
echo ""

echo "✅ Setup complete!"
echo ""
echo "🎯 Next steps:"
echo ""
echo "  Frontend (http://localhost:5173):"
echo "    cd frontend"
echo "    npm run dev"
echo ""
echo "  Backend (http://localhost:8000):"
echo "    cd backend"
echo "    source venv/bin/activate  # On Windows: venv\\Scripts\\activate"
echo "    python -m app.main"
echo "    # Or: uvicorn app.main:app --reload"
echo ""
echo "  API Docs: http://localhost:8000/docs"
echo ""
echo "  Run tests:"
echo "    Frontend: cd frontend && npm test"
echo "    Backend:  cd backend && source venv/bin/activate && pytest"
echo ""
echo "Happy coding! 🎉"
