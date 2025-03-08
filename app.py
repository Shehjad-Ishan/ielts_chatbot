
# app.py - Flask backend server for IELTS Examiner application
from flask import Flask, request, jsonify, send_from_directory
import requests
import os
import json

app = Flask(__name__, static_folder='static')

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        model = data.get('model', 'llama3')
        messages = data.get('messages', [])
        endpoint = data.get('endpoint', 'http://localhost:11434')
        
        # Call Ollama API
        ollama_response = requests.post(
            f"{endpoint}/api/chat",
            json={
                "model": model,
                "messages": messages,
                "stream": False
            }
        )
        
        if ollama_response.status_code != 200:
            return jsonify({
                "error": f"Ollama API returned status code {ollama_response.status_code}"
            }), 500
            
        response_data = ollama_response.json()
        return jsonify({
            "response": response_data["message"]["content"]
        })
        
    except Exception as e:
        print(f"Error calling Ollama API: {str(e)}")
        return jsonify({
            "error": "Failed to get response from Ollama",
            "details": str(e)
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"})

# Serve the frontend files
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_static(path):
    if path == "":
        return send_from_directory('static', 'index.html')
    try:
        return send_from_directory('static', path)
    except:
        return send_from_directory('static', 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)