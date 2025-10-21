import React from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import ApplicantProjectList from '../components/ApplicantProjectList';

const ProjectsPage: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);

  // For now, show the applicant project list for all users
  // In the future, coordinators might have a different view
  return <ApplicantProjectList />;
};

export default ProjectsPage;