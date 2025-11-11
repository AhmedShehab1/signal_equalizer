# Signal Equalizer Backend

Python FastAPI backend for the Signal Equalizer application.

## Tech Stack

- **FastAPI** - Modern, fast web framework for building APIs
- **Uvicorn** - ASGI server
- **NumPy** - Numerical computing
- **SciPy** - Scientific computing and signal processing
- **Pydantic** - Data validation

## Setup

### 1. Create Virtual Environment

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

For development:

```bash
pip install -r requirements-dev.txt
```

### 3. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` to configure your settings.

## Running the Server

### Development Mode (with auto-reload)

```bash
python -m app.main
```

Or using uvicorn directly:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Production Mode

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The API will be available at:
- Main: http://localhost:8000
- Documentation: http://localhost:8000/docs
- Alternative docs: http://localhost:8000/redoc

## Testing

Run tests:

```bash
pytest
```

Run tests with coverage:

```bash
pytest --cov=app tests/
```

## API Endpoints

- `GET /` - Root endpoint
- `GET /health` - Health check
- `GET /api/info` - API information
- `GET /docs` - Interactive API documentation (Swagger UI)
- `GET /redoc` - Alternative API documentation

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI application
│   └── config.py        # Configuration settings
├── tests/
│   ├── __init__.py
│   └── test_main.py     # API tests
├── requirements.txt     # Production dependencies
├── requirements-dev.txt # Development dependencies
├── .env.example         # Example environment variables
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

## Code Quality

Format code:

```bash
black app/ tests/
isort app/ tests/
```

Lint code:

```bash
flake8 app/ tests/
pylint app/ tests/
mypy app/
```

## Future Enhancements

The backend can be extended with:
- Audio file upload and processing endpoints
- Real-time audio streaming
- Batch processing capabilities
- Audio format conversion
- Advanced DSP algorithms
- User authentication and authorization
- Database integration for storing presets
- WebSocket support for real-time communication

## License

MIT
