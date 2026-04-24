/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, History, FileText, LogOut, Plus, LogIn, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../../store/useStore';

export default function Sidebar() {
  const [showLogout, setShowLogout] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const { isLoggedIn, user, setLoggedIn, toggleIsland, isIslandVisible } = useStore();

  const navItems = [
    { name: '今日任务', path: '/dashboard', icon: LayoutDashboard },
    { name: '历史记录', path: '/history', icon: History },
    { name: '生成日报', path: '/report', icon: FileText },
  ];

  const handleOpenLogin = () => {
    setAuthMode('login');
    setShowLoginModal(true);
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 border-r-2 border-border-sidebar bg-sidebar-bg flex flex-col py-6 z-50">
      <div className="flex flex-col h-full space-y-8">
        <div className="px-5 flex items-center gap-3">
          <div className="w-14 h-14 bg-[#FFF8EC] rounded-[4px] flex items-center justify-center overflow-hidden border-2 border-border-main shadow-[3px_3px_0_#C9B69D]">
            <img
              alt="Orange pixel-art crab mascot"
              className="w-10 h-10 pixel-icon object-contain"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBAW6yqc6Zzd8cYC-fF5_1M3_jgDcSydLUmC_jRBP5MrrXfz7j48DgO5JzrOCksalEZmRvMhX7oTQveaEm-ieWPI7vL0g_piM5j5F5Kh-evEPHlxJdj0QF71TvmnJqj8aqU8ubjkI0MzAjmeXbg-kUyE-b9DUBI5mhWXvHIJRNBkOjNFsbypEUPzunWHSfvIB5JCzA6YpYjBZlE2fZdnfQPIWLHYiMBZP04AVkeFk91w_EcCCVC8g7m2r_BXEyBB5ZhI8_F3AnnMYty"
            />
          </div>
          <div>
            <h1 className="text-[36px] leading-none font-black tracking-tight text-primary font-display">ClawdMate</h1>
            <p className="text-[12px] text-muted-text font-bold mt-1 font-body">温和的高效</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-3 min-h-[56px] transition-colors text-[20px] border-2 rounded-[4px] font-body',
                  isActive
                    ? 'text-primary font-bold bg-soft-apricot border-[#F5C49B] border-l-4 border-l-primary'
                    : 'text-ink bg-[#FFF8EC] border-transparent hover:border-[#E3D2BA]'
                )
              }
            >
              <item.icon size={20} />
              <span className="font-semibold">{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-4 mt-auto">
          <button
            onClick={toggleIsland}
            className={cn(
              'w-full py-3 min-h-[54px] rounded-[4px] font-bold flex items-center justify-center gap-2 transition-all pixel-button-primary',
              isIslandVisible ? 'opacity-95' : ''
            )}
          >
            <Zap size={16} fill={isIslandVisible ? 'currentColor' : 'none'} />
            <span className="text-[18px] font-body">{isIslandVisible ? '关闭灵动岛' : '召唤灵动岛'}</span>
          </button>
        </div>

        <div className="px-4 pt-4 border-t-2 border-border-sidebar">
          <div className="relative">
            {isLoggedIn ? (
              <>
                <button
                  onClick={() => setShowLogout(!showLogout)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-[4px] transition-all group border-2 border-border-main bg-[#FFF8EC]',
                    showLogout ? 'bg-soft-apricot' : 'hover:bg-[#FFF0DF]'
                  )}
                >
                  <div className="w-9 h-9 rounded-[4px] bg-[#FFF8EC] flex items-center justify-center text-primary border-2 border-border-main shrink-0 font-display font-black text-xs">
                    {user?.avatar || 'AL'}
                  </div>
                  <div className="flex-1 text-left overflow-hidden">
                    <p className="text-xs font-bold text-ink truncate">{user?.name || 'Alex'}</p>
                    <p className="text-[10px] text-muted-text font-medium truncate">个人账户</p>
                  </div>
                </button>

                <AnimatePresence>
                  {showLogout && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-full left-0 w-full mb-3 bg-[#FFF8EC] border-2 border-border-main rounded-[4px] p-1.5 z-50 paper-texture"
                    >
                      <button
                        onClick={() => {
                          setLoggedIn(false);
                          setShowLogout(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-red-500 hover:bg-red-50 transition-colors text-xs font-bold rounded-[4px]"
                      >
                        <LogOut size={14} />
                        <span>退出登录</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <button
                onClick={handleOpenLogin}
                className="w-full flex items-center gap-3 p-2.5 rounded-[4px] bg-[#FFF8EC] text-ink border-2 border-border-main hover:bg-soft-apricot transition-all font-bold text-xs"
              >
                <div className="w-8 h-8 rounded-[4px] bg-soft-apricot border-2 border-border-main flex items-center justify-center shrink-0">
                  <LogIn size={16} />
                </div>
                <span>登录</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLoginModal(false)}
              className="absolute inset-0 bg-ink/40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#FFFDF7] rounded-[4px] p-8 border-2 border-border-main shadow-[5px_5px_0_#C9B69D] paper-texture overflow-hidden"
            >
              <div className="text-center space-y-2 mb-8">
                <h3 className="text-3xl font-display font-bold text-ink leading-tight">
                  {authMode === 'login' ? '欢迎回来' : '开启高效之旅'}
                </h3>
                <p className="text-muted-text text-sm font-medium">
                  {authMode === 'login' ? '登录以同步你的任务与日报' : '创建一个账户来管理你的每日成就'}
                </p>
              </div>

              <div className="space-y-4">
                {authMode === 'register' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400 pl-1">用户名</label>
                    <input type="text" placeholder="你的称呼" className="w-full px-4 py-3 text-sm" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400 pl-1">邮箱地址</label>
                  <input type="email" placeholder="alex@example.com" className="w-full px-4 py-3 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400 pl-1">密码</label>
                  <input type="password" placeholder="请输入密码" className="w-full px-4 py-3 text-sm" />
                </div>
              </div>

              <button
                onClick={() => {
                  setLoggedIn(true);
                  setShowLoginModal(false);
                }}
                className="w-full mt-8 pixel-button-primary py-3 font-bold"
              >
                <span>{authMode === 'login' ? '立即登录' : '立即注册'}</span>
              </button>

              <div className="mt-6 text-center">
                <p className="text-xs text-stone-400 font-medium">
                  {authMode === 'login' ? (
                    <>还没有账号？ <button onClick={() => setAuthMode('register')} className="text-primary-accent font-bold hover:underline">立即注册</button></>
                  ) : (
                    <>已有账号？ <button onClick={() => setAuthMode('login')} className="text-primary-accent font-bold hover:underline">返回登录</button></>
                  )}
                </p>
              </div>

              <button onClick={() => setShowLoginModal(false)} className="absolute top-6 right-6 p-2 rounded-[4px] hover:bg-[#FFF0DF] transition-colors text-stone-500">
                <Plus size={20} className="rotate-45" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </aside>
  );
}
