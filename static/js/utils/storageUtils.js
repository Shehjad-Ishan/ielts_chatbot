export function saveSettings(config) {
    const settings = {
        conversationModel: config.conversationModel,
        scoringModel: config.scoringModel,
        ollamaEndpoint: config.ollamaEndpoint
    };
    
    localStorage.setItem('ieltsExaminerSettings', JSON.stringify(settings));
    updateStatus('Settings saved successfully.');
}

export function loadSettings(config) {
    const savedSettings = localStorage.getItem('ieltsExaminerSettings');
    if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        Object.assign(config, {
            conversationModel: parsedSettings.conversationModel || 'gemma3:12b',
            scoringModel: parsedSettings.scoringModel || 'gemma3:12b',
            ollamaEndpoint: parsedSettings.ollamaEndpoint || 'http://localhost:11434'
        });
        
        updateFormFields(config);
    }
}

function updateFormFields(config) {
    const elements = window.elements;
    elements.conversationModelInput.value = config.conversationModel;
    elements.scoringModelInput.value = config.scoringModel;
    elements.ollamaEndpointInput.value = config.ollamaEndpoint;
}

function updateStatus(message) {
    document.getElementById('statusMessage').textContent = message;
}