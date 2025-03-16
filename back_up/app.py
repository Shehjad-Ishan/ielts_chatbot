# app.py - Flask backend server for IELTS Examiner application
from flask import Flask, request, jsonify, send_file, send_from_directory
import requests
import os
import json
import io
import base64
from gtts import gTTS

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

app = Flask(__name__, static_folder='static')

def generate_speech(text, language='en', slow=False, tld='com'):
    """Generate speech using gTTS and return the audio data as base64."""
    tts = gTTS(text=text, lang=language, slow=slow, tld=tld)
    audio_buffer = io.BytesIO()
    tts.write_to_fp(audio_buffer)
    audio_buffer.seek(0)
    audio_data = base64.b64encode(audio_buffer.read()).decode('utf-8')
    return audio_data

def handle_ollama_api(model, messages, endpoint):
    """Call the Ollama API and return the response data."""
    ollama_response = requests.post(
        f"{endpoint}/api/chat",
        json={
            "model": model,
            "messages": messages,
            "stream": False
        }
    )
    if ollama_response.status_code != 200:
        return None, f"Ollama API returned status code {ollama_response.status_code}"
    return ollama_response.json(), None

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        model = data.get('model', 'gemma2:27b')
        messages = data.get('messages', [])
        endpoint = data.get('endpoint', 'http://localhost:11434')
        
        response_data, error = handle_ollama_api(model, messages, endpoint)
        if error:
            return jsonify({"error": error}), 500
        
        return jsonify({"response": response_data["message"]["content"]})
        
    except Exception as e:
        print(f"Error calling Ollama API: {str(e)}")
        return jsonify({"error": "Failed to get response from Ollama", "details": str(e)}), 500

@app.route('/api/tts', methods=['POST'])
def text_to_speech():
    try:
        data = request.json
        text = data.get('text', '')
        language = data.get('language', 'en')
        slow = data.get('slow', False)
        tld = data.get('tld', 'com')
        
        audio_data = generate_speech(text, language, slow, tld)
        
        return jsonify({"audio": audio_data})
        
    except Exception as e:
        print(f"Error generating TTS: {str(e)}")
        return jsonify({"error": "Failed to generate speech", "details": str(e)}), 500

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
    # Create a voices directory if it doesn't exist
    os.makedirs('static/voices', exist_ok=True)
    app.run(host='0.0.0.0', port=port, debug=True)