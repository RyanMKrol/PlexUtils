import chalk from 'chalk';

/**
 * Rate limiter class to handle API request throttling
 */
export class RateLimiter {
  constructor(maxRequestsPerSecond = 30) {
    this.maxRequestsPerSecond = maxRequestsPerSecond;
    this.requests = [];
    this.running = 0;
    this.queue = [];
  }
  
  /**
   * Execute a function with rate limiting
   * @param {Function} fn - Function to execute
   * @returns {Promise} Promise that resolves when function completes
   */
  async execute(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }
  
  processQueue() {
    if (this.queue.length === 0 || this.running >= this.maxRequestsPerSecond) {
      return;
    }
    
    const now = Date.now();
    // Remove requests older than 1 second
    this.requests = this.requests.filter(time => now - time < 1000);
    
    if (this.requests.length >= this.maxRequestsPerSecond) {
      // Wait until we can make another request
      const oldestRequest = Math.min(...this.requests);
      const waitTime = 1000 - (now - oldestRequest);
      setTimeout(() => this.processQueue(), waitTime + 1);
      return;
    }
    
    const { fn, resolve, reject } = this.queue.shift();
    this.requests.push(now);
    this.running++;
    
    fn()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        this.running--;
        // Process next item in queue after a small delay
        setTimeout(() => this.processQueue(), 10);
      });
    
    // Try to process more items immediately
    setTimeout(() => this.processQueue(), 0);
  }
}

/**
 * Retry function with exponential backoff for API calls
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries (default: 5)
 * @param {string} context - Context for logging (e.g., show name)
 * @returns {Promise} Result of the function or throws after max retries
 */
export async function retryWithBackoff(fn, maxRetries = 5, context = 'API call') {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimit = error.status === 429 || error.message.includes('rate limit') || error.message.includes('429');
      
      if (!isRateLimit || attempt === maxRetries) {
        // If not a rate limit error, or we've exhausted retries, throw the error
        throw error;
      }
      
      // Calculate exponential backoff delay (1s, 2s, 4s, 8s, 16s, max 60s)
      const baseDelay = 1000; // 1 second base
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 60000); // Max 60 seconds
      
      console.log(chalk.yellow(`⚠️  Rate limit hit for ${context} (attempt ${attempt}/${maxRetries})`));
      console.log(chalk.gray(`   🕒 Waiting ${delay / 1000} seconds before retry...`));
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}