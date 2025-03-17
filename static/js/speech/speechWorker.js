// Web Worker for speech processing
self.onmessage = async function(e) {
    const { action, data } = e.data;
    
    switch (action) {
        case 'processPunctuation':
            try {
                const response = await fetch('/api/punctuate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: data.text })
                });
                const result = await response.json();
                self.postMessage({ action: 'punctuationComplete', text: result.text });
            } catch (error) {
                self.postMessage({ action: 'error', error: error.message });
            }
            break;
            
        case 'processMetadata':
            const metadata = analyzeSpeechMetadata(data);
            self.postMessage({ action: 'metadataComplete', metadata });
            break;
    }
};

function analyzeSpeechMetadata(data) {
    const {transcript, startTime, endTime} = data;
    const elapsedTimeMs = endTime - startTime;
    const elapsedTimeSeconds = elapsedTimeMs / 1000;
    
    const words = transcript.trim().split(/\s+/);
    const wordCount = words.length;
    const wordsPerMinute = Math.round((wordCount / elapsedTimeSeconds) * 60);
    
    const hesitationMarkers = (transcript.match(/um|uh|er|hmm|like|you know/gi) || []).length;
    
    let repeatedWords = 0;
    for (let i = 1; i < words.length; i++) {
        if (words[i].toLowerCase() === words[i-1].toLowerCase()) {
            repeatedWords++;
        }
    }
    
    return {
        timestamp: new Date().toISOString(),
        durationSeconds: elapsedTimeSeconds.toFixed(2),
        wordCount: wordCount,
        wordsPerMinute: wordsPerMinute,
        hesitationMarkers: hesitationMarkers,
        repeatedWords: repeatedWords
    };
}