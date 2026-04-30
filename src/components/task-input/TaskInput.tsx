import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SimpleMode } from './SimpleMode';
import { StructuredMode } from './StructuredMode';
import type { Task } from '../../types/task';

interface TaskInputProps {
  onTaskStart: (task: Task) => void;
  keepCurrentActiveTask?: boolean;
}

export function TaskInput({ onTaskStart, keepCurrentActiveTask = false }: TaskInputProps) {
  const [mode, setMode] = useState<'simple' | 'structured'>('simple');

  return (
    <div className="flex w-full flex-col" data-window-measure="content">
      <div className="mb-4 flex gap-2">
        <label className="mode-switch" aria-label="Toggle task mode">
          <input
            type="checkbox"
            checked={mode === 'structured'}
            onChange={(e) => setMode(e.target.checked ? 'structured' : 'simple')}
          />
          <span>极简模式</span>
          <span>结构模式</span>
        </label>
        <style>{`
          .mode-switch {
            --_switch-bg-clr: #0a2e26;
            --_switch-padding: 3px;
            --_slider-bg-clr: #3fffd5;
            --_slider-bg-clr-on: #3fffd5;
            --_slider-txt-clr: #ffffff;
            --_label-padding: 0.5rem 1.25rem;
            --_switch-easing: cubic-bezier(0.47, 1.64, 0.41, 0.8);
            width: fit-content;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            position: relative;
            isolation: isolate;
            border-radius: 9999px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
          }
          .mode-switch input[type="checkbox"] {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border-width: 0;
          }
          .mode-switch > span {
            display: grid;
            place-content: center;
            transition: opacity 300ms ease-in-out 150ms;
            padding: var(--_label-padding);
            color: var(--_slider-txt-clr);
          }
          .mode-switch::before,
          .mode-switch::after {
            content: "";
            position: absolute;
            border-radius: inherit;
          }
          .mode-switch::before {
            background-color: var(--_slider-bg-clr);
            inset: var(--_switch-padding) 50% var(--_switch-padding) var(--_switch-padding);
            transition: inset 500ms var(--_switch-easing), background-color 500ms ease-in-out;
            z-index: -1;
            box-shadow: inset 0 1px 1px rgba(0,0,0,0.3), 0 1px rgba(255,255,255,0.3);
          }
          .mode-switch::after {
            background-color: var(--_switch-bg-clr);
            inset: 0;
            z-index: -2;
          }
          .mode-switch:has(input:checked):hover > span:first-of-type,
          .mode-switch:has(input:not(:checked)):hover > span:last-of-type {
            opacity: 1;
            transition-delay: 0ms;
            transition-duration: 100ms;
          }
          .mode-switch:has(input:checked):hover::before {
            inset: var(--_switch-padding) var(--_switch-padding) var(--_switch-padding) 45%;
          }
          .mode-switch:has(input:not(:checked)):hover::before {
            inset: var(--_switch-padding) 45% var(--_switch-padding) var(--_switch-padding);
          }
          .mode-switch:has(input:checked)::before {
            background-color: var(--_slider-bg-clr-on);
            inset: var(--_switch-padding) var(--_switch-padding) var(--_switch-padding) 50%;
          }
          .mode-switch > span:last-of-type,
          .mode-switch > input:checked + span:first-of-type {
            opacity: 0.75;
          }
          .mode-switch > input:checked ~ span:last-of-type {
            opacity: 1;
          }
          .mode-switch:has(input:not(:checked)) > span:first-of-type,
          .mode-switch:has(input:checked) > span:last-of-type {
            color: #212121;
          }
          .island-input {
            border-radius: 0.8rem;
            background: #1a1e24;
            box-shadow:
              inset 4px 4px 8px #0e1013,
              inset -4px -4px 8px #2e3440,
              0px 0px 60px rgba(63, 255, 213, 0),
              0px 0px 60px rgba(63, 255, 213, 0);
            width: 100%;
            padding: 0.7rem 0.875rem;
            border: 1px solid transparent;
            color: white;
            transition: all 0.3s ease-in-out;
          }
          .island-input:focus {
            border-color: rgba(63, 255, 213, 0.55);
            outline: none;
            box-shadow:
              inset 0px 0px 8px rgba(63, 255, 213, 0.2),
              inset 0px 0px 8px rgba(63, 255, 213, 0.1),
              0px 0px 50px rgba(63, 255, 213, 0.35),
              0px 0px 50px rgba(63, 255, 213, 0.18);
          }
          .island-input::placeholder {
            color: rgba(255, 255, 255, 0.3);
          }
          .preset-btn {
            border-radius: 0.8rem;
            background: #1a1e24;
            box-shadow:
              inset 4px 4px 8px #0e1013,
              inset -4px -4px 8px #2e3440;
            padding: 0.35rem 0.75rem;
            font-size: 0.875rem;
            border: 1px solid transparent;
            color: rgba(255, 255, 255, 0.7);
            transition: all 0.2s ease-in-out;
          }
          .preset-btn-active {
            background: #3fffd5;
            color: #212121;
            box-shadow:
              inset 0px 0px 6px rgba(63, 255, 213, 0.4),
              0px 0px 20px rgba(63, 255, 213, 0.3);
            font-weight: 600;
          }
          .preset-input {
            border-radius: 0.8rem;
            background: #3fffd5;
            box-shadow: 0px 0px 16px rgba(63, 255, 213, 0.25);
            padding: 0.35rem 0.5rem;
            width: 5rem;
            text-align: center;
            font-size: 0.875rem;
            color: #212121;
            font-weight: 600;
            border: none;
            outline: none;
          }
          .preset-input:focus {
            box-shadow: 0px 0px 24px rgba(63, 255, 213, 0.45);
          }
        `}</style>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'simple' ? (
          <motion.div
            key="simple"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="w-full"
          >
            <SimpleMode
              onStart={onTaskStart}
              activateOnStart
              switchToTaskOnStart={!keepCurrentActiveTask}
            />
          </motion.div>
        ) : (
          <motion.div
            key="structured"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full"
          >
            <StructuredMode
              onStart={onTaskStart}
              activateOnStart
              switchToTaskOnStart={!keepCurrentActiveTask}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
