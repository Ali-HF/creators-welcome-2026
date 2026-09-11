/**
 * Creators Welcome 2026 - Application Utilities & Web Audio Engine
 */

window.AppUtils = (function () {
  // Web Audio Synthesizer Engine
  let audioCtx = null;

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSuccessTone() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      
      // Dual high chime (E5 -> A5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now); // E5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.1); // A5
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.35);
    } catch (e) {
      console.log('Audio playback prevented or unsupported', e);
    }
  }

  function playWarningTone() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Low buzz tone (150Hz square wave)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.setValueAtTime(120, now + 0.15);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
  function playScanBeep() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.50, now); // C6 high beep
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {
      console.log('Audio playback error', e);
    }
  }

  // Toast Notification Engine
  function showToast(message, type = 'info', duration = 4000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `
      <span style="font-size: 1.2rem;">${icon}</span>
      <div style="flex:1;">
        <div style="font-weight: 600; font-size: 0.9rem;">${message}</div>
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // Canvas Pass Downloader
  function downloadPassAsImage(elementId, filename = 'CW26-Pass.png') {
    const cardEl = document.getElementById(elementId);
    if (!cardEl) return;

    showToast('Generating high-res pass image...', 'info');

    // Simple HTML5 Canvas fallback rendering for pass card
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');

    // Background Gradient
    const grad = ctx.createLinearGradient(0, 0, 800, 1000);
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 1000);

    // Border
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 792, 992);

    // Header Banner
    ctx.fillStyle = '#6d28d9';
    ctx.fillRect(0, 0, 800, 160);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CREATORS WELCOME 2026', 400, 70);

    ctx.fillStyle = '#f3e8ff';
    ctx.font = '600 20px Inter, sans-serif';
    ctx.fillText('OFFICIAL LIVE ADMISSION PASS', 400, 115);

    // Pass details
    const attendeeName = cardEl.querySelector('.pass-attendee-name')?.innerText || 'ATTENDEE';
    const attendeeRoll = cardEl.querySelector('.pass-attendee-roll')?.innerText || '#ROLL';
    const passId = cardEl.querySelector('.pass-id-chip')?.innerText || '#CW26-000';
    const qrImg = cardEl.querySelector('.pass-qr-frame img');

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px Inter, sans-serif';
    ctx.fillText(attendeeName, 400, 240);

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 26px "JetBrains Mono", monospace';
    ctx.fillText(attendeeRoll, 400, 285);

    // Metadata box
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(100, 320, 600, 100);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.strokeRect(100, 320, 600, 100);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('DATE & TIME', 130, 355);
    ctx.fillText('VENUE', 450, 355);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.fillText('20 SEP 2026 | 01:00 PM - 05:00 PM', 130, 390);
    ctx.fillText('GRAND IMPERIAL', 450, 390);

    // QR Image drawing
    if (qrImg && qrImg.complete && qrImg.naturalWidth > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(250, 460, 300, 300);
      ctx.drawImage(qrImg, 260, 470, 280, 280);
      triggerDownload();
    } else {
      // Fallback if image loading
      const tempImg = new Image();
      tempImg.crossOrigin = 'anonymous';
      const qrSrc = qrImg ? qrImg.src : `https://quickchart.io/qr?text=${encodeURIComponent(passId)}&size=300`;
      tempImg.src = qrSrc;
      tempImg.onload = () => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(250, 460, 300, 300);
        ctx.drawImage(tempImg, 260, 470, 280, 280);
        triggerDownload();
      };
      tempImg.onerror = () => {
        triggerDownload();
      };
    }

    function triggerDownload() {
      // Pass ID Pill
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 32px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(passId, 400, 840);

      ctx.fillStyle = '#64748b';
      ctx.font = '16px Inter, sans-serif';
      ctx.fillText('Present this QR Code at the entry gate for high-speed scanning.', 400, 920);

      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('Pass image downloaded!', 'success');
    }
  }

  function updateConnectionBadge() {
    const badge = document.getElementById('connectionStatusBadge');
    if (!badge) return;

    const scriptUrl = typeof CW26Api !== 'undefined' ? CW26Api.getScriptUrl() : (localStorage.getItem('cw26_script_url') || '');
    const isMock = typeof CW26Api !== 'undefined' ? CW26Api.isMockMode() : (!scriptUrl || scriptUrl.length < 10);

    if (!isMock && scriptUrl && scriptUrl.trim().length > 10) {
      badge.className = 'connection-badge live';
      badge.innerHTML = `<span class="pulse-dot"></span> LIVE GOOGLE SHEET`;
      badge.title = 'Connected to Live Google Apps Script API';
    } else {
      badge.className = 'connection-badge mock';
      badge.innerHTML = `<span class="pulse-dot"></span> DEMO / MOCK MODE`;
      badge.title = 'Click to configure Google Apps Script API URL';
    }
  }

  // Ensure Settings Modal exists on every page
  function ensureSettingsModal() {
    if (document.getElementById('settingsModal')) return;

    const modalHtml = `
      <div class="modal-overlay" id="settingsModal">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">⚙️ Backend API Configuration</h3>
            <button class="btn btn-ghost" data-close-modal style="padding: 0.25rem 0.5rem;">✕</button>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
            Paste your Google Apps Script Web App Deployment URL below to connect to live Google Sheets backend.
          </p>

          <div class="form-group">
            <label class="form-label">Google Apps Script Web App URL</label>
            <input type="text" id="inputScriptUrl" class="form-control" placeholder="https://script.google.com/macros/s/.../exec">
          </div>

          <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.5rem;">
            <button class="btn btn-secondary" data-close-modal>Cancel</button>
            <button class="btn btn-primary" onclick="AppUtils.saveSettings()">Save & Connect</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  function saveSettings() {
    const input = document.getElementById('inputScriptUrl');
    const url = input ? input.value.trim() : '';
    localStorage.setItem('cw26_script_url', url);
    updateConnectionBadge();
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.remove('open');
    showToast('Backend API URL saved! Connecting to Google Sheet...', 'success');
    if (typeof loadDashboardData === 'function') {
      loadDashboardData();
    }
  }

  // Global Init
  document.addEventListener('DOMContentLoaded', () => {
    ensureSettingsModal();
    updateConnectionBadge();

    const input = document.getElementById('inputScriptUrl');
    if (input) {
      input.value = typeof CW26Api !== 'undefined' ? CW26Api.getScriptUrl() : '';
    }

    const badge = document.getElementById('connectionStatusBadge');
    if (badge) {
      badge.addEventListener('click', () => {
        ensureSettingsModal();
        const input = document.getElementById('inputScriptUrl');
        if (input) input.value = typeof CW26Api !== 'undefined' ? CW26Api.getScriptUrl() : '';
        const modal = document.getElementById('settingsModal');
        if (modal) modal.classList.add('open');
      });
    }

    // Modal dismiss listeners
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-close-modal]') || e.target.closest('[data-close-modal]')) {
        const modal = e.target.closest('.modal-overlay');
        if (modal) modal.classList.remove('open');
      }
    });
  });

  return {
    getAudioContext,
    playScanBeep,
    playSuccessTone,
    playWarningTone,
    showToast,
    downloadPassAsImage,
    updateConnectionBadge,
    saveSettings
  };
})();
