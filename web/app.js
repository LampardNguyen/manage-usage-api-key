function app() {
  const nf = new Intl.NumberFormat('vi-VN');
  // UI chạy ở {BASE_PATH}/admin/ → gọi API bằng đường dẫn tương đối.
  const API = 'api';

  return {
    authed: null,
    password: '',
    loginError: '',
    view: 'keys',
    state: { keys: [], settings: { model: '', reasoningEffort: '' }, pricesReady: true, endpoint: '' },
    search: '',
    filterStatus: '',
    detail: null,
    keyForm: {},
    keyError: '',
    confirmName: '',
    deleteError: '',
    logTab: 'requests',
    logKey: '',
    logErrorsOnly: false,
    logs: [],
    settingsForm: null,
    settingsError: '',
    createOpen: false,
    createForm: { name: '', usdLimit: '' },
    createError: '',
    newToken: '',
    copied: false,
    toast: '',

    async init() {
      const me = await this.api('GET', 'me');
      this.authed = !!(me && me.authed);
      window.addEventListener('hashchange', () => this.route());
      setInterval(() => this.authed && !this.createOpen && this.refresh(), 15000);
      if (this.authed) await this.afterLogin();
    },

    async afterLogin() {
      await this.refresh();
      this.route();
    },

    async api(method, path, body) {
      const res = await fetch(`${API}/${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && path !== 'login') {
        this.authed = false;
        return null;
      }
      if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
      return data;
    },

    async login() {
      this.loginError = '';
      try {
        await this.api('POST', 'login', { password: this.password });
        this.password = '';
        this.authed = true;
        await this.afterLogin();
      } catch (e) {
        this.loginError = e.message;
      }
    },

    async logout() {
      await this.api('POST', 'logout');
      this.authed = false;
    },

    async refresh() {
      const s = await this.api('GET', 'state');
      if (!s) return;
      this.state = s;
      if (this.view === 'key' && this.detail) await this.loadKey(this.detail.key.id, true);
    },

    route() {
      const h = location.hash.replace(/^#\/?/, '');
      if (h.startsWith('key/')) {
        this.view = 'key';
        this.loadKey(decodeURIComponent(h.slice(4)));
      } else if (h === 'logs') {
        this.view = 'logs';
        this.loadLogs();
      } else if (h === 'settings') {
        this.view = 'settings';
        this.loadSettings();
      } else {
        this.view = 'keys';
      }
      window.scrollTo(0, 0);
    },

    // ----- Danh sách -----
    countStatus(s) {
      return this.state.keys.filter((k) => k.status === s).length;
    },
    sum(field) {
      return this.state.keys.reduce((t, k) => t + k.used[field], 0);
    },
    filteredKeys() {
      const q = this.search.trim().toLowerCase();
      const order = { over: 0, warn: 1, ok: 2, unlimited: 3, disabled: 4 };
      return this.state.keys
        .filter((k) => !this.filterStatus || k.status === this.filterStatus)
        .filter((k) => !q || k.name.toLowerCase().includes(q))
        .sort((a, b) => order[a.status] - order[b.status] || (b.pct || 0) - (a.pct || 0) || b.used.usd - a.used.usd);
    },

    // ----- Tạo key -----
    openCreate() {
      this.createForm = { name: '', usdLimit: '' };
      this.createError = '';
      this.newToken = '';
      this.copied = false;
      this.createOpen = true;
      setTimeout(() => {
        const el = document.querySelector('.modal input');
        if (el) el.focus();
      }, 50);
    },
    async createKey() {
      this.createError = '';
      try {
        const r = await this.api('POST', 'keys', this.createForm);
        this.newToken = r.token;
        await this.refresh();
      } catch (e) {
        this.createError = e.message;
      }
    },
    async copyToken() {
      try {
        await navigator.clipboard.writeText(this.newToken);
      } catch (e) {
        // Trình duyệt chặn clipboard khi không phải HTTPS → chọn sẵn text để copy tay.
        const box = document.querySelector('.token-box');
        const range = document.createRange();
        range.selectNodeContents(box);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
        document.execCommand('copy');
      }
      this.copied = true;
    },
    closeCreate() {
      if (this.newToken && !this.copied && !confirm('Bạn chưa copy key. Đóng lại sẽ không xem được key nữa. Vẫn đóng?')) return;
      this.createOpen = false;
      this.newToken = '';
    },

    // ----- Chi tiết key -----
    async loadKey(id, keepForm) {
      try {
        const d = await this.api('GET', `keys/${encodeURIComponent(id)}`);
        if (!d) return;
        this.detail = d;
        if (!keepForm) {
          this.keyForm = { name: d.key.name, usdLimit: d.key.usdLimit == null ? '' : d.key.usdLimit };
          this.keyError = '';
          this.confirmName = '';
          this.deleteError = '';
        }
      } catch (e) {
        this.flash(e.message);
        location.hash = '#/';
      }
    },
    async saveKey() {
      this.keyError = '';
      try {
        await this.api('PATCH', `keys/${this.detail.key.id}`, this.keyForm);
        this.flash('Đã lưu');
        await this.refresh();
        await this.loadKey(this.detail.key.id);
      } catch (e) {
        this.keyError = e.message;
      }
    },
    async toggleDisabled() {
      const k = this.detail.key;
      if (!k.disabled && !confirm(`Khoá key "${k.name}"? App dùng key này sẽ nhận lỗi 403 cho tới khi mở khoá.`)) return;
      await this.api('PATCH', `keys/${k.id}`, { disabled: !k.disabled });
      this.flash(k.disabled ? 'Đã mở khoá' : 'Đã khoá key');
      await this.refresh();
      await this.loadKey(k.id, true);
    },
    async resetKey() {
      const k = this.detail.key;
      if (!confirm(`Reset bộ đếm của "${k.name}" về 0? (đang: $${this.fmtUsd(k.used.usd, 4)}, ${this.fmtNum(k.used.tokens)} token). Tổng trọn đời vẫn được giữ.`)) return;
      await this.api('POST', `keys/${k.id}/reset`);
      this.flash('Đã reset bộ đếm');
      await this.refresh();
      await this.loadKey(k.id, true);
    },
    async deleteKey() {
      this.deleteError = '';
      try {
        await this.api('DELETE', `keys/${this.detail.key.id}`, { confirmName: this.confirmName });
        this.flash('Đã xoá key');
        this.detail = null;
        location.hash = '#/';
        await this.refresh();
      } catch (e) {
        this.deleteError = e.message;
      }
    },
    chartPct(d) {
      const useUsd = this.state.pricesReady;
      const val = (x) => (useUsd ? x.usd : x.tokens);
      const max = Math.max(...this.detail.daily.map(val));
      return val(d) ? Math.max(2, (val(d) / max) * 100) : 0;
    },

    // ----- Nhật ký -----
    async loadLogs() {
      if (this.logTab === 'events') {
        this.logs = (await this.api('GET', 'events')) || [];
      } else {
        const q = new URLSearchParams();
        if (this.logKey) q.set('keyId', this.logKey);
        if (this.logErrorsOnly) q.set('errorsOnly', '1');
        this.logs = (await this.api('GET', `requests?${q}`)) || [];
      }
    },

    // ----- Cài đặt -----
    async loadSettings() {
      const s = await this.api('GET', 'settings');
      if (!s) return;
      const v = (x) => (x == null ? '' : x);
      this.settingsForm = {
        model: s.model,
        reasoningEffort: s.reasoningEffort,
        prices: { input: v(s.prices.input), cached_input: v(s.prices.cached_input), output: v(s.prices.output) },
      };
      this.settingsError = '';
    },
    async saveSettings() {
      this.settingsError = '';
      try {
        await this.api('PUT', 'settings', this.settingsForm);
        this.flash('Đã lưu cài đặt');
        await this.refresh();
      } catch (e) {
        this.settingsError = e.message;
      }
    },

    // ----- Hiển thị -----
    fmtNum(v) {
      return nf.format(v || 0);
    },
    fmtUsd(v, digits) {
      v = v || 0;
      return v.toFixed(digits != null ? digits : v >= 100 ? 0 : 2);
    },
    fmtDate(ms) {
      return ms ? new Date(ms).toLocaleString('vi-VN') : '—';
    },
    barClass(pct) {
      return pct >= 100 ? 'fill danger' : pct >= 80 ? 'fill warn' : 'fill ok';
    },
    statusLabel(s) {
      return { ok: 'OK', warn: 'Sắp hết', over: 'Hết hạn mức', unlimited: 'Không giới hạn', disabled: 'Đang khoá' }[s] || s;
    },
    statusClass(s) {
      return { ok: 'ok', warn: 'warn', over: 'danger', disabled: 'muted-badge' }[s] || '';
    },
    eventLabel(t) {
      return { key_created: 'Tạo key', key_updated: 'Sửa key', key_reset: 'Reset', key_deleted: 'Xoá key', settings_changed: 'Cài đặt' }[t] || t;
    },
    flash(msg) {
      this.toast = msg;
      clearTimeout(this._t);
      this._t = setTimeout(() => (this.toast = ''), 3000);
    },
  };
}
