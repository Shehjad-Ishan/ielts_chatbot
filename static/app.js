// app.js - Frontend JavaScript logic for Flask backend

// Configuration
let config = {
    ollamaModel: 'llama3',
    ollamaEndpoint: 'http://localhost:11434',
    currentTestPart: 1,
    testActive: false,
    timerInterval: null,
    timerSeconds: 0,
    recognition: null,
    testPrompts: {
        systemPrompt: `You are an IELTS speaking examiner. You should evaluate the student's English speaking ability 
                      according to the IELTS criteria: Fluency and Coherence, Lexical Resource, Grammatical Range 
                      and Accuracy, and Pronunciation. Keep your responses concise and natural like a real examiner. 
                      Do not provide scores during the test, only at the end when explicitly asked.`,
        part1: {
            intro: "Good morning/afternoon. My name is [Examiner]. Can you tell me your full name, please? Now, I'd like to ask you some questions about yourself.",
            topics: [
                "Can you describe your hometown?",
                "Do you work or are you a student?",
                "What do you enjoy doing in your free time?",
                "Do you prefer indoor or outdoor activities?",
                "What kind of music do you like to listen to?",
                "Do you enjoy cooking?"
            ]
        },
        part2: {
            intro: "I'm going to give you a topic and I'd like you to talk about it for 1 to 2 minutes. Before you start, you'll have one minute to prepare. Here's some paper and a pencil for making notes, and here's your topic:",
            topics: [
                "Describe a book you have recently read. You should say: what kind of book it is, what it is about, why you decided to read it, and explain why you liked or disliked it.",
                "Describe a place you have visited that made a strong impression on you. You should say: where it is, when you went there, what you did there, and explain why it made such a strong impression on you.",
                "Describe a skill you would like to learn. You should say: what the skill is, how you would learn it, how long it would take to learn, and explain why you want to learn this skill."
            ]
        },
        part3: {
            intro: "Now let's discuss some more general questions related to this topic.",
            topics: {
                "books": [
                    "How have reading habits changed in your country in recent years?",
                    "Do you think digital books will eventually replace printed books?",
                    "What kinds of books are most popular in your country?",
                    "How important is reading for a child's development?"
                ],
                "places": [
                    "What types of places do people from your country like to visit on vacation?",
                    "How has tourism changed in your country over the last few decades?",
                    "Do you think it's better to travel independently or as part of a tour group?",
                    "How might tourism affect local communities?"
                ],
                "skills": [
                    "Why do you think some people are reluctant to learn new skills?",
                    "How has technology changed the way people learn new skills?",
                    "What skills do you think will be most important in the future?",
                    "Should schools focus more on practical skills rather than academic knowledge?"
                ]
            }
        },
        conclusion: "Thank you. That's the end of the speaking test."
    }
};

// DOM Elements
const chatContainer = document.getElementById('chatContainer');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const startRecordingButton = document.getElementById('startRecordingButton');
const stopRecordingButton = document.getElementById('stopRecordingButton');
const statusMessage = document.getElementById('statusMessage');
const timerElement = document.getElementById('timer');
const startTestButton = document.getElementById('startTestButton');
const testPartSelector = document.getElementById('testPartSelector');
const saveSettingsButton = document.getElementById('saveSettingsButton');
const ollamaModelInput = document.getElementById('ollamaModel');
const ollamaEndpointInput = document.getElementById('ollamaEndpoint');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeSpeechRecognition();
    attachEventListeners();
    loadSettings();
});

// Initialize Speech Recognition
function initializeSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        config.recognition = new SpeechRecognition();
        config.recognition.continuous = false; // Changed to false for single utterance
        config.recognition.interimResults = true;
        config.recognition.lang = 'en-US';
        
        // Variable to track if speech has been detected
        let hasSpeechDetected = false;
        let silenceTimer = null;
        const SILENCE_THRESHOLD = 2000; // 2 seconds of silence to auto-submit
        
        config.recognition.onstart = () => {
            updateStatus('Listening... Speak now.');
            hasSpeechDetected = false;
            startRecordingButton.disabled = true;
            stopRecordingButton.disabled = false;
        };
        
        config.recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0])
                .map(result => result.transcript)
                .join('');
                
            userInput.value = transcript;
            hasSpeechDetected = true;
            
            // Reset silence timer when new speech is detected
            if (silenceTimer) {
                clearTimeout(silenceTimer);
            }
            
            // Set a new silence timer
            silenceTimer = setTimeout(() => {
                if (hasSpeechDetected) {
                    stopRecording();
                    sendMessage();
                }
            }, SILENCE_THRESHOLD);
        };
        
        config.recognition.onend = () => {
            startRecordingButton.disabled = false;
            stopRecordingButton.disabled = true;
            updateStatus('Recording stopped.');
            
            // Clear any pending silence timer
            if (silenceTimer) {
                clearTimeout(silenceTimer);
            }
            
            // Auto-send if speech was detected and the recognition ended naturally
            if (hasSpeechDetected && userInput.value.trim() !== '') {
                sendMessage();
            }
        };
        
        config.recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            updateStatus('Error with speech recognition: ' + event.error);
            stopRecording();
        };
    } else {
        updateStatus('Speech recognition is not supported in your browser.');
        startRecordingButton.disabled = true;
    }
}

// Update the startRecording function
function startRecording() {
    if (config.recognition) {
        try {
            // Clear the input field when starting new recording
            userInput.value = '';
            config.recognition.start();
            // Button states are now handled in the onstart event
        } catch (error) {
            console.error('Error starting recognition', error);
            updateStatus('Error starting speech recognition.');
        }
    }
}

// Update the stopRecording function
function stopRecording() {
    if (config.recognition) {
        try {
            config.recognition.stop();
            // Button states are now handled in the onend event
        } catch (error) {
            console.error('Error stopping recognition', error);
            updateStatus('Error stopping speech recognition.');
        }
    }
}
// Event Listeners
function attachEventListeners() {
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    startRecordingButton.addEventListener('click', startRecording);
    stopRecordingButton.addEventListener('click', stopRecording);
    
    startTestButton.addEventListener('click', startTest);
    testPartSelector.addEventListener('change', (e) => {
        config.currentTestPart = parseInt(e.target.value);
    });
    
    saveSettingsButton.addEventListener('click', saveSettings);
}

// Start Recording
function startRecording() {
    if (config.recognition) {
        try {
            config.recognition.start();
            startRecordingButton.disabled = true;
            stopRecordingButton.disabled = false;
            updateStatus('Listening... Speak now.');
        } catch (error) {
            console.error('Error starting recognition', error);
            updateStatus('Error starting speech recognition.');
        }
    }
}

// Stop Recording
function stopRecording() {
    if (config.recognition) {
        try {
            config.recognition.stop();
            startRecordingButton.disabled = false;
            stopRecordingButton.disabled = true;
            updateStatus('Recording stopped.');
        } catch (error) {
            console.error('Error stopping recognition', error);
            updateStatus('Error stopping speech recognition.');
        }
    }
}

// Send Message to Ollama via Flask backend
async function sendMessage() {
    if (!userInput.value.trim()) return;
    
    const userMessage = userInput.value.trim();
    addMessage(userMessage, 'user');
    userInput.value = '';
    
    updateStatus('Waiting for examiner response...');
    
    try {
        // Get conversation history for context
        const history = getConversationHistory();
        
        // Prepare the prompt for Ollama
        const systemPrompt = config.testPrompts.systemPrompt;
        
        // Make API call to Flask backend which will then call Ollama
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: config.ollamaModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...history,
                    { role: 'user', content: userMessage }
                ],
                endpoint: config.ollamaEndpoint
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        const examinerResponse = data.response;
        
        addMessage(examinerResponse, 'examiner');
        speakText(examinerResponse);
        updateStatus('Ready for your response.');
        
    } catch (error) {
        console.error('Error calling API:', error);
        updateStatus('Error getting response from the examiner. Please check your Ollama setup.');
    }
}

// Text to Speech
function speakText(text) {
    if ('speechSynthesis' in window) {
        const speech = new SpeechSynthesisUtterance(text);
        speech.lang = 'en-US';
        speech.rate = 0.9;  // Slightly slower for better comprehension
        speech.pitch = 1;
        window.speechSynthesis.speak(speech);
    } else {
        console.warn('Text-to-speech not supported in this browser');
    }
}

// Add Message to Chat
function addMessage(message, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);
    messageDiv.textContent = message;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Get Conversation History
function getConversationHistory() {
    const messages = [];
    const messageElements = chatContainer.querySelectorAll('.message');
    
    messageElements.forEach(element => {
        const role = element.classList.contains('user') ? 'user' : 'assistant';
        messages.push({
            role: role,
            content: element.textContent
        });
    });
    
    return messages;
}

// Update Status
function updateStatus(message) {
    statusMessage.textContent = message;
}

// Timer Functions
function startTimer() {
    timerElement.classList.remove('d-none');
    config.timerSeconds = 0;
    updateTimerDisplay();
    
    config.timerInterval = setInterval(() => {
        config.timerSeconds++;
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    if (config.timerInterval) {
        clearInterval(config.timerInterval);
        config.timerInterval = null;
    }
}

function updateTimerDisplay() {
    const minutes = Math.floor(config.timerSeconds / 60);
    const seconds = config.timerSeconds % 60;
    timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Start IELTS Test
function startTest() {
    chatContainer.innerHTML = '';
    config.testActive = true;
    
    startTimer();
    
    // Begin with appropriate introduction based on test part
    let introMessage = '';
    switch (config.currentTestPart) {
        case 1:
            introMessage = config.testPrompts.part1.intro;
            break;
        case 2:
            // Select a random topic for Part 2
            const part2Topic = config.testPrompts.part2.topics[
                Math.floor(Math.random() * config.testPrompts.part2.topics.length)
            ];
            introMessage = config.testPrompts.part2.intro + " " + part2Topic;
            break;
        case 3:
            // For part 3, we would normally select topics related to the part 2 topic
            // For simplicity, let's just use one of the topic sets
            const topicKeys = Object.keys(config.testPrompts.part3.topics);
            const selectedTopic = topicKeys[Math.floor(Math.random() * topicKeys.length)];
            introMessage = config.testPrompts.part3.intro + " " + 
                          config.testPrompts.part3.topics[selectedTopic][0];
            break;
    }
    
    addMessage(introMessage, 'examiner');
    speakText(introMessage);
    updateStatus('Test started. Please respond to the examiner.');
}

// Save Settings
function saveSettings() {
    config.ollamaModel = ollamaModelInput.value.trim();
    config.ollamaEndpoint = ollamaEndpointInput.value.trim();
    
    localStorage.setItem('ieltsExaminerSettings', JSON.stringify({
        ollamaModel: config.ollamaModel,
        ollamaEndpoint: config.ollamaEndpoint
    }));
    
    updateStatus('Settings saved successfully.');
}

// Load Settings
function loadSettings() {
    const savedSettings = localStorage.getItem('ieltsExaminerSettings');
    if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        config.ollamaModel = parsedSettings.ollamaModel;
        config.ollamaEndpoint = parsedSettings.ollamaEndpoint;
        
        ollamaModelInput.value = config.ollamaModel;
        ollamaEndpointInput.value = config.ollamaEndpoint;
    }
}