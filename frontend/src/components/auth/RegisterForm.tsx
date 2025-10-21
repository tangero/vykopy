import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import type { RootState, AppDispatch } from '../../store';
import { registerUser } from '../../store/thunks/authThunks';
import { clearError, clearRegistrationSuccess } from '../../store/slices/authSlice';
import { GovButton, GovInput, GovCard, Alert, Icon } from '../gov';
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
      <div className="gov-auth-container">
        <GovCard className="gov-auth-card">
          <Alert color="success" className="gov-auth-success">
            <Icon name="check-circle" />
            <div>
              <h2>Registrace byla úspěšná!</h2>
              <p>
                Váš účet byl vytvořen a čeká na schválení administrátorem.
                Budete přesměrováni na přihlašovací stránku.
              </p>
            </div>
          </Alert>
        </GovCard>
      </div>
    );
  }

  return (
    <div className="gov-auth-container">
      <GovCard 
        className="gov-auth-card"
        title="Registrace do DigiKop"
        subtitle="Vytvořte si účet pro koordinaci výkopových prací"
      >
        <form onSubmit={handleSubmit} className="gov-form">
          <GovInput
            label="Jméno a příjmení"
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange({ target: { name: 'name', value: e.target.value } } as React.ChangeEvent<HTMLInputElement>)}
            onBlur={(e) => handleBlur({ target: { name: 'name', value: e.target.value } } as React.FocusEvent<HTMLInputElement>)}
            placeholder="Jan Novák"
            disabled={isLoading}
            error={formErrors.name && touched.name ? formErrors.name : undefined}
            required
            fullWidth
            data-testid="name-input"
          />

          <GovInput
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange({ target: { name: 'email', value: e.target.value } } as React.ChangeEvent<HTMLInputElement>)}
            onBlur={(e) => handleBlur({ target: { name: 'email', value: e.target.value } } as React.FocusEvent<HTMLInputElement>)}
            placeholder="jan.novak@example.com"
            disabled={isLoading}
            error={formErrors.email && touched.email ? formErrors.email : undefined}
            required
            fullWidth
            data-testid="email-input"
          />

          <GovInput
            label="Organizace"
            type="text"
            value={formData.organization}
            onChange={(e) => handleInputChange({ target: { name: 'organization', value: e.target.value } } as React.ChangeEvent<HTMLInputElement>)}
            onBlur={(e) => handleBlur({ target: { name: 'organization', value: e.target.value } } as React.FocusEvent<HTMLInputElement>)}
            placeholder="Název vaší organizace"
            disabled={isLoading}
            error={formErrors.organization && touched.organization ? formErrors.organization : undefined}
            required
            fullWidth
            data-testid="organization-input"
          />

          <GovInput
            label="Heslo"
            type="password"
            value={formData.password}
            onChange={(e) => handleInputChange({ target: { name: 'password', value: e.target.value } } as React.ChangeEvent<HTMLInputElement>)}
            onBlur={(e) => handleBlur({ target: { name: 'password', value: e.target.value } } as React.FocusEvent<HTMLInputElement>)}
            placeholder="Alespoň 8 znaků"
            disabled={isLoading}
            error={formErrors.password && touched.password ? formErrors.password : undefined}
            helperText="Heslo musí obsahovat malé písmeno, velké písmeno a číslici"
            required
            fullWidth
            data-testid="password-input"
          />

          <GovInput
            label="Potvrzení hesla"
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => handleInputChange({ target: { name: 'confirmPassword', value: e.target.value } } as React.ChangeEvent<HTMLInputElement>)}
            onBlur={(e) => handleBlur({ target: { name: 'confirmPassword', value: e.target.value } } as React.FocusEvent<HTMLInputElement>)}
            placeholder="Zadejte heslo znovu"
            disabled={isLoading}
            error={formErrors.confirmPassword && touched.confirmPassword ? formErrors.confirmPassword : undefined}
            required
            fullWidth
            data-testid="confirm-password-input"
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
            data-testid="register-button"
          >
            {isLoading ? 'Registruji...' : 'Zaregistrovat se'}
          </GovButton>
        </form>

        <div className="gov-auth-footer">
          <p>
            Již máte účet?{' '}
            <Link to="/login" className="gov-link">
              Přihlaste se
            </Link>
          </p>
        </div>
      </GovCard>
    </div>
  );
};

export default RegisterForm;