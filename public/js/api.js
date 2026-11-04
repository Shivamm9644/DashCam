/**
 * Inurum Fleet - API client for the Java backend (/api/v1, proxied by the local web server).
 * Errors are thrown, never replaced with made-up data: the UI shows an honest empty/error state.
 */

(function (window) {
  'use strict';

  class FleetApiClient {
    constructor(baseUrl = '') {
      this.baseUrl = baseUrl;
      this.token = localStorage.getItem('inurum_auth_token') || null;
      this.user = null;
      try {
        const storedUser = localStorage.getItem('inurum_user');
        if (storedUser) this.user = JSON.parse(storedUser);
      } catch (_) {}
    }

    setToken(token, user = null) {
      this.token = token;
      if (token) {
        localStorage.setItem('inurum_auth_token', token);
      } else {
        localStorage.removeItem('inurum_auth_token');
      }
      if (user) {
        this.user = user;
        localStorage.setItem('inurum_user', JSON.stringify(user));
      } else if (!token) {
        this.user = null;
        localStorage.removeItem('inurum_user');
      }
    }

    getHeaders() {
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
      return headers;
    }

    async request(endpoint, options = {}) {
      const config = {
        method: options.method || 'GET',
        headers: { ...this.getHeaders(), ...(options.headers || {}) }
      };
      if (options.body) {
        config.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      }
      if (options.keepalive) config.keepalive = true;

      const response = await fetch(`${this.baseUrl}${endpoint}`, config);
      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await response.json() : await response.text();

      if (!response.ok) {
        // Expired or invalid session: drop it and show the login screen again
        if (response.status === 401 && this.token && !endpoint.endsWith('/auth/login')) {
          this.setToken(null, null);
          window.location.reload();
        }
        const err = new Error((data && data.message) || (data && data.error) || `HTTP ${response.status}: Request failed`);
        err.status = response.status;
        err.data = data;
        throw err;
      }
      return data;
    }

    // ── Authentication ──────────────────────────────────────────
    async login(email, password) {
      const data = await this.request('/api/v1/auth/login', {
        method: 'POST',
        body: { email, password }
      });
      this.setToken(data.token, data.user);
      return { token: data.token, user: data.user };
    }

    logout() {
      this.setToken(null, null);
    }

    // ── Vehicles & live positions ────────────────────────────────
    async getVehicles() {
      const data = await this.request('/api/v1/vehicles');
      return data.vehicles || [];
    }

    async getLatestPositions() {
      const data = await this.request('/api/v1/positions/latest');
      return data.positions || [];
    }

    async createVehicle(vehicleData) {
      return await this.request('/api/v1/vehicles', { method: 'POST', body: vehicleData });
    }

    async updateVehicle(vehicleId, vehicleData) {
      return await this.request(`/api/v1/vehicles/${vehicleId}`, { method: 'PUT', body: vehicleData });
    }

    async toggleVehicleStatus(vehicleId) {
      return await this.request(`/api/v1/vehicles/${vehicleId}/toggle-status`, { method: 'POST' });
    }

    async pairDevice(vehicleId, terminalId) {
      return await this.request(`/api/v1/vehicles/${vehicleId}/pair-device`, { method: 'POST', body: { terminalId } });
    }

    async unpairDevice(vehicleId) {
      return await this.request(`/api/v1/vehicles/${vehicleId}/unpair-device`, { method: 'POST' });
    }

    async getDeviceHealth() {
      const data = await this.request('/api/v1/devices/health');
      return data.devices || [];
    }

    // ── Live video (backend sends 0x9101/0x9102 to the camera) ────
    async startLiveSession(terminalId, channelId = 1) {
      return await this.request('/api/v1/live-sessions', {
        method: 'POST',
        body: { terminalId, channelId: parseInt(channelId, 10) }
      });
    }

    async sendLiveHeartbeat(terminalId) {
      return await this.request('/api/v1/live-sessions/heartbeat', { method: 'POST', body: { terminalId } });
    }

    async stopLiveStream(terminalId) {
      // keepalive lets the stop reach the server when the page is closing
      return await this.request('/api/v1/live-sessions/stop', { method: 'POST', body: { terminalId }, keepalive: true });
    }

    getLiveHlsUrl(terminalId, channelId = 1) {
      return `/media/live/${terminalId}_${channelId}/live.m3u8`;
    }

    // ── SD card footage (0x9205 list, 0x9201 play, 0x9202 stop) ───
    // Times are camera-local "YYYY-MM-DD HH:mm:ss"
    async sdVideo(action, params) {
      const qs = new URLSearchParams(params).toString();
      return await this.request(`/api/v1/video/${action}?${qs}`);
    }

    listSdFiles(terminalId, start, end, channel = 0) {
      return this.sdVideo('sd-list', { terminalId, channel, start, end });
    }

    startSdPlayback(terminalId, start, end, channel = 'all') {
      return this.sdVideo('playback-start', { terminalId, channel, start, end });
    }

    stopSdPlayback(terminalId, channel = 'all') {
      return this.sdVideo('playback-stop', { terminalId, channel });
    }

    async querySdCard(terminalId, channel = 1, startTime = null, endTime = null) {
      return await this.request('/api/v1/video/query-sd', {
        method: 'POST',
        body: { terminalId, channel, startTime, endTime }
      });
    }

    async retrieveFootage(terminalId, channel = 1, startTime = null, endTime = null) {
      return await this.request('/api/v1/video/retrieve', {
        method: 'POST',
        body: { terminalId, channel, startTime, endTime }
      });
    }

    async getRetrievalJob(jobId) {
      return await this.request(`/api/v1/video/jobs/${jobId}`);
    }

    async getRecordings(terminalId, channel = 1) {
      const data = await this.request(`/api/v1/video/recordings?terminalId=${encodeURIComponent(terminalId)}&channel=${channel}`);
      return data.recordings || [];
    }

    // ── Safety events ─────────────────────────────────────────────
    async getSafetyEvents() {
      const data = await this.request('/api/v1/events');
      return data.events || [];
    }

    async getSafetyIncidents(filters = {}) {
      const params = new URLSearchParams();
      if (filters.severity && filters.severity !== 'ALL') params.append('severity', filters.severity);
      if (filters.type && filters.type !== 'ALL') params.append('type', filters.type);
      if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
      if (filters.terminalId && filters.terminalId !== 'ALL') params.append('terminalId', filters.terminalId);
      const data = await this.request(`/api/v1/safety/incidents?${params.toString()}`);
      return data.incidents || [];
    }

    async getSafetyIncident(id) {
      return await this.request(`/api/v1/safety/incidents/${id}`);
    }

    async reviewSafetyIncident(id, reviewData = {}) {
      return await this.request(`/api/v1/safety/incidents/${id}/review`, { method: 'POST', body: reviewData });
    }

    // ── Plan quota ────────────────────────────────────────────────
    async getQuotas() {
      return await this.request('/api/v1/quotas');
    }

    // ── Trips ─────────────────────────────────────────────────────
    async getTrips(terminalId = null) {
      const url = terminalId ? `/api/v1/trips?terminalId=${encodeURIComponent(terminalId)}` : '/api/v1/trips';
      const data = await this.request(url);
      return data.trips || [];
    }

    async getTripDetail(tripId) {
      return await this.request(`/api/v1/trips/${tripId}`);
    }

    // ── Administration, reports & cost controls ───────────────────
    async getSaasMetrics() {
      const res = await this.request('/api/v1/admin/saas-metrics');
      return res.metrics;
    }

    async getOrganizations() {
      const res = await this.request('/api/v1/admin/organizations');
      return res.organizations || [];
    }

    async createOrganization(data) {
      return await this.request('/api/v1/admin/organizations', { method: 'POST', body: data });
    }

    async toggleOrganizationStatus(id) {
      return await this.request(`/api/v1/admin/organizations/${id}/toggle-status`, { method: 'POST' });
    }

    async getAdminUsers() {
      const res = await this.request('/api/v1/admin/users');
      return res.users || [];
    }

    async inviteUser(data) {
      return await this.request('/api/v1/admin/users', { method: 'POST', body: data });
    }

    async toggleUserStatus(id) {
      return await this.request(`/api/v1/admin/users/${id}/toggle-status`, { method: 'POST' });
    }

    async setUserVehicleAccess(id, terminalIds) {
      return await this.request(`/api/v1/admin/users/${id}/vehicle-access`, { method: 'POST', body: { terminalIds } });
    }

    async resetUserPassword(id, newPassword) {
      return await this.request(`/api/v1/admin/users/${id}/reset-password`, { method: 'POST', body: { newPassword } });
    }

    async getReportsSummary(params = {}) {
      const query = new URLSearchParams(params).toString();
      const res = await this.request(`/api/v1/reports/summary?${query}`);
      return res.report;
    }

    async getCostControls() {
      const res = await this.request('/api/v1/admin/cost-controls');
      return res.costControls;
    }

    async updateCostControls(data) {
      return await this.request('/api/v1/admin/cost-controls', { method: 'PUT', body: data });
    }

    async cleanupExpiredMedia() {
      return await this.request('/api/v1/admin/cleanup-media', { method: 'POST' });
    }

    async getAuditLogs(limit = 50) {
      const res = await this.request(`/api/v1/admin/audit-logs?limit=${limit}`);
      return res.auditLogs || [];
    }
  }

  window.FleetApi = new FleetApiClient();
})(window);
