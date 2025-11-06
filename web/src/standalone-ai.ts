// Standalone AI service - always accessible, even without terminal
import { getWebLLMService, WebLLMService } from './backend-webllm';
import { notificationManager } from './components/notification';

// Global AI service instance
let globalAIService: WebLLMService | null = null;
let isInitializing: boolean = false;

/**
 * Get or initialize the global AI service
 */
export async function getGlobalAIService(): Promise<WebLLMService> {
  if (globalAIService && globalAIService.isReady()) {
    return globalAIService;
  }

  // If already initializing, wait for it
  if (isInitializing) {
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (globalAIService) {
      return globalAIService;
    }
  }

  // Initialize
  isInitializing = true;
  try {
    globalAIService = getWebLLMService();
    await globalAIService.initialize();
    console.log('[StandaloneAI] AI service initialized successfully');
    isInitializing = false;
    return globalAIService;
  } catch (error) {
    isInitializing = false;
    console.error('[StandaloneAI] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Check if AI is ready
 */
export function isAIReady(): boolean {
  return globalAIService !== null && globalAIService.isReady();
}

/**
 * Chat with AI (standalone, no terminal required)
 */
export async function chatWithAI(message: string, onProgress?: (text: string) => void): Promise<string> {
  try {
    const ai = await getGlobalAIService();
    return await ai.chat([{ role: 'user', content: message }], onProgress);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`AI chat failed: ${errorMsg}`);
  }
}

/**
 * Initialize AI service in background (non-blocking)
 */
export function initializeAIBackground(): void {
  getGlobalAIService().catch(error => {
    console.warn('[StandaloneAI] Background initialization failed:', error);
    notificationManager.warning('AI service initialization failed. Will retry when needed.');
  });
}

// Auto-initialize in background when module loads
if (typeof window !== 'undefined') {
  // Initialize after a short delay to not block page load
  setTimeout(() => {
    initializeAIBackground();
  }, 1000);
}

