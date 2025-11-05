// Toast notification system for user feedback
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
  timestamp: number;
}

class NotificationManager {
  private notifications: Notification[] = [];
  private container: HTMLElement | null = null;
  private defaultDuration = 3000;

  constructor() {
    this.createContainer();
    this.setupStyles();
  }

  private createContainer(): void {
    this.container = document.createElement('div');
    this.container.id = 'notification-container';
    this.container.className = 'fixed top-4 right-4 z-[10000] flex flex-col gap-2 pointer-events-none';
    document.body.appendChild(this.container);
  }

  private setupStyles(): void {
    if (!document.getElementById('notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        .notification-toast {
          min-width: 300px;
          max-width: 500px;
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          gap: 0.75rem;
          pointer-events: auto;
          animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .notification-toast:hover {
          transform: translateX(-4px);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.15);
        }
        
        .notification-toast.success {
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #10b981;
        }
        
        .notification-toast.error {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
        }
        
        .notification-toast.warning {
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.3);
          color: #f59e0b;
        }
        
        .notification-toast.info {
          background: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #3b82f6;
        }
        
        .notification-icon {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }
        
        .notification-message {
          flex: 1;
          font-size: 0.875rem;
          font-weight: 500;
          line-height: 1.4;
        }
        
        .notification-close {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
          opacity: 0.6;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        
        .notification-close:hover {
          opacity: 1;
        }
        
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOutRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
        
        .notification-toast.removing {
          animation: slideOutRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `;
      document.head.appendChild(style);
    }
  }

  private getIcon(type: NotificationType): string {
    const icons: Record<NotificationType, string> = {
      success: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`,
      error: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`,
      warning: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
      info: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    };
    return icons[type];
  }

  show(message: string, type: NotificationType = 'info', duration?: number): string {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const notification: Notification = {
      id,
      type,
      message,
      duration: duration ?? this.defaultDuration,
      timestamp: Date.now(),
    };

    this.notifications.push(notification);
    this.render();

    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, notification.duration);
    }

    return id;
  }

  success(message: string, duration?: number): string {
    return this.show(message, 'success', duration);
  }

  error(message: string, duration?: number): string {
    return this.show(message, 'error', duration || 5000);
  }

  warning(message: string, duration?: number): string {
    return this.show(message, 'warning', duration);
  }

  info(message: string, duration?: number): string {
    return this.show(message, 'info', duration);
  }

  remove(id: string): void {
    const notification = this.notifications.find(n => n.id === id);
    if (!notification) return;

    const element = document.getElementById(id);
    if (element) {
      element.classList.add('removing');
      setTimeout(() => {
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.render();
      }, 300);
    } else {
      this.notifications = this.notifications.filter(n => n.id !== id);
      this.render();
    }
  }

  clear(): void {
    this.notifications.forEach(n => {
      const element = document.getElementById(n.id);
      if (element) {
        element.classList.add('removing');
      }
    });
    setTimeout(() => {
      this.notifications = [];
      this.render();
    }, 300);
  }

  private render(): void {
    if (!this.container) return;

    // Remove old notifications
    const existing = this.container.querySelectorAll('.notification-toast:not(.removing)');
    existing.forEach(el => {
      const id = el.id;
      if (!this.notifications.find(n => n.id === id)) {
        el.classList.add('removing');
        setTimeout(() => el.remove(), 300);
      }
    });

    // Add new notifications
    this.notifications.forEach(notification => {
      if (document.getElementById(notification.id)) return;

      const toast = document.createElement('div');
      toast.id = notification.id;
      toast.className = `notification-toast ${notification.type}`;
      toast.innerHTML = `
        <div class="notification-icon">${this.getIcon(notification.type)}</div>
        <div class="notification-message">${this.escapeHtml(notification.message)}</div>
        <div class="notification-close" onclick="window.notificationManager?.remove('${notification.id}')">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </div>
      `;

      // Click to dismiss
      toast.addEventListener('click', () => {
        this.remove(notification.id);
      });

      this.container!.appendChild(toast);
    });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Singleton instance
export const notificationManager = new NotificationManager();

// Expose to window for global access
if (typeof window !== 'undefined') {
  (window as any).notificationManager = notificationManager;
}

