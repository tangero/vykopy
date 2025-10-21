import React from 'react';
import ApplicantProjectList from '../components/ApplicantProjectList';

const ProjectsPage: React.FC = () => {
  // For now, show the applicant project list for all users
  // In the future, coordinators might have a different view
  return <ApplicantProjectList />;
};

export default ProjectsPage;
