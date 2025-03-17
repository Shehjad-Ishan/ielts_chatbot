export class MessageHandler {
    constructor(config) {
        this.config = config;
        this.chatWorker = new Worker('./js/chat/chatWorker.js');
        this.setupWorkerEvents();
    }

    setupWorkerEvents() {
        this.chatWorker.onmessage = (e) => {
            const { action, data } = e.data;
            switch (action) {
                case 'messageComplete':
                    this.handleMessageResponse(data);
                    break;
                case 'error':
                    this.handleError(data.error);
                    break;
            }
        };
    }

    async sendMessage(message, isScoring = false, customPrompt = null) {
        const userMessage = customPrompt || message;
        
        if (!userMessage) return;
        
        if (!isScoring || !customPrompt) {
            this.addMessage(userMessage, 'user');
        }
        
        this.updateStatus(`Waiting for response using ${isScoring ? this.config.scoringModel : this.config.conversationModel}...`);
        
        const history = this.getConversationHistory();
        const modelToUse = isScoring ? this.config.scoringModel : this.config.conversationModel;
        
        this.chatWorker.postMessage({
            action: 'sendMessage',
            data: {
                model: modelToUse,
                messages: [
                    { role: 'system', content: this.config.testPrompts.systemPrompt },
                    ...history,
                    { role: 'user', content: userMessage }
                ],
                endpoint: this.config.ollamaEndpoint
            }
        });
    }

    handleMessageResponse(data) {
        const examinerResponse = data.response;
        this.addMessage(examinerResponse, 'examiner');
        
        if (!data.isScoring) {
            this.speakText(examinerResponse);
        } else {
            this.updateStatus('Scoring complete.');
        }
    }

    handleError(error) {
        console.error('Error:', error);
        this.updateStatus(`Error: ${error}. Please try again.`);

        // Re-enable inputs in case of error
        this.disableInputs(false);
    }

    addMessage(message, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);
        messageDiv.textContent = message;
        document.getElementById('chatContainer').appendChild(messageDiv);
        document.getElementById('chatContainer').scrollTop = document.getElementById('chatContainer').scrollHeight;
    }

    getConversationHistory() {
        const messages = [];
        const messageElements = document.getElementById('chatContainer').querySelectorAll('.message');
        
        messageElements.forEach(element => {
            const role = element.classList.contains('user') ? 'user' : 'assistant';
            messages.push({
                role: role,
                content: element.textContent
            });
        });
        
        return messages;
    }

    async speakText(text) {
        this.updateStatus('Generating speech...');
        this.disableInputs(true);
        document.getElementById('stopSpeakingButton').disabled = false;

        try {
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    voice: 'default'
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
            this.config.currentAudio = audio;
            this.setupAudioEvents(audio);

        } catch (error) {
            console.error('Error with TTS:', error);
            this.handleTTSError(text);
        }
    }

    setupAudioEvents(audio) {
        audio.onplay = () => {
            this.updateStatus('Examiner is speaking...');
            document.getElementById('stopSpeakingButton').disabled = false;
            this.disableInputs(true);
        };

        audio.onended = () => {
            this.updateStatus('Ready for your response.');
            document.getElementById('stopSpeakingButton').disabled = true;
            this.config.currentAudio = null;
            this.disableInputs(false);
        };

        audio.onerror = () => {
            this.updateStatus('Error playing audio.');
            document.getElementById('stopSpeakingButton').disabled = true;
            this.config.currentAudio = null;
            this.disableInputs(false);
        };

        audio.play().catch(error => {
            console.error('Error playing audio:', error);
            this.handleTTSError(text);
        });
    }

    handleTTSError(text) {
        this.updateStatus('Error generating speech. Falling back to browser TTS.');
        
        if ('speechSynthesis' in window) {
            const speech = new SpeechSynthesisUtterance(text);
            speech.lang = 'en-US';
            speech.rate = 0.9;
            speech.pitch = 1;

            speech.onstart = () => {
                this.updateStatus('Examiner is speaking (using browser TTS)...');
            };

            speech.onend = () => {
                this.updateStatus('Ready for your response.');
                document.getElementById('stopSpeakingButton').disabled = true;
                this.disableInputs(false);
            };

            speech.onerror = () => {
                this.updateStatus('Speech synthesis failed.');
                document.getElementById('stopSpeakingButton').disabled = true;
                this.disableInputs(false);
            };

            this.config.currentAudio = {
                pause: () => {
                    window.speechSynthesis.cancel();
                },
                currentTime: 0
            };

            window.speechSynthesis.speak(speech);
        } else {
            this.updateStatus('Speech synthesis not available.');
            this.disableInputs(false);
        }
    }

    stopSpeaking() {
        if (this.config.currentAudio) {
            this.config.currentAudio.pause();
            this.config.currentAudio.currentTime = 0;
            this.config.currentAudio = null;
            
            document.getElementById('stopSpeakingButton').disabled = true;
            this.updateStatus('Playback stopped.');
            this.disableInputs(false);
        }
    }

    disableInputs(disabled) {
        document.getElementById('startRecordingButton').disabled = disabled;
        document.getElementById('sendButton').disabled = disabled;
        document.getElementById('userInput').disabled = disabled;
    }

    updateStatus(message) {
        document.getElementById('statusMessage').textContent = message;
    }

    // Cleanup method to be called when the instance is destroyed
    cleanup() {
        if (this.chatWorker) {
            this.chatWorker.terminate();
        }
        if (this.config.currentAudio) {
            this.stopSpeaking();
        }
    }
}