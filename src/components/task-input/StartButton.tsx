import { type ButtonHTMLAttributes } from 'react';

interface StartButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: string;
}

const buttonStyles = `
  .animated-button {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    justify-content: center;
    min-width: 156px;
    padding: 10px 24px;
    border: 3px solid;
    border-color: transparent;
    font-size: 14px;
    line-height: 1;
    background-color: inherit;
    border-radius: 100px;
    font-weight: 600;
    color: #3fffd5;
    box-shadow: 0 0 0 2px #3fffd5;
    cursor: pointer;
    overflow: hidden;
    transition: transform 0.4s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.6s cubic-bezier(0.23, 1, 0.32, 1), color 0.4s ease, border-radius 0.4s ease;
  }
  .animated-button svg {
    position: absolute;
    width: 20px;
    fill: #3fffd5;
    z-index: 9;
    transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
  }
  .animated-button .arr-1 { right: 14px; }
  .animated-button .arr-2 { left: -25%; }
  .animated-button .circle {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 18px;
    height: 18px;
    background-color: #3fffd5;
    border-radius: 50%;
    opacity: 0;
    transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
  }
  .animated-button .text {
    position: relative;
    z-index: 1;
    transform: translateX(-10px);
    transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
  }
  .animated-button:hover {
    transform: translateY(-1px) scale(1.02);
    box-shadow: 0 0 0 12px transparent;
    color: #212121;
    border-radius: 12px;
  }
  .animated-button:hover .arr-1 { right: -25%; }
  .animated-button:hover .arr-2 { left: 14px; }
  .animated-button:hover .text { transform: translateX(10px); }
  .animated-button:hover svg { fill: #212121; }
  .animated-button:active {
    scale: 0.95;
    box-shadow: 0 0 0 4px #3fffd5;
  }
  .animated-button:hover .circle {
    width: 180px;
    height: 180px;
    opacity: 1;
  }
  .animated-button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
    pointer-events: none;
  }
`;

export function StartButton({ children = '开始任务', disabled, ...props }: StartButtonProps) {
  return (
    <>
      <style>{buttonStyles}</style>
      <button className="animated-button" disabled={disabled} {...props}>
        <svg viewBox="0 0 24 24" className="arr-2" xmlns="http://www.w3.org/2000/svg">
          <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z" />
        </svg>
        <span className="text">{children}</span>
        <span className="circle" />
        <svg viewBox="0 0 24 24" className="arr-1" xmlns="http://www.w3.org/2000/svg">
          <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z" />
        </svg>
      </button>
    </>
  );
}
