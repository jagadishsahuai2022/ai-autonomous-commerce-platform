# AI Service

FastAPI-powered AI recommendation engine for the e-commerce platform.

## Setup

```bash
# Create Python virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run development server
npm run dev
```

The AI service will run on `http://localhost:8000`

## Endpoints

- `GET /` - Service health check
- `GET /health` - Detailed health status
- `GET /recommend/{user_id}` - Get recommendations for a user
- `POST /feedback` - Submit feedback for recommendations
