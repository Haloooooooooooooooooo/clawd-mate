/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import DailyReportView from './pages/DailyReportView';
import { HistoryCardView } from './components/history/HistoryViews';
import TasksIsland from './components/dashboard/TasksIsland';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-main-bg">
        <Sidebar />
        <TasksIsland />
        <main className="ml-64 min-h-screen">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/history" element={<HistoryCardView />} />
            <Route path="/report" element={<DailyReportView />} />
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

