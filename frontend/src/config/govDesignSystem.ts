// Configuration for Czech Gov Design System
export const govDesignSystemConfig = {
  // Theme configuration
  theme: {
    primaryColor: '#0066cc', // Czech government blue
    secondaryColor: '#f5f5f5',
    successColor: '#28a745',
    warningColor: '#ffc107',
    errorColor: '#dc3545',
    infoColor: '#17a2b8'
  },
  
  // Typography configuration
  typography: {
    fontFamily: '"Source Sans Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    baseFontSize: '16px',
    lineHeight: 1.5
  },
  
  // Spacing configuration
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px'
  },
  
  // Breakpoints for responsive design
  breakpoints: {
    mobile: '576px',
    tablet: '768px',
    desktop: '992px',
    widescreen: '1200px'
  },
  
  // Component variants
  components: {
    button: {
      primary: 'gov-button--primary',
      secondary: 'gov-button--secondary',
      success: 'gov-button--success',
      warning: 'gov-button--warning',
      danger: 'gov-button--danger'
    },
    input: {
      default: 'gov-form-control',
      error: 'gov-form-control--error',
      success: 'gov-form-control--success'
    },
    card: {
      default: 'gov-card',
      bordered: 'gov-card--bordered',
      elevated: 'gov-card--elevated'
    }
  }
};

// Utility function to get Gov DS class names
export const getGovClass = (component: string, variant: string = 'default') => {
  const componentConfig = govDesignSystemConfig.components[component as keyof typeof govDesignSystemConfig.components];
  if (componentConfig && typeof componentConfig === 'object') {
    return (componentConfig as any)[variant] || '';
  }
  return '';
};

// Utility function to combine Gov DS classes with custom classes
export const combineClasses = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};