/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import DailyReportView from './pages/DailyReportView';
import { HistoryCardView } from './components/history/HistoryViews';
import { pullTasksForWeb } from './lib/islandBridge';
import { useStore } from './store/useStore';
import LandingPage from './pages/LandingPage';

export default function App() {
  const applyBridgeTask = useStore((state) => state.applyBridgeTask);

  useEffect(() => {
    let cancelled = false;

    const syncTasks = async () => {
      const tasks = await pullTasksForWeb();
      if (cancelled || tasks.length === 0) return;

      tasks.forEach((task) => {
        applyBridgeTask(task);
      });
    };

    void syncTasks();
    const timer = window.setInterval(() => {
      void syncTasks();
    }, 1200);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [applyBridgeTask]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app/*" element={
          <div className="min-h-screen bg-main-bg">
            <Sidebar />
            <main className="ml-64 min-h-screen">
              <Routes>
                <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/history" element={<HistoryCardView />} />
                <Route path="/report" element={<DailyReportView />} />
              </Routes>
            </main>
          </div>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
