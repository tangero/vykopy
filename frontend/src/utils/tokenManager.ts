import { store } from '../store';
import { refreshToken } from '../store/thunks/authThunks';
import { logoutUser } from '../store/thunks/authThunks';

interface TokenPayload {
  exp: number;
  iat: number;
  userId: string;
}

class TokenManager {
  private refreshTimer: number | null = null;
  private readonly REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry

  constructor() {
    this.initializeTokenRefresh();
  }

  private decodeToken(token: string): TokenPayload | null {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Failed to decode token:', error);
      return null;
    }
  }

  private getTokenExpirationTime(token: string): number | null {
    const payload = this.decodeToken(token);
    return payload ? payload.exp * 1000 : null; // Convert to milliseconds
  }

  private isTokenExpired(token: string): boolean {
    const expirationTime = this.getTokenExpirationTime(token);
    if (!expirationTime) return true;
    return Date.now() >= expirationTime;
  }

  private shouldRefreshToken(token: string): boolean {
    const expirationTime = this.getTokenExpirationTime(token);
    if (!expirationTime) return false;
    return Date.now() >= (expirationTime - this.REFRESH_THRESHOLD);
  }

  private scheduleTokenRefresh(token: string): void {
    const expirationTime = this.getTokenExpirationTime(token);
    if (!expirationTime) return;

    const refreshTime = expirationTime - this.REFRESH_THRESHOLD;
    const timeUntilRefresh = refreshTime - Date.now();

    if (timeUntilRefresh > 0) {
      this.refreshTimer = window.setTimeout(() => {
        this.performTokenRefresh();
      }, timeUntilRefresh);
    } else {
      // Token should be refreshed immediately
      this.performTokenRefresh();
    }
  }

  private async performTokenRefresh(): Promise<void> {
    try {
      const state = store.getState();
      const currentToken = state.auth.token;

      if (!currentToken) {
        return;
      }

      if (this.isTokenExpired(currentToken)) {
        // Token is already expired, logout user
        store.dispatch(logoutUser());
        return;
      }

      // Attempt to refresh token
      const result = await store.dispatch(refreshToken());
      
      if (refreshToken.fulfilled.match(result)) {
        // Schedule next refresh
        this.scheduleTokenRefresh(result.payload);
      } else {
        // Refresh failed, logout user
        store.dispatch(logoutUser());
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      store.dispatch(logoutUser());
    }
  }

  public initializeTokenRefresh(): void {
    const state = store.getState();
    const token = state.auth.token;

    if (token) {
      if (this.isTokenExpired(token)) {
        // Token is expired, logout immediately
        store.dispatch(logoutUser());
      } else if (this.shouldRefreshToken(token)) {
        // Token should be refreshed
        this.performTokenRefresh();
      } else {
        // Schedule refresh for later
        this.scheduleTokenRefresh(token);
      }
    }
  }

  public updateToken(newToken: string): void {
    // Clear existing timer
    if (this.refreshTimer) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    // Schedule refresh for new token
    this.scheduleTokenRefresh(newToken);
  }

  public clearTokenRefresh(): void {
    if (this.refreshTimer) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  public isCurrentTokenValid(): boolean {
    const state = store.getState();
    const token = state.auth.token;
    return token ? !this.isTokenExpired(token) : false;
  }
}

export const tokenManager = new TokenManager();