import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import type { RootState, AppDispatch } from '../../store';
import { loginUser } from '../../store/thunks/authThunks';
import { clearError } from '../../store/slices/authSlice';
import { GovButton, GovInput, GovCard, Alert } from '../gov';
import './auth.css';

interface FormData {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
}

const LoginForm: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { isLoading, error, isAuthenticated } = useSelector((state: RootState) => state.auth);

  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    return () => {
      dispatch(clearError());
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
        if (value.length < 6) return 'Heslo musí mít alespoň 6 znaků';
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
    });

    if (!validateForm()) {
      return;
    }

    dispatch(loginUser(formData));
  };

  return (
    <div className="gov-auth-container">
      <GovCard 
        className="gov-auth-card"
        title="Přihlášení do DigiKop"
        subtitle="Koordinační systém pro výkopové práce"
      >
        <form onSubmit={handleSubmit} className="gov-form">
          <GovInput
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange({ target: { name: 'email', value: e.target.value } } as React.ChangeEvent<HTMLInputElement>)}
            onBlur={(e) => handleBlur({ target: { name: 'email', value: e.target.value } } as React.FocusEvent<HTMLInputElement>)}
            placeholder="vas.email@example.com"
            disabled={isLoading}
            error={formErrors.email && touched.email ? formErrors.email : undefined}
            required
            fullWidth
            data-testid="email-input"
          />

          <GovInput
            label="Heslo"
            type="password"
            value={formData.password}
            onChange={(e) => handleInputChange({ target: { name: 'password', value: e.target.value } } as React.ChangeEvent<HTMLInputElement>)}
            onBlur={(e) => handleBlur({ target: { name: 'password', value: e.target.value } } as React.FocusEvent<HTMLInputElement>)}
            placeholder="Vaše heslo"
            disabled={isLoading}
            error={formErrors.password && touched.password ? formErrors.password : undefined}
            required
            fullWidth
            data-testid="password-input"
          />

          {error && (
            <Alert color="error" className="gov-auth-error">
              {error}
            </Alert>
          )}

          <GovButton
            type="submit"
            variant="primary"
            size="large"
            disabled={isLoading}
            loading={isLoading}
            fullWidth
            data-testid="login-button"
          >
            {isLoading ? 'Přihlašuji...' : 'Přihlásit se'}
          </GovButton>
        </form>

        <div className="gov-auth-footer">
          <p>
            Nemáte účet?{' '}
            <Link to="/register" className="gov-link">
              Zaregistrujte se
            </Link>
          </p>
        </div>
      </GovCard>
    </div>
  );
};

export default LoginForm;