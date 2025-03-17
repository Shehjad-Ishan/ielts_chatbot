export function updateStatus(message) {
    document.getElementById('statusMessage').textContent = message;
}

export function initializeDOMElements() {
    // Cache DOM elements
    window.elements = {
        chatContainer: document.getElementById('chatContainer'),
        userInput: document.getElementById('userInput'),
        sendButton: document.getElementById('sendButton'),
        startRecordingButton: document.getElementById('startRecordingButton'),
        stopRecordingButton: document.getElementById('stopRecordingButton'),
        stopSpeakingButton: document.getElementById('stopSpeakingButton'),
        scoreButton: document.getElementById('scoreButton'),
        statusMessage: document.getElementById('statusMessage'),
        timerElement: document.getElementById('timer'),
        startTestButton: document.getElementById('startTestButton'),
        testPartSelector: document.getElementById('testPartSelector'),
        saveSettingsButton: document.getElementById('saveSettingsButton'),
        conversationModelInput: document.getElementById('conversationModel'),
        scoringModelInput: document.getElementById('scoringModel'),
        ollamaEndpointInput: document.getElementById('ollamaEndpoint')
    };
}

export function attachEventListeners(app) {
    const elements = window.elements;

    elements.sendButton.addEventListener('click', () => {
        const message = elements.userInput.value.trim();
        if (message) {
            app.messageHandler.sendMessage(message);
        }
    });

    elements.userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const message = elements.userInput.value.trim();
            if (message) {
                app.messageHandler.sendMessage(message);
            }
        }
    });

    window.addEventListener('speechComplete', (e) => {
        app.messageHandler.sendMessage(e.detail.transcript);
    });

    window.addEventListener('requestScoring', (e) => {
        app.messageHandler.sendMessage(e.detail.scoringPrompt, true);
    });

    // Other event listeners are handled in their respective classes
}