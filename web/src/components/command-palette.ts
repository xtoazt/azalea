// Command palette with fuzzy search

export interface Command {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  category?: string;
  callback: () => void;
}

class CommandPalette {
  private commands: Command[] = [];
  private container: HTMLElement | null = null;
  private isOpen: boolean = false;
  private filteredCommands: Command[] = [];
  private selectedIndex: number = 0;
  private searchQuery: string = '';

  constructor() {
    this.createContainer();
    this.setupStyles();
    this.setupKeyboardHandler();
  }

  private createContainer(): void {
    this.container = document.createElement('div');
    this.container.id = 'command-palette';
    this.container.className = 'fixed inset-0 z-[10001] hidden';
    this.container.innerHTML = `
      <div class="command-palette-overlay"></div>
      <div class="command-palette-content">
        <div class="command-palette-search">
          <svg class="command-palette-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input 
            type="text" 
            id="command-palette-input" 
            placeholder="Type a command or search..." 
            class="command-palette-input"
            autocomplete="off"
            aria-label="Command palette search"
            aria-describedby="command-palette-hint"
          />
        </div>
        <div id="command-palette-list" class="command-palette-list" role="listbox" aria-label="Command list"></div>
        <div class="command-palette-footer">
          <div id="command-palette-hint" class="command-palette-hint" role="status" aria-live="polite">
            <kbd>↑</kbd><kbd>↓</kbd> Navigate • <kbd>Enter</kbd> Execute • <kbd>Esc</kbd> Close
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(this.container);

    const input = document.getElementById('command-palette-input') as HTMLInputElement;
    if (input) {
      input.addEventListener('input', (e) => {
        this.searchQuery = (e.target as HTMLInputElement).value;
        this.filterCommands();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredCommands.length - 1);
          this.updateSelection();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
          this.updateSelection();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          this.executeSelected();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.close();
        }
      });
    }

    const overlay = this.container.querySelector('.command-palette-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => this.close());
    }
  }

  private setupStyles(): void {
    if (!document.getElementById('command-palette-styles')) {
      const style = document.createElement('style');
      style.id = 'command-palette-styles';
      style.textContent = `
        .command-palette-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(12px) saturate(180%);
          -webkit-backdrop-filter: blur(12px) saturate(180%);
          animation: fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .command-palette-content {
          position: absolute;
          top: 20%;
          left: 50%;
          transform: translateX(-50%);
          width: 90%;
          max-width: 600px;
          background: rgba(17, 24, 39, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.75rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .command-palette-search {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .command-palette-search-icon {
          width: 20px;
          height: 20px;
          color: #9ca3af;
          flex-shrink: 0;
        }
        
        .command-palette-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: #e4e4e7;
          font-size: 1rem;
          font-family: inherit;
        }
        
        .command-palette-input::placeholder {
          color: #6b7280;
        }
        
        .command-palette-list {
          max-height: 400px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
        }
        
        .command-palette-list::-webkit-scrollbar {
          width: 8px;
        }
        
        .command-palette-list::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .command-palette-list::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }
        
        .command-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border-left: 3px solid transparent;
          position: relative;
        }
        
        .command-item::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: linear-gradient(180deg, rgba(37, 99, 235, 1), rgba(234, 88, 12, 1));
          opacity: 0;
          transition: opacity 0.2s;
        }
        
        .command-item:hover,
        .command-item.selected {
          background: rgba(59, 130, 246, 0.15);
          border-left-color: #3b82f6;
          transform: translateX(2px);
        }
        
        .command-item.selected::before {
          opacity: 1;
        }
        
        .command-item-icon {
          width: 20px;
          height: 20px;
          color: #9ca3af;
          flex-shrink: 0;
        }
        
        .command-item-content {
          flex: 1;
          min-width: 0;
        }
        
        .command-item-label {
          color: #e4e4e7;
          font-size: 0.875rem;
          font-weight: 500;
          margin-bottom: 0.25rem;
        }
        
        .command-item-description {
          color: #9ca3af;
          font-size: 0.75rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .command-item-shortcut {
          display: flex;
          gap: 0.25rem;
          flex-shrink: 0;
        }
        
        .command-item-shortcut kbd {
          padding: 0.25rem 0.5rem;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 0.25rem;
          color: #9ca3af;
          font-size: 0.75rem;
          font-family: 'SF Mono', 'Monaco', monospace;
        }
        
        .command-palette-footer {
          padding: 0.75rem 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.2);
        }
        
        .command-palette-hint {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #6b7280;
          font-size: 0.75rem;
        }
        
        .command-palette-hint kbd {
          padding: 0.125rem 0.375rem;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 0.25rem;
          color: #9ca3af;
          font-size: 0.7rem;
          font-family: 'SF Mono', 'Monaco', monospace;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  private setupKeyboardHandler(): void {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  register(command: Command): void {
    this.commands.push(command);
    this.commands.sort((a, b) => {
      if (a.category !== b.category) {
        return (a.category || '').localeCompare(b.category || '');
      }
      return a.label.localeCompare(b.label);
    });
  }

  private fuzzyMatch(query: string, text: string): boolean {
    if (!query) return true;
    const lowerQuery = query.toLowerCase();
    const lowerText = text.toLowerCase();
    return lowerText.includes(lowerQuery) || this.fuzzyScore(query, text) > 0;
  }

  private fuzzyScore(query: string, text: string): number {
    const lowerQuery = query.toLowerCase();
    const lowerText = text.toLowerCase();
    let score = 0;
    let queryIndex = 0;

    for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
      if (lowerText[i] === lowerQuery[queryIndex]) {
        score += 1;
        queryIndex++;
      }
    }

    return queryIndex === lowerQuery.length ? score : 0;
  }

  private filterCommands(): void {
    if (!this.searchQuery) {
      this.filteredCommands = this.commands;
    } else {
      this.filteredCommands = this.commands
        .filter(cmd => 
          this.fuzzyMatch(this.searchQuery, cmd.label) ||
          (cmd.description && this.fuzzyMatch(this.searchQuery, cmd.description)) ||
          (cmd.category && this.fuzzyMatch(this.searchQuery, cmd.category))
        )
        .sort((a, b) => {
          const scoreA = this.fuzzyScore(this.searchQuery, a.label);
          const scoreB = this.fuzzyScore(this.searchQuery, b.label);
          return scoreB - scoreA;
        });
    }
    this.selectedIndex = 0;
    this.render();
  }

  private render(): void {
    const list = document.getElementById('command-palette-list');
    if (!list) return;

    list.innerHTML = '';

    if (this.filteredCommands.length === 0) {
      list.innerHTML = `
        <div class="command-item" style="justify-content: center; color: #6b7280; padding: 2rem;">
          No commands found
        </div>
      `;
      return;
    }

    let currentCategory = '';
    this.filteredCommands.forEach((cmd, index) => {
      if (cmd.category && cmd.category !== currentCategory) {
        currentCategory = cmd.category;
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'command-item';
        categoryDiv.style.padding = '0.5rem 1rem';
        categoryDiv.style.color = '#6b7280';
        categoryDiv.style.fontSize = '0.75rem';
        categoryDiv.style.fontWeight = '600';
        categoryDiv.style.textTransform = 'uppercase';
        categoryDiv.style.letterSpacing = '0.05em';
        categoryDiv.textContent = currentCategory;
        list.appendChild(categoryDiv);
      }

      const item = document.createElement('div');
      item.className = `command-item ${index === this.selectedIndex ? 'selected' : ''}`;
      item.innerHTML = `
        <svg class="command-item-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
        <div class="command-item-content">
          <div class="command-item-label">${this.highlightMatch(cmd.label)}</div>
          ${cmd.description ? `<div class="command-item-description">${cmd.description}</div>` : ''}
        </div>
        ${cmd.shortcut ? `
          <div class="command-item-shortcut">
            ${this.formatShortcut(cmd.shortcut)}
          </div>
        ` : ''}
      `;
      item.addEventListener('click', () => {
        this.selectedIndex = index;
        this.executeSelected();
      });
      list.appendChild(item);
    });

    // Scroll selected item into view
    const selectedItem = list.children[this.selectedIndex + 1] as HTMLElement;
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  private highlightMatch(text: string): string {
    if (!this.searchQuery) return text;
    const regex = new RegExp(`(${this.searchQuery})`, 'gi');
    return text.replace(regex, '<mark style="background: rgba(59, 130, 246, 0.3); color: #60a5fa;">$1</mark>');
  }

  private formatShortcut(shortcut: string): string {
    return shortcut.split('+').map(key => `<kbd>${key}</kbd>`).join('');
  }

  private updateSelection(): void {
    this.render();
  }

  private executeSelected(): void {
    if (this.filteredCommands[this.selectedIndex]) {
      this.filteredCommands[this.selectedIndex].callback();
      this.close();
    }
  }

  open(): void {
    if (!this.container) return;
    this.isOpen = true;
    this.container.classList.remove('hidden');
    this.searchQuery = '';
    this.filterCommands();
    
    const input = document.getElementById('command-palette-input') as HTMLInputElement;
    if (input) {
      setTimeout(() => input.focus(), 50);
    }
  }

  close(): void {
    if (!this.container) return;
    this.isOpen = false;
    this.container.classList.add('hidden');
    const input = document.getElementById('command-palette-input') as HTMLInputElement;
    if (input) {
      input.value = '';
    }
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
}

export const commandPalette = new CommandPalette();

// Expose to window for global access
if (typeof window !== 'undefined') {
  (window as any).commandPalette = commandPalette;
}

