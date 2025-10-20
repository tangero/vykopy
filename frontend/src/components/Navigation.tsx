import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { logoutUser } from '../store/thunks/authThunks';

const Navigation: React.FC = () => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  
  const { user } = useAppSelector((state) => state.auth);

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/login');
  };

  const toggleUserMenu = () => {
    setUserMenuOpen(!userMenuOpen);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const isActiveRoute = (path: string) => {
    return location.pathname === path;
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'regional_admin':
        return 'Regionální administrátor';
      case 'municipal_coordinator':
        return 'Koordinátor obce';
      case 'applicant':
        return 'Žadatel';
      default:
        return role;
    }
  };

  return (
    <nav className="navigation">
      <div className="nav-container">
        {/* Logo and brand */}
        <div className="nav-brand">
          <Link to="/dashboard" className="nav-logo">
            <h1>DigiKop</h1>
          </Link>
        </div>

        {/* Mobile menu button */}
        <button 
          className="mobile-menu-button"
          onClick={toggleMobileMenu}
          aria-label="Toggle mobile menu"
        >
          <span className={`hamburger ${mobileMenuOpen ? 'open' : ''}`}>
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>

        {/* Navigation links */}
        <div className={`nav-links ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <Link 
            to="/dashboard" 
            className={`nav-link ${isActiveRoute('/dashboard') ? 'active' : ''}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            Dashboard
          </Link>
          <Link 
            to="/projects" 
            className={`nav-link ${isActiveRoute('/projects') ? 'active' : ''}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            Projekty
          </Link>
          {user?.role === 'municipal_coordinator' || user?.role === 'regional_admin' ? (
            <Link 
              to="/moratoriums" 
              className={`nav-link ${isActiveRoute('/moratoriums') ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Moratoria
            </Link>
          ) : null}
        </div>

        {/* User menu */}
        <div className="user-menu">
          <button 
            className="user-menu-button"
            onClick={toggleUserMenu}
            aria-label="User menu"
          >
            <div className="user-avatar">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="user-info">
              <span className="user-name">{user?.name}</span>
              <span className="user-role">{getRoleDisplayName(user?.role || '')}</span>
            </div>
            <svg 
              className={`dropdown-arrow ${userMenuOpen ? 'open' : ''}`}
              width="12" 
              height="12" 
              viewBox="0 0 12 12"
            >
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none"/>
            </svg>
          </button>

          {userMenuOpen && (
            <div className="user-dropdown">
              <div className="user-dropdown-header">
                <div className="user-details">
                  <strong>{user?.name}</strong>
                  <span>{user?.email}</span>
                  {user?.organization && <span>{user.organization}</span>}
                </div>
              </div>
              <div className="user-dropdown-divider"></div>
              <button 
                className="user-dropdown-item"
                onClick={() => {
                  setUserMenuOpen(false);
                  // TODO: Navigate to profile settings
                }}
              >
                Nastavení profilu
              </button>
              <button 
                className="user-dropdown-item logout"
                onClick={() => {
                  setUserMenuOpen(false);
                  handleLogout();
                }}
              >
                Odhlásit se
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Overlay for mobile menu */}
      {mobileMenuOpen && (
        <div 
          className="mobile-overlay"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </nav>
  );
};

export default Navigation;