/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { LogOut, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../../store/useStore';
import { getIslandState } from '../../lib/islandBridge';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { getUserWithProfile, upsertUserProfile } from '../../lib/profileRepository';

export default function Sidebar() {
  const [showLogout, setShowLogout] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const {
    isLoggedIn,
    user,
    setLoggedIn,
    hydrateCloudData,
    syncCloudData,
    toggleIsland,
    isIslandVisible,
    setIslandVisible,
    isLoginModalOpen,
    openLoginModal,
    closeLoginModal,
    showToast
  } = useStore();

  useEffect(() => {
    let cancelled = false;

    const syncState = async () => {
      const visible = await getIslandState();
      if (cancelled || visible === null) return;
      setIslandVisible(visible);
    };

    void syncState();
    const interval = window.setInterval(() => {
      void syncState();
    }, 1200);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [setIslandVisible]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoggedIn(false, null, { clearDataOnLogout: false });
      return;
    }

    let mounted = true;

    const bootstrap = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;
      if (error || !data.session?.user) {
        const shouldClear = useStore.getState().isLoggedIn;
        setLoggedIn(false, null, { clearDataOnLogout: shouldClear });
        return;
      }
      try {
        const uiUser = await getUserWithProfile(data.session.user);
        await upsertUserProfile(data.session.user, uiUser.name);
        const previousState = useStore.getState();
        const guestHistoryToImport = previousState.isLoggedIn ? [] : previousState.history;
        setLoggedIn(true, uiUser);
        if (uiUser.id) {
          await hydrateCloudData(uiUser.id, { guestHistoryToImport });
        }
      } catch (syncError) {
        console.error('[auth bootstrap] failed to hydrate cloud data', syncError);
      }
    };

    void bootstrap();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        void syncCloudData();
        const shouldClear = useStore.getState().isLoggedIn;
        setLoggedIn(false, null, { clearDataOnLogout: shouldClear });
        return;
      }
      void (async () => {
        try {
          const uiUser = await getUserWithProfile(session.user);
          await upsertUserProfile(session.user, uiUser.name);
          const previousState = useStore.getState();
          const guestHistoryToImport = previousState.isLoggedIn ? [] : previousState.history;
          setLoggedIn(true, uiUser);
          if (uiUser.id) {
            await hydrateCloudData(uiUser.id, { guestHistoryToImport });
          }
        } catch (syncError) {
          console.error('[auth state] failed to hydrate cloud data', syncError);
        }
      })();
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [hydrateCloudData, setLoggedIn, syncCloudData]);

  const navItems = [
    { name: '今日任务', path: '/app/dashboard' },
    { name: '历史记录', path: '/app/history' },
    { name: '生成日报', path: '/app/report' },
  ];

  const userInitial = (user?.avatar || user?.name?.trim()?.charAt(0) || 'AL').toUpperCase();

  const handleOpenLogin = () => {
    resetAuthForm();
    setAuthMode('login');
    openLoginModal();
  };

  const resetAuthForm = () => {
    setAuthName('');
    setAuthEmail('');
    setAuthPassword('');
    setAuthError('');
    setAuthSuccess('');
  };

  const normalizeRegisterErrorMessage = (rawMessage: string) => {
    const message = rawMessage.toLowerCase();
    if (message.includes('already registered') || message.includes('user already registered')) {
      return '该邮箱已注册，请直接登录';
    }
    if (message.includes('password should be at least')) {
      return '密码长度太短，请至少 6 位';
    }
    return '注册失败，请稍后重试';
  };

  const resolveLoginErrorMessage = async (rawMessage: string, email: string) => {
    const message = rawMessage.toLowerCase();
    if (message.includes('email not confirmed')) {
      return '该邮箱尚未完成验证，请先在 Supabase 开启“关闭邮箱验证”或完成验证';
    }
    if (message.includes('user not found') || message.includes('no user found')) {
      return '该账号尚未注册';
    }
    if (message.includes('wrong password')) {
      return '密码错误';
    }

    if (message.includes('invalid login credentials') || message.includes('invalid credentials')) {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.rpc('is_email_registered', { p_email: normalizedEmail });
      if (error) {
        return '账号或密码错误';
      }
      return data ? '密码错误' : '该账号尚未注册';
    }
    return '登录失败，请稍后重试';
  };

  const handleAuthSubmit = async () => {
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError('请输入邮箱和密码');
      setAuthSuccess('');
      return;
    }
    if (authMode === 'register' && !authName.trim()) {
      setAuthError('请输入用户名');
      setAuthSuccess('');
      return;
    }
    if (!isSupabaseConfigured) {
      setAuthError('服务暂时不可用，请检查 Supabase 配置后重试');
      setAuthSuccess('');
      return;
    }
    setAuthSubmitting(true);
    setAuthError('');
    setAuthSuccess('');
    try {
      if (authMode === 'register') {
        const displayName = authName.trim();
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
          options: {
            data: {
              display_name: displayName
            }
          }
        });
        if (error) throw error;
        if (data.user || data.session?.user) {
          await upsertUserProfile(data.user || data.session!.user, displayName);
          await supabase.auth.signOut();
          setLoggedIn(false, null, { clearDataOnLogout: true });
          setAuthSuccess('注册成功，请直接登录');
          setAuthMode('login');
          setAuthName('');
          setAuthEmail('');
          setAuthPassword('');
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword
        });
        if (error) throw error;
        resetAuthForm();
        closeLoginModal();
        showToast('登录成功');
        return;
      }
    } catch (error) {
      const rawMessage = error instanceof Error && error.message ? error.message : '';
      const message =
        authMode === 'login'
          ? await resolveLoginErrorMessage(rawMessage, authEmail)
          : normalizeRegisterErrorMessage(rawMessage);
      setAuthError(message);
      setAuthSuccess('');
    } finally {
      setAuthSubmitting(false);
    }
  };

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-[280px] shrink-0 flex-col border-r-2 border-border-sidebar bg-sidebar-bg">
      <div className="border-b-2 border-border-sidebar bg-warm-paper px-5 py-6">
        <div className="flex items-start gap-1.5">
          <div className="-mt-1 flex h-[68px] w-[68px] shrink-0 items-center justify-center overflow-visible bg-transparent">
            <img
              alt="ClawdMate mascot"
              className="h-16 w-16 object-contain pixel-icon"
              src="/clawd.png"
            />
          </div>
          <div className="min-w-0 pt-1">
            <h1 className="font-display text-[28px] font-bold leading-none tracking-[0.04em] text-ink">ClawdMate</h1>
            <p className="mt-1 text-[12px] font-medium tracking-[0.22em] text-muted-text">温和的高效</p>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <nav className="flex-1 space-y-2 px-5 py-6">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'group flex min-h-[62px] items-center gap-4 px-5 py-4 text-[18px] font-medium text-i2 transition-colors',
                  isActive
                    ? 'border border-border-main bg-soft-apricot text-primary shadow-[2px_2px_0_var(--color-o3)]'
                    : 'border border-transparent bg-transparent text-i2 hover:bg-[#fff8f2] hover:text-ink'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'h-3 w-3 shrink-0 border-[1.5px] transition-colors',
                      isActive ? 'border-primary bg-primary' : 'border-[color:var(--color-i4)] bg-transparent'
                    )}
                  />
                  <span className={cn('truncate', isActive ? 'font-semibold' : 'font-medium')}>{item.name}</span>
                </>
              )}
            </NavLink>
          ))}

        </nav>

        <div className="border-t-2 border-border-sidebar px-5 py-6">
          <Link
            to="/"
            className="mb-3 flex min-h-[44px] w-full items-center justify-center gap-2 border border-border-main/60 bg-warm-paper/70 px-4 py-2 text-[13px] font-semibold tracking-[0.02em] text-muted-text shadow-[2px_2px_0_rgba(44,32,24,0.22)] transition-colors hover:bg-[#fff8f2] hover:text-ink"
          >
            <span aria-hidden="true" className="text-[13px]">←</span>
            <span>返回首页</span>
          </Link>

          <button
            onClick={toggleIsland}
            className={cn(
              'flex min-h-[62px] w-full items-center justify-center gap-3 px-5 py-4 text-[16px] font-semibold tracking-[0.03em] pixel-button-primary',
              isIslandVisible ? 'opacity-95' : ''
            )}
          >
            <span className="h-3 w-3 shrink-0 rounded-full border-2 border-white/80" />
            <span>{isIslandVisible ? '关闭灵动岛' : '召唤灵动岛'}</span>
          </button>

          <div className="relative mt-4">
            {isLoggedIn ? (
              <>
                <button
                  onClick={() => setShowLogout(!showLogout)}
                  className={cn(
                    'flex min-h-[52px] w-full items-center gap-3 border border-transparent bg-transparent px-3 py-2 text-left text-[13px] font-medium text-muted-text shadow-none',
                    showLogout ? 'bg-[#fff1e5]' : 'hover:bg-[#fff8f2]'
                  )}
                >
                  <span className="text-[16px] text-i3">→</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{user?.name || '用户'}</p>
                    <p className="truncate text-[11px] text-muted-text">个人账户</p>
                  </div>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-border-main bg-bg text-[11px] font-bold text-primary shadow-[1px_1px_0_var(--color-o3)]">
                    {userInitial}
                  </div>
                </button>

                <AnimatePresence>
                  {showLogout && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.96 }}
                      className="absolute bottom-full left-0 z-50 mb-3 w-full border-2 border-border-main bg-o5 p-2 shadow-[3px_3px_0_var(--color-o3)]"
                    >
                      <button
                        onClick={() => {
                          void (async () => {
                            try {
                              await syncCloudData();
                            } catch (error) {
                              console.warn('[logout] failed to sync before sign out', error);
                            } finally {
                              await supabase.auth.signOut();
                              setLoggedIn(false, null, { clearDataOnLogout: true });
                              setShowLogout(false);
                              showToast('已退出登录');
                            }
                          })();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-[13px] font-semibold text-red-500 shadow-none hover:bg-red-50"
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
                className="flex min-h-[48px] w-full items-center gap-3 border border-transparent bg-transparent px-3 py-2 text-left text-[13px] font-medium text-muted-text shadow-none hover:bg-[#fff8f2]"
              >
                <span className="text-[16px] text-i3">→</span>
                <span className="font-medium text-muted-text">登录</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isLoginModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                resetAuthForm();
                closeLoginModal();
              }}
              className="absolute inset-0 bg-ink/40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md overflow-hidden border-2 border-border-main bg-o5 p-8 shadow-[5px_5px_0_var(--color-o3)] paper-texture"
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
                    <input
                      type="text"
                      name="clawdmate_register_display_name"
                      autoComplete="off"
                      value={authName}
                      onChange={(event) => setAuthName(event.target.value)}
                      placeholder="你的称呼"
                      className="w-full px-4 py-3 text-sm"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400 pl-1">邮箱地址</label>
                  <input
                    type="email"
                    name={authMode === 'login' ? 'clawdmate_login_email' : 'clawdmate_register_email'}
                    autoComplete="off"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    placeholder="alex@example.com"
                    className="w-full px-4 py-3 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400 pl-1">密码</label>
                  <input
                    type="password"
                    name={authMode === 'login' ? 'clawdmate_login_password' : 'clawdmate_register_password'}
                    autoComplete="new-password"
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    placeholder="请输入密码"
                    className="w-full px-4 py-3 text-sm"
                  />
                </div>
                {authError && (
                  <p className="text-xs text-red-500 font-medium">{authError}</p>
                )}
                {authSuccess && (
                  <p className="text-xs text-green-600 font-medium">{authSuccess}</p>
                )}
              </div>

                      <button
                        onClick={() => {
                          void handleAuthSubmit();
                        }}
                disabled={authSubmitting}
                className="w-full mt-8 pixel-button-primary py-3 font-bold"
              >
                <span>
                  {authSubmitting ? '处理中...' : authMode === 'login' ? '立即登录' : '立即注册'}
                </span>
              </button>

              <div className="mt-6 text-center">
                <p className="text-xs text-stone-400 font-medium">
                  {authMode === 'login' ? (
                    <>还没有账号？ <button onClick={() => { resetAuthForm(); setAuthMode('register'); }} className="border-0 bg-transparent p-0 text-primary-accent font-bold shadow-none hover:underline">立即注册</button></>
                  ) : (
                    <>已有账号？ <button onClick={() => { resetAuthForm(); setAuthMode('login'); }} className="border-0 bg-transparent p-0 text-primary-accent font-bold shadow-none hover:underline">返回登录</button></>
                  )}
                </p>
              </div>

              <button onClick={() => { resetAuthForm(); closeLoginModal(); }} className="absolute top-6 right-6 border-0 bg-transparent p-2 text-stone-500 shadow-none hover:bg-[#FFF0DF] transition-colors">
                <Plus size={20} className="rotate-45" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </aside>
  );
}
