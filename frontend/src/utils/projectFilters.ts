import type { FilterOptions } from '../components/MapFilters';
import type { MockProject } from '../data/mockProjects';

// Filter projects based on filter criteria
export const filterProjects = (projects: MockProject[], filters: FilterOptions): MockProject[] => {
  return projects.filter(project => {
    // Filter by states
    if (filters.states.length > 0 && !filters.states.includes(project.state)) {
      return false;
    }

    // Filter by work types
    if (filters.workTypes.length > 0 && !filters.workTypes.includes(project.properties.workType)) {
      return false;
    }

    // Filter by applicants
    if (filters.applicants.length > 0 && !filters.applicants.includes(project.properties.applicant)) {
      return false;
    }

    // Filter by date range
    if (filters.dateRange.startDate || filters.dateRange.endDate) {
      const projectStart = new Date(project.properties.startDate);
      const projectEnd = new Date(project.properties.endDate);
      
      if (filters.dateRange.startDate) {
        const filterStart = new Date(filters.dateRange.startDate);
        if (projectEnd < filterStart) {
          return false;
        }
      }
      
      if (filters.dateRange.endDate) {
        const filterEnd = new Date(filters.dateRange.endDate);
        if (projectStart > filterEnd) {
          return false;
        }
      }
    }

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const searchableText = [
        project.name,
        project.properties.applicant,
        project.properties.contractor || '',
        project.properties.workType,
        project.properties.description || ''
      ].join(' ').toLowerCase();
      
      if (!searchableText.includes(query)) {
        return false;
      }
    }

    return true;
  });
};

// Search projects by text query
export const searchProjects = (projects: MockProject[], query: string): MockProject[] => {
  if (!query.trim()) {
    return projects;
  }

  const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
  
  return projects.filter(project => {
    const searchableText = [
      project.name,
      project.properties.applicant,
      project.properties.contractor || '',
      project.properties.workType,
      project.properties.description || ''
    ].join(' ').toLowerCase();
    
    // All search terms must be found
    return searchTerms.every(term => searchableText.includes(term));
  });
};

// Get unique values for filter options
export const getFilterOptions = (projects: MockProject[]) => {
  const states = [...new Set(projects.map(p => p.state))];
  const workTypes = [...new Set(projects.map(p => p.properties.workType))];
  const applicants = [...new Set(projects.map(p => p.properties.applicant))];
  
  return {
    states: states.sort(),
    workTypes: workTypes.sort(),
    applicants: applicants.sort()
  };
};

// Get date range from projects
export const getProjectDateRange = (projects: MockProject[]) => {
  if (projects.length === 0) {
    return { minDate: '', maxDate: '' };
  }
  
  const dates = projects.flatMap(p => [
    new Date(p.properties.startDate),
    new Date(p.properties.endDate)
  ]);
  
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
  
  return {
    minDate: minDate.toISOString().split('T')[0],
    maxDate: maxDate.toISOString().split('T')[0]
  };
};