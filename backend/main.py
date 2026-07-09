import os
import sys

# Ensure parent directory is in sys.path so backend imports work regardless of CWD context
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import roads

app = FastAPI(
    title="Zimbabwe Department of Roads - Central Telemetry Repository API",
    description="Backend service that stores road condition surveys and aggregates telemetry data for visualization.",
    version="1.0.0"
)

# CORS configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to dashboard domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(roads.router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Zimbabwe MOTID Road Condition Survey Telemetry Repository",
        "version": "1.0.0"
      }
