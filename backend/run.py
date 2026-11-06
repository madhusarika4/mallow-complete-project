"""Run Mallow: `python run.py` then open http://localhost:8000"""

import os

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "mallow_api.main:create_app", factory=True,
        host=os.getenv("MALLOW_HOST", "127.0.0.1"), port=int(os.getenv("MALLOW_PORT", "8000")),
    )
