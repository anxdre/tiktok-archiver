<template>
    <NuxtPage />
</template>
<style>
      :root {
        --dark-bg: #0b0f14;
        --dark-surface: #1a1f2e;
        --dark-border: #2a3142;
        --accent: #3b82f6;
        --accent-hover: #2563eb;
        --success: #10b981;
        --warning: #f59e0b;
        --error: #ef4444;
        --text-primary: #f1f5f9;
        --text-secondary: #cbd5e1;
      }
      html,
      body{
        padding: 0!important;
        margin: 0!important;
      }

      .app-container {
        min-height: 100vh;
        background: linear-gradient(135deg, var(--dark-bg) 0%, #0d1117 100%);
        font-family: system-ui, -apple-system, sans-serif;
        color: var(--text-primary);
      }

      .content-wrapper {
        max-width: 800px;
        margin: 0 auto;
      }

      .header-section {
        margin-bottom: 48px;
      }

      .header-title {
        font-size: 36px;
        font-weight: 700;
        margin: 0 0 8px 0;
        background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .header-subtitle {
        font-size: 14px;
        color: var(--text-secondary);
        margin: 0;
      }

      .input-section {
        margin-bottom: 32px;
      }

      .input-group {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }

      .username-input {
        flex: 1;
        min-width: 200px;
        padding: 12px 16px;
        background: var(--dark-surface);
        border: 1px solid var(--dark-border);
        border-radius: 12px;
        color: var(--text-primary);
        font-size: 14px;
        transition: all 0.3s ease;
        outline: none;
      }

      .username-input:hover {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      .username-input:focus {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
      }

      .archive-button {
        padding: 12px 24px;
        background: var(--accent);
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 8px;
        white-space: nowrap;
      }

      .archive-button:hover:not(:disabled) {
        background: var(--accent-hover);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
      }

      .archive-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .job-card {
        background: var(--dark-surface);
        border: 1px solid var(--dark-border);
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transition: all 0.3s ease;
      }

      .job-card:hover {
        border-color: var(--accent);
        box-shadow: 0 8px 16px rgba(59, 130, 246, 0.15);
      }

      .job-header {
        display: flex;
        justify-content: space-between;
        align-items: start;
        margin-bottom: 20px;
      }

      .job-info {
        flex: 1;
      }

      .job-username {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 4px 0;
        color: var(--text-primary);
      }

      .job-id {
        font-size: 12px;
        color: var(--text-secondary);
        font-family: monospace;
        margin: 0;
      }

      .status-badge {
        display: inline-block;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        text-transform: capitalize;
        transition: all 0.3s ease;
      }

      .status-done {
        background: rgba(16, 185, 129, 0.15);
        color: #6ee7b7;
      }

      .status-pending {
        background: rgba(156, 163, 175, 0.2);
        color: #d1d5db;
      }

      .status-processing {
        background: rgba(59, 130, 246, 0.2);
        color: #93c5fd;
        animation: pulse-blue 2s infinite;
      }

      .status-zipping {
        background: rgba(245, 158, 11, 0.2);
        color: #fcd34d;
        animation: pulse-yellow 2s infinite;
      }

      .status-finished,
      .status-finished_partial {
        background: rgba(16, 185, 129, 0.2);
        color: #6ee7b7;
      }

      .status-failed {
        background: rgba(239, 68, 68, 0.2);
        color: #fca5a5;
      }

      @keyframes pulse-blue {

        0%,
        100% {
          opacity: 1;
        }

        50% {
          opacity: 0.7;
        }
      }

      @keyframes pulse-yellow {

        0%,
        100% {
          transform: scale(1);
        }

        50% {
          transform: scale(1.05);
        }
      }

      .progress-section {
        margin: 20px 0;
      }

      .progress-label {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        color: var(--text-secondary);
        margin-bottom: 8px;
      }

      .progress-bar-container {
        width: 100%;
        height: 8px;
        background: var(--dark-bg);
        border-radius: 4px;
        overflow: hidden;
        box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      .progress-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--accent) 0%, #60a5fa 100%);
        border-radius: 4px;
        transition: width 0.4s ease;
        box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
      }

      .progress-text {
        font-size: 12px;
        color: var(--text-secondary);
        margin-top: 6px;
      }

      .error-message {
        margin-top: 16px;
        padding: 12px;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 8px;
        color: #fca5a5;
        font-size: 13px;
        word-break: break-word;
      }

      .download-button {
        display: inline-block;
        margin-top: 16px;
        padding: 10px 20px;
        background: var(--success);
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        text-decoration: none;
      }

      .download-button:hover {
        background: #059669;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
      }

      .last-updated {
        font-size: 11px;
        color: var(--text-secondary);
        margin-top: 12px;
      }

      .limit-badge {
        display: inline-block;
        margin-left: 8px;
        padding: 4px 8px;
        background: rgba(245, 158, 11, 0.15);
        border: 1px solid rgba(245, 158, 11, 0.3);
        color: #fcd34d;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
      }

      .input-row {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 12px;
      }

      .input-row:last-child {
        margin-bottom: 0;
      }

      .max-videos-input {
        flex: 0 0 auto;
        width: 140px;
        padding: 12px 16px;
        background: var(--dark-surface);
        border: 1px solid var(--dark-border);
        border-radius: 12px;
        color: var(--text-primary);
        font-size: 14px;
        transition: all 0.3s ease;
        outline: none;
      }

      .max-videos-input:hover {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      .max-videos-input:focus {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
      }

      .max-videos-label {
        display: block;
        font-size: 12px;
        color: var(--text-secondary);
        margin-bottom: 4px;
      }

      .empty-state {
        text-align: center;
        padding: 24px;
        color: var(--text-secondary);
        font-size: 14px;
      }
</style>