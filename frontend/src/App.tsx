import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router-dom';
import { store } from './store';
import { router } from './router';
import { tokenManager } from './utils/tokenManager';
import './App.css';

const App: React.FC = () => {
  useEffect(() => {
    // Initialize token management
    tokenManager.initializeTokenRefresh();

    // Listen for token updates
    const unsubscribe = store.subscribe(() => {
      const state = store.getState();
      const token = state.auth.token;
      
      if (token) {
        tokenManager.updateToken(token);
      } else {
        tokenManager.clearTokenRefresh();
      }
    });

    return () => {
      unsubscribe();
      tokenManager.clearTokenRefresh();
    };
  }, []);

  return (
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  );
};

export default App;
