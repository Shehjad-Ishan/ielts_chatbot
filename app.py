# app.py - Flask backend server for IELTS Examiner application
from flask import Flask, request, jsonify, send_file, send_from_directory
import requests
import os
import json
import io
import base64
from gtts import gTTS
import re

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

app = Flask(__name__, static_folder='static')

class SimplePunctuator:
    def __init__(self):
        self.sentence_endings = r'([.!?])\s+'
        self.comma_patterns = [
            r'(,)\s+',
            r'\b(but|and|or|nor|for|so|yet)\b',
            r'\b(however|moreover|furthermore|therefore|nevertheless|meanwhile|consequently)\b',
            r'\b(in addition|as a result|for example|for instance)\b',
        ]
    
    def capitalize_sentences(self, text):
        sentences = re.split(self.sentence_endings, text)
        result = []
        for i in range(0, len(sentences), 2):
            if i < len(sentences):
                sentence = sentences[i].strip()
                if sentence:
                    sentence = sentence[0].upper() + sentence[1:] if len(sentence) > 1 else sentence.upper()
                    result.append(sentence)
                if i + 1 < len(sentences):
                    result.append(sentences[i + 1])
        return ' '.join(result)

    def add_punctuation(self, text):
        # Remove existing punctuation and extra spaces
        text = ' '.join(text.split())
        
        # Add periods for sentence-like structures
        text = re.sub(r'(?<=[.!?])\s+', ' ', text)
        text = re.sub(r'(?<=[a-z])\s+(?=[A-Z])', '. ', text)
        
        # Add question marks for questions
        text = re.sub(r'\b(what|who|where|when|why|how|which|whose|whom)\b.*?(?=[.!?]|\Z)', 
                     lambda m: m.group(0) + '?', 
                     text, 
                     flags=re.IGNORECASE)
        
        # Add commas
        for pattern in self.comma_patterns:
            text = re.sub(f'\\s+{pattern}\\s+', r', \1 ', text)
        
        # Clean up spacing around punctuation
        text = re.sub(r'\s+([.!?,])', r'\1', text)
        text = re.sub(r'([.!?,])', r'\1 ', text)
        text = re.sub(r'\s+', ' ', text)
        
        # Capitalize sentences
        text = self.capitalize_sentences(text)
        
        return text.strip()

# Initialize punctuator
punctuator = SimplePunctuator()

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
        model = data.get('model', 'gemma3:12b')
        messages = data.get('messages', [])
        endpoint = data.get('endpoint', 'http://localhost:11434')
        
        response_data, error = handle_ollama_api(model, messages, endpoint)
        if error:
            return jsonify({"error": error}), 500
        
        return jsonify({"response": response_data["message"]["content"]})
        
    except Exception as e:
        print(f"Error calling Ollama API: {str(e)}")
        return jsonify({"error": "Failed to get response from Ollama", "details": str(e)}), 500

@app.route('/api/punctuate', methods=['POST'])
def punctuate_text():
    try:
        data = request.json
        text = data.get('text', '')
        
        if not text.strip():
            return jsonify({"text": text})
        
        result = punctuator.add_punctuation(text)
        return jsonify({"text": result})
        
    except Exception as e:
        print(f"Error in punctuation: {str(e)}")
        return jsonify({"error": str(e), "text": text}), 500

@app.route('/api/tts', methods=['POST'])
def text_to_speech():
    try:
        data = request.json
        text = data.get('text', '')
        language = data.get('language', 'en')
        slow = data.get('slow', False)
        tld = data.get('tld', 'co.in')
        
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
    port = int(os.environ.get('PORT', 80))
    # Create a voices directory if it doesn't exist
    os.makedirs('static/voices', exist_ok=True)
    app.run(host='0.0.0.0', port=port, debug=True)