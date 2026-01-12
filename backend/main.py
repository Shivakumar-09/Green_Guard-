"""
GreenGuard AI - Main FastAPI Application
Environmental monitoring and pollution prevention system
"""

import sys
from pathlib import Path
import asyncio
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# ---- Path setup --------------------------------------------------

current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

# ---- App initialization -----------------------------------------

app = FastAPI(
    title="GreenGuard AI API",
    description="AI-powered environmental monitoring and pollution prevention system",
    version="1.0.0",
)

# ---- CORS CONFIG (FIXED) -----------------------------------------
# Frontend runs on Vercel, backend on Render → MUST allow Vercel origin

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://green-guard-nu.vercel.app",  # Vercel frontend (PROD)
        "http://localhost:3000",              # Local dev (CRA)
        "http://localhost:5173",              # Local dev (Vite)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Static files (optional agent UI) ----------------------------

env_safety_path = (
    current_dir
    / ".adk"
    / "artifacts"
    / "env-safety-agent"
    / "env-safety-agent"
    / "dist"
)

if env_safety_path.exists():
    app.mount(
        "/env-safety-agent",
        StaticFiles(directory=str(env_safety_path), html=True),
        name="env-safety-agent",
    )

# ---- Routers -----------------------------------------------------

from routes import (
    aqi_routes,
    recommendations_routes,
    travel_routes,
    geocoding_routes,
    agent_routes,
    personalized_recommendations_routes,
)

app.include_router(aqi_routes.router)
app.include_router(recommendations_routes.router)
app.include_router(travel_routes.router)
app.include_router(geocoding_routes.router)
app.include_router(agent_routes.router)
app.include_router(personalized_recommendations_routes.router)

# ---- Basic endpoints --------------------------------------------

@app.get("/")
async def root():
    return {
        "message": "GreenGuard AI API",
        "version": "1.0.0",
        "endpoints": {
            "current_aqi": "/api/current-aqi?latitude=<lat>&longitude=<lon>",
            "forecast": "/api/forecast?latitude=<lat>&longitude=<lon>&days=7",
            "recommendations": "/api/recommendations (POST)",
            "travel_exposure": "/api/travel-exposure (POST)",
            "health": "/health",
        },
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# ---- WebSocket connection manager --------------------------------

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)


manager = ConnectionManager()

# ---- WebSocket: Real-time monitoring -----------------------------

@app.websocket("/ws/realtime-monitoring")
async def realtime_monitoring(
    websocket: WebSocket,
    latitude: float = 40.7128,
    longitude: float = -74.006,
):
    """
    WebSocket endpoint for real-time environmental monitoring
    Streams AQI + weather updates
    """
    await manager.connect(websocket)

    try:
        await websocket.send_json(
            {
                "type": "connection_established",
                "message": "Real-time monitoring connected",
                "timestamp": datetime.utcnow().isoformat(),
            }
        )

        while True:
            from services.weather_service import get_weather_data
            from services.air_quality_service import get_current_aqi

            weather_data = get_weather_data(latitude, longitude)
            aqi_data = get_current_aqi(latitude, longitude)

            aqi_value = aqi_data.get("aqi", 50)

            realtime_data = {
                "type": "realtime_update",
                "timestamp": datetime.utcnow().isoformat(),
                "location": {
                    "latitude": latitude,
                    "longitude": longitude,
                },
                "aqi": {
                    "value": aqi_value,
                    "status": (
                        "Good"
                        if aqi_value <= 50
                        else "Moderate"
                        if aqi_value <= 100
                        else "Unhealthy"
                    ),
                    "pm25": aqi_data.get("pm25", 0),
                    "pm10": aqi_data.get("pm10", 0),
                    "co": aqi_data.get("co", 0),
                    "no2": aqi_data.get("no2", 0),
                    "o3": aqi_data.get("o3", 0),
                    "so2": aqi_data.get("so2", 0),
                },
                "weather": {
                    "temperature": weather_data.get("temperature", 22),
                    "humidity": weather_data.get("humidity", 60),
                    "wind_speed": weather_data.get("wind_speed", 5),
                    "description": weather_data.get("description", "Clear sky"),
                },
                "alerts": [],
            }

            if aqi_value > 150:
                realtime_data["alerts"].append(
                    {
                        "level": "danger",
                        "message": "Very unhealthy air quality – avoid outdoor activities",
                    }
                )
            elif aqi_value > 100:
                realtime_data["alerts"].append(
                    {
                        "level": "warning",
                        "message": "Unhealthy air quality for sensitive groups",
                    }
                )

            await websocket.send_json(realtime_data)
            await asyncio.sleep(15)

    except WebSocketDisconnect:
        manager.disconnect(websocket)

# ---- Local run (Render ignores this, uses PORT=10000) -------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(sys.environ.get("PORT", 8020)),
    )
