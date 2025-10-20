import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import type { RootState, AppDispatch } from '../../store';
import { registerUser } from '../../store/thunks/authThunks';
import { clearError, clearRegistrationSuccess } from '../../store/slices/authSlice';
import './auth.css';

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  organization: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  name?: string;
  organization?: string;
}

const RegisterForm: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { isLoading, error, registrationSuccess, isAuthenticated } = useSelector(
    (state: RootState) => state.auth
  );

  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    organization: '',
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (registrationSuccess) {
      // Redirect to login after successful registration
      setTimeout(() => {
        dispatch(clearRegistrationSuccess());
        navigate('/login');
      }, 3000);
    }
  }, [registrationSuccess, navigate, dispatch]);

  useEffect(() => {
    return () => {
      dispatch(clearError());
      dispatch(clearRegistrationSuccess());
    };
  }, [dispatch]);

  const validateField = (name: string, value: string): string | undefined => {
    switch (name) {
      case 'email':
        if (!value.trim()) return 'Email je povinný';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Neplatný formát emailu';
        break;
      case 'password':
        if (!value) return 'Heslo je povinné';
        if (value.length < 8) return 'Heslo musí mít alespoň 8 znaků';
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
          return 'Heslo musí obsahovat malé písmeno, velké písmeno a číslici';
        }
        break;
      case 'confirmPassword':
        if (!value) return 'Potvrzení hesla je povinné';
        if (value !== formData.password) return 'Hesla se neshodují';
        break;
      case 'name':
        if (!value.trim()) return 'Jméno je povinné';
        if (value.trim().length < 2) return 'Jméno musí mít alespoň 2 znaky';
        break;
      case 'organization':
        if (!value.trim()) return 'Organizace je povinná';
        break;
    }
    return undefined;
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    
    Object.keys(formData).forEach((key) => {
      const error = validateField(key, formData[key as keyof FormData]);
      if (error) {
        errors[key as keyof FormErrors] = error;
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear field error when user starts typing
    if (formErrors[name as keyof FormErrors]) {
      setFormErrors(prev => ({ ...prev, [name]: undefined }));
    }

    // Clear global error
    if (error) {
      dispatch(clearError());
    }

    // Re-validate confirm password if password changes
    if (name === 'password' && formData.confirmPassword) {
      const confirmError = validateField('confirmPassword', formData.confirmPassword);
      setFormErrors(prev => ({ ...prev, confirmPassword: confirmError }));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    
    const fieldError = validateField(name, value);
    if (fieldError) {
      setFormErrors(prev => ({ ...prev, [name]: fieldError }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all fields as touched
    setTouched({
      email: true,
      password: true,
      confirmPassword: true,
      name: true,
      organization: true,
    });

    if (!validateForm()) {
      return;
    }

    const { confirmPassword, ...registrationData } = formData;
    dispatch(registerUser(registrationData));
  };

  if (registrationSuccess) {
    return (
      <div className="register-form-container">
        <div className="register-form-card">
          <div className="success-message">
            <h2>Registrace byla úspěšná!</h2>
            <p>
              Váš účet byl vytvořen a čeká na schválení administrátorem.
              Budete přesměrováni na přihlašovací stránku.
            </p>
            <div className="success-icon">✓</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="register-form-container">
      <div className="register-form-card">
        <div className="register-header">
          <h1>Registrace do DigiKop</h1>
          <p>Vytvořte si účet pro koordinaci výkopových prací</p>
        </div>

        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-group">
            <label htmlFor="name">Jméno a příjmení *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              onBlur={handleBlur}
              className={`form-input ${formErrors.name && touched.name ? 'error' : ''}`}
              placeholder="Jan Novák"
              disabled={isLoading}
            />
            {formErrors.name && touched.name && (
              <span className="error-message">{formErrors.name}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              onBlur={handleBlur}
              className={`form-input ${formErrors.email && touched.email ? 'error' : ''}`}
              placeholder="jan.novak@example.com"
              disabled={isLoading}
            />
            {formErrors.email && touched.email && (
              <span className="error-message">{formErrors.email}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="organization">Organizace *</label>
            <input
              type="text"
              id="organization"
              name="organization"
              value={formData.organization}
              onChange={handleInputChange}
              onBlur={handleBlur}
              className={`form-input ${formErrors.organization && touched.organization ? 'error' : ''}`}
              placeholder="Název vaší organizace"
              disabled={isLoading}
            />
            {formErrors.organization && touched.organization && (
              <span className="error-message">{formErrors.organization}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">Heslo *</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              onBlur={handleBlur}
              className={`form-input ${formErrors.password && touched.password ? 'error' : ''}`}
              placeholder="Alespoň 8 znaků"
              disabled={isLoading}
            />
            {formErrors.password && touched.password && (
              <span className="error-message">{formErrors.password}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Potvrzení hesla *</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              onBlur={handleBlur}
              className={`form-input ${formErrors.confirmPassword && touched.confirmPassword ? 'error' : ''}`}
              placeholder="Zadejte heslo znovu"
              disabled={isLoading}
            />
            {formErrors.confirmPassword && touched.confirmPassword && (
              <span className="error-message">{formErrors.confirmPassword}</span>
            )}
          </div>

          {error && (
            <div className="error-banner">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="register-button"
            disabled={isLoading}
          >
            {isLoading ? 'Registruji...' : 'Zaregistrovat se'}
          </button>
        </form>

        <div className="register-footer">
          <p>
            Již máte účet?{' '}
            <Link to="/login" className="login-link">
              Přihlaste se
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;