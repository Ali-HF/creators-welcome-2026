/**
 * Creators Welcome 2026 - API Client & Mock Backend Engine
 */

window.CW26Api = (function () {
  // LocalStorage Mock Backend Store
  const MOCK_STORAGE_KEY = 'cw26_mock_passes_db';
  const DEFAULT_PRICE = 2500;

  function initMockStore() {
    let store = localStorage.getItem(MOCK_STORAGE_KEY);
    if (!store) {
      const initialPasses = [
        {
          passId: '#CW26-001',
          name: 'Zainab Ahmed',
          rollNo: 'CS-2024-042',
          amount: 2500,
          status: 'used',
          createdIso: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
          scannedIso: new Date(Date.now() - 3600000 * 5).toISOString(),
          email: 'zainab@example.com',
          whatsapp: '+923001234567'
        },
        {
          passId: '#CW26-002',
          name: 'Hamza Khan',
          rollNo: 'SE-2024-019',
          amount: 2500,
          status: 'unused',
          createdIso: new Date(Date.now() - 3600000 * 18).toISOString(),
          scannedIso: '',
          email: 'hamza@example.com',
          whatsapp: '+923009876543'
        },
        {
          passId: '#CW26-003',
          name: 'Ayesha Raza',
          rollNo: 'AI-2024-008',
          amount: 2500,
          status: 'unused',
          createdIso: new Date(Date.now() - 3600000 * 4).toISOString(),
          scannedIso: '',
          email: 'ayesha@example.com',
          whatsapp: ''
        }
      ];
      localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(initialPasses));
      return initialPasses;
    }
    return JSON.parse(store);
  }

  function saveMockStore(data) {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(data));
  }

  const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw2NUJtxC3bwhLne35wNoHzNyOBtMMWCXNXtKCfr-SGqgjq5nn1B70A9fdXulSlohbC/exec';

  function getScriptUrl() {
    return (localStorage.getItem('cw26_script_url') || DEFAULT_SCRIPT_URL).trim();
  }

  function isMockMode() {
    const url = getScriptUrl();
    return !url || url.length < 10 || !url.startsWith('http');
  }

  /**
   * Universal Fetcher with AbortController 20s timeout
   */
  async function callApi(action, payload = {}) {
    if (isMockMode()) {
      return executeMockAction(action, payload);
    }

    const scriptUrl = getScriptUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout max

    try {
      // Send as POST text JSON to bypass CORS preflight restrictions in Google Apps Script
      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({ action, ...payload }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      const resData = await response.json();
      return resData;
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`API call failed for action "${action}". Falling back to local Mock Store:`, err);
      AppUtils.showToast(`Live API unavailable (${err.name === 'AbortError' ? 'Timeout' : 'Network'}). Using Local Store.`, 'warning');
      return executeMockAction(action, payload);
    }
  }

  /**
   * Mock Engine Implementation
   */
  async function executeMockAction(action, payload) {
    // Artificial latency for realistic feel
    await new Promise(r => setTimeout(r, 250));

    const passes = initMockStore();

    if (action === 'getStats') {
      const totalIssued = passes.length;
      const scannedCount = passes.filter(p => p.status === 'used').length;
      const unusedCount = totalIssued - scannedCount;
      const totalRevenue = passes.reduce((acc, p) => acc + (Number(p.amount) || DEFAULT_PRICE), 0);
      const admissionPct = totalIssued > 0 ? Math.round((scannedCount / totalIssued) * 100) : 0;

      return {
        success: true,
        stats: {
          totalIssued,
          scannedCount,
          unusedCount,
          totalRevenue,
          admissionPct
        }
      };
    }

    if (action === 'getPasses') {
      return {
        success: true,
        passes: passes.slice().reverse()
      };
    }

    if (action === 'generatePass') {
      const nextNum = passes.length + 1;
      const passId = `#CW26-${String(nextNum).padStart(3, '0')}`;
      const newPass = {
        passId,
        name: payload.name || 'Anonymous',
        rollNo: (payload.rollNo || '').toUpperCase(),
        amount: Number(payload.amount) || DEFAULT_PRICE,
        status: 'unused',
        createdIso: new Date().toISOString(),
        scannedIso: '',
        email: payload.email || '',
        whatsapp: payload.whatsapp || ''
      };
      passes.push(newPass);
      saveMockStore(passes);

      return {
        success: true,
        pass: newPass,
        emailSent: false,
        message: 'Pass created in local store'
      };
    }

    if (action === 'checkAndScanPass') {
      const rawId = (payload.passId || '').trim().toUpperCase();
      const targetId = rawId.startsWith('#') ? rawId : `#${rawId}`;
      const pass = passes.find(p => p.passId.toUpperCase() === targetId);

      if (!pass) {
        return {
          success: false,
          state: 'INVALID',
          message: `Pass ID ${targetId} not found in database.`
        };
      }

      if (pass.status === 'used') {
        return {
          success: false,
          state: 'DUPLICATE',
          message: `ALREADY SCANNED! Entry was registered on ${new Date(pass.scannedIso).toLocaleTimeString()}.`,
          pass
        };
      }

      // Mark as used
      pass.status = 'used';
      pass.scannedIso = new Date().toISOString();
      saveMockStore(passes);

      return {
        success: true,
        state: 'APPROVED',
        message: 'ENTRY APPROVED! Welcome to Creators Welcome 2026.',
        pass
      };
    }

    return { success: false, message: 'Unknown action' };
  }

  return {
    callApi,
    getScriptUrl,
    isMockMode
  };
})();
