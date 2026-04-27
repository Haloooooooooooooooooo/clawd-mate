/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import DailyReportView from './pages/DailyReportView';
import PetPreviewPage from './pages/PetPreview';
import { HistoryCardView } from './components/history/HistoryViews';
import { pullTasksForWeb } from './lib/islandBridge';
import { useStore } from './store/useStore';
import LandingPage from './pages/LandingPage';

export default function App() {
  const applyBridgeTask = useStore((state) => state.applyBridgeTask);
  const toast = useStore((state) => state.toast);
  const clearToast = useStore((state) => state.clearToast);

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

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      clearToast();
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [toast, clearToast]);

  return (
    <BrowserRouter>
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            className="fixed top-5 left-1/2 z-[120] -translate-x-1/2 rounded-2xl border border-border-main bg-white px-4 py-3 text-sm font-medium text-ink shadow-[0_12px_30px_rgba(120,90,56,0.14)]"
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
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
                <Route path="/pet" element={<PetPreviewPage />} />
              </Routes>
            </main>
          </div>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
