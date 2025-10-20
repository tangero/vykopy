import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';
import Sidebar from './Sidebar';

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
    <div className="app-layout">
      <Navigation />
      <div className="app-content">
        <main className="app-main">
          <Outlet context={{ openSidebar, closeSidebar }} />
        </main>
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
