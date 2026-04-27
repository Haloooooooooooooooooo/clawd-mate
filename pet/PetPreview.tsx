/**
 * 桌宠组件预览页面
 *
 * 使用方法：在 src/App.tsx 中临时替换为：
 * import { PetPreview } from '../pet/PetPreview'
 * function App() { return <PetPreview /> }
 */

import { useState } from 'react'
import { PetSprite, type PetStatus } from './index'

const ALL_STATUS: PetStatus[] = ['idle', 'working', 'alert', 'celebrate']

const STATUS_INFO: Record<PetStatus, { label: string; desc: string }> = {
  idle: { label: '睡觉', desc: '无任务时' },
  working: { label: '敲键盘', desc: '任务进行中' },
  alert: { label: '举牌感叹号', desc: '倒计时结束' },
  celebrate: { label: '撒星星', desc: '任务完成' },
}

export function PetPreview() {
  const [status, setStatus] = useState<PetStatus>('idle')
  const [size, setSize] = useState<'sm' | 'md' | 'lg'>('md')

  return (
    <div style={{
      padding: '40px',
      backgroundColor: '#1a1a2e',
      minHeight: '100vh',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <h1 style={{ marginBottom: '8px' }}>桌宠动画预览</h1>
      <p style={{ color: '#888', marginBottom: '24px' }}>
        当前状态：<strong>{STATUS_INFO[status].label}</strong> ({STATUS_INFO[status].desc})
      </p>

      {/* 桌宠显示区域 */}
      <div style={{
        backgroundColor: '#16213e',
        borderRadius: '12px',
        padding: '60px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
      }}>
        <PetSprite status={status} size={size} />
      </div>

      {/* 状态切换 */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ marginRight: '12px', color: '#aaa' }}>状态：</label>
        {ALL_STATUS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            style={{
              padding: '10px 20px',
              marginRight: '8px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: status === s ? '#e94560' : '#0f3460',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            {STATUS_INFO[s].label}
          </button>
        ))}
      </div>

      {/* 尺寸切换 */}
      <div style={{ marginBottom: '32px' }}>
        <label style={{ marginRight: '12px', color: '#aaa' }}>尺寸：</label>
        {(['sm', 'md', 'lg'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSize(s)}
            style={{
              padding: '10px 20px',
              marginRight: '8px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: size === s ? '#e94560' : '#0f3460',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            {s === 'sm' ? '小' : s === 'md' ? '中' : '大'}
          </button>
        ))}
      </div>

      {/* 配置信息 */}
      <div style={{
        padding: '16px',
        backgroundColor: '#0f3460',
        borderRadius: '8px',
        fontSize: '13px',
        color: '#aaa',
      }}>
        <p style={{ margin: '0 0 8px 0' }}><strong>帧图信息：</strong></p>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ paddingRight: '16px' }}>idle / alert:</td>
              <td>512×768 × 4帧</td>
            </tr>
            <tr>
              <td style={{ paddingRight: '16px' }}>working / celebrate:</td>
              <td>362×724 × 6帧</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PetPreview
