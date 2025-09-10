import uvicorn
import os

if __name__ == "__main__":
    # Render provides PORT as an environment variable
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False  # set to True only for local dev
    )
