import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../store/useStore';
import { getUserWithProfile, upsertUserProfile } from '../lib/profileRepository';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const setLoggedIn = useStore((state) => state.setLoggedIn);
  const showToast = useStore((state) => state.showToast);

  const [isLoginDrawerOpen, setIsLoginDrawerOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const desktopDownloadUrl = import.meta.env.VITE_DESKTOP_DOWNLOAD_URL || 'https://github.com';
  const normalizedDesktopDownloadUrl = desktopDownloadUrl.startsWith('http')
    ? desktopDownloadUrl
    : `https://${desktopDownloadUrl}`;

  const openDesktopDownload = () => {
    const win = window.open(normalizedDesktopDownloadUrl, '_blank', 'noopener,noreferrer');
    if (!win) {
      window.location.href = normalizedDesktopDownloadUrl;
    }
  };

  const handleLoginClick = () => {
    setAuthMode('login');
    setAuthError('');
    setAuthSuccess('');
    setIsLoginDrawerOpen(true);
  };

  const handleCloseLoginDrawer = () => {
    setAuthMode('login');
    setAuthName('');
    setAuthPassword('');
    setAuthError('');
    setAuthSuccess('');
    setIsLoginDrawerOpen(false);
  };

  const handleAuthSubmit = async () => {
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError('请输入邮箱和密码');
      return;
    }
    if (authMode === 'register' && !authName.trim()) {
      setAuthError('请输入用户名');
      return;
    }
    if (!isSupabaseConfigured) {
      setAuthError('服务暂时不可用，请检查 Supabase 配置后重试');
      return;
    }

    setAuthSubmitting(true);
    setAuthError('');
    setAuthSuccess('');

    try {
      if (authMode === 'register') {
        const displayName = authName.trim();
        const registerEmail = authEmail.trim();
        const { data, error } = await supabase.auth.signUp({
          email: registerEmail,
          password: authPassword,
          options: {
            data: { display_name: displayName }
          }
        });
        if (error) throw error;
        if (data.user || data.session?.user) {
          await upsertUserProfile(data.user || data.session!.user, displayName);
          await supabase.auth.signOut();
          setLoggedIn(false, null, { clearDataOnLogout: true });
        }
        setAuthMode('login');
        setAuthName('');
        setAuthEmail(registerEmail);
        setAuthPassword('');
        setAuthSuccess('注册成功，请登录');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword
        });
        if (error) throw error;
        if (!data.user) throw new Error('登录失败，请稍后重试');

        const uiUser = await getUserWithProfile(data.user);
        setLoggedIn(true, uiUser, { clearDataOnLogout: false });
        showToast('登录成功');
        setIsLoginDrawerOpen(false);
        setAuthPassword('');
      }
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message.toLowerCase() : '';
      if (rawMessage.includes('already registered') || rawMessage.includes('user already registered')) {
        setAuthError('该邮箱已注册，请直接登录');
      } else if (rawMessage.includes('password should be at least')) {
        setAuthError('密码长度太短，请至少 6 位');
      } else if (rawMessage.includes('invalid login credentials') || rawMessage.includes('invalid credentials')) {
        setAuthError('账号或密码错误');
      } else if (rawMessage.includes('email not confirmed')) {
        setAuthError('该邮箱尚未完成验证，请先完成邮箱验证后再登录');
      } else {
        setAuthError(authMode === 'login' ? '登录失败，请稍后重试' : '注册失败，请稍后重试');
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  return (
    <div className="h-screen w-full bg-bg-primary text-text-dark flex flex-col relative overflow-hidden font-body">
      <nav className="w-full h-[88px] flex items-center justify-between px-16 z-50 shrink-0">
        <div className="flex items-center gap-20">
          <div className="flex items-center">
            <img src="/clawd.png" alt="Clawd" className="w-14 h-14 pixel-icon" style={{ imageRendering: 'pixelated' }} />
            <img src="/clawdmate.png" alt="ClawdMate" className="h-28 pixel-icon -ml-4 translate-y-2" style={{ imageRendering: 'pixelated' }} />
          </div>

          <div className="hidden md:flex items-center gap-10 text-lg">
            <div className="relative group cursor-pointer font-bold">
              <span className="text-primary">首页</span>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-primary/60 rounded-full" />
            </div>
            <a href="#" className="text-text-dark font-medium hover:text-primary transition-colors">功能</a>
            <a href="#" className="text-text-dark font-medium hover:text-primary transition-colors">关于我们</a>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleLoginClick}
            className="px-8 py-2.5 rounded-xl bg-white/80 border-none shadow-[2px_2px_0_#F3D4C4] hover:bg-white transition-all cursor-pointer font-bold"
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => navigate('/app/dashboard')}
            className="px-8 py-2.5 rounded-xl bg-primary text-white border-none shadow-[2px_2px_0_#D65D43] hover:opacity-90 transition-all cursor-pointer font-bold"
          >
            立即开始
          </button>
        </div>
      </nav>

      <main className="flex-1 w-full flex flex-col md:flex-row items-center px-16 relative">
        <div className="w-full md:w-[680px] z-10 flex flex-col items-start mt-[-160px]">
          <img
            src="/clawdmate.png"
            alt="ClawdMate"
            className="w-[640px] h-auto mb-0 pixel-icon -ml-12"
            style={{ imageRendering: 'pixelated' }}
          />

          <div style={{ transform: 'translateY(-180px)' }}>
            <h2 className="text-[38px] font-bold mb-5 leading-tight ml-10 mt-0">
              现在就<span className="text-primary">开始</span>做你想做的事情吧！
            </h2>
            <p className="text-text-secondary text-lg mb-5 max-w-[560px] leading-[1.8] ml-10">
              设置任务，开始倒计时。<br />
              不用复杂的 To-Do List，简单、温和、无压力。<br />
              让 Clawd 陪你一起专注学习，享受每一刻成长。
            </p>
            <div className="ml-10 flex items-center gap-6">
              <button
                type="button"
                onClick={() => navigate('/app/dashboard')}
                className="button-3d"
              >
                开始专注<span className="inline-block transition-transform group-hover:translate-x-1">→</span>
              </button>
              <button
                type="button"
                onClick={openDesktopDownload}
                className="button-3d !bg-white !text-ink !shadow-[6px_6px_0_#E6BE9E] hover:!bg-[#fffaf4]"
              >
                下载灵动岛
              </button>
            </div>
          </div>
        </div>

        <div className="absolute top-[-60px] right-0 w-[74vw] h-[90vh] min-h-[780px] overflow-hidden z-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover object-top"
            style={{
              WebkitMaskImage:
                'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.15) 8%, rgba(0,0,0,0.45) 13%, black 18%)',
              maskImage:
                'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.15) 8%, rgba(0,0,0,0.45) 13%, black 18%)'
            }}
          >
            <source src="/hero-video.mp4" type="video/mp4" />
          </video>

          <div
            className="absolute inset-x-0 top-0 h-[40px] z-20"
            style={{ background: 'linear-gradient(to bottom, #FFF4E8 0%, rgba(255,244,232,0) 100%)' }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-[12%] z-20"
            style={{ background: 'linear-gradient(to bottom, rgba(255,244,232,0) 0%, #FFF4E8 100%)' }}
          />
        </div>
      </main>

      <div className="absolute bottom-[60px] left-1/2 -translate-x-[55%] w-full max-w-[1300px] grid grid-cols-1 md:grid-cols-4 gap-6 px-16 z-20">
        <div className="bg-card-bg backdrop-blur-md rounded-[28px] border border-border-light p-6 flex items-center gap-5 hover:bg-white/90 transition-all cursor-default shadow-sm">
          <img src="/clock.png" alt="Tasks" className="w-16 h-16 pixel-icon" style={{ imageRendering: 'pixelated' }} />
          <div>
            <h3 className="font-bold text-lg mb-0.5">任务倒计时</h3>
            <p className="text-text-secondary text-xs leading-tight">设置目标，开始专注</p>
          </div>
        </div>

        <div className="bg-card-bg backdrop-blur-md rounded-[28px] border border-border-light p-6 flex items-center gap-5 hover:bg-white/90 transition-all cursor-default shadow-sm">
          <img src="/island.png" alt="Island" className="w-16 h-16 pixel-icon" style={{ imageRendering: 'pixelated' }} />
          <div>
            <h3 className="font-bold text-lg mb-0.5">灵动岛陪伴</h3>
            <p className="text-text-secondary text-xs leading-tight">专注时刻，灵动岛与你同在</p>
          </div>
        </div>

        <div className="bg-card-bg backdrop-blur-md rounded-[28px] border border-border-light p-6 flex items-center gap-5 hover:bg-white/90 transition-all cursor-default shadow-sm">
          <img src="/clawd.png" alt="Clawd" className="w-16 h-16 pixel-icon" style={{ imageRendering: 'pixelated' }} />
          <div>
            <h3 className="font-bold text-lg mb-0.5">Clawd 陪伴</h3>
            <p className="text-text-secondary text-xs leading-tight">可爱的像素宠物 Clawd</p>
          </div>
        </div>

        <div className="bg-card-bg backdrop-blur-md rounded-[28px] border border-border-light p-6 flex items-center gap-5 hover:bg-white/90 transition-all cursor-default shadow-sm">
          <img src="/heart.png" alt="Relax" className="w-16 h-16 pixel-icon" style={{ imageRendering: 'pixelated' }} />
          <div>
            <h3 className="font-bold text-lg mb-0.5">温和无压力</h3>
            <p className="text-text-secondary text-xs leading-tight">不需要复杂的计划</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isLoginDrawerOpen && (
          <div className="fixed inset-0 z-[120]">
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseLoginDrawer}
              className="absolute inset-0 bg-ink/30 backdrop-blur-sm border-0 p-0"
              aria-label="关闭登录抽屉"
            />

            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
              className="absolute right-0 top-0 h-full w-full max-w-md border-l-2 border-border-main bg-o5 p-8 shadow-[-6px_0_0_var(--color-o3)]"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-display font-bold text-ink">
                  {authMode === 'login' ? '登录 ClawdMate' : '注册 ClawdMate'}
                </h3>
                <button
                  type="button"
                  onClick={handleCloseLoginDrawer}
                  className="border-0 bg-transparent p-2 text-muted-text shadow-none hover:bg-[#FFF0DF]"
                  aria-label="关闭"
                >
                  <span className="text-2xl leading-none">×</span>
                </button>
              </div>

              <p className="mt-2 text-sm text-muted-text">
                {authMode === 'login' ? '登录后可同步你的任务与日报记录' : '创建账号后可同步你的任务与日报记录'}
              </p>

              <div className="mt-8 space-y-4">
                {authMode === 'register' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400 pl-1">用户名</label>
                    <input
                      type="text"
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
                    autoComplete="off"
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    placeholder="请输入密码"
                    className="w-full px-4 py-3 text-sm"
                  />
                </div>

                {authError && <p className="text-xs text-red-500 font-medium">{authError}</p>}
                {authSuccess && <p className="text-xs text-green-600 font-medium">{authSuccess}</p>}
              </div>

              <button
                type="button"
                disabled={authSubmitting}
                onClick={() => {
                  void handleAuthSubmit();
                }}
                className="w-full mt-8 pixel-button-primary py-3 font-bold disabled:opacity-60"
              >
                {authSubmitting ? '处理中...' : authMode === 'login' ? '立即登录' : '立即注册'}
              </button>

              <p className="mt-5 text-center text-xs text-stone-400 font-medium">
                {authMode === 'login' ? (
                  <>
                    还没有账号？
                    <button
                      type="button"
                      className="ml-1 border-0 bg-transparent p-0 text-primary-accent font-bold shadow-none hover:underline"
                      onClick={() => {
                        setAuthMode('register');
                        setAuthError('');
                        setAuthSuccess('');
                      }}
                    >
                      立即注册
                    </button>
                  </>
                ) : (
                  <>
                    已有账号？
                    <button
                      type="button"
                      className="ml-1 border-0 bg-transparent p-0 text-primary-accent font-bold shadow-none hover:underline"
                      onClick={() => {
                        setAuthMode('login');
                        setAuthError('');
                        setAuthSuccess('');
                      }}
                    >
                      返回登录
                    </button>
                  </>
                )}
              </p>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LandingPage;
