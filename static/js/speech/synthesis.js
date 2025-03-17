export class SpeechSynthesisManager {
    constructor(config) {
        this.config = config;
        this.currentAudio = null;
    }

    async speakText(text) {
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
            this.currentAudio = audio;

            this.setupAudioEvents(audio);
            return true;
        } catch (error) {
            console.error('Error with TTS:', error);
            this.handleTTSError(text, error);
            return false;
        }
    }

    setupAudioEvents(audio) {
        const elements = window.elements;

        audio.onplay = () => {
            this.updateStatus('Examiner is speaking...');
            elements.stopSpeakingButton.disabled = false;
            this.disableInputs(true);
        };

        audio.onended = () => {
            this.handleAudioEnd();
        };

        audio.onerror = () => {
            this.handleAudioError();
        };

        audio.play();
    }

    handleAudioEnd() {
        const elements = window.elements;
        this.updateStatus('Ready for your response.');
        elements.stopSpeakingButton.disabled = true;
        this.currentAudio = null;
        this.disableInputs(false);
    }

    handleAudioError() {
        const elements = window.elements;
        this.updateStatus('Error playing audio.');
        elements.stopSpeakingButton.disabled = true;
        this.currentAudio = null;
        this.disableInputs(false);
    }

    handleTTSError(text, error) {
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
                this.handleAudioEnd();
            };

            this.currentAudio = {
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
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
            
            const elements = window.elements;
            elements.stopSpeakingButton.disabled = true;
            this.updateStatus('Playback stopped.');
            this.disableInputs(false);
        }
    }

    disableInputs(disabled) {
        const elements = window.elements;
        elements.startRecordingButton.disabled = disabled;
        elements.sendButton.disabled = disabled;
        elements.userInput.disabled = disabled;
    }

    updateStatus(message) {
        const elements = window.elements;
        elements.statusMessage.textContent = message;
    }
}