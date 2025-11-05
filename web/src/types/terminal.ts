// TypeScript interfaces for terminal system

export interface TerminalTab {
  id: string;
  title: string;
  terminal: any; // Terminal instance
  backend: any; // Backend instance
  isActive: boolean;
  createdAt: number;
  sessionCommands: string[];
}

export interface TerminalPane {
  id: string;
  terminal: any;
  backend: any;
  isActive: boolean;
  parentId?: string; // For split panes
  direction?: 'vertical' | 'horizontal';
}

