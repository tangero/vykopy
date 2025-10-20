import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';
import type { RootState, AppDispatch } from '../../store';
import { getCurrentUser } from '../../store/thunks/authThunks';
import type { User } from '../../store/slices/authSlice';
import './auth.css';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: User['role'][];
  fallbackPath?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles = [],
  fallbackPath = '/login',
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const location = useLocation();
  const { isAuthenticated, user, token, isLoading } = useSelector(
    (state: RootState) => state.auth
  );

  useEffect(() => {
    // If we have a token but no user data, try to fetch current user
    if (token && !user && !isLoading) {
      dispatch(getCurrentUser());
    }
  }, [dispatch, token, user, isLoading]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Ověřuji přihlášení...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to={fallbackPath}
        state={{ from: location }}
        replace
      />
    );
  }

  // Check role-based access
  if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
    return (
      <div className="access-denied-container">
        <div className="access-denied-card">
          <h2>Přístup odepřen</h2>
          <p>
            Nemáte dostatečná oprávnění pro přístup k této stránce.
          </p>
          <p>
            Vaše role: <strong>{getRoleDisplayName(user.role)}</strong>
          </p>
          <p>
            Požadované role: <strong>{requiredRoles.map(getRoleDisplayName).join(', ')}</strong>
          </p>
          <button
            onClick={() => window.history.back()}
            className="back-button"
          >
            Zpět
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const getRoleDisplayName = (role: User['role']): string => {
  switch (role) {
    case 'regional_admin':
      return 'Regionální administrátor';
    case 'municipal_coordinator':
      return 'Obecní koordinátor';
    case 'applicant':
      return 'Žadatel';
    default:
      return role;
  }
};

export default ProtectedRoute;