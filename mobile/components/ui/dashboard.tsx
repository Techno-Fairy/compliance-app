import React, { useState } from 'react';
import { 
  Menu, 
  Warning, 
  FilterList, 
  Dashboard, 
  FolderShared, 
  Analytics, 
  Settings, 
  Add 
} from '@mui/icons-material';
import { IconButton, Button, Avatar, Chip } from '@mui/material';

const ComplianceDashboard = () => {
  const [activeFilter, setActiveFilter] = useState('ALL');

  const filters = ['ALL', 'BURS', 'CIPA', 'LABOUR'];

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      {/* TopAppBar */}
      <header className="bg-surface-container flex justify-between items-center h-16 px-container-margin w-full fixed top-0 z-50 border-b border-outline-variant shadow-none">
        <div className="flex items-center gap-md">
          <IconButton className="hover:bg-surface-variant/50 rounded-full p-2 transition-opacity duration-150 active:opacity-80">
            <Menu className="text-primary" />
          </IconButton>
          <h1 className="text-title-lg font-title-lg font-bold text-primary">CompliancePro Botswana</h1>
        </div>
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-primary-fixed-dim flex items-center justify-center overflow-hidden border border-outline-variant">
            <Avatar 
              alt="Profile" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBHJHftb6DcxeNvvohCyKxQOSR9rRiG3j-zvTUVHNt1nW6sWWMbSxVz9VQ5nTD9W5LvWbX8Y1-hvoHGFwwKp2SlY_vmqbWd2w622_Dpvvi2W8JwkQwXGUItDUdvUjU6nAUtbb_g8zp4cA5Jih3-8BVvqy2E6-FU3QN_ONLIMeCzqjECw94-AwNbSMtivMTtjCmgs90pJhmzRqAg8BWoNYdUN0Vni3cUE2nGY_LNq_9034rl8zROfe2XnAXyoMH7rVHBhkci9MKtwObo"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </header>

      <main className="mt-16 mb-24 px-container-margin pt-md space-y-lg flex-grow">
        {/* Overdue Banner */}
        <div className="bg-error-container text-on-error-container p-md rounded-xl flex items-start gap-md border border-error/20">
          <Warning className="text-error" style={{ fontVariationSettings: "'FILL' 1" }} />
          <div className="flex-grow">
            <p className="text-body-md font-body-md font-bold">1 Overdue Task</p>
            <p className="text-caption">WHT Monthly Return was due 3 days ago. File immediately to avoid penalties.</p>
          </div>
          <Button className="text-error font-label-md text-label-md uppercase tracking-wider">Resolve</Button>
        </div>

        {/* Compliance Health Score */}
        <section className="bg-surface-container-lowest rounded-xl p-lg border border-outline-variant shadow-sm text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-secondary"></div>
          <h2 className="text-label-md font-label-md text-on-surface-variant mb-md uppercase tracking-widest">Compliance Health Score</h2>
          <div className="relative inline-flex items-center justify-center mb-md">
            {/* Circular Gauge */}
            <svg className="w-40 h-40 transform -rotate-90">
              <circle className="text-surface-container-high" cx="80" cy="80" fill="transparent" r="70" stroke="currentColor" strokeWidth="12" />
              <circle className="text-secondary" cx="80" cy="80" fill="transparent" r="70" stroke="currentColor" strokeDasharray="440" strokeDashoffset="66" strokeWidth="12" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-display-lg font-display-lg text-primary">85%</span>
              <span className="text-label-md font-label-md text-secondary">GOOD STANDING</span>
            </div>
          </div>
          <p className="text-body-md font-body-md text-on-surface-variant max-w-xs mx-auto">
            Your business is mostly compliant. Complete the <span className="font-bold text-primary">2 upcoming tasks</span> to reach 100%.
          </p>
        </section>

        {/* Category Filters */}
        <section className="flex gap-sm overflow-x-auto pb-xs no-scrollbar">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-lg py-sm rounded-full text-label-md font-label-md whitespace-nowrap transition-all ${
                activeFilter === filter
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-variant/50'
              }`}
            >
              {filter}
            </button>
          ))}
        </section>

        {/* Upcoming Deadlines */}
        <section className="space-y-md">
          <div className="flex justify-between items-center px-xs">
            <h3 className="text-title-lg font-title-lg text-primary">Upcoming Deadlines</h3>
            <FilterList className="text-on-surface-variant" />
          </div>

          {/* Task Card: VAT Return */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-md flex gap-md relative">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-tertiary-fixed-dim rounded-l-xl"></div>
            <div className="flex-grow">
              <div className="flex justify-between items-start mb-xs">
                <Chip 
                  label="BURS" 
                  className="bg-tertiary-container/10 text-on-tertiary-fixed-variant text-label-md font-label-md px-sm py-xs rounded"
                  size="small"
                />
                <span className="text-on-tertiary-fixed-variant text-label-md font-label-md">Due in 21 days</span>
              </div>
              <h4 className="text-body-lg font-bold text-primary mb-xs">VAT Annual Return</h4>
              <p className="text-body-md font-body-md text-on-surface-variant mb-md">Reporting period for FY2023-24. Requires reconciled bank statements.</p>
              <div className="flex gap-sm">
                <Button 
                  variant="contained" 
                  className="bg-primary text-on-primary text-label-md font-label-md px-lg py-sm rounded-xl flex-grow transition-transform active:scale-95"
                >
                  File Now
                </Button>
                <Button 
                  variant="outlined" 
                  className="border border-outline-variant text-primary text-label-md font-label-md px-md py-sm rounded-xl"
                >
                  View Requirements
                </Button>
              </div>
            </div>
          </div>

          {/* Task Card: CIPA Annual Return */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-md flex gap-md relative">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary-fixed-dim rounded-l-xl"></div>
            <div className="flex-grow">
              <div className="flex justify-between items-start mb-xs">
                <Chip 
                  label="CIPA" 
                  className="bg-secondary-container text-on-secondary-container text-label-md font-label-md px-sm py-xs rounded"
                  size="small"
                />
                <span className="text-secondary text-label-md font-label-md">Due in 45 days</span>
              </div>
              <h4 className="text-body-lg font-bold text-primary mb-xs">CIPA Annual Return</h4>
              <p className="text-body-md font-body-md text-on-surface-variant mb-md">Confirmation of company details and directorship standing.</p>
              <div className="flex gap-sm">
                <Button 
                  variant="contained" 
                  className="bg-primary text-on-primary text-label-md font-label-md px-lg py-sm rounded-xl flex-grow transition-transform active:scale-95"
                >
                  Prepare Return
                </Button>
              </div>
            </div>
          </div>

          {/* Insight Section */}
          <div className="bg-surface-container rounded-xl p-md flex flex-row-reverse gap-md items-center">
            <div className="w-24 h-24 flex-shrink-0 bg-primary-container rounded-lg overflow-hidden border border-outline-variant">
              <img 
                alt="Botswana Landscape" 
                className="w-full h-full object-cover opacity-80"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAdyf6LWqf1OrNCBRRnLfC5gSomGuaf6c0b0Inx8m-CGhKXcUl-KhKMPrxLX7jr5d9p6K61WkZrT1ibyWTVdtNlDKbi1WPqLwdd6hke86Hhch0Gd9dsprPO_P__UX7TlsfbZ6wy3B2D1HOr5Qclfz0zBIu8NqAZdl6xddvYHiUWFYl9XLldFrO8HZZDJ2TJuLLy3gjDY3XsNRWktJztSPJBGXCTBIrR-UoMBDi0wgwdsSUbN4VPGh1WCkoFdTtNTI0lAH6NREf8hpGb"
              />
            </div>
            <div className="flex-grow">
              <p className="text-caption font-label-md text-on-primary-container mb-xs uppercase">Compliance Tip</p>
              <h5 className="text-body-md font-bold text-primary">Did you know?</h5>
              <p className="text-body-md font-body-md text-on-surface-variant">Late CIPA filings incur a recurring monthly fee. File early to save BWP 500.</p>
            </div>
          </div>
        </section>
      </main>

      {/* BottomNavBar */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center h-20 bg-surface px-2 pb-safe border-t border-outline-variant shadow-lg rounded-t-xl">
        <a className="flex flex-col items-center justify-center bg-secondary-container text-on-secondary-container rounded-full px-4 py-1 transition-transform duration-200 scale-95" href="#">
          <Dashboard style={{ fontVariationSettings: "'FILL' 1" }} />
          <span className="text-label-md font-label-md">Home</span>
        </a>
        <a className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1 hover:bg-surface-container-high" href="#">
          <FolderShared />
          <span className="text-label-md font-label-md">Vault</span>
        </a>
        <a className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1 hover:bg-surface-container-high" href="#">
          <Analytics />
          <span className="text-label-md font-label-md">Reports</span>
        </a>
        <a className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1 hover:bg-surface-container-high" href="#">
          <Settings />
          <span className="text-label-md font-label-md">Settings</span>
        </a>
      </nav>

      {/* FAB */}
      <button className="fixed right-container-margin bottom-24 bg-primary text-on-primary w-14 h-14 rounded-xl shadow-lg flex items-center justify-center active:scale-95 transition-transform">
        <Add />
      </button>
    </div>
  );
};

export default ComplianceDashboard;