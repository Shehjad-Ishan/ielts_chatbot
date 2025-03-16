from flask import Flask, request, jsonify, send_file, send_from_directory
import requests
import os
import json
import io
import base64
from gtts import gTTS
from deepmultilingualpunctuation import PunctuationModel
import numpy as np
import logging
import psutil
import gc
from logging.handlers import RotatingFileHandler
from functools import wraps
import time

# Configure logging
if not os.path.exists('logs'):
    os.makedirs('logs')

logging.basicConfig(
    handlers=[RotatingFileHandler('logs/app.log', maxBytes=10000000, backupCount=5)],
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

app = Flask(__name__, static_folder='static')

def memory_check(threshold=90):
    """Decorator to check memory before and after function execution"""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            process = psutil.Process()
            before_mem = process.memory_percent()
            
            if before_mem > threshold:
                gc.collect()
                logger.warning(f"High memory usage before execution: {before_mem}%")
                
            result = f(*args, **kwargs)
            
            after_mem = process.memory_percent()
            if after_mem > threshold:
                gc.collect()
                logger.warning(f"High memory usage after execution: {after_mem}%")
                
            return result
        return wrapper
    return decorator

class OllamaModel:
    _instance = None
    _is_initialized = False

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, model_name="gemma3:12b", endpoint="http://localhost:11434"):
        if not OllamaModel._is_initialized:
            self.model_name = model_name
            self.endpoint = endpoint
            self.session = requests.Session()
            self.last_request_time = 0
            self.request_cooldown = 1.0
            self._initialize_model()
            OllamaModel._is_initialized = True
            logger.info("Ollama model initialized for the first time")
        else:
            logger.info("Using existing Ollama model instance")

    def _initialize_model(self):
        try:
            logger.info(f"Initializing Ollama model: {self.model_name}")
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
                logger.info(f"Ollama model {self.model_name} initialized successfully!")
            else:
                logger.warning(f"Warning: Ollama initialization returned status code {response.status_code}")
        except Exception as e:
            logger.error(f"Warning: Could not initialize Ollama model: {str(e)}")
    
    @memory_check(threshold=85)
    def chat(self, messages):
        try:
            # Rate limiting
            current_time = time.time()
            time_since_last = current_time - self.last_request_time
            if time_since_last < self.request_cooldown:
                time.sleep(self.request_cooldown - time_since_last)
            
            response = self.session.post(
                f"{self.endpoint}/api/chat",
                json={
                    "model": self.model_name,
                    "messages": messages,
                    "stream": False
                }
            )
            
            self.last_request_time = time.time()
            
            if response.status_code != 200:
                return None, f"Ollama API returned status code {response.status_code}"
            
            return response.json(), None
        except Exception as e:
            return None, str(e)
        finally:
            gc.collect()

class SpeechHandler:
    def __init__(self):
        self._punctuation_model = None
    
    @property
    def punctuation_model(self):
        if self._punctuation_model is None:
            self._punctuation_model = PunctuationModel()
        return self._punctuation_model
    
    @memory_check(threshold=85)
    def generate_speech(self, text, language='en', slow=False, tld='co.in'):
        try:
            tts = gTTS(text=text, lang=language, slow=slow, tld=tld)
            audio_buffer = io.BytesIO()
            tts.write_to_fp(audio_buffer)
            audio_buffer.seek(0)
            return base64.b64encode(audio_buffer.read()).decode('utf-8')
        finally:
            gc.collect()
    
    @memory_check(threshold=85)
    def format_punctuated_text(self, text):
        if not text.strip():
            return text
        
        try:
            clean_text = self.punctuation_model.preprocess(text)
            labeled_words = self.punctuation_model.predict(clean_text)
            
            result = []
            for word, punct, _ in labeled_words:
                if punct != '0':
                    result.append(word + punct)
                else:
                    result.append(word)
            
            final_text = ' '.join(result)
            sentences = final_text.split('. ')
            sentences = [s[0].upper() + s[1:] if len(s) > 0 else s for s in sentences]
            return '. '.join(sentences)
        except Exception as e:
            logger.error(f"Text processing error: {str(e)}")
            return text
        finally:
            gc.collect()

# Initialize handlers lazily
speech_handler = SpeechHandler()
ollama_model = OllamaModel()

@app.route('/api/chat', methods=['POST'])
@memory_check(threshold=85)
def chat():
    try:
        data = request.json
        messages = data.get('messages', [])
        
        response_data, error = ollama_model.chat(messages)
        if error:
            return jsonify({"error": error}), 500
        
        return jsonify({"response": response_data["message"]["content"]})
    except Exception as e:
        logger.error(f"Chat endpoint error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/punctuate', methods=['POST'])
@memory_check(threshold=85)
def punctuate_text():
    try:
        data = request.json
        text = data.get('text', '')
        result = speech_handler.format_punctuated_text(text)
        return jsonify({"text": result})
    except Exception as e:
        logger.error(f"Punctuation endpoint error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/tts', methods=['POST'])
@memory_check(threshold=85)
def text_to_speech():
    try:
        data = request.json
        audio_data = speech_handler.generate_speech(
            text=data.get('text', ''),
            language=data.get('language', 'en'),
            slow=data.get('slow', False),
            tld=data.get('tld', 'co.in')
        )
        return jsonify({"audio": audio_data})
    except Exception as e:
        logger.error(f"TTS endpoint error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/memory', methods=['GET'])
def memory_status():
    process = psutil.Process()
    memory_info = {
        "percent": process.memory_percent(),
        "rss_mb": process.memory_info().rss / 1024 / 1024,
        "vms_mb": process.memory_info().vms / 1024 / 1024
    }
    gc.collect()  # Force garbage collection
    return jsonify(memory_info)

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"})

# Static file serving
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_static(path):
    if path == "" or not os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, 'index.html')
    return send_from_directory(app.static_folder, path)