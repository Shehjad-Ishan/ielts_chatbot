# app.py - Flask backend server for IELTS Examiner application
from flask import Flask, request, jsonify, send_from_directory
import requests
import os
import json
import torch
from TTS.api import TTS
import io
import base64
import pyttsx3


os.environ["KMP_DUPLICATE_LIB_OK"]="TRUE"

app = Flask(__name__, static_folder='static')

# Initialize TTS model
device = "cuda" if torch.cuda.is_available() else "cpu"
tts_model = None

def initialize_tts():
    global tts_model
    if tts_model is None:
        # Initialize the TTS model (using a simpler model for faster loading)
        tts_model = TTS("tts_models/en/ljspeech/speedy-speech").to(device)
        # For better quality but slower, use XTTS v2:
        # tts_model = TTS("tts_models/en/ljspeech/speedy-speech").to(device)
        # tts_model = pyttsx3.init()
        # tts_model.setProperty('rate', 125)
    return tts_model

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
        voice = data.get('voice', 'default')
        
        # Initialize TTS if not already done
        tts = initialize_tts()
        
        # Create a memory buffer for the audio
        audio_buffer = io.BytesIO()
        
        if "xtts_v2" in tts.model_name:
            # For XTTS v2, we need a speaker reference
            speaker_wav = "static/voices/british_male.wav"  # Default reference voice
            if voice == "female":
                speaker_wav = "static/voices/british_female.wav"
                
            # Generate speech with voice cloning
            tts.tts_to_file(
                text=text,
                speaker_wav=speaker_wav,
                language="en", 
                file_path=audio_buffer
            )
        else:
            # For regular TTS models
            wav = tts.tts(text=text)
            # Save wav to buffer
            tts.synthesizer.save_wav(wav, audio_buffer)

        # tts_model.say(text)
        # tts_model.runAndWait()
        
        # Get the buffer value and encode to base64
        audio_buffer.seek(0)
        audio_data = base64.b64encode(audio_buffer.read()).decode('utf-8')
        
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