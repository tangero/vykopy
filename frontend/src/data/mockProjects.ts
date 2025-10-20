// Mock project data for development and testing
export interface MockProject {
  id: string;
  name: string;
  state: string;
  geometry: GeoJSON.Geometry;
  properties: {
    applicant: string;
    contractor?: string;
    workType: string;
    startDate: string;
    endDate: string;
    description?: string;
  };
}

export const mockProjects: MockProject[] = [
  {
    id: '1',
    name: 'Rekonstrukce vodovodu - Hlavní ulice',
    state: 'pending_approval',
    geometry: {
      type: 'LineString',
      coordinates: [
        [14.4378, 50.0755], // Prague center
        [14.4398, 50.0765],
        [14.4418, 50.0775]
      ]
    },
    properties: {
      applicant: 'Vodárny Středních Čech',
      contractor: 'Stavební firma ABC s.r.o.',
      workType: 'Rekonstrukce vodovodu',
      startDate: '2024-03-15',
      endDate: '2024-04-30',
      description: 'Kompletní rekonstrukce vodovodního řadu v délce 200m včetně nových přípojek pro 15 domů.'
    }
  },
  {
    id: '2',
    name: 'Oprava plynovodu - Náměstí Míru',
    state: 'approved',
    geometry: {
      type: 'Point',
      coordinates: [14.4358, 50.0745]
    },
    properties: {
      applicant: 'Pražská plynárenská',
      contractor: 'GasRepair s.r.o.',
      workType: 'Oprava plynovodu',
      startDate: '2024-02-20',
      endDate: '2024-02-25',
      description: 'Nouzová oprava úniku plynu na hlavním vedení.'
    }
  },
  {
    id: '3',
    name: 'Rekonstrukce křižovatky',
    state: 'in_progress',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [14.4400, 50.0780],
        [14.4420, 50.0780],
        [14.4420, 50.0800],
        [14.4400, 50.0800],
        [14.4400, 50.0780]
      ]]
    },
    properties: {
      applicant: 'Město Praha',
      contractor: 'Silniční stavby Praha a.s.',
      workType: 'Rekonstrukce komunikace',
      startDate: '2024-01-15',
      endDate: '2024-05-30',
      description: 'Kompletní rekonstrukce křižovatky včetně nových semaforů a přechodů pro chodce.'
    }
  },
  {
    id: '4',
    name: 'Pokládka optických kabelů',
    state: 'forward_planning',
    geometry: {
      type: 'LineString',
      coordinates: [
        [14.4300, 50.0700],
        [14.4320, 50.0710],
        [14.4340, 50.0720],
        [14.4360, 50.0730]
      ]
    },
    properties: {
      applicant: 'O2 Czech Republic',
      contractor: 'Telekom Install s.r.o.',
      workType: 'Pokládka telekomunikačních kabelů',
      startDate: '2024-06-01',
      endDate: '2024-07-15',
      description: 'Pokládka nových optických kabelů pro zlepšení internetového připojení v oblasti.'
    }
  },
  {
    id: '5',
    name: 'Oprava kanalizace - Wenceslas Square',
    state: 'completed',
    geometry: {
      type: 'Point',
      coordinates: [14.4270, 50.0810]
    },
    properties: {
      applicant: 'Pražské vodovody a kanalizace',
      contractor: 'Aqua Repair s.r.o.',
      workType: 'Oprava kanalizace',
      startDate: '2023-12-01',
      endDate: '2023-12-15',
      description: 'Oprava prasklého kanalizačního potrubí pod vozovkou.'
    }
  },
  {
    id: '6',
    name: 'Instalace nového osvětlení',
    state: 'draft',
    geometry: {
      type: 'LineString',
      coordinates: [
        [14.4450, 50.0850],
        [14.4470, 50.0860],
        [14.4490, 50.0870]
      ]
    },
    properties: {
      applicant: 'Městská část Praha 2',
      workType: 'Instalace veřejného osvětlení',
      startDate: '2024-04-01',
      endDate: '2024-04-20',
      description: 'Instalace nových LED lamp pro zlepšení bezpečnosti v parku.'
    }
  }
];

// Helper function to get projects by state
export const getProjectsByState = (state: string): MockProject[] => {
  return mockProjects.filter(project => project.state === state);
};

// Helper function to get projects in date range
export const getProjectsInDateRange = (startDate: Date, endDate: Date): MockProject[] => {
  return mockProjects.filter(project => {
    const projectStart = new Date(project.properties.startDate);
    const projectEnd = new Date(project.properties.endDate);
    
    return (projectStart <= endDate && projectEnd >= startDate);
  });
};