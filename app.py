from flask import Flask, request, jsonify, send_file, send_from_directory
import requests
import os
import json
import io
import base64
from gtts import gTTS
from deepmultilingualpunctuation import PunctuationModel
import numpy as np

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

app = Flask(__name__, static_folder='static')

# Initialize the models at startup
print("Initializing models...")

# Initialize Punctuation Model
print("Loading punctuation model...")
punctuation_model = PunctuationModel()
print("Punctuation model initialized!")

class OllamaModel:
    def __init__(self, model_name="gemma3:12b", endpoint="http://localhost:11434"):
        self.model_name = model_name
        self.endpoint = endpoint
        self.session = requests.Session()
        self._initialize_model()
    
    def _initialize_model(self):
        try:
            print(f"Initializing Ollama model: {self.model_name}")
            response = self.session.post(
                f"{self.endpoint}/api/chat",
                json={
                    "model": self.model_name,
                    "messages": [{
                        "role": "system", 
                        "content": "You are an IELTS examiner. Evaluate responses professionally and provide constructive feedback."
                    }],
                    "stream": False
                }
            )
            if response.status_code == 200:
                print(f"Ollama model {self.model_name} initialized successfully!")
            else:
                print(f"Warning: Ollama initialization returned status code {response.status_code}")
        except Exception as e:
            print(f"Warning: Could not initialize Ollama model: {str(e)}")
    
    def chat(self, messages):
        try:
            response = self.session.post(
                f"{self.endpoint}/api/chat",
                json={
                    "model": self.model_name,
                    "messages": messages,
                    "stream": False
                }
            )
            if response.status_code != 200:
                return None, f"Ollama API returned status code {response.status_code}"
            return response.json(), None
        except Exception as e:
            return None, str(e)

def generate_speech(text, language='en', slow=False, tld='com'):
    """Generate speech using gTTS and return the audio data as base64."""
    tts = gTTS(text=text, lang=language, slow=slow, tld=tld)
    audio_buffer = io.BytesIO()
    tts.write_to_fp(audio_buffer)
    audio_buffer.seek(0)
    audio_data = base64.b64encode(audio_buffer.read()).decode('utf-8')
    return audio_data

def format_punctuated_text(labeled_words):
    """Convert labeled words into properly formatted text."""
    result = []
    for word, punct, _ in labeled_words:
        if punct != '0':  # If there's punctuation
            result.append(word + punct)
        else:
            result.append(word)
    return ' '.join(result)

# Initialize Ollama model
ollama_model = OllamaModel()
print("All models initialized successfully!")

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        messages = data.get('messages', [])
        
        response_data, error = ollama_model.chat(messages)
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
        
        try:
            # Preprocess the text
            clean_text = punctuation_model.preprocess(text)
            # Get punctuated text
            labeled_words = punctuation_model.predict(clean_text)
            
            # Format the text properly
            final_text = format_punctuated_text(labeled_words)
            
            # Capitalize the first letter of sentences
            sentences = final_text.split('. ')
            sentences = [s[0].upper() + s[1:] if len(s) > 0 else s for s in sentences]
            final_text = '. '.join(sentences)
            
            print(f"Original text: {text}")
            print(f"Processed text: {final_text}")
            
            return jsonify({"text": final_text})
            
        except Exception as e:
            print(f"Error in punctuation processing: {str(e)}")
            return jsonify({"text": text})
        
    except Exception as e:
        print(f"Error in punctuation endpoint: {str(e)}")
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
    os.makedirs('static/voices', exist_ok=True)
    app.run(host='0.0.0.0', port=port, debug=True)