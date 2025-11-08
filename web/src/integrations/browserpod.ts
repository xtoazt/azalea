/**
 * BrowserPod Integration with Puppeteer
 * Browser-based runtime and container system enhanced with Puppeteer
 * https://github.com/leaningtech/browserpod-meta
 * https://github.com/puppeteer/puppeteer
 */

import type { BackendInterface } from './crosup';

export interface BrowserPodConfig {
  image?: string;
  command?: string[];
  env?: Record<string, string>;
  ports?: Record<number, number>;
  volumes?: Record<string, string>;
}

export interface PuppeteerBrowser {
  browserId: string;
  connected: boolean;
  pages: string[];
}

export interface PuppeteerPage {
  pageId: string;
  url: string;
  title: string;
}

export class BrowserPodIntegration {
  private isAvailable: boolean = false;
  private version: string | null = null;
  private backend: BackendInterface | null = null;
  private browsers: Map<string, PuppeteerBrowser> = new Map();
  private pages: Map<string, PuppeteerPage> = new Map();

  constructor(backend?: BackendInterface) {
    this.backend = backend || null;
    this.checkAvailability();
  }

  /**
   * Set backend instance
   */
  setBackend(backend: BackendInterface): void {
    this.backend = backend;
    this.checkAvailability();
  }

  /**
   * Check if BrowserPod/Puppeteer is available
   */
  async checkAvailability(): Promise<boolean> {
    if (!this.backend) {
      this.isAvailable = false;
      return false;
    }

    try {
      // Check if bridge server has Puppeteer endpoints
      const response = await fetch('http://127.0.0.1:8765/api/puppeteer/browser/list');
      if (response.ok) {
        this.isAvailable = true;
        return true;
      }
    } catch (error) {
      // Bridge not available or Puppeteer not installed
    }

    this.isAvailable = false;
    return false;
  }

  /**
   * Launch a Puppeteer browser instance
   */
  async launchBrowser(headless: boolean = true, options: any = {}): Promise<{ success: boolean; browserId?: string; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const response = await fetch('http://127.0.0.1:8765/api/puppeteer/browser/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headless, ...options })
      });

      const result = await response.json();
      
      if (result.success && result.browserId) {
        this.browsers.set(result.browserId, {
          browserId: result.browserId,
          connected: true,
          pages: []
        });
      }

      return {
        success: result.success,
        browserId: result.browserId,
        output: result.success ? `Browser launched: ${result.browserId}` : result.error || 'Failed to launch browser'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to launch browser' };
    }
  }

  /**
   * Close a browser instance
   */
  async closeBrowser(browserId: string): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const response = await fetch('http://127.0.0.1:8765/api/puppeteer/browser/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ browserId })
      });

      const result = await response.json();
      this.browsers.delete(browserId);

      return {
        success: result.success,
        output: result.success ? 'Browser closed' : result.error || 'Failed to close browser'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to close browser' };
    }
  }

  /**
   * List all browsers
   */
  async listBrowsers(): Promise<{ success: boolean; browsers: PuppeteerBrowser[]; output: string }> {
    if (!this.backend) {
      return { success: false, browsers: [], output: 'Backend not available' };
    }

    try {
      const response = await fetch('http://127.0.0.1:8765/api/puppeteer/browser/list');
      const result = await response.json();

      if (result.success) {
        this.browsers.clear();
        for (const browser of result.browsers) {
          this.browsers.set(browser.browserId, browser);
        }
      }

      return {
        success: result.success,
        browsers: result.browsers || [],
        output: result.success ? `${result.browsers?.length || 0} browser(s) running` : result.error || 'Failed to list browsers'
      };
    } catch (error: any) {
      return { success: false, browsers: [], output: error.message || 'Failed to list browsers' };
    }
  }

  /**
   * Create a new page
   */
  async createPage(browserId: string): Promise<{ success: boolean; pageId?: string; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const response = await fetch('http://127.0.0.1:8765/api/puppeteer/page/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ browserId })
      });

      const result = await response.json();

      if (result.success && result.pageId) {
        this.pages.set(result.pageId, {
          pageId: result.pageId,
          url: result.url || '',
          title: ''
        });
        
        // Update browser's pages list
        const browser = this.browsers.get(browserId);
        if (browser) {
          browser.pages.push(result.pageId);
        }
      }

      return {
        success: result.success,
        pageId: result.pageId,
        output: result.success ? `Page created: ${result.pageId}` : result.error || 'Failed to create page'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to create page' };
    }
  }

  /**
   * Navigate to URL
   */
  async navigate(pageId: string, url: string, options: any = {}): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const response = await fetch('http://127.0.0.1:8765/api/puppeteer/page/navigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, url, options })
      });

      const result = await response.json();

      if (result.success && this.pages.has(pageId)) {
        const page = this.pages.get(pageId)!;
        page.url = result.url || url;
        page.title = result.title || '';
      }

      return {
        success: result.success,
        output: result.success ? `Navigated to ${url}` : result.error || 'Failed to navigate'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to navigate' };
    }
  }

  /**
   * Take a screenshot
   */
  async screenshot(pageId: string, options: any = {}): Promise<{ success: boolean; screenshot?: string; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const response = await fetch('http://127.0.0.1:8765/api/puppeteer/page/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, options })
      });

      const result = await response.json();

      return {
        success: result.success,
        screenshot: result.screenshot,
        output: result.success ? 'Screenshot taken' : result.error || 'Failed to take screenshot'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to take screenshot' };
    }
  }

  /**
   * Evaluate JavaScript
   */
  async evaluate(pageId: string, script: string, ...args: any[]): Promise<{ success: boolean; result?: any; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const response = await fetch('http://127.0.0.1:8765/api/puppeteer/page/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, script, args })
      });

      const result = await response.json();

      return {
        success: result.success,
        result: result.result,
        output: result.success ? 'Script executed' : result.error || 'Failed to execute script'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to execute script' };
    }
  }

  /**
   * Create a new BrowserPod container (legacy - now uses Puppeteer)
   */
  async createContainer(config: BrowserPodConfig): Promise<{ success: boolean; containerId?: string; output: string }> {
    // Use Puppeteer browser as container
    return this.launchBrowser(true, {});
  }

  /**
   * List running containers (browsers)
   */
  async listContainers(): Promise<{ success: boolean; containers: any[]; output: string }> {
    const browsersResult = await this.listBrowsers();
    return {
      success: browsersResult.success,
      containers: browsersResult.browsers.map(b => ({
        id: b.browserId,
        type: 'browser',
        status: b.connected ? 'running' : 'stopped',
        pages: b.pages.length
      })),
      output: browsersResult.output
    };
  }

  /**
   * Execute command in container (evaluate JavaScript on page)
   */
  async execInContainer(containerId: string, command: string[]): Promise<{ success: boolean; output: string }> {
    // For browser automation, we evaluate JavaScript
    if (command.length === 0) {
      return { success: false, output: 'No command provided' };
    }

    // Find a page for this browser
    const browser = this.browsers.get(containerId);
    if (!browser || browser.pages.length === 0) {
      return { success: false, output: 'No pages available in browser' };
    }

    const pageId = browser.pages[0];
    const script = command.join(' ');
    
    return this.evaluate(pageId, script);
  }

  /**
   * Stop a container (close browser)
   */
  async stopContainer(containerId: string): Promise<{ success: boolean; output: string }> {
    return this.closeBrowser(containerId);
  }

  /**
   * Remove a container (close browser)
   */
  async removeContainer(containerId: string): Promise<{ success: boolean; output: string }> {
    return this.closeBrowser(containerId);
  }

  /**
   * Get container logs (get page content)
   */
  async getContainerLogs(containerId: string, tail: number = 100): Promise<{ success: boolean; output: string }> {
    const browser = this.browsers.get(containerId);
    if (!browser || browser.pages.length === 0) {
      return { success: false, output: 'No pages available' };
    }

    const pageId = browser.pages[0];
    
    try {
      const response = await fetch('http://127.0.0.1:8765/api/puppeteer/page/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId })
      });

      const result = await response.json();
      
      if (result.success) {
        return {
          success: true,
          output: `Page: ${result.url}\nTitle: ${result.title}\nContent length: ${result.content?.length || 0} chars`
        };
      }

      return { success: false, output: result.error || 'Failed to get content' };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to get logs' };
    }
  }

  /**
   * List all pages
   */
  async listPages(): Promise<{ success: boolean; pages: PuppeteerPage[]; output: string }> {
    if (!this.backend) {
      return { success: false, pages: [], output: 'Backend not available' };
    }

    try {
      const response = await fetch('http://127.0.0.1:8765/api/puppeteer/page/list');
      const result = await response.json();

      if (result.success) {
        this.pages.clear();
        for (const page of result.pages) {
          this.pages.set(page.pageId, page);
        }
      }

      return {
        success: result.success,
        pages: result.pages || [],
        output: result.success ? `${result.pages?.length || 0} page(s) open` : result.error || 'Failed to list pages'
      };
    } catch (error: any) {
      return { success: false, pages: [], output: error.message || 'Failed to list pages' };
    }
  }

  /**
   * Close a page
   */
  async closePage(pageId: string): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const response = await fetch('http://127.0.0.1:8765/api/puppeteer/page/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId })
      });

      const result = await response.json();
      this.pages.delete(pageId);

      return {
        success: result.success,
        output: result.success ? 'Page closed' : result.error || 'Failed to close page'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to close page' };
    }
  }

  /**
   * Click an element
   */
  async click(pageId: string, selector: string): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const response = await fetch('http://127.0.0.1:8765/api/puppeteer/page/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, selector })
      });

      const result = await response.json();
      return {
        success: result.success,
        output: result.success ? `Clicked ${selector}` : result.error || 'Failed to click'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to click' };
    }
  }

  /**
   * Type text into an element
   */
  async type(pageId: string, selector: string, text: string): Promise<{ success: boolean; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const response = await fetch('http://127.0.0.1:8765/api/puppeteer/page/type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, selector, text })
      });

      const result = await response.json();
      return {
        success: result.success,
        output: result.success ? `Typed into ${selector}` : result.error || 'Failed to type'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to type' };
    }
  }

  /**
   * Get element text
   */
  async getText(pageId: string, selector: string): Promise<{ success: boolean; text?: string; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const response = await fetch('http://127.0.0.1:8765/api/puppeteer/page/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, selector })
      });

      const result = await response.json();
      return {
        success: result.success,
        text: result.text,
        output: result.success ? `Text: ${result.text}` : result.error || 'Failed to get text'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to get text' };
    }
  }

  /**
   * Generate PDF from page
   */
  async pdf(pageId: string, options: any = {}): Promise<{ success: boolean; pdf?: string; output: string }> {
    if (!this.backend) {
      return { success: false, output: 'Backend not available' };
    }

    try {
      const response = await fetch('http://127.0.0.1:8765/api/puppeteer/page/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, options })
      });

      const result = await response.json();
      return {
        success: result.success,
        pdf: result.pdf,
        output: result.success ? 'PDF generated' : result.error || 'Failed to generate PDF'
      };
    } catch (error: any) {
      return { success: false, output: error.message || 'Failed to generate PDF' };
    }
  }

  getStatus(): { available: boolean; version: string | null; browsers: number; pages: number } {
    return {
      available: this.isAvailable,
      version: this.version,
      browsers: this.browsers.size,
      pages: this.pages.size
    };
  }
}

// Export singleton instance
export const browserPodIntegration = new BrowserPodIntegration();

