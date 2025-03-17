// Web Worker for chat processing
self.onmessage = async function(e) {
    const { action, data } = e.data;
    
    if (action === 'sendMessage') {
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            const result = await response.json();
            self.postMessage({ 
                action: 'messageComplete', 
                data: {
                    response: result.response,
                    isScoring: data.messages[data.messages.length - 1].content.includes('evaluate my speaking test performance')
                }
            });
        } catch (error) {
            self.postMessage({ 
                action: 'error', 
                data: { error: error.message } 
            });
        }
    }
};