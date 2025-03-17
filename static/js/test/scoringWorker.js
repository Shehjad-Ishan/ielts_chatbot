self.onmessage = async function(e) {
    const { action, data } = e.data;
    
    switch (action) {
        case 'processScoring':
            try {
                const scoreData = await processScoring(data);
                self.postMessage({ 
                    action: 'scoringComplete', 
                    data: scoreData 
                });
            } catch (error) {
                self.postMessage({ 
                    action: 'error', 
                    data: { error: error.message } 
                });
            }
            break;
            
        case 'analyzeResponse':
            try {
                const analysis = analyzeResponse(data);
                self.postMessage({
                    action: 'analysisComplete',
                    data: analysis
                });
            } catch (error) {
                self.postMessage({
                    action: 'error',
                    data: { error: error.message }
                });
            }
            break;
    }
};

async function processScoring(data) {
    const { responses, metadata } = data;
    
    // Analyze responses for scoring criteria
    const fluencyScore = analyzeFluency(responses, metadata);
    const lexicalScore = analyzeLexical(responses);
    const grammaticalScore = analyzeGrammatical(responses);
    const pronunciationScore = analyzePronunciation(metadata);
    
    // Calculate overall band score
    const overallScore = calculateOverallScore([
        fluencyScore,
        lexicalScore,
        grammaticalScore,
        pronunciationScore
    ]);
    
    return {
        fluency: fluencyScore,
        lexical: lexicalScore,
        grammatical: grammaticalScore,
        pronunciation: pronunciationScore,
        overall: overallScore,
        feedback: generateFeedback({
            fluencyScore,
            lexicalScore,
            grammaticalScore,
            pronunciationScore,
            metadata
        })
    };
}

function analyzeFluency(responses, metadata) {
    const avgWPM = calculateAverageWPM(metadata);
    const hesitationRatio = calculateHesitationRatio(metadata);
    const coherenceScore = analyzeCoherence(responses);
    
    // Score based on IELTS band descriptors
    let score = 9;
    
    if (avgWPM < 100 || hesitationRatio > 0.2) score--;
    if (avgWPM < 80 || hesitationRatio > 0.3) score--;
    if (avgWPM < 60 || hesitationRatio > 0.4) score--;
    
    return Math.max(score, 5);
}

function analyzeLexical(responses) {
    // Implementation of lexical resource analysis
    return 7; // Placeholder
}

function analyzeGrammatical(responses) {
    // Implementation of grammatical range analysis
    return 7; // Placeholder
}

function analyzePronunciation(metadata) {
    // Implementation of pronunciation analysis based on metadata
    return 7; // Placeholder
}

function calculateOverallScore(scores) {
    const sum = scores.reduce((a, b) => a + b, 0);
    return Math.round((sum / scores.length) * 2) / 2; // Round to nearest 0.5
}

function generateFeedback(data) {
    // Generate detailed feedback based on scores and metadata
    return {
        strengths: [],
        improvements: [],
        suggestions: []
    };
}

function analyzeResponse(data) {
    // Analyze individual response characteristics
    return {
        complexity: calculateComplexity(data),
        vocabulary: analyzeVocabulary(data),
        grammar: analyzeGrammarPatterns(data)
    };
}

// Helper functions
function calculateAverageWPM(metadata) {
    return metadata.reduce((sum, data) => sum + data.wordsPerMinute, 0) / metadata.length;
}

function calculateHesitationRatio(metadata) {
    const totalWords = metadata.reduce((sum, data) => sum + data.wordCount, 0);
    const totalHesitations = metadata.reduce((sum, data) => sum + data.hesitationMarkers, 0);
    return totalHesitations / totalWords;
}

function analyzeCoherence(responses) {
    // Analyze response coherence
    return 7; // Placeholder
}

function calculateComplexity(data) {
    // Calculate linguistic complexity
    return 0.75; // Placeholder
}

function analyzeVocabulary(data) {
    // Analyze vocabulary usage
    return {
        diversity: 0.8,
        sophistication: 0.7
    };
}

function analyzeGrammarPatterns(data) {
    // Analyze grammar patterns
    return {
        accuracy: 0.8,
        complexity: 0.7
    };
}