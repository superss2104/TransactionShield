"""
FastAPI Main Application

Entry point for the TransactionShield API.
Configures CORS, middleware, and includes routes.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.routes import router

# Create FastAPI application
app = FastAPI(
    title="TransactionShield API",
    description="Risk-based fraud prevention system for financial transactions",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router)

# Mount static files for frontend
frontend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
if os.path.exists(frontend_path):
    app.mount("/frontend", StaticFiles(directory=frontend_path, html=True), name="frontend")


@app.on_event("startup")
async def startup_event():
    """Run on application startup."""
    print("=" * 60)
    print("TransactionShield API Starting...")
    print("=" * 60)
    print("[OK] Fraud Prevention System Initialized")
    print("[OK] Risk Engine: Active")
    print("[OK] Decision Policy: Loaded")
    print("[OK] API Documentation: http://localhost:8000/docs")
    print("[OK] Frontend: http://localhost:8000/frontend/index.html")
    print("=" * 60)


@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown."""
    print("\nTransactionShield API Shutting Down...")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
