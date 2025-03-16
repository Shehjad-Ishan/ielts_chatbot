// app.js - Frontend JavaScript logic for Flask backend

// Configuration
let config = {
    conversationModel: 'gemma3:12b',
    scoringModel: 'gemma3:12b',
    ollamaEndpoint: 'http://localhost:11434',
    currentTestPart: 1,
    testActive: false,
    timerInterval: null,
    timerSeconds: 0,
    lastTimerValue: 0,
    recognition: null,
    currentAudio: null,  // Track current playing audio
    messageSent: false,  // Flag to track if a message has been sent
    testPrompts: {
        systemPrompt: `You are an IELTS speaking examiner. You should evaluate the student's English speaking ability 
                      according to the IELTS criteria: Fluency and Coherence, Lexical Resource, Grammatical Range 
                      and Accuracy, and Pronunciation. Keep your responses concise and natural like a real examiner. 
                      Do not provide scores during the test, only at the end when explicitly asked.`,
        scoringPrompt: `Please analyze my complete speaking performance throughout this conversation and provide IELTS scores for:
                      1. Fluency and Coherence: Evaluate logical flow, topic development, and coherence of ideas.
                      2. Lexical Resource: Assess vocabulary range, appropriateness, and accuracy.
                      3. Grammatical Range and Accuracy: Judge grammatical structures and correctness.
                      4. Pronunciation: While you cannot hear my pronunciation directly, try to evaluate based on my choice of words and any metadata about my speech.
                      
                      Provide a score out of 9 for each category and an overall band score, with detailed feedback.`,
        part1: {
            intro: "Good morning/afternoon. My name is Aditi. Can you tell me your full name, please? Now, I'd like to ask you some questions about yourself.",
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
    },
    speechMetadata: []
};

// DOM Elements
const chatContainer = document.getElementById('chatContainer');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const startRecordingButton = document.getElementById('startRecordingButton');
const stopRecordingButton = document.getElementById('stopRecordingButton');
const stopSpeakingButton = document.getElementById('stopSpeakingButton');
const scoreButton = document.getElementById('scoreButton');
const statusMessage = document.getElementById('statusMessage');
const timerElement = document.getElementById('timer');
const startTestButton = document.getElementById('startTestButton');
const testPartSelector = document.getElementById('testPartSelector');
const saveSettingsButton = document.getElementById('saveSettingsButton');
const conversationModelInput = document.getElementById('conversationModel');
const scoringModelInput = document.getElementById('scoringModel');
const ollamaEndpointInput = document.getElementById('ollamaEndpoint');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeSpeechRecognition();
    attachEventListeners();
    loadSettings();
});

// Update the initializeSpeechRecognition function
function initializeSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        config.recognition = new SpeechRecognition();
        config.recognition.continuous = true;
        config.recognition.interimResults = true;
        config.recognition.lang = 'en-US';
        
        // Variables to track speech patterns
        let hasSpeechDetected = false;
        let silenceTimer = null;
        const SILENCE_THRESHOLD = 60000; // 1 minutes of silence to auto-submit
        let recordingStartTime = 0;
        config.pauseCount = 0;
        let lastSpeechTimestamp = 0;
        
        // Add a variable to track the temporary message element
        let tempMessageElement = null;
        
        // Add a variable to maintain the full transcript
        let fullTranscript = '';
        
        config.recognition.onstart = () => {
            updateStatus('Listening... Speak now.');
            hasSpeechDetected = false;
            recordingStartTime = Date.now();
            lastSpeechTimestamp = recordingStartTime;
            config.pauseCount = 0;
            config.lastTimerValue = config.timerSeconds;
            fullTranscript = ''; // Reset full transcript
            config.messageSent = false; // Reset message sent flag
            
            startRecordingButton.disabled = true;
            stopRecordingButton.disabled = false;
            
            // Create a temporary message element for live transcript
            tempMessageElement = document.createElement('div');
            tempMessageElement.classList.add('message', 'user', 'temp-message');
            tempMessageElement.textContent = '...'; // Placeholder text
            chatContainer.appendChild(tempMessageElement);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        };
        
        config.recognition.onresult = (event) => {
            // This is the critical change - we need to handle all results, not just the first one
            // The event.results object is a SpeechRecognitionResultList
            fullTranscript = '';
            
            // Loop through all results and accumulate them
            for (let i = 0; i < event.results.length; i++) {
                // Check if this result is final
                if (event.results[i].isFinal) {
                    fullTranscript += event.results[i][0].transcript + ' ';
                } else {
                    // Add interim results too, but they might change
                    fullTranscript += event.results[i][0].transcript + ' ';
                }
            }
            
            // Clean up the transcript
            fullTranscript = fullTranscript.trim();
            
            // Update UI
            userInput.value = fullTranscript;
            
            // Update the temporary message element with the current transcript
            if (tempMessageElement) {
                tempMessageElement.textContent = fullTranscript;
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
            
            // Track speech patterns
            const currentTime = Date.now();
            if (!hasSpeechDetected) {
                hasSpeechDetected = true;
            } else if (currentTime - lastSpeechTimestamp > 1500) {
                // Count as a pause if more than 1.5 seconds between speech segments
                config.pauseCount++;
            }
            lastSpeechTimestamp = currentTime;
            
            // Reset silence timer when new speech is detected
            if (silenceTimer) {
                clearTimeout(silenceTimer);
            }
            
            // Set a new silence timer
            silenceTimer = setTimeout(() => {
                if (hasSpeechDetected && !config.messageSent) {
                    const transcriptToProcess = fullTranscript;
                    // Remove the temporary element since we're going to add the final message
                    if (tempMessageElement) {
                        tempMessageElement.remove();
                        tempMessageElement = null;
                    }
                    config.messageSent = true; // Mark that we're sending a message
                    stopRecording();
                    
                    // Update the input field with the full transcript before sending
                    userInput.value = transcriptToProcess;
                    
                    sendMessage();
                    // Collect metadata asynchronously after sending the message
                    setTimeout(() => {
                        collectSpeechMetadata(transcriptToProcess, recordingStartTime);
                    }, 0);
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
            
            // Auto-send if speech was detected and we have transcript AND a message hasn't been sent yet
            if (hasSpeechDetected && fullTranscript.trim() !== '' && !config.messageSent) {
                const transcriptToProcess = fullTranscript;
                
                // Remove the temporary element since we're going to add the final message
                if (tempMessageElement) {
                    tempMessageElement.remove();
                    tempMessageElement = null;
                }
                
                config.messageSent = true; // Mark that we're sending a message
                
                // Update the input field with the full transcript before sending
                userInput.value = transcriptToProcess;
                
                sendMessage();
                // Collect metadata asynchronously after sending the message
                setTimeout(() => {
                    collectSpeechMetadata(transcriptToProcess, recordingStartTime);
                }, 0);
            } else {
                // If no speech was detected or the recording was stopped manually,
                // remove the temporary message element
                if (tempMessageElement) {
                    tempMessageElement.remove();
                    tempMessageElement = null;
                }
            }
        };
        
        config.recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            updateStatus('Error with speech recognition: ' + event.error);
            
            // Clean up temporary message element on error
            if (tempMessageElement) {
                tempMessageElement.remove();
                tempMessageElement = null;
            }
            
            stopRecording();
        };
    } else {
        updateStatus('Speech recognition is not supported in your browser.');
        startRecordingButton.disabled = true;
    }
}

// Update the stopRecording function to handle the temporary message element
function stopRecording() {
    if (config.recognition) {
        try {
            config.recognition.stop();
            // Button states are now handled in the onend event
        } catch (error) {
            console.error('Error stopping recognition', error);
            updateStatus('Error stopping speech recognition.');
            
            // Clean up any temporary message element if there's an error
            const tempMessage = document.querySelector('.temp-message');
            if (tempMessage) {
                tempMessage.remove();
            }
        }
    }
}

// Collect speech metadata for fluency analysis - now asynchronous
function collectSpeechMetadata(transcript, startTime) {
    // Use setTimeout with 0 delay to push this task to the end of the event queue
    setTimeout(() => {
        const elapsedTimeMs = Date.now() - startTime;
        const elapsedTimeSeconds = elapsedTimeMs / 1000;
        
        // Calculate words per minute
        const words = transcript.trim().split(/\s+/);
        const wordCount = words.length;
        const wordsPerMinute = Math.round((wordCount / elapsedTimeSeconds) * 60);
        
        // Count hesitation markers
        const hesitationMarkers = (transcript.match(/um|uh|er|hmm|like|you know/gi) || []).length;
        
        // Count repeated words
        let repeatedWords = 0;
        for (let i = 1; i < words.length; i++) {
            if (words[i].toLowerCase() === words[i-1].toLowerCase()) {
                repeatedWords++;
            }
        }
        
        // Store metadata
        const metadata = {
            timestamp: new Date().toISOString(),
            durationSeconds: elapsedTimeSeconds.toFixed(2),
            wordCount: wordCount,
            wordsPerMinute: wordsPerMinute,
            hesitationMarkers: hesitationMarkers,
            repeatedWords: repeatedWords,
            silencesCount: config.pauseCount
        };
        
        config.speechMetadata.push(metadata);
        console.log("Speech metadata collected asynchronously:", metadata);
    }, 0);
}

// Event Listeners
function attachEventListeners() {
    sendButton.addEventListener('click', () => sendMessage());
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    startRecordingButton.addEventListener('click', startRecording);
    stopRecordingButton.addEventListener('click', stopRecording);
    stopSpeakingButton.addEventListener('click', stopSpeaking);
    scoreButton.addEventListener('click', requestScoring);
    
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
            // Make sure we're not already speaking
            if (config.currentAudio) {
                stopSpeaking();
            }
            
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

// Stop Speaking (TTS playback) with improved UI handling
function stopSpeaking() {
    if (config.currentAudio) {
        config.currentAudio.pause();
        config.currentAudio.currentTime = 0;
        config.currentAudio = null;
        
        stopSpeakingButton.disabled = true;
        updateStatus('Playback stopped.');
        
        // Re-enable UI elements after manually stopping speech
        startRecordingButton.disabled = false;
        sendButton.disabled = false;
        userInput.disabled = false;
    }
}

// Request scoring using the scoring model
function requestScoring() {
    const metadataSummary = generateMetadataSummary();
    const scoringPrompt = config.testPrompts.scoringPrompt + "\n\n" + metadataSummary;
    
    updateStatus('Generating IELTS scores using ' + config.scoringModel + '...');
    
    // Add a system message for scoring
    addMessage("Please evaluate my speaking test performance and provide scores.", 'user');
    
    // Call sendMessage with the scoring flag
    sendMessage(true, scoringPrompt);
}

// Generate a summary of speech metadata for scoring
function generateMetadataSummary() {
    if (config.speechMetadata.length === 0) {
        return "No speech metadata available.";
    }
    
    let totalWords = 0;
    let totalDuration = 0;
    let totalHesitations = 0;
    let totalRepeatedWords = 0;
    
    config.speechMetadata.forEach(data => {
        totalWords += data.wordCount;
        totalDuration += parseFloat(data.durationSeconds);
        totalHesitations += data.hesitationMarkers;
        totalRepeatedWords += data.repeatedWords;
    });
    
    const avgWPM = Math.round((totalWords / totalDuration) * 60);
    
    return `Speech Metadata Summary:
- Total responses: ${config.speechMetadata.length}
- Average speaking rate: ${avgWPM} words per minute
- Total hesitation markers: ${totalHesitations}
- Repeated words: ${totalRepeatedWords}
- Speaking fluidity: ${totalHesitations <= 5 ? "Very fluid" : totalHesitations <= 15 ? "Moderately fluid" : "Less fluid with noticeable hesitations"}`;
}

// Send Message to Ollama via Flask backend
async function sendMessage(isScoring = false, customPrompt = null) {
    // If we have a custom prompt, use it, otherwise get the user input
    const userMessage = customPrompt || userInput.value.trim();
    
    if (!userMessage) return;
    
    // Only add the message to the chat if it's not a scoring request with custom prompt
    if (!isScoring || !customPrompt) {
        addMessage(userMessage, 'user');
    }
    
    userInput.value = '';
    updateStatus(`Waiting for response using ${isScoring ? config.scoringModel : config.conversationModel}...`);
    
    // Add a timeout to prevent the function from hanging indefinitely
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out after 30 seconds')), 120000);
    });
    
    try {
        // Get conversation history for context
        const history = getConversationHistory();
        
        // Prepare the prompt
        const systemPrompt = config.testPrompts.systemPrompt;
        
        // Choose which model to use
        const modelToUse = isScoring ? config.scoringModel : config.conversationModel;
        
        // Prepare the API request
        const fetchPromise = fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: modelToUse,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...history,
                    { role: 'user', content: userMessage }
                ],
                endpoint: config.ollamaEndpoint
            })
        });
        
        // Race the fetch request against the timeout
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        const examinerResponse = data.response;
        
        addMessage(examinerResponse, 'examiner');
        
        // Only speak the response if it's not a scoring request
        if (!isScoring) {
            speakText(examinerResponse);
        } else {
            updateStatus('Scoring complete.');
        }
        
    } catch (error) {
        console.error('Error calling API:', error);
        updateStatus(`Error: ${error.message}. Please try again with a shorter response or check your connection.`);
        
        // Enable UI elements that might have been disabled
        startRecordingButton.disabled = false;
        sendButton.disabled = false;
        userInput.disabled = false;
    }
}

// Text to Speech function with improved UI handling and optimized performance
async function speakText(text) {
    updateStatus('Generating speech...');

    // Parallelize the TTS request and UI updates
    const ttsPromise = fetch('/api/tts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text: text,
            voice: 'default'
        })
    });

    // Disable UI elements while the examiner is speaking
    startRecordingButton.disabled = true;
    sendButton.disabled = true;
    userInput.disabled = true;

    // Enable the stop speaking button
    stopSpeakingButton.disabled = false;

    try {
        const response = await ttsPromise;

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        // Create an audio element and play the speech
        const audio = new Audio(`data:audio/wav;base64,${data.audio}`);

        // Store the audio element in the config
        config.currentAudio = audio;

        audio.onplay = () => {
            updateStatus('Examiner is speaking...');
        };

        audio.onended = () => {
            updateStatus('Ready for your response.');
            stopSpeakingButton.disabled = true;
            config.currentAudio = null;

            // Re-enable UI elements after speech completes
            startRecordingButton.disabled = false;
            sendButton.disabled = false;
            userInput.disabled = false;
        };

        audio.onerror = () => {
            updateStatus('Error playing audio.');
            stopSpeakingButton.disabled = true;
            config.currentAudio = null;

            // Re-enable UI elements if there's an error
            startRecordingButton.disabled = false;
            sendButton.disabled = false;
            userInput.disabled = false;
        };

        audio.play();

    } catch (error) {
        console.error('Error with TTS:', error);
        updateStatus('Error generating speech. Falling back to browser TTS.');

        // Fallback to browser TTS if the server TTS fails
        if ('speechSynthesis' in window) {
            const speech = new SpeechSynthesisUtterance(text);
            speech.lang = 'en-US';
            speech.rate = 0.9;
            speech.pitch = 1;

            speech.onstart = () => {
                updateStatus('Examiner is speaking (using browser TTS)...');
            };

            speech.onend = () => {
                updateStatus('Ready for your response.');
                stopSpeakingButton.disabled = true;

                // Re-enable UI elements after speech completes
                startRecordingButton.disabled = false;
                sendButton.disabled = false;
                userInput.disabled = false;
            };

            // For browser TTS, we need to handle stopping differently
            config.currentAudio = {
                pause: () => {
                    window.speechSynthesis.cancel();
                },
                currentTime: 0  // Dummy property for consistency
            };

            window.speechSynthesis.speak(speech);
        }
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
    config.speechMetadata = [];
    config.messageSent = false; // Reset message sent flag
    
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
    
    // Enable the score button when the test starts
    scoreButton.disabled = false;
}

// Save Settings
function saveSettings() {
    config.conversationModel = conversationModelInput.value.trim();
    config.scoringModel = scoringModelInput.value.trim();
    config.ollamaEndpoint = ollamaEndpointInput.value.trim();
    
    localStorage.setItem('ieltsExaminerSettings', JSON.stringify({
        conversationModel: config.conversationModel,
        scoringModel: config.scoringModel,
        ollamaEndpoint: config.ollamaEndpoint
    }));
    
    updateStatus('Settings saved successfully.');
}

// Load Settings
function loadSettings() {
    const savedSettings = localStorage.getItem('ieltsExaminerSettings');
    if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        config.conversationModel = parsedSettings.conversationModel || 'gemma3:12b';
        config.scoringModel = parsedSettings.scoringModel || 'gemma3:12b';
        config.ollamaEndpoint = parsedSettings.ollamaEndpoint || 'http://localhost:11434';
        
        conversationModelInput.value = config.conversationModel;
        scoringModelInput.value = config.scoringModel;
        ollamaEndpointInput.value = config.ollamaEndpoint;
    }
}