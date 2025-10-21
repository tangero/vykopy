import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';
import Sidebar from './Sidebar';
import { Container } from './gov';

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarContent, setSidebarContent] = useState<React.ReactNode>(null);

  const openSidebar = (content: React.ReactNode) => {
    setSidebarContent(content);
    setSidebarOpen(true);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    setSidebarContent(null);
  };

  return (
    <div className="gov-layout">
      <Navigation />
      <div className="gov-layout__content">
        <Container>
          <main className="gov-layout__main">
            <Outlet context={{ openSidebar, closeSidebar }} />
          </main>
        </Container>
        <Sidebar 
          isOpen={sidebarOpen} 
          onClose={closeSidebar}
          content={sidebarContent}
        />
      </div>
    </div>
  );
};

export default Layout;
