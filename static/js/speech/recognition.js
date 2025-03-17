import { updateStatus } from '../utils/domUtils.js';

export class SpeechRecognitionManager {
    constructor(config) {
        this.config = config;
        this.recognition = null;
        this.tempMessageElement = null;
        this.hasSpeechDetected = false;
        this.silenceTimer = null;
        this.recordingStartTime = 0;
        this.lastSpeechTimestamp = 0;
        this.fullTranscript = '';
    }

    initialize() {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            updateStatus('Speech recognition not supported');
            return false;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.setupRecognitionEvents();
        return true;
    }

    setupRecognitionEvents() {
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-IN';

        this.recognition.onstart = this.handleStart.bind(this);
        this.recognition.onresult = this.handleResult.bind(this);
        this.recognition.onend = this.handleEnd.bind(this);
        this.recognition.onerror = this.handleError.bind(this);
    }

    handleStart() {
        updateStatus('Listening... Speak now.');
        this.hasSpeechDetected = false;
        this.recordingStartTime = Date.now();
        this.lastSpeechTimestamp = this.recordingStartTime;
        this.config.pauseCount = 0;
        this.config.lastTimerValue = this.config.timerSeconds;
        this.fullTranscript = '';
        this.config.messageSent = false;

        document.getElementById('startRecordingButton').disabled = true;
        document.getElementById('stopRecordingButton').disabled = false;

        this.tempMessageElement = document.createElement('div');
        this.tempMessageElement.classList.add('message', 'user', 'temp-message');
        this.tempMessageElement.textContent = '...';
        document.getElementById('chatContainer').appendChild(this.tempMessageElement);
    }

    async handleResult(event) {
        this.fullTranscript = '';
        
        for (let i = 0; i < event.results.length; i++) {
            this.fullTranscript += event.results[i][0].transcript + ' ';
        }
        
        this.fullTranscript = this.fullTranscript.trim();
        document.getElementById('userInput').value = this.fullTranscript;
        
        if (this.tempMessageElement) {
            this.tempMessageElement.textContent = this.fullTranscript;
        }

        const currentTime = Date.now();
        if (!this.hasSpeechDetected) {
            this.hasSpeechDetected = true;
        } else if (currentTime - this.lastSpeechTimestamp > 1500) {
            this.config.pauseCount++;
        }
        this.lastSpeechTimestamp = currentTime;

        this.handleSilence();
    }

    handleSilence() {
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
        }

        this.silenceTimer = setTimeout(async () => {
            if (this.hasSpeechDetected && !this.config.messageSent) {
                if (this.tempMessageElement) {
                    this.tempMessageElement.remove();
                    this.tempMessageElement = null;
                }
                this.config.messageSent = true;
                this.stopRecording();
                
                // Send the message through MessageHandler
                window.dispatchEvent(new CustomEvent('speechComplete', {
                    detail: { transcript: this.fullTranscript }
                }));
            }
        }, this.config.SILENCE_THRESHOLD);
    }

    async handleEnd() {
        document.getElementById('startRecordingButton').disabled = false;
        document.getElementById('stopRecordingButton').disabled = true;
        updateStatus('Recording stopped.');
        
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
        }
        
        if (this.hasSpeechDetected && this.fullTranscript.trim() !== '' && !this.config.messageSent) {
            if (this.tempMessageElement) {
                this.tempMessageElement.remove();
                this.tempMessageElement = null;
            }
            
            this.config.messageSent = true;
            window.dispatchEvent(new CustomEvent('speechComplete', {
                detail: { transcript: this.fullTranscript }
            }));
        } else {
            if (this.tempMessageElement) {
                this.tempMessageElement.remove();
                this.tempMessageElement = null;
            }
        }
    }

    handleError(event) {
        console.error('Speech recognition error', event.error);
        updateStatus('Error with speech recognition: ' + event.error);
        
        if (this.tempMessageElement) {
            this.tempMessageElement.remove();
            this.tempMessageElement = null;
        }
        
        this.stopRecording();
    }

    startRecording() {
        if (this.recognition) {
            try {
                document.getElementById('userInput').value = '';
                this.recognition.start();
            } catch (error) {
                console.error('Error starting recognition', error);
                updateStatus('Error starting speech recognition.');
            }
        }
    }

    stopRecording() {
        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (error) {
                console.error('Error stopping recognition', error);
                updateStatus('Error stopping speech recognition.');
            }
        }
    }
}