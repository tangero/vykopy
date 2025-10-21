import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { logoutUser } from '../store/thunks/authThunks';
import { GovButton, Container, Icon } from '../components/gov';

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
    <nav className="gov-header">
      <Container>
        <div className="gov-header__content">
          {/* Logo and brand */}
          <div className="gov-header__brand">
            <Link to="/dashboard" className="gov-header__logo">
              <h1 className="gov-header__title">DigiKop</h1>
            </Link>
          </div>

          {/* Mobile menu button */}
          <GovButton
            variant="secondary"
            size="small"
            className="gov-header__mobile-toggle"
            onClick={toggleMobileMenu}
            aria-label="Toggle mobile menu"
          >
            <Icon name={mobileMenuOpen ? 'close' : 'menu'} />
          </GovButton>

          {/* Navigation links */}
          <div className={`gov-header__nav ${mobileMenuOpen ? 'gov-header__nav--open' : ''}`}>
            <Link 
              to="/dashboard" 
              className={`gov-nav-link ${isActiveRoute('/dashboard') ? 'gov-nav-link--active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link 
              to="/projects" 
              className={`gov-nav-link ${isActiveRoute('/projects') ? 'gov-nav-link--active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Projekty
            </Link>
            {user?.role === 'municipal_coordinator' || user?.role === 'regional_admin' ? (
              <Link 
                to="/moratoriums" 
                className={`gov-nav-link ${isActiveRoute('/moratoriums') ? 'gov-nav-link--active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Moratoria
              </Link>
            ) : null}
          </div>

          {/* User menu */}
          <div className="gov-header__user">
            <GovButton
              variant="secondary"
              size="small"
              className="gov-header__user-button"
              onClick={toggleUserMenu}
            >
              <div className="gov-avatar">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="gov-header__user-info">
                <span className="gov-header__user-name">{user?.name}</span>
                <span className="gov-header__user-role">{getRoleDisplayName(user?.role || '')}</span>
              </div>
              <Icon name={userMenuOpen ? 'chevron-up' : 'chevron-down'} />
            </GovButton>

            {userMenuOpen && (
              <div className="gov-dropdown">
                <div className="gov-dropdown__header">
                  <div className="gov-dropdown__user-details">
                    <strong>{user?.name}</strong>
                    <span>{user?.email}</span>
                    {user?.organization && <span>{user.organization}</span>}
                  </div>
                </div>
                <div className="gov-dropdown__divider"></div>
                <button 
                  className="gov-dropdown__item"
                  onClick={() => {
                    setUserMenuOpen(false);
                    // TODO: Navigate to profile settings
                  }}
                >
                  <Icon name="settings" />
                  Nastavení profilu
                </button>
                <button 
                  className="gov-dropdown__item gov-dropdown__item--danger"
                  onClick={() => {
                    setUserMenuOpen(false);
                    handleLogout();
                  }}
                >
                  <Icon name="logout" />
                  Odhlásit se
                </button>
              </div>
            )}
          </div>
        </div>
      </Container>

      {/* Overlay for mobile menu */}
      {mobileMenuOpen && (
        <div 
          className="gov-overlay"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </nav>
  );
};

export default Navigation;