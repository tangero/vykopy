import { lazy } from 'react';

// Lazy load heavy components for better performance
export const LazyMapContainer = lazy(() => import('./MapContainer'));
export const LazyProjectForm = lazy(() => import('./ProjectForm'));
export const LazyCoordinatorDashboard = lazy(() => import('./CoordinatorDashboard'));
export const LazyApplicantProjectList = lazy(() => import('./ApplicantProjectList'));
export const LazyProjectDetail = lazy(() => import('./ProjectDetail'));
export const LazyMoratoriumForm = lazy(() => import('./MoratoriumForm'));
export const LazyProjectHistory = lazy(() => import('./ProjectHistory'));

// Lazy load pages
export const LazyDashboardPage = lazy(() => import('../pages/DashboardPage'));
export const LazyProjectsPage = lazy(() => import('../pages/ProjectsPage'));
export const LazyCreateProjectPage = lazy(() => import('../pages/CreateProjectPage'));