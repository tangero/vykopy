import * as Sentry from '@sentry/node';
import { Express } from 'express';
import { config } from '../config';

export class MonitoringService {
  private static initialized = false;

  /**
   * Initialize Sentry monitoring
   */
  static initialize(app: Express): void {
    if (this.initialized || !process.env.SENTRY_DSN) {
      console.log('⚠️  Sentry monitoring not initialized (no DSN provided)');
      return;
    }

    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: config.nodeEnv,
      release: process.env.npm_package_version || '1.0.0',

      // Performance monitoring
      tracesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,

      // Error filtering
      beforeSend(event, hint) {
        // Filter out non-critical errors in production
        if (config.nodeEnv === 'production') {
          const error = hint.originalException;

          // Skip validation errors
          if (error instanceof Error && error.message.includes('validation')) {
            return null;
          }

          // Skip rate limit errors
          if (error instanceof Error && error.message.includes('rate limit')) {
            return null;
          }
        }

        return event;
      },

      // Custom tags
      initialScope: {
        tags: {
          component: 'digikop-api',
          version: process.env.npm_package_version || '1.0.0',
        },
      },
    });

    // Setup Express error handling and request isolation
    Sentry.setupExpressErrorHandler(app);

    this.initialized = true;
    console.log('✅ Sentry monitoring initialized');
  }

  /**
   * Add error handler middleware (must be added after routes)
   */
  static addErrorHandler(app: Express): void {
    if (!this.initialized) {
      return;
    }

    // Error handler is set up in initialize() via setupExpressErrorHandler
  }

  /**
   * Capture custom error with context
   */
  static captureError(error: Error, context?: Record<string, any>): void {
    if (!this.initialized) {
      console.error('Monitoring not initialized:', error);
      return;
    }

    Sentry.withScope((scope) => {
      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          scope.setContext(key, value);
        });
      }
      
      Sentry.captureException(error);
    });
  }

  /**
   * Capture custom message with level
   */
  static captureMessage(
    message: string, 
    level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
    context?: Record<string, any>
  ): void {
    if (!this.initialized) {
      console.log(`[${level.toUpperCase()}] ${message}`, context);
      return;
    }

    Sentry.withScope((scope) => {
      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          scope.setContext(key, value);
        });
      }
      
      Sentry.captureMessage(message, level);
    });
  }

  /**
   * Add user context to current scope
   */
  static setUser(user: { id: string; email?: string; role?: string }): void {
    if (!this.initialized) {
      return;
    }

    Sentry.setUser({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  }

  /**
   * Add custom tags to current scope
   */
  static setTags(tags: Record<string, string>): void {
    if (!this.initialized) {
      return;
    }

    Sentry.setTags(tags);
  }

  /**
   * Start a custom transaction for performance monitoring
   */
  static startTransaction(name: string, op: string): any {
    if (!this.initialized) {
      return null;
    }

    return Sentry.startSpan({ name, op }, () => {});
  }

  /**
   * Performance monitoring for database queries
   */
  static async monitorDatabaseQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    if (!this.initialized) {
      return queryFn();
    }

    return Sentry.startSpan(
      {
        name: queryName,
        op: 'db.query',
      },
      async () => {
        try {
          return await queryFn();
        } catch (error) {
          this.captureError(error as Error, { queryName });
          throw error;
        }
      }
    );
  }

  /**
   * Performance monitoring for external API calls
   */
  static async monitorExternalCall<T>(
    serviceName: string,
    callFn: () => Promise<T>
  ): Promise<T> {
    if (!this.initialized) {
      return callFn();
    }

    return Sentry.startSpan(
      {
        name: `external.${serviceName}`,
        op: 'http.client',
      },
      async () => {
        try {
          return await callFn();
        } catch (error) {
          this.captureError(error as Error, { serviceName });
          throw error;
        }
      }
    );
  }

  /**
   * Monitor conflict detection performance
   */
  static async monitorConflictDetection<T>(
    projectId: string,
    detectionFn: () => Promise<T>
  ): Promise<T> {
    return this.monitorDatabaseQuery(
      `conflict_detection.${projectId}`,
      detectionFn
    );
  }

  /**
   * Monitor email sending
   */
  static async monitorEmailSending<T>(
    emailType: string,
    sendFn: () => Promise<T>
  ): Promise<T> {
    return this.monitorExternalCall(
      `email.${emailType}`,
      sendFn
    );
  }

  /**
   * Add breadcrumb for debugging
   */
  static addBreadcrumb(
    message: string,
    category: string,
    level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
    data?: Record<string, any>
  ): void {
    if (!this.initialized) {
      return;
    }

    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,
      timestamp: Date.now() / 1000,
    });
  }

  /**
   * Flush pending events (useful for serverless)
   */
  static async flush(timeout = 2000): Promise<boolean> {
    if (!this.initialized) {
      return true;
    }

    return Sentry.flush(timeout);
  }

  /**
   * Close Sentry client
   */
  static async close(timeout = 2000): Promise<boolean> {
    if (!this.initialized) {
      return true;
    }

    return Sentry.close(timeout);
  }
}

// Export singleton instance
export const monitoring = MonitoringService;