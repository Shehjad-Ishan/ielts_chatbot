import os
from app import app
from waitress import serve

if __name__ == "__main__":
    # Create necessary directories
    os.makedirs('static/voices', exist_ok=True)
    os.makedirs('logs', exist_ok=True)
    
    print("Starting server with Waitress...")
    serve(app, 
          host='0.0.0.0', 
          port=80, 
          threads=1,  # Use single thread for model
          connection_limit=50,  # Limit concurrent connections
          cleanup_interval=30,  # Cleanup every 30 seconds
          channel_timeout=120)  # 2 minute timeout