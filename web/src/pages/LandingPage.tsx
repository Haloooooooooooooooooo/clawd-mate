import React from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
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
          <button className="px-8 py-2.5 rounded-xl bg-white/80 border-none shadow-[2px_2px_0_#F3D4C4] hover:bg-white transition-all cursor-pointer font-bold">
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
    </div>
  );
};

export default LandingPage;
