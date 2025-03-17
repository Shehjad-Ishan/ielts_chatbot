export class TestManager {
    constructor(config) {
        this.config = config;
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('startTestButton').addEventListener('click', () => this.startTest());
        document.getElementById('scoreButton').addEventListener('click', () => this.requestScoring());
        document.getElementById('testPartSelector').addEventListener('change', (e) => {
            this.config.currentTestPart = parseInt(e.target.value);
        });
    }

    startTest() {
        document.getElementById('chatContainer').innerHTML = '';
        this.config.testActive = true;
        this.config.speechMetadata = [];
        this.config.messageSent = false;
        
        this.startTimer();
        
        let introMessage = this.getIntroMessage();
        window.dispatchEvent(new CustomEvent('newMessage', {
            detail: { message: introMessage, sender: 'examiner' }
        }));
    }

    getIntroMessage() {
        switch (this.config.currentTestPart) {
            case 1:
                return this.config.testPrompts.part1.intro;
            case 2:
                const part2Topic = this.config.testPrompts.part2.topics[
                    Math.floor(Math.random() * this.config.testPrompts.part2.topics.length)
                ];
                return this.config.testPrompts.part2.intro + " " + part2Topic;
            case 3:
                const topicKeys = Object.keys(this.config.testPrompts.part3.topics);
                const selectedTopic = topicKeys[Math.floor(Math.random() * topicKeys.length)];
                return this.config.testPrompts.part3.intro + " " + 
                       this.config.testPrompts.part3.topics[selectedTopic][0];
            default:
                return this.config.testPrompts.part1.intro;
        }
    }

    startTimer() {
        const timerElement = document.getElementById('timer');
        timerElement.classList.remove('d-none');
        this.config.timerSeconds = 0;
        this.updateTimerDisplay();
        
        this.config.timerInterval = setInterval(() => {
            this.config.timerSeconds++;
            this.updateTimerDisplay();
        }, 1000);
    }

    updateTimerDisplay() {
        const timerElement = document.getElementById('timer');
        const minutes = Math.floor(this.config.timerSeconds / 60);
        const seconds = this.config.timerSeconds % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    stopTimer() {
        if (this.config.timerInterval) {
            clearInterval(this.config.timerInterval);
            this.config.timerInterval = null;
        }
    }

    requestScoring() {
        const metadataSummary = this.generateMetadataSummary();
        const scoringPrompt = this.config.testPrompts.scoringPrompt + "\n\n" + metadataSummary;
        
        window.dispatchEvent(new CustomEvent('requestScoring', {
            detail: { scoringPrompt }
        }));
    }

    generateMetadataSummary() {
        if (this.config.speechMetadata.length === 0) {
            return "No speech metadata available.";
        }
        
        let totalWords = 0;
        let totalDuration = 0;
        let totalHesitations = 0;
        let totalRepeatedWords = 0;
        
        this.config.speechMetadata.forEach(data => {
            totalWords += data.wordCount;
            totalDuration += parseFloat(data.durationSeconds);
            totalHesitations += data.hesitationMarkers;
            totalRepeatedWords += data.repeatedWords;
        });
        
        const avgWPM = Math.round((totalWords / totalDuration) * 60);
        
        return `Speech Metadata Summary:
- Total responses: ${this.config.speechMetadata.length}
- Average speaking rate: ${avgWPM} words per minute
- Total hesitation markers: ${totalHesitations}
- Repeated words: ${totalRepeatedWords}
- Speaking fluidity: ${this.getSpeakingFluidity(totalHesitations)}`;
    }

    getSpeakingFluidity(hesitations) {
        if (hesitations <= 5) return "Very fluid";
        if (hesitations <= 15) return "Moderately fluid";
        return "Less fluid with noticeable hesitations";
    }
}