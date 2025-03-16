# app.py - Flask backend server for IELTS Examiner application
from flask import Flask, request, jsonify, send_from_directory
import requests
import os
import json
import io
import base64
import pyttsx3
import tempfile

app = Flask(__name__, static_folder='static')

# Initialize pyttsx3 engine
tts_engine = None

def initialize_tts():
    global tts_engine
    if tts_engine is None:
        tts_engine = pyttsx3.init()
        # Configure properties
        tts_engine.setProperty('rate', 150)  # Speed of speech
        tts_engine.setProperty('volume', 0.8)  # Volume (0.0 to 1.0)
    return tts_engine

@app.route('/api/voices', methods=['GET'])
def get_available_voices():
    """Return a list of all available voices on the system"""
    tts = initialize_tts()
    voices = tts.getProperty('voices')
    
    voice_list = []
    for i, voice in enumerate(voices):
        voice_list.append({
            'id': i,  # Use index as ID for easy reference
            'name': voice.name,
            'languages': voice.languages,
            'gender': 'female' if 'female' in voice.name.lower() else 'male',
            'system_id': voice.id  # The actual system ID of the voice
        })
    
    return jsonify({
        "voices": voice_list
    })

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

@app.route('/api/tts', methods=['POST'])
def text_to_speech():
    try:
        data = request.json
        text = data.get('text', '')
        voice_id = data.get('voice_id')  # Accept a specific voice ID
        voice_gender = data.get('voice', 'default')  # For backward compatibility
        
        # Initialize TTS if not already done
        tts = initialize_tts()
        voices = tts.getProperty('voices')
        
        # Set voice based on parameters
        if voice_id is not None and 0 <= voice_id < len(voices):
            # If a specific voice ID is provided, use that
            tts.setProperty('voice', voices[voice_id].id)
        elif voice_gender == "female":
            # Try to find a female voice
            female_voices = [v for v in voices if "female" in v.name.lower()]
            if female_voices:
                tts.setProperty('voice', female_voices[0].id)
        else:
            # Default to a male voice if available
            male_voices = [v for v in voices if "male" in v.name.lower()]
            if male_voices:
                tts.setProperty('voice', male_voices[0].id)
        
        # Use a temporary file
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            temp_filename = temp_file.name
            
        # Save speech to the temporary file
        tts.save_to_file(text, temp_filename)
        tts.runAndWait()
        
        # Read the temporary file into memory
        with open(temp_filename, 'rb') as audio_file:
            audio_data = base64.b64encode(audio_file.read()).decode('utf-8')
        
        # Clean up the temporary file
        os.unlink(temp_filename)
        
        return jsonify({
            "audio": audio_data
        })
        
    except Exception as e:
        print(f"Error generating TTS: {str(e)}")
        return jsonify({
            "error": "Failed to generate speech",
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
    # Create a voices directory if it doesn't exist
    os.makedirs('static/voices', exist_ok=True)
    app.run(host='0.0.0.0', port=port, debug=True)