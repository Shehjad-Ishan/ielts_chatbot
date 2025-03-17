import { defaultConfig, testPrompts } from './config.js';
import { SpeechRecognitionManager } from './speech/recognition.js';
import { SpeechSynthesisManager } from './speech/synthesis.js';
import { MessageHandler } from './chat/messageHandler.js';
import { TestManager } from './test/testManager.js';
import { initializeDOMElements, attachEventListeners } from './utils/domUtils.js';
import { loadSettings, saveSettings } from './utils/storageUtils.js';

class IELTSExaminer {
    constructor() {
        this.config = { ...defaultConfig };
        this.config.testPrompts = testPrompts;
        
        this.initialize();
    }

    async initialize() {
        // Initialize DOM elements
        initializeDOMElements();
        
        // Load saved settings
        loadSettings(this.config);
        
        // Initialize components
        this.speechRecognition = new SpeechRecognitionManager(this.config);
        this.speechSynthesis = new SpeechSynthesisManager(this.config);
        this.messageHandler = new MessageHandler(this.config);
        this.testManager = new TestManager(this.config);
        
        // Initialize speech recognition
        const recognitionAvailable = this.speechRecognition.initialize();
        if (!recognitionAvailable) {
            this.handleSpeechRecognitionUnavailable();
        }
        
        // Attach event listeners
        this.attachEventListeners();
        
        // Initialize Web Workers
        this.initializeWorkers();
        
        // Ready state
        this.updateStatus('Ready to start test.');
    }

    handleSpeechRecognitionUnavailable() {
        const elements = window.elements;
        elements.startRecordingButton.disabled = true;
        elements.stopRecordingButton.disabled = true;
        this.updateStatus('Speech recognition is not supported in your browser.');
    }

    attachEventListeners() {
        // Attach general event listeners
        attachEventListeners(this);
        
        // Attach component-specific event listeners
        this.attachComponentListeners();
    }

    attachComponentListeners() {
        const elements = window.elements;
        
        // Settings listeners
        elements.saveSettingsButton.addEventListener('click', () => {
            this.updateConfig();
            saveSettings(this.config);
        });
        
        // Speech control listeners
        elements.stopSpeakingButton.addEventListener('click', () => {
            this.speechSynthesis.stopSpeaking();
        });
        
        // Custom event listeners
        window.addEventListener('synthesisComplete', (e) => {
            this.handleSynthesisComplete(e.detail);
        });
        
        window.addEventListener('recognitionError', (e) => {
            this.handleRecognitionError(e.detail);
        });
    }

    initializeWorkers() {
        // Initialize Web Workers if browser supports them
        if (window.Worker) {
            this.speechWorker = new Worker('./js/speech/speechWorker.js');
            this.chatWorker = new Worker('./js/chat/chatWorker.js');
            this.scoringWorker = new Worker('./js/test/scoringWorker.js');
            
            this.setupWorkerListeners();
        } else {
            console.warn('Web Workers not supported. Some features may be limited.');
        }
    }

    setupWorkerListeners() {
        // Speech Worker
        this.speechWorker.onmessage = (e) => {
            const { action, data } = e.data;
            switch (action) {
                case 'punctuationComplete':
                    this.handlePunctuationComplete(data);
                    break;
                case 'metadataComplete':
                    this.handleMetadataComplete(data);
                    break;
            }
        };
        
        // Chat Worker
        this.chatWorker.onmessage = (e) => {
            const { action, data } = e.data;
            switch (action) {
                case 'messageComplete':
                    this.handleMessageComplete(data);
                    break;
            }
        };
        
        // Scoring Worker
        this.scoringWorker.onmessage = (e) => {
            const { action, data } = e.data;
            switch (action) {
                case 'scoringComplete':
                    this.handleScoringComplete(data);
                    break;
            }
        };
    }

    updateConfig() {
        const elements = window.elements;
        this.config.conversationModel = elements.conversationModelInput.value.trim();
        this.config.scoringModel = elements.scoringModelInput.value.trim();
        this.config.ollamaEndpoint = elements.ollamaEndpointInput.value.trim();
    }

    // Event Handlers
    handlePunctuationComplete(data) {
        this.messageHandler.sendMessage(data.text);
    }

    handleMetadataComplete(data) {
        this.config.speechMetadata.push(data);
    }

    handleMessageComplete(data) {
        if (data.isScoring) {
            this.updateStatus('Scoring complete.');
        } else {
            this.speechSynthesis.speakText(data.response);
        }
    }

    handleScoringComplete(data) {
        this.testManager.displayScores(data);
    }

    handleSynthesisComplete(data) {
        if (data.error) {
            this.updateStatus('Error in speech synthesis: ' + data.error);
        }
    }

    handleRecognitionError(error) {
        this.updateStatus('Speech recognition error: ' + error);
    }

    updateStatus(message) {
        const elements = window.elements;
        elements.statusMessage.textContent = message;
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new IELTSExaminer();
});