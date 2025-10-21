import React, { Suspense } from 'react';
import LoadingSpinner from './LoadingSpinner';

interface LazyWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const LazyWrapper: React.FC<LazyWrapperProps> = ({ 
  children, 
  fallback = <LoadingSpinner size="large" message="Načítání komponenty..." /> 
}) => {
  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  );
};

export default LazyWrapper;