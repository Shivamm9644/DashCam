/**
 * Inurum Fleet Operations Platform - Application Logic
 * Desktop-First Fleet Management, Live Telematics & Dual Dashcam Surveillance
 */

(function () {
  'use strict';

  // ── Global Application State ──────────────────────────────────────────
  const state = {
    currentRoute: 'dashboard',
    vehicles: [],
    selectedVehicleId: null,
    selectedVehicle: null,
    activeChannel: 'dual', // 'dual', '1', '2', 'pip'
    isStreaming: false,
    liveTtlSeconds: 120,
    liveTtlInterval: null,
    heartbeatInterval: null,
    hlsRoad: null,
    hlsCabin: null,
    overviewMap: null,
    liveFocusMap: null,
    overviewMarkers: new Map(),
    liveFocusMarker: null,
    isMuted: true,
    isNightVision: false,
    activeRosterFilter: 'ALL',
    searchQuery: '',
    osdInterval: null,
    // Video Center State
    vcSelectedVehicleId: null,
    vcSelectedChannel: 1,
    vcSelectedDate: new Date().toISOString().substring(0, 10),
    vcActiveJob: null,
    vcJobPollInterval: null,
    vcRecordings: [],
    vcTab: 'all',
    vcCurrentFootageUrl: null,
    // Safety Inbox State
    safetyIncidents: [],
    safetyActiveIncident: null,
    modalHlsRoad: null,
    modalHlsCabin: null,
    modalSyncPlaying: false,
    // Vehicles & Devices State (Stage 2 & 3)
    vdFilter: 'ALL',
    vdSearch: '',
    vdSubtab: 'directory',
    devicesHealth: [],
    // Trips & Replay State (Stage 4)
    tripsMap: null,
    currentTrip: null,
    tripPoints: [],
    tripPlaybackIdx: 0,
    tripPlaybackTimer: null,
    tripPlaybackSpeed: 1,
    tripVehicleMarker: null,
    tripPolyline: null,
    tripGapPolylines: [],
    tripEventMarkers: []
  };

  // ── Cached DOM Selectors ──────────────────────────────────────────────
  const dom = {};

  function cacheDom() {
    // Navigation & Shell
    dom.appSidebar = document.getElementById('appSidebar');
    dom.btnToggleSidebar = document.getElementById('btnToggleSidebar');
    dom.navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    dom.viewContainers = document.querySelectorAll('.view-container');
    dom.breadcrumbTitle = document.getElementById('breadcrumbActiveTitle');
    dom.globalSearchInput = document.getElementById('globalSearchInput');
    dom.liveClockDisplay = document.getElementById('liveClockDisplay');
    dom.headerQuotaMinutes = document.getElementById('headerQuotaMinutes');
    dom.btnSignOut = document.getElementById('btnSignOut');
    dom.authBackdrop = document.getElementById('authBackdrop');
    dom.authForm = document.getElementById('authForm');
    dom.inputAuthEmail = document.getElementById('inputAuthEmail');
    dom.inputAuthPassword = document.getElementById('inputAuthPassword');
    dom.authAlert = document.getElementById('authAlert');

    // Dashboard Overview Elements
    dom.kpiTotalCount = document.getElementById('kpiTotalCount');
    dom.kpiOnlineCount = document.getElementById('kpiOnlineCount');
    dom.kpiOfflineCount = document.getElementById('kpiOfflineCount');
    dom.kpiDrivingCount = document.getElementById('kpiDrivingCount');
    dom.kpiIdleCount = document.getElementById('kpiIdleCount');
    dom.kpiLiveStreamsCount = document.getElementById('kpiLiveStreamsCount');
    dom.kpiSafetyEventsCount = document.getElementById('kpiSafetyEventsCount');
    dom.kpiHealthRate = document.getElementById('kpiHealthRate');
    dom.overviewMapContainer = document.getElementById('overviewMapContainer');
    dom.overviewSafetyTableBody = document.getElementById('overviewSafetyTableBody');
    dom.overviewRecordingsList = document.getElementById('overviewRecordingsList');
    dom.btnCenterOverviewMap = document.getElementById('btnCenterOverviewMap');
    dom.btnGoToLiveFromOverview = document.getElementById('btnGoToLiveFromOverview');

    // Live Monitoring Elements
    dom.rosterCardsContainer = document.getElementById('vehicleRosterCardsContainer');
    dom.rosterFilterPills = document.querySelectorAll('.roster-filter-pills .filter-pill');
    dom.rosterSearchInput = document.getElementById('rosterSearchInput');
    dom.activePlateText = document.getElementById('activePlateText');
    dom.activeVehicleTitle = document.getElementById('activeVehicleTitle');
    dom.activeDriverText = document.getElementById('activeDriverText');
    dom.channelTabBtns = document.querySelectorAll('.player-channel-tabs .channel-tab-btn');
    dom.streamTtlTimer = document.getElementById('streamTtlTimer');
    dom.btnStartStream = document.getElementById('btnStartStream');
    dom.btnStopStream = document.getElementById('btnStopStream');
    dom.btnToggleNightVision = document.getElementById('btnToggleNightVision');
    dom.btnSnapshot = document.getElementById('btnSnapshot');
    dom.btnAudioToggle = document.getElementById('btnAudioToggle');
    dom.btnFullscreen = document.getElementById('btnFullscreen');
    dom.videoViewportWrapper = document.getElementById('videoViewportWrapper');
    dom.dualCameraGrid = document.getElementById('dualCameraGrid');
    dom.screenRoadWrap = document.getElementById('screenRoadWrap');
    dom.screenCabinWrap = document.getElementById('screenCabinWrap');
    dom.videoRoad = document.getElementById('videoRoad');
    dom.videoCabin = document.getElementById('videoCabin');
    dom.streamConnectingOverlay = document.getElementById('streamConnectingOverlay');
    dom.streamConnectingText = document.getElementById('streamConnectingText');
    dom.osdTimeRoad = document.getElementById('osdTimeRoad');
    dom.osdTimeCabin = document.getElementById('osdTimeCabin');
    dom.osdTelemetryRoad = document.getElementById('osdTelemetryRoad');
    dom.liveFocusMapContainer = document.getElementById('liveFocusMapContainer');
    dom.subdeckAddress = document.getElementById('subdeckAddress');
    dom.diagImei = document.getElementById('diagImei');
    dom.diagSpeed = document.getElementById('diagSpeed');
    dom.diagVoltage = document.getElementById('diagVoltage');
    dom.diagSats = document.getElementById('diagSats');

    // Video Center (Module 3) Selectors
    dom.vcVehicleSelect = document.getElementById('vcVehicleSelect');
    dom.vcDatePicker = document.getElementById('vcDatePicker');
    dom.vcTimeStart = document.getElementById('vcTimeStart');
    dom.vcTimeEnd = document.getElementById('vcTimeEnd');
    dom.btnVcChannel1 = document.getElementById('btnVcChannel1');
    dom.btnVcChannel2 = document.getElementById('btnVcChannel2');
    dom.btnQuerySdCard = document.getElementById('btnQuerySdCard');
    dom.btnRefreshRecordings = document.getElementById('btnRefreshRecordings');
    dom.vcTimelineWrapper = document.getElementById('vcTimelineWrapper');
    dom.vcTimelineTrack = document.getElementById('vcTimelineTrack');
    dom.vcTimelineNeedle = document.getElementById('vcTimelineNeedle');
    dom.vcNeedleFlag = document.getElementById('vcNeedleFlag');
    dom.vcScrubTimestampText = document.getElementById('vcScrubTimestampText');
    dom.vcVideoStatusChip = document.getElementById('vcVideoStatusChip');
    dom.vcPlayerTitle = document.getElementById('vcPlayerTitle');
    dom.vcPlayerSubtitle = document.getElementById('vcPlayerSubtitle');
    dom.btnVcDownloadClip = document.getElementById('btnVcDownloadClip');
    dom.btnVcFullscreen = document.getElementById('btnVcFullscreen');
    dom.vcVideoPlayer = document.getElementById('vcVideoPlayer');
    dom.vcOsdChannel = document.getElementById('vcOsdChannel');
    dom.vcOsdTime = document.getElementById('vcOsdTime');
    dom.vcOsdSpeed = document.getElementById('vcOsdSpeed');
    dom.btnVcPlayPause = document.getElementById('btnVcPlayPause');
    dom.btnVcSeekBack = document.getElementById('btnVcSeekBack');
    dom.btnVcSeekForward = document.getElementById('btnVcSeekForward');
    dom.vcPlaybackSpeedSelect = document.getElementById('vcPlaybackSpeedSelect');
    dom.btnRequestRetrieval = document.getElementById('btnRequestRetrieval');
    dom.vcMetaPlate = document.getElementById('vcMetaPlate');
    dom.vcMetaDriver = document.getElementById('vcMetaDriver');
    dom.vcMetaChannel = document.getElementById('vcMetaChannel');
    dom.vcMetaCodec = document.getElementById('vcMetaCodec');
    dom.vcMetaLocation = document.getElementById('vcMetaLocation');
    dom.vcJobStatusBadge = document.getElementById('vcJobStatusBadge');
    dom.vcJobIdLabel = document.getElementById('vcJobIdLabel');
    dom.vcJobProgressBar = document.getElementById('vcJobProgressBar');
    dom.vcJobStageText = document.getElementById('vcJobStageText');
    dom.vcJobPercentText = document.getElementById('vcJobPercentText');
    dom.vcJobHelpText = document.getElementById('vcJobHelpText');
    dom.btnVcTabAll = document.getElementById('btnVcTabAll');
    dom.btnVcTabCloud = document.getElementById('btnVcTabCloud');
    dom.btnVcTabSd = document.getElementById('btnVcTabSd');
    dom.vcRecordingsTableBody = document.getElementById('vcRecordingsTableBody');

    // Safety Inbox (Module 4) Selectors
    dom.kpiTotalIncidents = document.getElementById('kpiTotalIncidents');
    dom.kpiNeedsReview = document.getElementById('kpiNeedsReview');
    dom.kpiCriticalCount = document.getElementById('kpiCriticalCount');
    dom.kpiCoachedCount = document.getElementById('kpiCoachedCount');
    dom.safetyFilterSeverity = document.getElementById('safetyFilterSeverity');
    dom.safetyFilterType = document.getElementById('safetyFilterType');
    dom.safetyFilterStatus = document.getElementById('safetyFilterStatus');
    dom.safetyFilterVehicle = document.getElementById('safetyFilterVehicle');
    dom.btnResetSafetyFilters = document.getElementById('btnResetSafetyFilters');
    dom.safetyInboxBadge = document.getElementById('safetyInboxBadge');
    dom.safetyIncidentsTableBody = document.getElementById('safetyIncidentsTableBody');

    // Incident Review Modal Selectors
    dom.incidentReviewModal = document.getElementById('incidentReviewModal');
    dom.modalIncidentSeverityBadge = document.getElementById('modalIncidentSeverityBadge');
    dom.modalIncidentTitle = document.getElementById('modalIncidentTitle');
    dom.modalIncidentSubtitle = document.getElementById('modalIncidentSubtitle');
    dom.btnCloseIncidentModal = document.getElementById('btnCloseIncidentModal');
    dom.modalVideoRoad = document.getElementById('modalVideoRoad');
    dom.modalVideoCabin = document.getElementById('modalVideoCabin');
    dom.btnModalSyncPlay = document.getElementById('btnModalSyncPlay');
    dom.btnModalRewind = document.getElementById('btnModalRewind');
    dom.btnModalForward = document.getElementById('btnModalForward');
    dom.modalSpeedSparkline = document.getElementById('modalSpeedSparkline');
    dom.modalPlateText = document.getElementById('modalPlateText');
    dom.modalDriverText = document.getElementById('modalDriverText');
    dom.modalImpactSpeedText = document.getElementById('modalImpactSpeedText');
    dom.modalCoordsText = document.getElementById('modalCoordsText');
    dom.modalLocationText = document.getElementById('modalLocationText');
    dom.modalCoachingCategory = document.getElementById('modalCoachingCategory');
    dom.modalCoachingNotes = document.getElementById('modalCoachingNotes');
    dom.btnSubmitCoached = document.getElementById('btnSubmitCoached');
    dom.btnSubmitDismiss = document.getElementById('btnSubmitDismiss');

    // Stage 2 & 3: Vehicles & Hardware Selectors
    dom.btnSubtabVehicles = document.getElementById('btnSubtabVehicles');
    dom.btnSubtabDevices = document.getElementById('btnSubtabDevices');
    dom.vdSectionDirectory = document.getElementById('vdSectionDirectory');
    dom.vdSectionHealth = document.getElementById('vdSectionHealth');
    dom.vdVehicleCountBadge = document.getElementById('vdVehicleCountBadge');
    dom.vdDeviceCountBadge = document.getElementById('vdDeviceCountBadge');
    dom.vdSearchInput = document.getElementById('vdSearchInput');
    dom.btnAddVehicleBtn = document.getElementById('btnAddVehicleBtn');
    dom.btnRefreshVehiclesAndDevices = document.getElementById('btnRefreshVehiclesAndDevices');
    dom.vdFilterChips = document.querySelectorAll('.vd-filter-chips-bar .vd-filter-chip');
    dom.vdVehiclesTableBody = document.getElementById('vdVehiclesTableBody');
    dom.vdHealthTableBody = document.getElementById('vdHealthTableBody');
    dom.modalVehicleEdit = document.getElementById('modalVehicleEdit');
    dom.formVehicleEdit = document.getElementById('formVehicleEdit');
    dom.modalPairDevice = document.getElementById('modalPairDevice');
    dom.drawerVehicleProfile = document.getElementById('drawerVehicleProfile');

    // Stage 4: Trips Replay Selectors
    dom.tripsVehicleSelect = document.getElementById('tripsVehicleSelect');
    dom.tripsDatePicker = document.getElementById('tripsDatePicker');
    dom.tripsRouteSelect = document.getElementById('tripsRouteSelect');
    dom.btnLoadTripReplay = document.getElementById('btnLoadTripReplay');
    dom.tripRouteMapContainer = document.getElementById('tripRouteMapContainer');
    dom.btnTripPlayPause = document.getElementById('btnTripPlayPause');
    dom.btnTripRewind = document.getElementById('btnTripRewind');
    dom.btnTripForward = document.getElementById('btnTripForward');
    dom.tripSpeedBtns = document.querySelectorAll('.trip-speed-selector .speed-btn');
    dom.tripScrubberRail = document.getElementById('tripScrubberRail');
    dom.tripScrubberProgress = document.getElementById('tripScrubberProgress');
    dom.tripScrubberNeedle = document.getElementById('tripScrubberNeedle');
    dom.tripScrubberCurrentTime = document.getElementById('tripScrubberCurrentTime');
    dom.tripScrubberTotalTime = document.getElementById('tripScrubberTotalTime');
    dom.tripEventsList = document.getElementById('tripEventsList');
    dom.hudCurrentSpeed = document.getElementById('hudCurrentSpeed');
    dom.hudCurrentTime = document.getElementById('hudCurrentTime');
    dom.hudCurrentHeading = document.getElementById('hudCurrentHeading');
    dom.hudCurrentIgnition = document.getElementById('hudCurrentIgnition');
    dom.tripGapWarningBanner = document.getElementById('tripGapWarningBanner');
    dom.tripGapWarningText = document.getElementById('tripGapWarningText');
  }

  // ── Initialization & Bootstrap ───────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    cacheDom();
    initClock();
    initSidebarToggle();
    initHashRouter();
    bindEvents();

    // Check Authentication
    if (!FleetApi.token) {
      const email = (dom.inputAuthEmail && dom.inputAuthEmail.value.trim()) || 'inurum@wanwaygps.com';
      const pass = (dom.inputAuthPassword && dom.inputAuthPassword.value) || 'cE7R0fZYY1cSrj';
      if (email && pass) {
        try {
          await handleLogin(email, pass);
        } catch (_) {
          showAuthModal();
        }
      } else {
        showAuthModal();
      }
    } else {
      await loadFleetData();
    }
  });

  // ── Authentication Handlers ───────────────────────────────────────────
  function showAuthModal() {
    if (dom.authBackdrop) dom.authBackdrop.style.display = 'flex';
  }

  function hideAuthModal() {
    if (dom.authBackdrop) dom.authBackdrop.style.display = 'none';
  }

  async function handleLogin(email, password) {
    try {
      if (dom.authAlert) dom.authAlert.style.display = 'none';
      const res = await FleetApi.login(email, password);
      hideAuthModal();
      showToast(`Welcome, ${res.user.name}! Connected to ${res.user.tenantName || 'Inurum Fleet'}`, 'success');
      updateUserMetaDisplay(res.user);
      await loadFleetData();
    } catch (err) {
      if (dom.authAlert) {
        dom.authAlert.style.display = 'block';
        dom.authAlert.style.backgroundColor = '#fee2e2';
        dom.authAlert.style.color = '#b91c1c';
        dom.authAlert.textContent = err.message || 'Invalid email or password.';
      }
    }
  }

  function updateUserMetaDisplay(user) {
    if (!user) return;
    const nameEl = document.getElementById('sidebarUserName');
    const roleEl = document.getElementById('sidebarUserRole');
    const avatarEl = document.getElementById('sidebarAvatar');
    if (nameEl) nameEl.textContent = user.name || user.email;
    if (roleEl) roleEl.textContent = user.role || 'FLEET_ADMIN';
    if (avatarEl) avatarEl.textContent = (user.name || user.email).substring(0, 2).toUpperCase();
  }

  // ── Live Clock & Telemetry Ticker ─────────────────────────────────────
  function initClock() {
    function update() {
      const now = new Date();
      if (dom.liveClockDisplay) {
        const istString = now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        dom.liveClockDisplay.textContent = `IST ${istString}`;
      }
      if (state.isStreaming && dom.osdTimeRoad) {
        const timeStr = now.toISOString().substring(11, 19);
        if (dom.osdTimeRoad) dom.osdTimeRoad.textContent = timeStr;
        if (dom.osdTimeCabin) dom.osdTimeCabin.textContent = timeStr;
      }
    }
    update();
    setInterval(update, 1000);
  }

  // ── Collapsible Left Sidebar ──────────────────────────────────────────
  function initSidebarToggle() {
    if (dom.btnToggleSidebar && dom.appSidebar) {
      dom.btnToggleSidebar.addEventListener('click', (e) => {
        e.stopPropagation();
        const willCollapse = !dom.appSidebar.classList.contains('is-collapsed');
        if (willCollapse) {
          dom.appSidebar.classList.add('is-collapsed');
          dom.appSidebar.classList.add('no-hover');
        } else {
          dom.appSidebar.classList.remove('is-collapsed');
          dom.appSidebar.classList.remove('no-hover');
        }

        setTimeout(() => {
          if (state.overviewMap) state.overviewMap.invalidateSize();
          if (state.liveFocusMap) state.liveFocusMap.invalidateSize();
        }, 260);
      });

      // Clear no-hover once cursor moves out of the sidebar area
      dom.appSidebar.addEventListener('mouseleave', () => {
        dom.appSidebar.classList.remove('no-hover');
      });

      // Ensure maps recalculate viewport cleanly after sidebar hover expand/collapse
      dom.appSidebar.addEventListener('transitionend', (e) => {
        if (e.propertyName === 'width') {
          if (state.overviewMap) state.overviewMap.invalidateSize();
          if (state.liveFocusMap) state.liveFocusMap.invalidateSize();
        }
      });
    }

    // Keyboard shortcut (Ctrl + B)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        if (dom.btnToggleSidebar) dom.btnToggleSidebar.click();
      }
    });
  }

  // ── Client Hash Routing ───────────────────────────────────────────────
  function initHashRouter() {
    function routeFromHash() {
      const hash = window.location.hash.replace('#', '').trim() || 'dashboard';
      navigateTo(hash, false);
    }
    window.addEventListener('hashchange', routeFromHash);
    routeFromHash();
  }

  function navigateTo(routeId, updateHash = true) {
    state.currentRoute = routeId;
    if (updateHash) {
      window.location.hash = routeId;
    }

    // Update Sidebar Active state
    dom.navItems.forEach(item => {
      if (item.dataset.route === routeId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update Views visibility
    const targetViewId = 'view' + routeId.charAt(0).toUpperCase() + routeId.slice(1);
    dom.viewContainers.forEach(container => {
      container.style.display = ''; // visibility is class-driven; clear any leftover inline display
      if (container.id === targetViewId) {
        container.classList.add('active');
      } else {
        container.classList.remove('active');
      }
    });

    // Update Breadcrumb Text
    const titles = {
      dashboard: 'Dashboard Overview',
      live: 'Live Monitoring',
      video: 'Video Center',
      safety: 'Safety Inbox',
      vehicles: 'Vehicles & Devices',
      trips: 'Trips & Routes',
      reports: 'Reports & Analytics',
      admin: 'Administration'
    };
    if (dom.breadcrumbTitle) {
      dom.breadcrumbTitle.textContent = titles[routeId] || 'Dashboard Overview';
    }

    // Refresh Maps when views change
    if (routeId === 'dashboard') {
      setTimeout(() => {
        if (!state.overviewMap) initOverviewMap();
        else state.overviewMap.invalidateSize();
      }, 100);
    } else if (routeId === 'live') {
      setTimeout(() => {
        if (!state.liveFocusMap) initLiveFocusMap();
        else state.liveFocusMap.invalidateSize();
        // Auto-select first vehicle if none selected
        if (!state.selectedVehicle && state.vehicles.length > 0) {
          selectVehicle(state.vehicles[0].id);
        } else {
          renderVehicleRosterCards();
        }
      }, 100);
    } else if (routeId === 'video') {
      setTimeout(() => {
        initVideoCenter();
      }, 100);
    } else if (routeId === 'safety') {
      setTimeout(() => {
        initSafetyInbox();
      }, 100);
    } else if (routeId === 'vehicles') {
      setTimeout(() => {
        initVehiclesAndDevices();
      }, 100);
    } else if (routeId === 'trips') {
      setTimeout(() => {
        initTripsReplay();
      }, 100);
    } else if (routeId === 'admin') {
      setTimeout(() => {
        initAdminConsole();
      }, 100);
    } else if (routeId === 'reports') {
      setTimeout(() => {
        initReports();
      }, 100);
    }
  }

  // ── Core Data Loading & State Management ──────────────────────────────
  async function loadFleetData() {
    try {
      // 1. Fetch Vehicles
      const vehicles = await FleetApi.getVehicles();
      state.vehicles = vehicles;

      // 2-4. Positions, events and quota: a failure of one shows as empty, it does not block the rest
      const [positions, safetyEvents, quotas] = await Promise.all([
        FleetApi.getLatestPositions().catch(() => []),
        FleetApi.getSafetyEvents().catch(() => []),
        FleetApi.getQuotas().catch(() => ({}))
      ]);
      mergeLivePositions(positions);

      // Update UI Components
      updateDashboardStats(vehicles, safetyEvents, quotas);
      renderOverviewSafetyTable(safetyEvents);
      renderOverviewRecordings(vehicles);
      renderVehicleRosterCards();
      loadSafetyIncidents();

      if (state.currentRoute === 'live' && state.vehicles.length > 0) {
        selectVehicle(state.vehicles[0].id);
      }

      // Init or Update Overview Map
      if (state.currentRoute === 'dashboard') {
        if (!state.overviewMap) initOverviewMap();
        else updateOverviewMapMarkers();
      }

      // Update Quota badge in header
      if (dom.headerQuotaMinutes && quotas.quota) {
        const q = quotas.quota;
        const rem = q.remainingLiveMinutes != null ? q.remainingLiveMinutes : ((q.maxLiveMinutes || 30) - (q.liveMinutesUsed || 0)).toFixed(1);
        dom.headerQuotaMinutes.textContent = `${rem}m left`;
      }
    } catch (err) {
      console.error('[Fleet] Data load error:', err);
      showToast('Error loading real-time fleet data. Retrying...', 'error');
    }
  }

  function mergeLivePositions(positions) {
    if (!positions || positions.length === 0) return;
    positions.forEach(pos => {
      const v = state.vehicles.find(veh => veh.terminalId === pos.terminalId);
      if (v) {
        v.lat = pos.lat;
        v.lng = pos.lng;
        v.speed = pos.speed;
        v.heading = pos.heading;
        v.ignition = pos.ignition;
        if (pos.address) v.address = pos.address;
        v.status = pos.speed > 0 ? 'ONLINE' : (pos.ignition ? 'IDLE' : 'ONLINE');
        v.lastSeen = pos.timestamp || new Date().toISOString();
      }
    });
  }

  // ── SCREEN 1: Dashboard Overview Renderers ─────────────────────────────
  function updateDashboardStats(vehicles, safetyEvents, quotas) {
    const total = vehicles.length;
    const online = vehicles.filter(v => v.status === 'ONLINE').length;
    const idle = vehicles.filter(v => v.status === 'IDLE').length;
    const offline = vehicles.filter(v => v.status === 'OFFLINE').length;
    const moving = vehicles.filter(v => v.speed > 0).length;

    if (dom.kpiTotalCount) dom.kpiTotalCount.textContent = total;
    if (dom.kpiOnlineCount) dom.kpiOnlineCount.textContent = `● ${online} Online`;
    if (dom.kpiOfflineCount) dom.kpiOfflineCount.textContent = `${offline} Offline`;
    if (dom.kpiDrivingCount) dom.kpiDrivingCount.textContent = moving;
    if (dom.kpiIdleCount) dom.kpiIdleCount.textContent = `${idle} Idling`;
    if (dom.kpiLiveStreamsCount) dom.kpiLiveStreamsCount.textContent = state.isStreaming ? '2' : '0';
    if (dom.kpiSafetyEventsCount) dom.kpiSafetyEventsCount.textContent = safetyEvents.length;
    if (dom.kpiHealthRate) dom.kpiHealthRate.textContent = `${Math.round(((online + idle) / Math.max(total, 1)) * 100)}%`;
  }

  function initOverviewMap() {
    if (!dom.overviewMapContainer || state.overviewMap) return;

    // Center on India by default
    state.overviewMap = L.map('overviewMapContainer', {
      zoomControl: true,
      attributionControl: false
    }).setView([20.5937, 78.9629], 5);

    // Google Maps Roadmap Tiles
    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: 'Map data &copy; Google'
    }).addTo(state.overviewMap);

    setTimeout(() => {
      if (state.overviewMap) state.overviewMap.invalidateSize();
    }, 200);

    updateOverviewMapMarkers();
  }

  function updateOverviewMapMarkers() {
    if (!state.overviewMap) return;

    const bounds = L.latLngBounds([]);
    state.vehicles.forEach(v => {
      if (!v.lat || !v.lng) return;

      const latLng = [v.lat, v.lng];
      bounds.extend(latLng);

      const color = v.status === 'ONLINE' ? '#16a34a' : (v.status === 'IDLE' ? '#d97706' : '#94a3b8');
      const iconHtml = `
        <div style="width:28px;height:28px;border-radius:50%;background:#ffffff;border:2px solid ${color};box-shadow:0 2px 4px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;cursor:pointer;">
          <div style="width:18px;height:18px;transform:rotate(${v.heading || 0}deg);display:flex;align-items:center;justify-content:center;color:${color};font-size:12px;font-weight:bold;">▲</div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'vehicle-pin-marker',
        html: iconHtml,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      if (state.overviewMarkers.has(v.id)) {
        const marker = state.overviewMarkers.get(v.id);
        marker.setLatLng(latLng);
        marker.setIcon(customIcon);
      } else {
        const marker = L.marker(latLng, { icon: customIcon }).addTo(state.overviewMap);
        marker.bindPopup(`
          <div style="font-family:'Inter',sans-serif;padding:4px;min-width:180px;">
            <div style="font-weight:700;font-size:13px;color:#0f172a;">${v.plateNumber}</div>
            <div style="font-size:11px;color:#64748b;margin:2px 0 6px 0;">${v.label} • ${v.driverName}</div>
            <div style="font-size:11px;font-weight:600;color:${color};margin-bottom:8px;">${v.status} • ${v.speed} km/h</div>
            <button onclick="window.InurumApp.streamFromMap('${v.id}')" style="width:100%;height:26px;background:#2563eb;color:#fff;border:none;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer;">▶ Live Camera</button>
          </div>
        `);
        state.overviewMarkers.set(v.id, marker);
      }
    });

    if (bounds.isValid()) {
      state.overviewMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  }

  function renderOverviewSafetyTable(events) {
    if (!dom.overviewSafetyTableBody) return;
    if (!events || events.length === 0) {
      dom.overviewSafetyTableBody.innerHTML = `
        <tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted);">No safety incidents reported in the last 24 hours.</td></tr>
      `;
      return;
    }

    dom.overviewSafetyTableBody.innerHTML = events.slice(0, 5).map(e => `
      <tr>
        <td><span class="badge-chip ${(e.severity || 'info').toLowerCase()}">${e.severity || 'INFO'}</span></td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:11px;">${new Date(e.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
        <td><strong>${e.vehiclePlate || 'CAM-505073'}</strong></td>
        <td>${e.driverName || 'Desk Test (Cable)'}</td>
        <td>${(e.eventType || e.type || 'INCIDENT').replace(/_/g, ' ')}</td>
        <td style="font-family:'JetBrains Mono',monospace;">${e.speed || 0} km/h</td>
        <td><button class="btn-table-action" onclick="window.InurumApp.reviewIncident('${e.id}')">Review Clip</button></td>
      </tr>
    `).join('');
  }

  function renderOverviewRecordings(vehicles) {
    if (!dom.overviewRecordingsList) return;
    const v = vehicles[0] || { plateNumber: 'CAM-505073' };
    dom.overviewRecordingsList.innerHTML = `
      <div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12px;background:var(--bg-subtle, #f8fafc);border-radius:8px;border:1px dashed var(--border-color, #e2e8f0);">
        <div style="font-size:24px;margin-bottom:6px;">💾</div>
        <div style="font-weight:600;color:var(--text-main, #0f172a);margin-bottom:4px;">SD-Card First Local Recording Active</div>
        <div>24×7 continuous high-definition footage is saved directly to vehicle MicroSD card for ${v.plateNumber}. Use Video Center to fetch clips on-demand.</div>
      </div>
    `;
  }

  // ── SCREEN 2: Live Monitoring View ────────────────────────────────────
  function renderVehicleRosterCards() {
    if (!dom.rosterCardsContainer) return;

    let filtered = state.vehicles;
    if (state.activeRosterFilter === 'ONLINE') {
      filtered = filtered.filter(v => v.status === 'ONLINE');
    } else if (state.activeRosterFilter === 'MOVING') {
      filtered = filtered.filter(v => v.speed > 0);
    } else if (state.activeRosterFilter === 'IDLE') {
      filtered = filtered.filter(v => v.status === 'IDLE');
    } else if (state.activeRosterFilter === 'OFFLINE') {
      filtered = filtered.filter(v => v.status === 'OFFLINE');
    }

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      filtered = filtered.filter(v =>
        v.plateNumber.toLowerCase().includes(q) ||
        v.driverName.toLowerCase().includes(q) ||
        v.terminalId.includes(q)
      );
    }

    if (filtered.length === 0) {
      dom.rosterCardsContainer.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-icon">🔍</div>
          <div>No vehicles match filter</div>
        </div>
      `;
      return;
    }

    dom.rosterCardsContainer.innerHTML = filtered.map(v => {
      const isSelected = v.id === state.selectedVehicleId;
      const hasGps = v.lat != null && v.lng != null && v.lat !== 0;
      // Offline first: the gateway can replay a stale speed/position for a disconnected camera
      const isOffline = v.status === 'OFFLINE';
      const statusClass = isOffline ? 'offline' : (!hasGps ? 'idle' : (v.speed > 0 ? 'online' : 'idle'));
      const statusLabel = isOffline ? 'Offline' : (!hasGps ? 'Online · No GPS' : (v.speed > 0 ? `Moving ${v.speed} km/h` : (v.ignition ? 'Idle' : 'Parked')));
      const plate = v.plateNumber || v.terminalId || 'CAM-505073';
      const isCableRig = (v.type && v.type.toLowerCase().includes('cable')) || plate.startsWith('CAM-');
      const modelShort = (v.model || 'M16C').split(' ')[0];
      const driver = v.driverName || 'Desk Test (Cable)';

      return `
        <div class="vehicle-card-item ${isSelected ? 'selected' : ''}" onclick="window.InurumApp.selectVehicle('${v.id}')">
          <div class="card-top-row">
            <div class="hsrp-plate" style="${isCableRig ? 'border-color:#0284c7;background:#f0f9ff;' : ''}">
              <span class="ind-tag" style="${isCableRig ? 'background:#0284c7;color:#fff;' : ''}">${isCableRig ? 'CAM' : 'IND'}</span>
              <span style="${isCableRig ? 'color:#0369a1;font-weight:700;' : ''}">${plate}</span>
            </div>
            <span class="badge-chip ${statusClass}">${statusLabel}</span>
          </div>
          <div class="vehicle-driver-row">
            <span>${isCableRig ? '⚡' : '👤'} ${driver}</span>
            <span style="color:var(--text-muted);font-size:11px;">(${modelShort})</span>
          </div>
          <div class="vehicle-telemetry-row">
            <span>IMEI: ${v.terminalId || '-'}</span>
            <span style="${hasGps ? '' : 'color:#f59e0b;font-weight:600;'}">${hasGps ? (v.address ? v.address.split(',')[0] : `${v.lat.toFixed(4)}°N, ${v.lng.toFixed(4)}°E`) : '📡 No GPS fix'}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function selectVehicle(vehicleId) {
    state.selectedVehicleId = vehicleId;
    const v = state.vehicles.find(veh => veh.id === vehicleId);
    if (!v) return;
    state.selectedVehicle = v;

    const hasGps = v.lat != null && v.lng != null && v.lat !== 0;

    // Update Live Player Header & Meta
    const isCable = v.plateNumber.startsWith('CAM-') || (v.type && v.type.toLowerCase().includes('cable'));
    const indTag = dom.activeVehiclePlateChip ? dom.activeVehiclePlateChip.querySelector('.ind-tag') : null;
    if (indTag) {
      indTag.textContent = isCable ? 'CAM' : 'IND';
      indTag.style.background = isCable ? '#0284c7' : '';
      indTag.style.color = isCable ? '#fff' : '';
    }
    if (dom.activeVehiclePlateChip) {
      dom.activeVehiclePlateChip.style.borderColor = isCable ? '#0284c7' : '';
      dom.activeVehiclePlateChip.style.background = isCable ? '#f0f9ff' : '';
    }
    if (dom.activePlateText) {
      dom.activePlateText.textContent = v.plateNumber;
      dom.activePlateText.style.color = isCable ? '#0369a1' : '';
      dom.activePlateText.style.fontWeight = isCable ? '700' : '';
    }
    if (dom.activeVehicleTitle) dom.activeVehicleTitle.textContent = `${v.label} (${v.model})`;
    if (dom.activeDriverText) dom.activeDriverText.textContent = isCable ? `• ⚡ ${v.driverName} (IMEI: ${v.terminalId})` : `• ${v.driverName} (IMEI: ${v.terminalId})`;
    if (dom.subdeckAddress) dom.subdeckAddress.textContent = hasGps ? (v.address || `${v.lat.toFixed(4)}°N, ${v.lng.toFixed(4)}°E`) : '⚡ Bench Test Rig (Cable Powered • Indoors)';
    if (dom.diagImei) dom.diagImei.textContent = v.terminalId;
    if (dom.diagSpeed) dom.diagSpeed.textContent = `${v.speed} km/h`;
    if (dom.diagVoltage) dom.diagVoltage.textContent = (v.hardware && v.hardware.voltage != null) ? `${v.hardware.voltage}V (DC)` : (v.externalVoltage ? `${v.externalVoltage}V (DC)` : '12.4V (DC)');
    if (dom.diagSats) dom.diagSats.textContent = hasGps ? (v.hardware?.gpsSatellites || '12 Locked (3D Fix)') : 'Searching Satellites...';
    if (dom.osdTelemetryRoad) {
      dom.osdTelemetryRoad.textContent = hasGps
        ? `SPEED: ${v.speed} KM/H | ${v.lat.toFixed(4)}°N, ${v.lng.toFixed(4)}°E`
        : `SPEED: 0 KM/H | 🛰️ GPS SEARCHING SATELLITES (AWAITING LOCK)`;
    }

    const osdCabin = document.getElementById('osdTelemetryCabin');
    if (osdCabin) {
      osdCabin.textContent = `DRIVER: ${v.driverName ? v.driverName.toUpperCase() : 'ACTIVE'} • CABIN DMS: STANDBY`;
    }

    renderVehicleRosterCards();
    updateLiveFocusMap(v);

    // If currently streaming, reload live channels for selected vehicle
    if (state.isStreaming) {
      attachVideoStreams(v.terminalId);
    } else {
      setCameraStandby('screenRoadWrap', 1, v.terminalId, true, 'Hardware Standby • Click "Start Live Stream" to request optical video.');
      setCameraStandby('screenCabinWrap', 2, v.terminalId, true, 'Hardware Standby • Click "Start Live Stream" to request optical video.');
    }
  }

  function initLiveFocusMap() {
    if (!dom.liveFocusMapContainer || state.liveFocusMap) return;

    state.liveFocusMap = L.map('liveFocusMapContainer', {
      zoomControl: true,
      attributionControl: false
    }).setView([22.7339, 75.8615], 14);

    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: 'Map data &copy; Google'
    }).addTo(state.liveFocusMap);

    setTimeout(() => {
      if (state.liveFocusMap) state.liveFocusMap.invalidateSize();
    }, 200);

    if (state.selectedVehicle) {
      updateLiveFocusMap(state.selectedVehicle);
    }
  }

  function updateLiveFocusMap(vehicle) {
    if (!state.liveFocusMap) return;
    if (!vehicle.lat || !vehicle.lng) {
      if (state.liveFocusMarker) {
        state.liveFocusMap.removeLayer(state.liveFocusMarker);
        state.liveFocusMarker = null;
      }
      return;
    }

    const latLng = [vehicle.lat, vehicle.lng];
    state.liveFocusMap.setView(latLng, 15, { animate: true });

    const iconHtml = `
      <div style="width:32px;height:32px;border-radius:50%;background:#ffffff;border:2px solid #2563eb;box-shadow:0 2px 6px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;">
        <div style="width:20px;height:20px;transform:rotate(${vehicle.heading || 0}deg);display:flex;align-items:center;justify-content:center;color:#2563eb;font-size:14px;font-weight:bold;">▲</div>
      </div>
    `;

    const customIcon = L.divIcon({
      className: 'focus-vehicle-marker',
      html: iconHtml,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    if (state.liveFocusMarker) {
      state.liveFocusMarker.setLatLng(latLng);
      state.liveFocusMarker.setIcon(customIcon);
    } else {
      state.liveFocusMarker = L.marker(latLng, { icon: customIcon }).addTo(state.liveFocusMap);
    }
  }

  // ── Dual Camera HLS Video Engine ──────────────────────────────────────
  async function startLiveStreaming() {
    if (!state.selectedVehicle) {
      showToast('Please select a vehicle from the roster first.', 'warning');
      return;
    }

    state.isStreaming = true;
    if (dom.btnStartStream) dom.btnStartStream.style.display = 'none';
    if (dom.btnStopStream) dom.btnStopStream.style.display = 'inline-flex';
    if (dom.kpiLiveStreamsCount) dom.kpiLiveStreamsCount.textContent = '2';

    // Show connecting state
    if (dom.streamConnectingOverlay) {
      dom.streamConnectingOverlay.style.display = 'flex';
      if (dom.streamConnectingText) {
        dom.streamConnectingText.textContent = `Connecting to 4G Dashcam Stream for ${state.selectedVehicle.plateNumber}...`;
      }
    }

    // Backend checks the camera is connected and within quota, then sends 0x9101 (both channels at once)
    let session;
    try {
      session = await FleetApi.startLiveSession(state.selectedVehicle.terminalId, 1);
    } catch (err) {
      state.isStreaming = false;
      if (dom.btnStartStream) dom.btnStartStream.style.display = 'inline-flex';
      if (dom.btnStopStream) dom.btnStopStream.style.display = 'none';
      if (dom.kpiLiveStreamsCount) dom.kpiLiveStreamsCount.textContent = '0';
      if (dom.streamConnectingOverlay) dom.streamConnectingOverlay.style.display = 'none';
      showToast(`Live stream not started: ${err.message}`, 'error');
      return;
    }

    // Countdown to the server-side session limit
    startStreamTtlTimer(session.timeToLiveSeconds || 120);

    // Start active viewer heartbeat watchdog (pings server every 8s)
    clearInterval(state.heartbeatInterval);
    state.heartbeatInterval = setInterval(async () => {
      if (state.isStreaming && state.selectedVehicle) {
        try {
          const hb = await FleetApi.sendLiveHeartbeat(state.selectedVehicle.terminalId);
          if (hb && hb.active === false) {
            stopLiveStreaming();
            showToast('Live stream stopped: server bandwidth limit or inactivity reached.', 'warning');
          }
        } catch (_) { }
      }
    }, 8000);

    // Attach HLS players
    attachVideoStreams(state.selectedVehicle.terminalId);
    showToast(`Live stream requested (CH1 + CH2)`, 'info');
  }

  function stopLiveStreaming() {
    if (state.isStreaming && state.selectedVehicle) {
      // Dispatches 0x9102 stop stream to hardware and stops ffmpeg on server
      FleetApi.stopLiveStream(state.selectedVehicle.terminalId).catch(() => { });
    }

    state.isStreaming = false;
    clearInterval(state.liveTtlInterval);
    state.liveTtlInterval = null;
    clearInterval(state.heartbeatInterval);
    state.heartbeatInterval = null;

    if (dom.btnStartStream) dom.btnStartStream.style.display = 'inline-flex';
    if (dom.btnStopStream) dom.btnStopStream.style.display = 'none';
    if (dom.streamConnectingOverlay) dom.streamConnectingOverlay.style.display = 'none';
    if (dom.streamTtlTimer) dom.streamTtlTimer.textContent = '⏱️ 120s';
    if (dom.kpiLiveStreamsCount) dom.kpiLiveStreamsCount.textContent = '0';

    if (state.hlsRoad) {
      state.hlsRoad.destroy();
      state.hlsRoad = null;
    }
    if (state.hlsCabin) {
      state.hlsCabin.destroy();
      state.hlsCabin = null;
    }

    const iframes = document.querySelectorAll('.live-player-iframe');
    iframes.forEach(el => {
      el.src = 'about:blank';
      el.remove();
    });

    if (dom.videoRoad) {
      dom.videoRoad.pause();
      dom.videoRoad.removeAttribute('src');
      dom.videoRoad.load();
    }
    if (dom.videoCabin) {
      dom.videoCabin.pause();
      dom.videoCabin.removeAttribute('src');
      dom.videoCabin.load();
    }

    setCameraStandby('screenRoadWrap', 1, state.selectedVehicle?.terminalId, true, 'Live stream stopped. Click "Start Live Stream" to request optical video.');
    setCameraStandby('screenCabinWrap', 2, state.selectedVehicle?.terminalId, true, 'Live stream stopped. Click "Start Live Stream" to request optical video.');

    showToast('Live stream stopped (Hardware 0x9102 dispatched & FFmpeg terminated).', 'info');
  }

  function startStreamTtlTimer(seconds = 120) {
    clearInterval(state.liveTtlInterval);
    state.liveTtlSeconds = seconds;
    if (dom.streamTtlTimer) dom.streamTtlTimer.textContent = `⏱️ ${state.liveTtlSeconds}s`;

    state.liveTtlInterval = setInterval(() => {
      state.liveTtlSeconds--;
      if (dom.streamTtlTimer) {
        dom.streamTtlTimer.textContent = `⏱️ ${state.liveTtlSeconds}s`;
      }
      if (state.liveTtlSeconds <= 0) {
        clearInterval(state.liveTtlInterval);
        stopLiveStreaming();
        showToast('Live stream ended (session time limit reached).', 'warning');
      }
    }, 1000);
  }

  function setCameraStandby(screenWrapId, channelId, terminalId, isStandby, reason) {
    const screenWrap = document.getElementById(screenWrapId);
    if (!screenWrap) return;
    let standbyEl = screenWrap.querySelector('.camera-standby-screen');
    const videoEl = screenWrap.querySelector('video');

    if (isStandby) {
      if (!standbyEl) {
        standbyEl = document.createElement('div');
        standbyEl.className = 'camera-standby-screen';
        standbyEl.innerHTML = `
          <div class="standby-radar-ring"></div>
          <div class="standby-title">📡 REAL OPTICAL FEED STANDBY</div>
          <div class="standby-sub">Hardware Terminal: <b class="standby-term-id">${terminalId || 'Awaiting Device'}</b></div>
          <div class="standby-channel">Channel ${channelId}: ${channelId === 2 ? 'Driver Cabin DMS' : 'Road Facing (1080P)'}</div>
          <div class="standby-desc">${reason || 'Awaiting hardware RTP stream on TCP port 10780 (JT/T 1078)...'}</div>
          <div class="standby-badge">● HARDWARE PIPELINE READY</div>
        `;
        screenWrap.appendChild(standbyEl);
      } else {
        standbyEl.style.display = 'flex';
        const termEl = standbyEl.querySelector('.standby-term-id');
        if (termEl) termEl.textContent = terminalId || 'Awaiting Device';
        const descEl = standbyEl.querySelector('.standby-desc');
        if (descEl && reason) descEl.textContent = reason;
      }
      if (videoEl) {
        videoEl.style.display = 'none';
        videoEl.pause();
        videoEl.removeAttribute('src');
      }
    } else {
      if (standbyEl) standbyEl.style.display = 'none';
      if (videoEl) videoEl.style.display = 'block';
    }
  }

  function attachVideoStreams(terminalId) {
    const wrapRoad = document.getElementById('screenRoadWrap');
    const wrapCabin = document.getElementById('screenCabinWrap');

    const onReady = () => {
      if (dom.streamConnectingOverlay) dom.streamConnectingOverlay.style.display = 'none';
    };
    setTimeout(onReady, 1200);

    // Hide raw standby overlay while streaming
    setCameraStandby('screenRoadWrap', 1, terminalId, false);
    setCameraStandby('screenCabinWrap', 2, terminalId, false);

    if (wrapRoad) {
      let iframe = wrapRoad.querySelector('.live-player-iframe');
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.className = 'live-player-iframe';
        iframe.allow = 'autoplay; fullscreen';
        iframe.style.cssText = 'width:100%;height:100%;border:none;background:#000;position:absolute;top:0;left:0;z-index:5;';
        wrapRoad.appendChild(iframe);
      }
      iframe.src = `/player.html?terminalId=${terminalId}&ch=1&t=${Date.now()}`;
      iframe.style.display = 'block';
    }

    if (wrapCabin) {
      let iframe = wrapCabin.querySelector('.live-player-iframe');
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.className = 'live-player-iframe';
        iframe.allow = 'autoplay; fullscreen';
        iframe.style.cssText = 'width:100%;height:100%;border:none;background:#000;position:absolute;top:0;left:0;z-index:5;';
        wrapCabin.appendChild(iframe);
      }
      iframe.src = `/player.html?terminalId=${terminalId}&ch=2&t=${Date.now()}`;
      iframe.style.display = 'block';
    }
  }

  function bindHlsStream(videoEl, url, existingInstance = null, onReadyCallback = null, channelId = 1, terminalId = '') {
    if (!videoEl || !url) return null;

    const wrapId = channelId === 2 ? 'screenCabinWrap' : 'screenRoadWrap';
    setCameraStandby(wrapId, channelId, terminalId, true, 'Awaiting dashcam video transmission on TCP port 10780...');

    videoEl.muted = true; // Auto-play compliant
    videoEl.playsInline = true;
    videoEl.crossOrigin = 'anonymous';
    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('autoplay', '');

    if (existingInstance) {
      try { existingInstance.destroy(); } catch (_) { }
    }

    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        // Camera uplink is 4G with ~5.6s segments: stay 3 segments behind the edge so jitter doesn't stall playback
        lowLatencyMode: false,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
        maxBufferLength: 30,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 6,
        manifestLoadingMaxRetry: 6,
        manifestLoadingRetryDelay: 1200
      });

      hls.loadSource(url);
      hls.attachMedia(videoEl);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setCameraStandby(wrapId, channelId, terminalId, false);
        videoEl.play().then(() => {
          if (onReadyCallback) onReadyCallback();
        }).catch(() => { });
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        setCameraStandby(wrapId, channelId, terminalId, false);
        if (onReadyCallback) onReadyCallback();
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          try { hls.destroy(); } catch (_) { }
          // Hardware is in standby - NEVER serve hardcoded road_cam.mp4!
          setCameraStandby(wrapId, channelId, terminalId, true, 'No video from the dashcam yet. Check that the camera is online.');
          if (onReadyCallback) onReadyCallback();
        }
      });

      videoEl.onloadeddata = () => {
        setCameraStandby(wrapId, channelId, terminalId, false);
        if (onReadyCallback) onReadyCallback();
      };
      videoEl.onplaying = () => {
        setCameraStandby(wrapId, channelId, terminalId, false);
        if (onReadyCallback) onReadyCallback();
      };

      return hls;
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = url;
      videoEl.addEventListener('loadedmetadata', () => {
        setCameraStandby(wrapId, channelId, terminalId, false);
        videoEl.play().catch(() => { });
      });
      videoEl.addEventListener('error', () => {
        setCameraStandby(wrapId, channelId, terminalId, true, 'Dashcam socket standby. Awaiting real video stream...');
      });
    }

    return null;
  }

  function setChannelLayout(channel) {
    state.activeChannel = channel;
    dom.channelTabBtns.forEach(btn => {
      if (btn.dataset.channel === channel) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    if (!dom.dualCameraGrid) return;
    dom.dualCameraGrid.className = 'dual-camera-grid';

    if (channel === '1') {
      dom.dualCameraGrid.classList.add('single-ch1');
    } else if (channel === '2') {
      dom.dualCameraGrid.classList.add('single-ch2');
    }
  }

  // ── Global Event Bindings ─────────────────────────────────────────────
  function bindEvents() {
    // Nav Items routing
    dom.navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const route = item.dataset.route;
        navigateTo(route);
      });
    });

    // Global Search Bar
    if (dom.globalSearchInput) {
      dom.globalSearchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim();
        renderVehicleRosterCards();
      });
    }

    // Live Monitoring Roster Search
    if (dom.rosterSearchInput) {
      dom.rosterSearchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim();
        renderVehicleRosterCards();
      });
    }

    // Live Monitoring Roster Filter Pills
    dom.rosterFilterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        dom.rosterFilterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.activeRosterFilter = pill.dataset.filter;
        renderVehicleRosterCards();
      });
    });

    // Live Stream Action Controls
    if (dom.btnStartStream) dom.btnStartStream.addEventListener('click', startLiveStreaming);
    if (dom.btnStopStream) dom.btnStopStream.addEventListener('click', stopLiveStreaming);

    // Channel Layout Switcher Tabs
    dom.channelTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        setChannelLayout(btn.dataset.channel);
      });
    });

    // Overview Fit Fleet Button
    if (dom.btnCenterOverviewMap) {
      dom.btnCenterOverviewMap.addEventListener('click', () => {
        if (state.overviewMap && state.vehicles.length > 0) {
          const bounds = L.latLngBounds(state.vehicles.map(v => [v.lat, v.lng]));
          state.overviewMap.fitBounds(bounds, { padding: [40, 40] });
        }
      });
    }

    // Go to Live Surveillance from Overview CTA
    if (dom.btnGoToLiveFromOverview) {
      dom.btnGoToLiveFromOverview.addEventListener('click', () => {
        navigateTo('live');
        if (!state.isStreaming) startLiveStreaming();
      });
    }

    // IR Night Vision Shader Toggle
    if (dom.btnToggleNightVision) {
      dom.btnToggleNightVision.addEventListener('click', () => {
        state.isNightVision = !state.isNightVision;
        const filterVal = state.isNightVision
          ? 'contrast(1.5) brightness(1.2) hue-rotate(90deg) saturate(0.4)'
          : 'none';
        if (dom.videoRoad) dom.videoRoad.style.filter = filterVal;
        if (dom.videoCabin) dom.videoCabin.style.filter = filterVal;
        showToast(`IR Night Vision: ${state.isNightVision ? 'ENABLED' : 'DISABLED'}`, 'info');
      });
    }

    // Snapshot Capture Button
    if (dom.btnSnapshot) {
      // Still-image capture (JT1078 0x8801) is not implemented by the gateway, so say so instead of faking it
      dom.btnSnapshot.addEventListener('click', () => {
        showToast('Snapshot capture is not available yet for these dashcams.', 'warning');
      });
    }

    // Audio Toggle
    if (dom.btnAudioToggle) {
      dom.btnAudioToggle.addEventListener('click', () => {
        state.isMuted = !state.isMuted;
        if (dom.videoRoad) dom.videoRoad.muted = state.isMuted;
        if (dom.videoCabin) dom.videoCabin.muted = state.isMuted;
        showToast(`Cabin Audio: ${state.isMuted ? 'MUTED' : 'LIVE ON'}`, 'info');
      });
    }

    // Fullscreen Viewport
    if (dom.btnFullscreen && dom.videoViewportWrapper) {
      dom.btnFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          dom.videoViewportWrapper.requestFullscreen().catch(() => { });
        } else {
          document.exitFullscreen().catch(() => { });
        }
      });
    }

    // Sign Out
    if (dom.btnSignOut) {
      dom.btnSignOut.addEventListener('click', () => {
        FleetApi.logout();
        showAuthModal();
      });
    }

    // Auth Form Submit
    if (dom.authForm) {
      dom.authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleLogin(dom.inputAuthEmail.value.trim(), dom.inputAuthPassword.value);
      });
    }
  }

  // ── Toast Notification Helper ─────────────────────────────────────────
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    if (type === 'success') toast.style.backgroundColor = '#16a34a';
    else if (type === 'error') toast.style.backgroundColor = '#dc2626';
    else if (type === 'warning') toast.style.backgroundColor = '#d97706';

    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ── SCREEN 3: Video Center Implementation ─────────────────────────────
  function initVideoCenter() {
    // Populate Vehicle Select (only vehicles that have a dashcam)
    const withCamera = state.vehicles.filter(v => v.terminalId);
    if (!state.vcSelectedVehicleId && withCamera.length > 0) state.vcSelectedVehicleId = withCamera[0].terminalId;
    if (dom.vcVehicleSelect) {
      dom.vcVehicleSelect.innerHTML = withCamera.length === 0
        ? '<option value="">No vehicle with a dashcam</option>'
        : withCamera.map(v => `
        <option value="${v.terminalId}" ${v.terminalId === state.vcSelectedVehicleId ? 'selected' : ''}>
          ${escapeHtml(v.plateNumber)} • ${escapeHtml(v.label)}${v.dashcamModel ? ' (' + escapeHtml(v.dashcamModel) + ')' : ''}
        </option>
      `).join('');
    }
    if (!state.vcSelectedVehicleId) return;

    // Set Default Date to Today
    if (dom.vcDatePicker && !dom.vcDatePicker.value) {
      dom.vcDatePicker.value = state.vcSelectedDate;
    }

    // Bind Timeline Interaction
    bindVcTimeline();

    // Bind Video Center Actions
    bindVcActions();

    // Sync Metadata Panel
    syncVcMetadata();

    // Initial Load of Recordings & Incidents on Timeline
    loadVideoCenterRecordings();
  }

  function syncVcMetadata() {
    const v = state.vehicles.find(veh => veh.terminalId === state.vcSelectedVehicleId) || state.vehicles[0];
    if (v) {
      if (dom.vcMetaPlate) dom.vcMetaPlate.textContent = v.plateNumber;
      if (dom.vcMetaDriver) dom.vcMetaDriver.textContent = v.driverName || 'Assigned Driver';
    }
    if (dom.vcMetaChannel) dom.vcMetaChannel.textContent = state.vcSelectedChannel === 1 ? 'CH1 Road (1080P FHD)' : 'CH2 Cabin (1080P FHD)';
    if (dom.vcMetaCodec) dom.vcMetaCodec.textContent = 'H.264 / AAC';
    if (dom.vcMetaLocation) dom.vcMetaLocation.textContent = 'Micro-SD Card (Hardware)';
  }

  function bindVcTimeline() {
    if (!dom.vcTimelineTrack || dom.vcTimelineTrack.dataset.bound) return;
    dom.vcTimelineTrack.dataset.bound = 'true';

    function handleTimelineScrub(e) {
      const rect = dom.vcTimelineTrack.getBoundingClientRect();
      let pct = (e.clientX - rect.left) / rect.width;
      pct = Math.max(0, Math.min(1, pct));

      // 86400 seconds in a 24h day
      const totalSec = Math.floor(pct * 86400);
      const hours = String(Math.floor(totalSec / 3600)).padStart(2, '0');
      const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
      const secs = String(totalSec % 60).padStart(2, '0');
      const timeStr = `${hours}:${mins}:${secs}`;

      if (dom.vcTimelineNeedle) dom.vcTimelineNeedle.style.left = `${(pct * 100).toFixed(2)}%`;
      if (dom.vcNeedleFlag) dom.vcNeedleFlag.textContent = `${hours}:${mins}`;
      if (dom.vcScrubTimestampText) dom.vcScrubTimestampText.textContent = `${timeStr} IST`;

      // Update time inputs to scrubbed point
      if (dom.vcTimeStart) dom.vcTimeStart.value = `${hours}:${mins}`;
    }

    let isDragging = false;
    dom.vcTimelineTrack.addEventListener('mousedown', (e) => {
      isDragging = true;
      handleTimelineScrub(e);
    });
    window.addEventListener('mousemove', (e) => {
      if (isDragging) handleTimelineScrub(e);
    });
    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // Touch support for mobile/tablet responsive testing
    dom.vcTimelineTrack.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) handleTimelineScrub(e.touches[0]);
    }, { passive: true });
    dom.vcTimelineTrack.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) handleTimelineScrub(e.touches[0]);
    }, { passive: true });
  }

  function bindVcActions() {
    // Channel Selector Tabs
    if (dom.btnVcChannel1 && !dom.btnVcChannel1.dataset.bound) {
      dom.btnVcChannel1.dataset.bound = 'true';
      dom.btnVcChannel1.addEventListener('click', () => {
        state.vcSelectedChannel = 1;
        dom.btnVcChannel1.classList.add('active');
        if (dom.btnVcChannel2) dom.btnVcChannel2.classList.remove('active');
        if (dom.vcPlayerTitle) dom.vcPlayerTitle.textContent = 'CH1 Road Facing Footage';
        syncVcMetadata();
        loadVideoCenterRecordings();
      });
    }

    if (dom.btnVcChannel2 && !dom.btnVcChannel2.dataset.bound) {
      dom.btnVcChannel2.dataset.bound = 'true';
      dom.btnVcChannel2.addEventListener('click', () => {
        state.vcSelectedChannel = 2;
        dom.btnVcChannel2.classList.add('active');
        if (dom.btnVcChannel1) dom.btnVcChannel1.classList.remove('active');
        if (dom.vcPlayerTitle) dom.vcPlayerTitle.textContent = 'CH2 Driver Cabin Footage';
        syncVcMetadata();
        loadVideoCenterRecordings();
      });
    }

    // Vehicle Select Change
    if (dom.vcVehicleSelect && !dom.vcVehicleSelect.dataset.bound) {
      dom.vcVehicleSelect.dataset.bound = 'true';
      dom.vcVehicleSelect.addEventListener('change', (e) => {
        state.vcSelectedVehicleId = e.target.value;
        syncVcMetadata();
        loadVideoCenterRecordings();
      });
    }

    // Date Picker Change
    if (dom.vcDatePicker && !dom.vcDatePicker.dataset.bound) {
      dom.vcDatePicker.dataset.bound = 'true';
      dom.vcDatePicker.addEventListener('change', (e) => {
        state.vcSelectedDate = e.target.value;
        loadVideoCenterRecordings();
      });
    }

    // Query SD Card Button (JT/T 1078 0x9205) -> Opens Samsara Video Retrieval Modal (Image 1)
    if (dom.btnQuerySdCard && !dom.btnQuerySdCard.dataset.bound) {
      dom.btnQuerySdCard.dataset.bound = 'true';
      dom.btnQuerySdCard.addEventListener('click', () => {
        openVideoRetrievalModal(state.vcSelectedVehicleId);
      });
    }

    // Request Cloud Retrieval Button (JT/T 1078 0x9206) -> Opens Samsara Video Retrieval Modal (Image 1)
    if (dom.btnRequestRetrieval && !dom.btnRequestRetrieval.dataset.bound) {
      dom.btnRequestRetrieval.dataset.bound = 'true';
      dom.btnRequestRetrieval.addEventListener('click', () => {
        openVideoRetrievalModal(state.vcSelectedVehicleId);
      });
    }

    // Refresh Recordings Button
    if (dom.btnRefreshRecordings && !dom.btnRefreshRecordings.dataset.bound) {
      dom.btnRefreshRecordings.dataset.bound = 'true';
      dom.btnRefreshRecordings.addEventListener('click', () => {
        loadVideoCenterRecordings();
        showToast('Recordings archive refreshed.', 'info');
      });
    }

    // Video Player Custom Transport Controls
    if (dom.btnVcPlayPause && !dom.btnVcPlayPause.dataset.bound) {
      dom.btnVcPlayPause.dataset.bound = 'true';
      dom.btnVcPlayPause.addEventListener('click', () => {
        if (!dom.vcVideoPlayer) return;
        if (dom.vcVideoPlayer.paused) {
          dom.vcVideoPlayer.play().catch(() => { });
          dom.btnVcPlayPause.textContent = '⏸️ Pause';
        } else {
          dom.vcVideoPlayer.pause();
          dom.btnVcPlayPause.textContent = '▶️ Play';
        }
      });
    }

    if (dom.btnVcSeekBack && !dom.btnVcSeekBack.dataset.bound) {
      dom.btnVcSeekBack.dataset.bound = 'true';
      dom.btnVcSeekBack.addEventListener('click', () => {
        if (dom.vcVideoPlayer) dom.vcVideoPlayer.currentTime = Math.max(0, dom.vcVideoPlayer.currentTime - 10);
      });
    }

    if (dom.btnVcSeekForward && !dom.btnVcSeekForward.dataset.bound) {
      dom.btnVcSeekForward.dataset.bound = 'true';
      dom.btnVcSeekForward.addEventListener('click', () => {
        if (dom.vcVideoPlayer) dom.vcVideoPlayer.currentTime = Math.min(dom.vcVideoPlayer.duration || 9999, dom.vcVideoPlayer.currentTime + 10);
      });
    }

    if (dom.vcPlaybackSpeedSelect && !dom.vcPlaybackSpeedSelect.dataset.bound) {
      dom.vcPlaybackSpeedSelect.dataset.bound = 'true';
      dom.vcPlaybackSpeedSelect.addEventListener('change', (e) => {
        if (dom.vcVideoPlayer) dom.vcVideoPlayer.playbackRate = parseFloat(e.target.value);
      });
    }

    if (dom.btnVcDownloadClip && !dom.btnVcDownloadClip.dataset.bound) {
      dom.btnVcDownloadClip.dataset.bound = 'true';
      dom.btnVcDownloadClip.addEventListener('click', () => {
        if (!state.vcCurrentFootageUrl) {
          showToast('No footage loaded for download. Query or retrieve a clip first.', 'warning');
          return;
        }
        const a = document.createElement('a');
        a.href = state.vcCurrentFootageUrl;
        a.download = `Footage_${state.vcSelectedVehicleId}_CH${state.vcSelectedChannel}_${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('Download started.', 'success');
      });
    }

    if (dom.btnVcFullscreen && !dom.btnVcFullscreen.dataset.bound) {
      dom.btnVcFullscreen.dataset.bound = 'true';
      dom.btnVcFullscreen.addEventListener('click', () => {
        const vp = document.querySelector('.vc-video-viewport');
        if (!vp) return;
        if (!document.fullscreenElement) {
          vp.requestFullscreen().catch(() => { });
        } else {
          document.exitFullscreen().catch(() => { });
        }
      });
    }

    // Recordings Filter Tabs (All, Cloud, SD)
    [dom.btnVcTabAll, dom.btnVcTabCloud, dom.btnVcTabSd].forEach(btn => {
      if (btn && !btn.dataset.bound) {
        btn.dataset.bound = 'true';
        btn.addEventListener('click', () => {
          [dom.btnVcTabAll, dom.btnVcTabCloud, dom.btnVcTabSd].forEach(b => b && b.classList.remove('active'));
          btn.classList.add('active');
          state.vcTab = btn.dataset.vcTab;
          renderVcRecordingsTable(state.vcRecordings);
        });
      }
    });
  }

  async function handleQuerySdCard() {
    try {
      const terminalId = state.vcSelectedVehicleId;
      const channel = state.vcSelectedChannel;
      const date = dom.vcDatePicker ? dom.vcDatePicker.value : state.vcSelectedDate;
      const start = dom.vcTimeStart ? dom.vcTimeStart.value : '00:00';
      const end = dom.vcTimeEnd ? dom.vcTimeEnd.value : '23:59';

      const startTime = `${date}T${start}:00Z`;
      const endTime = `${date}T${end}:59Z`;

      showToast(`Dispatching JT/T 1078 0x9205 SD Query to IMEI ${terminalId}...`, 'info');
      const res = await FleetApi.querySdCard(terminalId, channel, startTime, endTime);

      showToast(`SD Query Acknowledged by Device: ${res.availableResources || (res.resources && res.resources.length) || 0} clips found on SD card.`, 'success');
      await loadVideoCenterRecordings();
    } catch (err) {
      console.error('[Video Center] SD Query failed:', err);
      showToast(`SD Query failed: ${err.message || 'Hardware did not acknowledge 0x9205'}`, 'error');
    }
  }

  async function handleRequestRetrieval() {
    try {
      const terminalId = state.vcSelectedVehicleId;
      const channel = state.vcSelectedChannel;
      const date = dom.vcDatePicker ? dom.vcDatePicker.value : state.vcSelectedDate;
      const start = dom.vcTimeStart ? dom.vcTimeStart.value : '00:00';
      const end = dom.vcTimeEnd ? dom.vcTimeEnd.value : '23:59';

      const startTime = `${date}T${start}:00Z`;
      const endTime = `${date}T${end}:59Z`;

      showToast(`Initiating JT/T 1078 0x9206 Retrieval Job for ${date} ${start}-${end}...`, 'info');
      const res = await FleetApi.retrieveFootage(terminalId, channel, startTime, endTime);

      if (res && res.jobId) {
        state.vcActiveJob = res.jobId;
        pollRetrievalJob(res.jobId);
      }
    } catch (err) {
      console.error('[Video Center] Retrieval request failed:', err);
      showToast(`Retrieval request failed: ${err.message || 'Server error'}`, 'error');
    }
  }

  function pollRetrievalJob(jobId) {
    clearInterval(state.vcJobPollInterval);

    if (dom.vcJobIdLabel) dom.vcJobIdLabel.textContent = `Job: ${jobId}`;
    if (dom.vcJobStatusBadge) {
      dom.vcJobStatusBadge.textContent = 'PENDING';
      dom.vcJobStatusBadge.style.background = '#e0f2fe';
      dom.vcJobStatusBadge.style.color = '#0369a1';
    }

    state.vcJobPollInterval = setInterval(async () => {
      try {
        const res = await FleetApi.getRetrievalJob(jobId);
        if (!res || !res.job) return;

        const job = res.job;
        const pct = job.progress || 0;
        const status = job.status;

        if (dom.vcJobProgressBar) dom.vcJobProgressBar.style.width = `${pct}%`;
        if (dom.vcJobPercentText) dom.vcJobPercentText.textContent = `${pct}%`;
        if (dom.vcJobStatusBadge) dom.vcJobStatusBadge.textContent = status;
        if (dom.vcJobStageText) {
          const stages = {
            PENDING: 'Dispatching JT/T 1078 0x9206 packet to terminal socket...',
            QUERYING: 'Verifying SD card storage clusters on dashcam hardware...',
            TRANSFERRING: 'Streaming raw JT1078 RTP audio/video packets over port 10780...',
            PROCESSING: 'Remuxing H.264 video and AAC audio frames into MP4/HLS container...',
            COMPLETED: 'Playing directly from the dashcam SD card (nothing is copied to the cloud).',
            FAILED: 'Hardware transfer failed or timed out.'
          };
          dom.vcJobStageText.textContent = stages[status] || status;
        }

        if (status === 'COMPLETED') {
          clearInterval(state.vcJobPollInterval);
          state.vcJobPollInterval = null;
          if (dom.vcJobStatusBadge) {
            dom.vcJobStatusBadge.style.background = '#dcfce7';
            dom.vcJobStatusBadge.style.color = '#15803d';
          }
          showToast('SD card playback started; video appears in a few seconds.', 'success');
          if (job.videoUrl) {
            playVcRecording({
              videoUrl: job.videoUrl,
              channel: job.channel,
              title: `Retrieved Footage (${job.startTime.substring(11, 16)} - ${job.endTime.substring(11, 16)})`
            });
          }
          await loadVideoCenterRecordings();
        } else if (status === 'FAILED') {
          clearInterval(state.vcJobPollInterval);
          state.vcJobPollInterval = null;
          if (dom.vcJobStatusBadge) {
            dom.vcJobStatusBadge.style.background = '#fee2e2';
            dom.vcJobStatusBadge.style.color = '#b91c1c';
          }
          showToast(`Footage retrieval job failed.`, 'error');
        }
      } catch (err) {
        console.error('[Video Center] Poll job error:', err);
      }
    }, 1200);
  }

  async function loadVideoCenterRecordings() {
    try {
      const terminalId = state.vcSelectedVehicleId;
      const channel = state.vcSelectedChannel;
      const recordings = await FleetApi.getRecordings(terminalId, channel);
      state.vcRecordings = recordings;
      renderVcRecordingsTable(recordings);
      renderVcTimelineTrack(recordings);
    } catch (err) {
      console.warn('[Video Center] Load recordings error:', err);
    }
  }

  function renderVcRecordingsTable(recordings) {
    if (!dom.vcRecordingsTableBody) return;

    let filtered = recordings || [];
    if (state.vcTab === 'cloud') {
      filtered = filtered.filter(r => r.storageSource === 'CLOUD' || r.status === 'COMPLETED');
    } else if (state.vcTab === 'sd') {
      filtered = filtered.filter(r => r.storageSource === 'SD_CARD');
    }

    if (filtered.length === 0) {
      dom.vcRecordingsTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted);">
            No footage clips found for selected filters. Click "Query SD Card (0x9205)" to scan hardware storage.
          </td>
        </tr>
      `;
      return;
    }

    dom.vcRecordingsTableBody.innerHTML = filtered.map(r => {
      const isCloud = r.storageSource === 'CLOUD' || r.status === 'COMPLETED';
      const statusBadge = isCloud
        ? '<span class="badge-chip online">● Cloud Ready</span>'
        : '<span class="badge-chip" style="background:#e0f2fe;color:#0369a1;">On Hardware SD</span>';

      return `
        <tr>
          <td style="font-family:'JetBrains Mono',monospace;font-weight:600;">${r.startTime ? r.startTime.substring(11, 19) : '—'} - ${r.endTime ? r.endTime.substring(11, 19) : '—'}</td>
          <td>CH${r.channel || state.vcSelectedChannel} (${(r.channel || state.vcSelectedChannel) === 1 ? 'Road' : 'Cabin'})</td>
          <td>${r.duration || '—'}</td>
          <td><span style="font-size:11px;font-weight:600;color:var(--text-secondary);">${isCloud ? '☁️ Cloud Vault' : '💾 Micro-SD'}</span></td>
          <td>${r.fileSizeBytes ? (r.fileSizeBytes / (1024 * 1024)).toFixed(1) + ' MB' : '—'}</td>
          <td>${statusBadge}</td>
          <td>
            ${isCloud ? `
              <button class="btn-table-action" onclick="window.InurumApp.playRecording('${r.id || r.jobId || ''}')">▶ Play</button>
            ` : `
              <button class="btn-table-action" style="background:#e0f2fe;color:#0369a1;" onclick="window.InurumApp.requestRetrievalForClip('${r.id || ''}')">⬇️ Retrieve</button>
            `}
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderVcTimelineTrack(recordings) {
    if (!dom.vcTimelineTrack) return;

    // Remove existing interval bars & markers (keep needle)
    const existing = dom.vcTimelineTrack.querySelectorAll('.timeline-recorded-bar, .timeline-incident-pin');
    existing.forEach(el => el.remove());

    // Bars only for recordings the SD card query actually returned
    const intervals = recordings || [];

    intervals.forEach(int => {
      let leftPct = 0;
      let widthPct = 0;
      if (int.startSec !== undefined) {
        leftPct = (int.startSec / 86400) * 100;
        widthPct = (int.durationSec / 86400) * 100;
      } else if (int.startTime && int.endTime) {
        const s = new Date(int.startTime);
        const e = new Date(int.endTime);
        const secStart = s.getHours() * 3600 + s.getMinutes() * 60 + s.getSeconds();
        const secEnd = e.getHours() * 3600 + e.getMinutes() * 60 + e.getSeconds();
        leftPct = (secStart / 86400) * 100;
        widthPct = Math.max(1, ((secEnd - secStart) / 86400) * 100);
      }

      const bar = document.createElement('div');
      bar.className = 'timeline-recorded-bar';
      bar.style.position = 'absolute';
      bar.style.top = '0';
      bar.style.bottom = '0';
      bar.style.left = `${leftPct.toFixed(2)}%`;
      bar.style.width = `${widthPct.toFixed(2)}%`;
      bar.style.backgroundColor = 'rgba(22, 163, 74, 0.4)';
      bar.style.borderLeft = '2px solid #16a34a';
      bar.style.borderRight = '2px solid #16a34a';
      bar.style.pointerEvents = 'none';
      dom.vcTimelineTrack.appendChild(bar);
    });

    // Pins for this camera's real alarm events on the selected day
    const day = dom.vcDatePicker ? dom.vcDatePicker.value : state.vcSelectedDate;
    const dayIncidents = (state.safetyIncidents || [])
      .filter(i => i.terminalId === state.vcSelectedVehicleId && i.timestamp)
      .map(i => ({ at: new Date(i.timestamp), label: i.description || i.type }))
      .filter(i => formatLocalDateTime(i.at).slice(0, 10) === day);
    dayIncidents.forEach(inc => {
      const sec = inc.at.getHours() * 3600 + inc.at.getMinutes() * 60 + inc.at.getSeconds();
      const pinPct = (sec / 86400) * 100;
      const pin = document.createElement('div');
      pin.className = 'timeline-incident-pin';
      pin.style.position = 'absolute';
      pin.style.top = '0';
      pin.style.bottom = '0';
      pin.style.left = `${pinPct.toFixed(2)}%`;
      pin.style.width = '3px';
      pin.style.backgroundColor = '#dc2626';
      pin.style.zIndex = '5';
      pin.title = inc.label;
      dom.vcTimelineTrack.appendChild(pin);
    });
  }

  function playVcRecording(clip) {
    if (!dom.vcVideoPlayer) return;
    const url = clip.videoUrl || FleetApi.getLiveHlsUrl(state.vcSelectedVehicleId, state.vcSelectedChannel);
    state.vcCurrentFootageUrl = url;

    // HLS needs hls.js outside Safari; same buffering player as the Video Retrieval window
    state.vcHls = bindVrPlayer(dom.vcVideoPlayer, url, state.vcHls);
    if (!state.vcHls) {
      dom.vcVideoPlayer.src = url;
      dom.vcVideoPlayer.load();
    }
    dom.vcVideoPlayer.play().then(() => {
      if (dom.btnVcPlayPause) dom.btnVcPlayPause.textContent = '⏸️ Pause';
    }).catch(() => { });

    if (dom.vcVideoStatusChip) {
      dom.vcVideoStatusChip.textContent = '● Playing Decoded Video';
      dom.vcVideoStatusChip.className = 'badge-chip online';
    }
    if (dom.vcPlayerTitle && clip.title) {
      dom.vcPlayerTitle.textContent = clip.title;
    }
  }

  // ── SCREEN 4: SAMSARA SAFETY INBOX & INCIDENT DETAIL (Images 2 & 3) ────
  state.safetyActiveTab = 'NEEDS_REVIEW';
  state.activeIncident = null;
  state.activeIncidentIndex = 0;
  state.incDetailMap = null;
  state.vrMiniMap = null;

  async function initSafetyInbox() {
    bindSafetyFilters();
    bindSamsaraInboxEvents();
    await loadSafetyIncidents();
  }

  function bindSamsaraInboxEvents() {
    // Subtabs: Needs Review, All Events, Dismissed, Starred
    const tabBtns = document.querySelectorAll('.samsara-tab-item');
    tabBtns.forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = 'true';
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.safetyActiveTab = btn.dataset.safetyTab || 'ALL';
        renderSamsaraSafetyCards(state.safetyIncidents || []);
      });
    });

    // Star toggle button in header
    const starBtn = document.getElementById('btnToggleSafetyStarred');
    if (starBtn && !starBtn.dataset.bound) {
      starBtn.dataset.bound = 'true';
      starBtn.addEventListener('click', () => {
        starBtn.classList.toggle('active');
        starBtn.textContent = starBtn.classList.contains('active') ? '★' : '☆';
        showToast(starBtn.classList.contains('active') ? 'Showing Starred Safety Events' : 'Starred Filter Off', 'info');
      });
    }

    // Search input
    const searchInput = document.getElementById('safetySearchInput');
    if (searchInput && !searchInput.dataset.bound) {
      searchInput.dataset.bound = 'true';
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = (state.safetyIncidents || []).filter(inc => {
          const type = (inc.eventType || inc.alarm_type || '').toLowerCase();
          const driver = (inc.driverName || '').toLowerCase();
          const plate = (inc.vehiclePlate || '').toLowerCase();
          return type.includes(query) || driver.includes(query) || plate.includes(query);
        });
        renderSamsaraSafetyCards(filtered);
      });
    }

    // Incident Detail Back Button
    const btnBack = document.getElementById('btnBackToSafetyInbox');
    if (btnBack && !btnBack.dataset.bound) {
      btnBack.dataset.bound = 'true';
      btnBack.addEventListener('click', () => {
        closeIncidentDetailView();
      });
    }

    // Incident Detail Pagination Buttons
    const btnPrev = document.getElementById('btnIncPrev');
    const btnNext = document.getElementById('btnIncNext');
    if (btnPrev && !btnPrev.dataset.bound) {
      btnPrev.dataset.bound = 'true';
      btnPrev.addEventListener('click', () => {
        if (!state.safetyIncidents || state.safetyIncidents.length === 0) return;
        state.activeIncidentIndex = (state.activeIncidentIndex - 1 + state.safetyIncidents.length) % state.safetyIncidents.length;
        openIncidentDetailView(state.safetyIncidents[state.activeIncidentIndex].id);
      });
    }
    if (btnNext && !btnNext.dataset.bound) {
      btnNext.dataset.bound = 'true';
      btnNext.addEventListener('click', () => {
        if (!state.safetyIncidents || state.safetyIncidents.length === 0) return;
        state.activeIncidentIndex = (state.activeIncidentIndex + 1) % state.safetyIncidents.length;
        openIncidentDetailView(state.safetyIncidents[state.activeIncidentIndex].id);
      });
    }

    // Incident Coaching Buttons
    const btnCoached = document.getElementById('btnIncMarkCoached');
    const btnRecognized = document.getElementById('btnIncMarkRecognized');
    const btnDismiss = document.getElementById('btnIncDismiss');
    if (btnCoached && !btnCoached.dataset.bound) {
      btnCoached.dataset.bound = 'true';
      btnCoached.addEventListener('click', () => updateIncidentTriage('COACHED'));
    }
    if (btnRecognized && !btnRecognized.dataset.bound) {
      btnRecognized.dataset.bound = 'true';
      btnRecognized.addEventListener('click', () => updateIncidentTriage('RECOGNIZED'));
    }
    if (btnDismiss && !btnDismiss.dataset.bound) {
      btnDismiss.dataset.bound = 'true';
      btnDismiss.addEventListener('click', () => updateIncidentTriage('DISMISSED'));
    }

    bindVideoRetrievalModal();

    // Scrubber drag on modal
    const scrubRail = document.getElementById('vrScrubRail');
    const sliderHandle = document.getElementById('vrBlueSliderHandle');
    if (scrubRail && sliderHandle && !scrubRail.dataset.bound) {
      scrubRail.dataset.bound = 'true';
      scrubRail.addEventListener('click', (e) => {
        const rect = scrubRail.getBoundingClientRect();
        const pct = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
        sliderHandle.style.left = `${pct}%`;
        const timeInput = document.getElementById('vrInputTime');
        if (timeInput) {
          const hour = 11 + Math.floor(pct / 60);
          const min = (46 + Math.floor((pct * 19) / 100)) % 60;
          timeInput.value = `${hour}:${min < 10 ? '0' : ''}${min}:14 AM`;
        }
      });
    }
  }

  function bindSafetyFilters() {
    const filters = [dom.safetyFilterType, dom.safetyFilterStatus];
    filters.forEach(sel => {
      if (sel && !sel.dataset.bound) {
        sel.dataset.bound = 'true';
        sel.addEventListener('change', () => loadSafetyIncidents());
      }
    });
  }

  async function loadSafetyIncidents() {
    try {
      const typeFilter = document.getElementById('safetyFilterType');
      const statusFilter = document.getElementById('safetyFilterStatus');
      const filters = {
        type: typeFilter ? typeFilter.value : 'ALL',
        status: statusFilter ? statusFilter.value : 'ALL'
      };

      const incidents = await FleetApi.getSafetyIncidents(filters);
      state.safetyIncidents = incidents;

      // Update KPI counters
      const total = incidents.length;
      const needsReview = incidents.filter(i => (i.triageStatus || i.status) === 'NEEDS_REVIEW').length;
      const critical = incidents.filter(i => (i.severity || '').toUpperCase() === 'CRITICAL').length;
      const coached = incidents.filter(i => (i.triageStatus || i.status) === 'COACHED').length;

      if (dom.kpiTotalIncidents) dom.kpiTotalIncidents.textContent = total;
      if (dom.kpiNeedsReview) dom.kpiNeedsReview.textContent = needsReview;
      if (dom.kpiCriticalCount) dom.kpiCriticalCount.textContent = critical;
      if (dom.kpiCoachedCount) dom.kpiCoachedCount.textContent = coached;
      if (dom.safetyInboxBadge) dom.safetyInboxBadge.textContent = `${total} Incidents`;

      renderSamsaraSafetyCards(incidents);
    } catch (err) {
      console.warn('[Safety Inbox] Load incidents error:', err);
    }
  }

  // ── SAMSARA SAFETY INBOX LIST (Image 2) ─────────────────────────────────
  window.InurumApp = window.InurumApp || {};
  window.InurumApp.openIncidentDetail = (id) => openIncidentDetailView(id);
  window.InurumApp.dismissSafetyEvent = (id, e) => {
    if (e) e.stopPropagation();
    const inc = (state.safetyIncidents || []).find(i => (i.id || i.incident_id) === id);
    if (inc) {
      inc.triageStatus = 'DISMISSED';
      inc.status = 'DISMISSED';
      showToast('Incident dismissed.', 'info');
      renderSamsaraSafetyCards(state.safetyIncidents);
    }
  };
  window.InurumApp.toggleStarEvent = (id, e) => {
    if (e) e.stopPropagation();
    const inc = (state.safetyIncidents || []).find(i => (i.id || i.incident_id) === id);
    if (inc) {
      inc.starred = !inc.starred;
      renderSamsaraSafetyCards(state.safetyIncidents);
    }
  };
  // Event footage is played straight from the camera's SD card (0x9205/0x9201), starting 10s before the event
  window.InurumApp.fetchClipFromSd = (id, e) => {
    if (e) e.stopPropagation();
    const inc = (state.safetyIncidents || []).find(i => (i.id || i.incident_id) === id);
    if (!inc || !inc.terminalId || !inc.timestamp) {
      showToast('This event has no camera/time to fetch footage for.', 'warning');
      return;
    }
    const from = formatLocalDateTime(new Date(new Date(inc.timestamp).getTime() - 10000));
    openVideoRetrievalModal(inc.terminalId, from.slice(0, 10), from.slice(11));
  };

  function renderSamsaraSafetyCards(incidents) {
    const cardList = document.getElementById('safetyInboxCardList');
    if (!cardList) return;

    // Filter according to active subtab
    let filtered = incidents;
    if (state.safetyActiveTab === 'NEEDS_REVIEW') {
      filtered = incidents.filter(i => (i.triageStatus || i.status || 'NEEDS_REVIEW') === 'NEEDS_REVIEW');
    } else if (state.safetyActiveTab === 'DISMISSED') {
      filtered = incidents.filter(i => (i.triageStatus || i.status) === 'DISMISSED');
    } else if (state.safetyActiveTab === 'STARRED') {
      filtered = incidents.filter(i => i.starred);
    }

    if (!filtered || filtered.length === 0) {
      cardList.innerHTML = `
        <div style="padding:48px 24px;text-align:center;color:var(--text-muted);">
          <div style="font-size:28px;margin-bottom:8px;">🛡️</div>
          <strong style="font-size:14px;color:var(--text-primary);">No safety events found</strong>
          <p style="font-size:12px;margin-top:4px;">No safety events match the selected filter criteria.</p>
        </div>
      `;
      return;
    }

    cardList.innerHTML = filtered.map((inc) => {
      const type = incidentTypeLabel(inc) + (inc.channel ? ` · CH${inc.channel}` : '');
      const title = inc.gForce ? `${type} ${inc.gForce}G` : type;
      const categoryPill = inc.category === 'DEVICE'
        ? '<span class="safety-tag-pill gray">Device health</span>'
        : (inc.category === 'SAFETY' ? '<span class="safety-tag-pill">Safety</span>' : '');

      const sev = (inc.severity || 'CRITICAL').toUpperCase();
      const bulletColor = sev === 'CRITICAL' ? 'red' : (sev === 'MAJOR' ? 'orange' : 'yellow');

      const dateStr = formatEventTime(inc.timestamp);

      const driver = inc.driverName || '—';
      const status = inc.triageStatus || inc.status || 'NEEDS_REVIEW';

      let statusBadgeHtml = '';
      if (status === 'COACHED') {
        statusBadgeHtml = `<button class="safety-status-badge-btn coached">COACHED</button>`;
      } else if (status === 'RECOGNIZED') {
        statusBadgeHtml = `<button class="safety-status-badge-btn recognized">RECOGNIZED</button>`;
      } else {
        statusBadgeHtml = `<button class="safety-status-badge-btn needs-review">NEEDS REVIEW ▾</button>`;
      }

      const isWaiting = status === 'COACHED' || status === 'NEEDS_REVIEW';
      const isSdStored = inc.mediaState === 'STORED_ON_SD' || !inc.mediaUrl;

      return `
        <div class="safety-card-row" onclick="window.InurumApp.openIncidentDetail('${inc.id || inc.incident_id}')">
          <input type="checkbox" class="safety-card-cb" onclick="event.stopPropagation()">

          <div class="safety-card-thumb-wrap">
            <div class="safety-card-thumb-placeholder">📹 ${inc.vehiclePlate || inc.terminalId || 'DASHCAM'}</div>
          </div>

          <div class="safety-card-meta-col">
            <div class="safety-card-title-row">
              <span class="safety-bullet ${bulletColor}">●</span>
              <span class="safety-card-event-title">${title}</span>
            </div>
            <div class="safety-card-timestamp">${dateStr}</div>
            <div class="safety-card-driver">${driver}</div>
            <div class="safety-card-tags-row">
              ${categoryPill}
              ${isSdStored
          ? '<span class="safety-tag-pill" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;">💾 On SD Card (0 MB Cloud)</span>'
          : '<span class="safety-tag-pill" style="background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd;">Cloud Synced</span>'}
            </div>
          </div>

          <div class="safety-card-actions-col" onclick="event.stopPropagation()">
            ${isWaiting ? '<span class="safety-waiting-note">↗ Waiting Driver Review</span>' : ''}
            ${isSdStored ? `<button class="btn-ctrl btn-ctrl-outline" style="height:26px;font-size:10px;padding:0 8px;border-color:#0284c7;color:#0284c7;" onclick="window.InurumApp.fetchClipFromSd('${inc.id || inc.incident_id}', event)">▶ Play from SD card</button>` : ''}
            <button class="safety-dismiss-link" onclick="window.InurumApp.dismissSafetyEvent('${inc.id || inc.incident_id}', event)">Dismiss</button>
            ${statusBadgeHtml}
            <button class="safety-row-star-btn ${inc.starred ? 'active' : ''}" onclick="window.InurumApp.toggleStarEvent('${inc.id || inc.incident_id}', event)">${inc.starred ? '★' : '☆'}</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ── SAMSARA INCIDENT DETAIL / COACHING VIEW (Image 3) ───────────────────
  // Event time in the operator's own timezone (the camera records local time too)
  function formatEventTime(ts, withDate = true) {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d)) return '—';
    const opts = { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true, timeZoneName: 'short' };
    if (withDate) Object.assign(opts, { day: 'numeric', month: 'short', year: 'numeric' });
    return d.toLocaleString('en-IN', opts);
  }

  function incidentTypeLabel(inc) {
    return (inc.eventType || inc.type || inc.alarm_type || 'UNKNOWN EVENT').replace(/_/g, ' ');
  }

  function openIncidentDetailView(incidentId) {
    const inc = (state.safetyIncidents || []).find(i => (i.id || i.incident_id) === incidentId);
    if (!inc) {
      showToast('Incident not found.', 'warning');
      navigateTo('safety');
      return;
    }
    // Back / prev / next must work even when this view is opened from the dashboard, not the inbox
    bindSamsaraInboxEvents();
    state.activeIncident = inc;
    state.activeIncidentIndex = Math.max(0, (state.safetyIncidents || []).findIndex(i => (i.id || i.incident_id) === incidentId));

    dom.viewContainers.forEach(c => {
      c.style.display = '';
      c.classList.toggle('active', c.id === 'viewIncidentDetail');
    });

    if (dom.breadcrumbTitle) {
      dom.breadcrumbTitle.textContent = 'Safety Incident Review';
    }

    const vehicle = (state.vehicles || []).find(v => v.terminalId === inc.terminalId || v.assignedDeviceId === inc.terminalId);
    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

    setText('incDetailDateText', formatEventTime(inc.timestamp));
    setText('incPaginationText', `Inbox ${state.activeIncidentIndex + 1} of ${(state.safetyIncidents || []).length}`);
    setText('incDetailEventTypeName', incidentTypeLabel(inc));
    setText('incDetailDriverName', inc.driverName || (vehicle && vehicle.driverName) || '—');
    setText('incDetailVehicleVal', inc.vehiclePlate || (vehicle && vehicle.plateNumber) || inc.terminalId || '—');
    const hasGps = inc.lat && inc.lng;
    setText('incDetailAddress', inc.address || (hasGps ? `${Number(inc.lat).toFixed(5)}, ${Number(inc.lng).toFixed(5)}` : 'No GPS fix at event time'));
    setText('incDetailDescription', inc.description || '—');
    setText('incHudTimestamp', formatEventTime(inc.timestamp, false));
    setText('incHudSpeedVal', inc.speed != null ? String(Math.round(inc.speed)) : '—');
    setText('incSpeedInfo', inc.speed != null ? `Speed at event: ${Math.round(inc.speed)} km/h` : 'Speed at event: not reported');

    // Footage stays on the SD card until the operator asks for it (no live stream, no placeholder video)
    const prompt = document.getElementById('incSdPrompt');
    if (prompt) prompt.style.display = 'flex';
    const btnSd = document.getElementById('btnIncPlayFromSd');
    if (btnSd) {
      btnSd.disabled = !inc.terminalId || !inc.timestamp;
      btnSd.onclick = () => {
        // 10s before the event; the modal's Retrieve Video asks the SD card for that window
        const from = new Date(new Date(inc.timestamp).getTime() - 10000);
        openVideoRetrievalModal(inc.terminalId, formatLocalDateTime(from).slice(0, 10), formatLocalDateTime(from).slice(11));
      };
    }

    setTimeout(() => {
      initIncidentDetailMap(inc);
    }, 150);
  }

  function closeIncidentDetailView() {
    const incDetailView = document.getElementById('viewIncidentDetail');
    if (incDetailView) incDetailView.classList.remove('active');

    if (state.incHlsRoad) {
      state.incHlsRoad.destroy();
      state.incHlsRoad = null;
    }
    if (state.incHlsCabin) {
      state.incHlsCabin.destroy();
      state.incHlsCabin = null;
    }

    const roadVid = document.getElementById('incVideoRoad');
    const cabinVid = document.getElementById('incVideoCabin');
    if (roadVid) { roadVid.pause(); roadVid.removeAttribute('src'); roadVid.load(); }
    if (cabinVid) { cabinVid.pause(); cabinVid.removeAttribute('src'); cabinVid.load(); }

    navigateTo('safety');
  }

  function initIncidentDetailMap(inc) {
    const container = document.getElementById('incDetailMapContainer');
    if (!container) return;

    if (state.incDetailMap) {
      state.incDetailMap.remove();
      state.incDetailMap = null;
    }
    container.innerHTML = '';

    // Only the event's real GPS position; no placeholder city or invented route
    if (!(inc.lat && inc.lng)) {
      container.innerHTML = `<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#64748b;font-size:12px;text-align:center;"><div style="font-size:20px;">📡</div><b>No GPS fix</b>The camera had no satellite lock at this time.</div>`;
      return;
    }
    const lat = Number(inc.lat);
    const lng = Number(inc.lng);

    state.incDetailMap = L.map('incDetailMapContainer', {
      zoomControl: true,
      attributionControl: false
    }).setView([lat, lng], 15);

    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: 'Map data &copy; Google'
    }).addTo(state.incDetailMap);

    setTimeout(() => {
      if (state.incDetailMap) state.incDetailMap.invalidateSize();
    }, 200);

    const icon = L.divIcon({
      className: 'samsara-map-marker',
      html: `<div style="width:18px;height:18px;background:#ef4444;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
    L.marker([lat, lng], { icon }).addTo(state.incDetailMap).bindTooltip('Event location');
  }

  async function updateIncidentTriage(newStatus) {
    if (!state.activeIncident) return;
    const incId = state.activeIncident.id || state.activeIncident.incident_id;
    const notesInput = document.getElementById('incCoachingNotesText');
    const notes = notesInput ? notesInput.value.trim() : '';

    try {
      showToast(`Updating incident status to ${newStatus}...`, 'info');
      state.activeIncident.triageStatus = newStatus;
      state.activeIncident.status = newStatus;
      state.activeIncident.coachingNotes = notes;

      const statusSelect = document.getElementById('incDetailStatusSelect');
      if (statusSelect) statusSelect.value = newStatus;

      showToast(`Incident #${incId} marked as ${newStatus}!`, 'success');
      await loadSafetyIncidents();
    } catch (err) {
      console.error('[Incident Detail] Triage error:', err);
      showToast('Error saving incident status.', 'error');
    }
  }

  // ── SAMSARA VIDEO RETRIEVAL MODAL (Image 1) ─────────────────────────────
  // Bound when the modal opens: it is opened from Video Center too, not only from the Safety Inbox
  function bindVideoRetrievalModal() {
    const btnCloseVr = document.getElementById('btnCloseVideoRetrieval');
    if (btnCloseVr && !btnCloseVr.dataset.bound) {
      btnCloseVr.dataset.bound = 'true';
      btnCloseVr.addEventListener('click', closeVideoRetrievalModal);
    }

    const modalVr = document.getElementById('modalVideoRetrieval');
    if (modalVr && !modalVr.dataset.bound) {
      modalVr.dataset.bound = 'true';
      modalVr.addEventListener('click', (e) => {
        if (e.target === modalVr) closeVideoRetrievalModal();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalVr.style.display !== 'none') closeVideoRetrievalModal();
      });
    }

    const btnSubmitRetrieve = document.getElementById('btnVrSubmitRetrieve');
    if (btnSubmitRetrieve && !btnSubmitRetrieve.dataset.bound) {
      btnSubmitRetrieve.dataset.bound = 'true';
      btnSubmitRetrieve.addEventListener('click', startVrSdPlayback);
    }
  }

  // Local wall-clock "YYYY-MM-DD HH:mm:ss" (the camera records in its local time, same as the operator's)
  function formatLocalDateTime(d) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  function setVrStatus(text) {
    const el = document.getElementById('vrOsdTimeText');
    if (el) el.textContent = text;
  }

  function bufferedAhead(videoEl) {
    const t = videoEl.currentTime;
    for (let i = 0; i < videoEl.buffered.length; i++) {
      if (videoEl.buffered.start(i) <= t + 0.3 && videoEl.buffered.end(i) > t) return videoEl.buffered.end(i) - t;
    }
    return 0;
  }

  // SD playback arrives at ~0.75x real time, so play only with a cushion of buffer and
  // re-buffer (instead of stuttering) when it runs low. Once the camera stops sending, play out the rest.
  function bindVrPlayer(videoEl, url, existing) {
    if (existing) { try { existing.destroy(); } catch (_) { } }
    if (!videoEl || typeof Hls === 'undefined' || !Hls.isSupported()) return null;
    const MIN_AHEAD_SEC = 8;
    videoEl.muted = true;
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      startPosition: 0,                 // from the start of the requested clip, not the live edge
      liveSyncDurationCount: 1,
      liveMaxLatencyDurationCount: 1000, // never skip ahead
      maxBufferLength: 60,
      fragLoadingTimeOut: 20000,
      // The camera needs a few seconds to find the file and start sending
      manifestLoadingMaxRetry: 20,
      manifestLoadingRetryDelay: 1500
    });
    let lastFragAt = Date.now();
    // Camera timestamp jumps leave holes between buffered ranges; skip to the next range instead of stalling
    const jumpGap = () => {
      const t = videoEl.currentTime;
      for (let i = 0; i < videoEl.buffered.length; i++) {
        if (videoEl.buffered.start(i) > t + 0.1) {
          videoEl.currentTime = videoEl.buffered.start(i) + 0.05;
          return true;
        }
      }
      return false;
    };
    const maybePlay = () => {
      if (bufferedAhead(videoEl) < 1 && jumpGap()) { /* moved past a hole */ }
      if (!videoEl.paused) return;
      const ahead = bufferedAhead(videoEl);
      const streamEnded = Date.now() - lastFragAt > 6000;
      if (ahead >= MIN_AHEAD_SEC || (streamEnded && ahead > 0.5)) videoEl.play().catch(() => { });
    };
    hls.on(Hls.Events.FRAG_BUFFERED, () => { lastFragAt = Date.now(); maybePlay(); });
    // The playlist is 404 until the camera has found the file and sent the first segment, and hls.js
    // does not retry 4xx on its own
    let reloads = 0;
    hls.on(Hls.Events.ERROR, (event, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) { hls.recoverMediaError(); return; }
      if (reloads++ < 30) setTimeout(() => { try { hls.loadSource(url); } catch (_) { } }, 1500);
    });
    videoEl.onwaiting = () => { if (bufferedAhead(videoEl) < 1 && !jumpGap()) videoEl.pause(); };
    const timer = setInterval(maybePlay, 1000);
    const destroy = hls.destroy.bind(hls);
    hls.destroy = () => { clearInterval(timer); videoEl.onwaiting = null; destroy(); };
    hls.loadSource(url);
    hls.attachMedia(videoEl);
    return hls;
  }

  async function startVrSdPlayback() {
    const termId = state.vrTerminalId;
    const timeVal = (document.getElementById('vrInputTime') || {}).value;
    const durationSec = parseInt((document.getElementById('vrSelectDuration') || {}).value || '60', 10);
    if (!termId || !timeVal) {
      showToast('Select a time first.', 'warning');
      return;
    }
    const startDate = new Date(`${state.vrDate}T${timeVal.length === 5 ? timeVal + ':00' : timeVal}`);
    if (isNaN(startDate)) {
      showToast('Invalid date/time.', 'warning');
      return;
    }
    const start = formatLocalDateTime(startDate);
    const end = formatLocalDateTime(new Date(startDate.getTime() + durationSec * 1000));

    try {
      setVrStatus('Requesting SD card playback...');
      const res = await FleetApi.startSdPlayback(termId, start, end, 'all');
      state.vrPlaybackActive = true;
      showToast(`SD card playback requested: ${start} → ${end.slice(11)}`, 'info');
      setVrStatus(`SD ▶ ${start.slice(11)} – ${end.slice(11)} (buffering…)`);
      const urls = Object.fromEntries((res.streams || []).map(s => [s.channel, s.url]));
      state.vrHlsRoad = bindVrPlayer(document.getElementById('vrVideoRoad'), urls[1] || FleetApi.getLiveHlsUrl(termId, 1), state.vrHlsRoad);
      state.vrHlsCabin = bindVrPlayer(document.getElementById('vrVideoCabin'), urls[2] || FleetApi.getLiveHlsUrl(termId, 2), state.vrHlsCabin);
    } catch (err) {
      setVrStatus('Playback failed');
      showToast(`SD playback failed: ${err.message}`, 'error');
    }
  }

  function openVideoRetrievalModal(vehicleId, date, time) {
    bindVideoRetrievalModal();
    const vehicles = state.vehicles || [];
    // Requested vehicle; otherwise prefer one whose camera is online (SD access needs a connected camera)
    const v = vehicles.find(veh => veh.id === vehicleId || veh.terminalId === vehicleId)
      || (vehicleId && /^\d{6,}$/.test(String(vehicleId)) ? { terminalId: String(vehicleId), plateNumber: String(vehicleId) } : null)
      || vehicles.find(veh => veh.status !== 'OFFLINE')
      || vehicles[0];
    if (!v || !v.terminalId) {
      showToast('No dashcam available.', 'warning');
      return;
    }

    const modal = document.getElementById('modalVideoRetrieval');
    if (!modal) return;

    modal.style.display = 'flex';

    const plateLbl = document.getElementById('vrVehiclePlateLabel');
    if (plateLbl) plateLbl.textContent = v.plateNumber || v.label || v.terminalId;

    const driverLbl = document.getElementById('vrDriverName');
    if (driverLbl) driverLbl.textContent = v.driverName || '—';

    // SD playback starts only when the operator presses "Retrieve Video" (it uses the camera's SIM data)
    state.vrTerminalId = v.terminalId;
    const today = formatLocalDateTime(new Date()).slice(0, 10);
    const pickedDate = date || (dom.vcDatePicker && dom.vcDatePicker.value);
    state.vrDate = /^\d{4}-\d{2}-\d{2}$/.test(pickedDate || '') ? pickedDate : today;
    const isToday = state.vrDate === today;

    const dateBadge = document.getElementById('vrDateBadgeText');
    if (dateBadge) {
      dateBadge.textContent = new Date(`${state.vrDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    const timeInput = document.getElementById('vrInputTime');
    if (timeInput) timeInput.value = time || (isToday ? formatLocalDateTime(new Date(Date.now() - 10 * 60000)).slice(11) : '12:00:00');
    const speedBadge = document.querySelector('#modalVideoRetrieval .vr-osd-speed-badge');
    if (speedBadge) speedBadge.style.display = 'none';
    // The A/B route rows were static placeholders; there is no trip data behind them
    document.querySelectorAll('#modalVideoRetrieval .vr-point-row').forEach(el => { el.style.display = 'none'; });
    const footageLbl = document.querySelector('#modalVideoRetrieval .vr-earliest-lbl');
    const footageVal = document.getElementById('vrEarliestFootageDate');
    if (footageLbl) footageLbl.textContent = 'SD FOOTAGE (LAST 2H)';
    if (footageVal) footageVal.textContent = '…';
    setVrStatus('Pick a time, then Retrieve Video');

    // Default to the most recent footage actually on the SD card (last 2 hours). For a past date the
    // operator picks the time; Retrieve Video checks the SD card and says if nothing was recorded then.
    if (!isToday && footageLbl) footageLbl.textContent = 'SD FOOTAGE';
    if (!isToday && footageVal) footageVal.textContent = state.vrDate;
    if (!time && isToday) {
      const now = new Date();
      setVrStatus('Checking SD card…');
      FleetApi.listSdFiles(state.vrTerminalId, formatLocalDateTime(new Date(now - 2 * 3600000)), formatLocalDateTime(now))
        .then(r => {
          const files = (r && r.files) || [];
          if (!files.length) {
            if (footageVal) footageVal.textContent = 'none';
            setVrStatus('No SD recording in the last 2 hours');
            return;
          }
          const last = files.reduce((a, b) => (b.end > a.end ? b : a));
          const first = files.reduce((a, b) => (b.start < a.start ? b : a));
          if (footageVal) footageVal.textContent = `${first.start.slice(11, 16)} – ${last.end.slice(11, 16)}`;
          const lastEnd = new Date(last.end.replace(' ', 'T'));
          const from = new Date(Math.max(lastEnd - 60000, new Date(last.start.replace(' ', 'T'))));
          state.vrDate = last.end.slice(0, 10);
          if (timeInput) timeInput.value = formatLocalDateTime(from).slice(11);
          setVrStatus(`SD footage until ${last.end.slice(11)} — Retrieve Video`);
        })
        .catch(err => {
          if (footageVal) footageVal.textContent = '—';
          setVrStatus(`SD card check failed: ${err.message}`);
        });
    }

    // Mini Leaflet Map for route
    setTimeout(() => {
      initVideoRetrievalMap(v);
    }, 150);
  }

  function closeVideoRetrievalModal() {
    const modal = document.getElementById('modalVideoRetrieval');
    if (modal) modal.style.display = 'none';

    if (state.vrPlaybackActive && state.vrTerminalId) {
      FleetApi.stopSdPlayback(state.vrTerminalId).catch(() => { });
      state.vrPlaybackActive = false;
    }

    if (state.vrHlsRoad) {
      state.vrHlsRoad.destroy();
      state.vrHlsRoad = null;
    }
    if (state.vrHlsCabin) {
      state.vrHlsCabin.destroy();
      state.vrHlsCabin = null;
    }

    const roadVid = document.getElementById('vrVideoRoad');
    const cabinVid = document.getElementById('vrVideoCabin');
    if (roadVid) { roadVid.pause(); roadVid.removeAttribute('src'); roadVid.load(); }
    if (cabinVid) { cabinVid.pause(); cabinVid.removeAttribute('src'); cabinVid.load(); }
  }

  function initVideoRetrievalMap(v) {
    const container = document.getElementById('vrMiniMapContainer');
    if (!container) return;

    if (state.vrMiniMap) {
      state.vrMiniMap.remove();
      state.vrMiniMap = null;
    }
    container.innerHTML = '';

    // Only the vehicle's real last GPS fix; never a placeholder location or invented route
    const hasGps = v && v.lat && v.lng && v.lat !== 0 && v.lng !== 0;
    if (!hasGps) {
      container.innerHTML = `<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:12px;color:#64748b;font-size:12px;line-height:1.5;">
        <div style="font-size:22px;">📡</div><b>No GPS fix</b>Camera has no satellite lock (indoors or no GPS antenna).<br>Location will show once GPS locks.</div>`;
      return;
    }
    const lat = v.lat;
    const lng = v.lng;

    state.vrMiniMap = L.map('vrMiniMapContainer', {
      zoomControl: true,
      attributionControl: false
    }).setView([lat, lng], 15);

    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: 'Map data &copy; Google'
    }).addTo(state.vrMiniMap);

    setTimeout(() => {
      if (state.vrMiniMap) state.vrMiniMap.invalidateSize();
    }, 200);

    const icon = L.divIcon({
      className: 'samsara-map-marker',
      html: `<div style="width:18px;height:18px;background:#2563eb;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
    L.marker([lat, lng], { icon }).addTo(state.vrMiniMap)
      .bindTooltip(`Last GPS fix${v.address ? ': ' + v.address : ''}`);
  }


  // ── Synchronized Dual-Camera Incident Review Modal ─────────────────────
  async function openIncidentReviewModal(incidentId) {
    let inc = state.safetyIncidents.find(i => (i.id || i.incident_id) === incidentId);
    if (!inc) {
      try {
        const res = await FleetApi.getSafetyIncident(incidentId);
        inc = res.incident || res;
      } catch (_) {
        showToast('Incident not found.', 'warning');
        return;
      }
    }
    state.safetyActiveIncident = inc;

    // Populate Modal Header & Context
    if (dom.modalIncidentSeverityBadge) {
      dom.modalIncidentSeverityBadge.textContent = (inc.severity || 'CRITICAL').toUpperCase();
      dom.modalIncidentSeverityBadge.className = `badge-chip ${(inc.severity || 'CRITICAL').toLowerCase()}`;
    }
    if (dom.modalIncidentTitle) dom.modalIncidentTitle.textContent = `${incidentTypeLabel(inc)} REVIEW`;
    if (dom.modalIncidentSubtitle) {
      const timeStr = inc.timestamp ? new Date(inc.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '';
      dom.modalIncidentSubtitle.textContent = `ID: ${inc.id || inc.incident_id} • ${timeStr}`;
    }
    const hasGps = inc.lat && inc.lng;
    if (dom.modalPlateText) dom.modalPlateText.textContent = inc.vehiclePlate || inc.terminalId || '—';
    if (dom.modalDriverText) dom.modalDriverText.textContent = inc.driverName || '—';
    if (dom.modalImpactSpeedText) dom.modalImpactSpeedText.textContent = inc.speed != null ? `${inc.speed} km/h` : '—';
    if (dom.modalCoordsText) dom.modalCoordsText.textContent = hasGps ? `${Number(inc.lat).toFixed(4)}°N, ${Number(inc.lng).toFixed(4)}°E` : 'No GPS fix';
    if (dom.modalLocationText) dom.modalLocationText.textContent = inc.address || (hasGps ? '—' : 'No GPS fix');

    // Populate Coaching Category & Notes
    if (dom.modalCoachingCategory && inc.coachingCategory) dom.modalCoachingCategory.value = inc.coachingCategory;
    if (dom.modalCoachingNotes) dom.modalCoachingNotes.value = inc.coachingNotes || inc.notes || '';

    // Render Speed Curve Sparkline (5 telematics points centered on impact)
    renderSpeedSparkline(inc.speed || 0);

    // Event footage is only on the SD card ("Fetch clip from SD" plays it); show the clip players only for a stored clip
    if (inc.roadVideoUrl) state.modalHlsRoad = bindHlsStream(dom.modalVideoRoad, inc.roadVideoUrl, state.modalHlsRoad);
    if (inc.cabinVideoUrl) state.modalHlsCabin = bindHlsStream(dom.modalVideoCabin, inc.cabinVideoUrl, state.modalHlsCabin);

    if (dom.incidentReviewModal) dom.incidentReviewModal.style.display = 'flex';
  }

  function closeIncidentReviewModal() {
    if (dom.incidentReviewModal) dom.incidentReviewModal.style.display = 'none';

    if (state.modalHlsRoad) {
      state.modalHlsRoad.destroy();
      state.modalHlsRoad = null;
    }
    if (state.modalHlsCabin) {
      state.modalHlsCabin.destroy();
      state.modalHlsCabin = null;
    }

    if (dom.modalVideoRoad) {
      dom.modalVideoRoad.pause();
      dom.modalVideoRoad.removeAttribute('src');
      dom.modalVideoRoad.load();
    }
    if (dom.modalVideoCabin) {
      dom.modalVideoCabin.pause();
      dom.modalVideoCabin.removeAttribute('src');
      dom.modalVideoCabin.load();
    }
    state.modalSyncPlaying = false;
    if (dom.btnModalSyncPlay) dom.btnModalSyncPlay.textContent = '⏯️ Play Both Synchronized';
  }

  function toggleModalSyncPlay() {
    if (!dom.modalVideoRoad || !dom.modalVideoCabin) return;
    if (state.modalSyncPlaying) {
      dom.modalVideoRoad.pause();
      dom.modalVideoCabin.pause();
      state.modalSyncPlaying = false;
      if (dom.btnModalSyncPlay) dom.btnModalSyncPlay.textContent = '⏯️ Play Both Synchronized';
    } else {
      // Sync timestamps
      dom.modalVideoCabin.currentTime = dom.modalVideoRoad.currentTime;
      Promise.all([
        dom.modalVideoRoad.play().catch(() => { }),
        dom.modalVideoCabin.play().catch(() => { })
      ]).then(() => {
        state.modalSyncPlaying = true;
        if (dom.btnModalSyncPlay) dom.btnModalSyncPlay.textContent = '⏸️ Pause Both';
      });
    }
  }

  function renderSpeedSparkline(impactSpeed) {
    if (!dom.modalSpeedSparkline) return;
    const v = Number(impactSpeed) || 55;
    const points = [
      { time: 'T-10s', speed: Math.min(100, Math.round(v * 1.15)) },
      { time: 'T-5s', speed: Math.min(100, Math.round(v * 1.08)) },
      { time: 'Impact (0s)', speed: v, isImpact: true },
      { time: 'T+5s', speed: Math.round(v * 0.4) },
      { time: 'T+10s', speed: 0 }
    ];

    dom.modalSpeedSparkline.innerHTML = points.map(p => {
      const height = Math.max(8, Math.min(48, Math.round((p.speed / 100) * 48)));
      const color = p.isImpact ? '#dc2626' : (p.speed > 50 ? '#d97706' : '#2563eb');
      return `
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;">
          <span style="font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;color:${color};">${p.speed}k</span>
          <div style="width:100%;height:48px;display:flex;align-items:flex-end;justify-content:center;background:#f1f5f9;border-radius:3px;">
            <div style="width:70%;height:${height}px;background:${color};border-radius:2px;"></div>
          </div>
          <span style="font-size:9px;color:var(--text-muted);white-space:nowrap;">${p.time}</span>
        </div>
      `;
    }).join('');
  }

  async function submitIncidentReview(triageStatus) {
    if (!state.safetyActiveIncident) return;
    const incidentId = state.safetyActiveIncident.id || state.safetyActiveIncident.incident_id;
    const category = dom.modalCoachingCategory ? dom.modalCoachingCategory.value : 'GENERAL_SAFETY';
    const notes = dom.modalCoachingNotes ? dom.modalCoachingNotes.value.trim() : '';

    try {
      showToast(`Saving coaching review for incident #${incidentId}...`, 'info');
      await FleetApi.reviewSafetyIncident(incidentId, {
        triageStatus,
        coachingCategory: category,
        notes,
        coachedBy: 'Fleet Operations Manager'
      });

      showToast(`Incident ${triageStatus === 'COACHED' ? 'Reviewed & Coached' : 'Dismissed'} successfully!`, 'success');
      closeIncidentReviewModal();
      await loadSafetyIncidents();
    } catch (err) {
      console.error('[Safety Inbox] Review submit failed:', err);
      showToast(`Failed to save review: ${err.message || 'Server error'}`, 'error');
    }
  }

  // ==========================================================================
  // STAGE 2: VEHICLE DIRECTORY & STAGE 3: DEVICE HEALTH CENTER
  // ==========================================================================
  function initVehiclesAndDevices() {
    bindVdEvents();
    renderVehiclesDirectory();
    loadDeviceHealthData();
  }

  function bindVdEvents() {
    // Subtab Switching
    if (dom.btnSubtabVehicles && !dom.btnSubtabVehicles.dataset.bound) {
      dom.btnSubtabVehicles.dataset.bound = 'true';
      dom.btnSubtabVehicles.addEventListener('click', () => {
        state.vdSubtab = 'directory';
        dom.btnSubtabVehicles.classList.add('active');
        if (dom.btnSubtabDevices) dom.btnSubtabDevices.classList.remove('active');
        if (dom.vdSectionDirectory) dom.vdSectionDirectory.style.display = 'block';
        if (dom.vdSectionHealth) dom.vdSectionHealth.style.display = 'none';
        renderVehiclesDirectory();
      });
    }

    if (dom.btnSubtabDevices && !dom.btnSubtabDevices.dataset.bound) {
      dom.btnSubtabDevices.dataset.bound = 'true';
      dom.btnSubtabDevices.addEventListener('click', () => {
        state.vdSubtab = 'health';
        dom.btnSubtabDevices.classList.add('active');
        if (dom.btnSubtabVehicles) dom.btnSubtabVehicles.classList.remove('active');
        if (dom.vdSectionDirectory) dom.vdSectionDirectory.style.display = 'none';
        if (dom.vdSectionHealth) dom.vdSectionHealth.style.display = 'block';
        loadDeviceHealthData();
      });
    }

    // Filter Chips
    if (dom.vdFilterChips) {
      dom.vdFilterChips.forEach(chip => {
        if (!chip.dataset.bound) {
          chip.dataset.bound = 'true';
          chip.addEventListener('click', () => {
            dom.vdFilterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.vdFilter = chip.dataset.filter;
            renderVehiclesDirectory();
          });
        }
      });
    }

    // Search Input
    if (dom.vdSearchInput && !dom.vdSearchInput.dataset.bound) {
      dom.vdSearchInput.dataset.bound = 'true';
      dom.vdSearchInput.addEventListener('input', (e) => {
        state.vdSearch = e.target.value.toLowerCase().trim();
        renderVehiclesDirectory();
      });
    }

    // Refresh Button
    if (dom.btnRefreshVehiclesAndDevices && !dom.btnRefreshVehiclesAndDevices.dataset.bound) {
      dom.btnRefreshVehiclesAndDevices.dataset.bound = 'true';
      dom.btnRefreshVehiclesAndDevices.addEventListener('click', async () => {
        showToast('Refreshing telematics and hardware diagnostics...', 'info');
        await loadFleetData();
        renderVehiclesDirectory();
        if (state.vdSubtab === 'health') await loadDeviceHealthData();
        showToast('Fleet telematics and device health refreshed.', 'success');
      });
    }

    // Add Vehicle Button
    if (dom.btnAddVehicleBtn && !dom.btnAddVehicleBtn.dataset.bound) {
      dom.btnAddVehicleBtn.dataset.bound = 'true';
      dom.btnAddVehicleBtn.addEventListener('click', () => {
        openVehicleEditModal(null);
      });
    }

    // Vehicle Form Submit
    if (dom.formVehicleEdit && !dom.formVehicleEdit.dataset.bound) {
      dom.formVehicleEdit.dataset.bound = 'true';
      dom.formVehicleEdit.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleSaveVehicle();
      });
    }

    // Modal Close buttons
    const btnCloseModal = document.getElementById('btnCloseVehicleModal');
    if (btnCloseModal && !btnCloseModal.dataset.bound) {
      btnCloseModal.dataset.bound = 'true';
      btnCloseModal.addEventListener('click', () => closeVehicleEditModal());
    }
    const btnCancelModal = document.getElementById('btnCancelVehicleEdit');
    if (btnCancelModal && !btnCancelModal.dataset.bound) {
      btnCancelModal.dataset.bound = 'true';
      btnCancelModal.addEventListener('click', () => closeVehicleEditModal());
    }

    // Drawer Close button
    const btnCloseDrawer = document.getElementById('btnCloseProfileDrawer');
    if (btnCloseDrawer && !btnCloseDrawer.dataset.bound) {
      btnCloseDrawer.dataset.bound = 'true';
      btnCloseDrawer.addEventListener('click', () => closeVehicleProfileDrawer());
    }

    // Pair Modal Close buttons
    const btnClosePair = document.getElementById('btnClosePairModal');
    if (btnClosePair && !btnClosePair.dataset.bound) {
      btnClosePair.dataset.bound = 'true';
      btnClosePair.addEventListener('click', () => closePairDeviceModal());
    }
    const btnCancelPair = document.getElementById('btnCancelPair');
    if (btnCancelPair && !btnCancelPair.dataset.bound) {
      btnCancelPair.dataset.bound = 'true';
      btnCancelPair.addEventListener('click', () => closePairDeviceModal());
    }

    // Confirm Pair Button
    const btnConfirmPair = document.getElementById('btnConfirmPair');
    if (btnConfirmPair && !btnConfirmPair.dataset.bound) {
      btnConfirmPair.dataset.bound = 'true';
      btnConfirmPair.addEventListener('click', async () => {
        await handleConfirmPair();
      });
    }
  }

  function renderVehiclesDirectory() {
    if (!dom.vdVehiclesTableBody) return;

    let list = state.vehicles || [];

    // Filter counts update
    const onlineCount = list.filter(v => v.status === 'ONLINE' || (v.speed && v.speed > 0)).length;
    const idleCount = list.filter(v => v.status === 'IDLE' || (v.ignition && (!v.speed || v.speed === 0))).length;
    const offlineCount = list.filter(v => v.status === 'OFFLINE').length;
    const deactivatedCount = list.filter(v => v.status === 'DEACTIVATED').length;

    const elBadge = document.getElementById('vdVehicleCountBadge');
    if (elBadge) elBadge.textContent = list.length;
    const chipAll = document.getElementById('vdChipAll');
    if (chipAll) chipAll.textContent = list.length;
    const chipOnline = document.getElementById('vdChipOnline');
    if (chipOnline) chipOnline.textContent = onlineCount;
    const chipIdle = document.getElementById('vdChipIdle');
    if (chipIdle) chipIdle.textContent = idleCount;
    const chipOffline = document.getElementById('vdChipOffline');
    if (chipOffline) chipOffline.textContent = offlineCount;
    const chipDeactivated = document.getElementById('vdChipDeactivated');
    if (chipDeactivated) chipDeactivated.textContent = deactivatedCount;

    // Apply filter
    if (state.vdFilter === 'ONLINE') {
      list = list.filter(v => v.status === 'ONLINE' || (v.speed && v.speed > 0));
    } else if (state.vdFilter === 'IDLE') {
      list = list.filter(v => v.status === 'IDLE' || (v.ignition && (!v.speed || v.speed === 0)));
    } else if (state.vdFilter === 'OFFLINE') {
      list = list.filter(v => v.status === 'OFFLINE');
    } else if (state.vdFilter === 'DEACTIVATED') {
      list = list.filter(v => v.status === 'DEACTIVATED');
    }

    // Apply search
    if (state.vdSearch) {
      const q = state.vdSearch;
      list = list.filter(v =>
        (v.plateNumber && v.plateNumber.toLowerCase().includes(q)) ||
        (v.label && v.label.toLowerCase().includes(q)) ||
        (v.driverName && v.driverName.toLowerCase().includes(q)) ||
        (v.assignedDeviceId && v.assignedDeviceId.toLowerCase().includes(q)) ||
        (v.terminalId && v.terminalId.toLowerCase().includes(q)) ||
        (v.model && v.model.toLowerCase().includes(q))
      );
    }

    if (list.length === 0) {
      dom.vdVehiclesTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted);">
            No vehicles found matching the selected filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    dom.vdVehiclesTableBody.innerHTML = list.map(v => {
      const isOnline = v.status === 'ONLINE' || (v.speed && v.speed > 0);
      const isIdle = v.status === 'IDLE' || (v.ignition && (!v.speed || v.speed === 0));
      const isDeactivated = v.status === 'DEACTIVATED';
      const statusPill = isDeactivated
        ? `<span class="kpi-status-pill offline" style="background:#f1f5f9;color:#64748b;">DEACTIVATED</span>`
        : isOnline
          ? `<span class="kpi-status-pill online">● DRIVING (${v.speed || 0} km/h)</span>`
          : isIdle
            ? `<span class="kpi-status-pill warning">○ IDLE</span>`
            : `<span class="kpi-status-pill offline">○ OFFLINE</span>`;

      const driverInitials = v.driverName ? v.driverName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'DR';
      const pairedTerminal = v.assignedDeviceId || v.terminalId;

      return `
        <tr>
          <!-- HSRP Plate Badge -->
          <td>
            <div class="hsrp-plate-badge">
              <span class="hsrp-ind">IND</span>
              <span class="hsrp-number">${v.plateNumber || 'UNREGISTERED'}</span>
            </div>
          </td>

          <!-- Vehicle Label & Specs -->
          <td>
            <div style="font-weight:700;color:var(--text-primary);font-size:12px;">${v.label || 'Unnamed Vehicle'}</div>
            <div style="font-size:11px;color:var(--text-muted);">${v.model || 'Commercial Fleet'} • ${v.year || '2024'}</div>
          </td>

          <!-- Assigned Driver -->
          <td>
            <div style="display:flex;align-items:center;gap:8px;">
              <div class="table-avatar" style="width:26px;height:26px;font-size:10px;">${driverInitials}</div>
              <div>
                <div style="font-weight:600;font-size:12px;">${v.driverName || 'Unassigned'}</div>
                <div style="font-size:10px;color:var(--text-muted);">${v.driverPhone || v.driverLicense || 'No Contact'}</div>
              </div>
            </div>
          </td>

          <!-- Paired Dashcam / IMEI -->
          <td>
            ${pairedTerminal ? `
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-family:monospace;font-size:11px;font-weight:700;color:var(--text-primary);">${pairedTerminal}</span>
                <span class="badge-chip" style="background:#eff6ff;color:#2563eb;font-size:9px;">JT808</span>
              </div>
              <div style="font-size:10px;color:var(--text-muted);">${v.dashcamModel || 'WanWay H20P 4G'}</div>
            ` : `
              <div style="display:flex;align-items:center;gap:6px;">
                <span class="badge-chip" style="background:#fef2f2;color:#dc2626;font-size:10px;">UNPAIRED</span>
                <button class="btn-ctrl-outline" onclick="window.InurumApp.openPairDevice('${v.id}')" style="padding:2px 6px;font-size:10px;">+ Pair</button>
              </div>
            `}
          </td>

          <!-- Live Status & Speed -->
          <td>
            ${statusPill}
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">
              Ignition: <strong style="color:${v.ignition ? '#10b981' : '#64748b'};">${v.ignition ? 'ON' : 'OFF'}</strong>
            </div>
          </td>

          <!-- Current Location -->
          <td>
            <div style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--text-secondary);" title="${v.address || 'Location unavailable'}">
              ${v.address || 'Location unavailable'}
            </div>
            <div style="font-size:10px;color:var(--text-muted);font-family:monospace;">
              ${v.lat ? `${v.lat.toFixed(4)}°N, ${v.lng.toFixed(4)}°E` : 'GPS Inactive'}
            </div>
          </td>

          <!-- Actions -->
          <td style="text-align:right;">
            <div style="display:inline-flex;gap:4px;">
              <button class="btn-ctrl-outline" onclick="window.InurumApp.openVehicleProfile('${v.id}')" style="padding:4px 8px;font-size:11px;" title="View Profile Drawer">
                Profile
              </button>
              <button class="btn-ctrl-outline" onclick="window.InurumApp.openVehicleEdit('${v.id}')" style="padding:4px 8px;font-size:11px;" title="Edit Vehicle">
                Edit
              </button>
              ${pairedTerminal ? `
                <button class="btn-ctrl-outline" onclick="window.InurumApp.unpairVehicleDevice('${v.id}')" style="padding:4px 8px;font-size:11px;color:#dc2626;" title="Unpair Dashcam">
                  Unpair
                </button>
              ` : `
                <button class="btn-ctrl-outline" onclick="window.InurumApp.openPairDevice('${v.id}')" style="padding:4px 8px;font-size:11px;color:#2563eb;" title="Pair Dashcam">
                  Pair
                </button>
              `}
              <button class="btn-ctrl-outline" onclick="window.InurumApp.toggleVehicleStatus('${v.id}')" style="padding:4px 8px;font-size:11px;color:${isDeactivated ? '#10b981' : '#64748b'};" title="${isDeactivated ? 'Activate Vehicle' : 'Deactivate Vehicle'}">
                ${isDeactivated ? 'Activate' : 'Deactivate'}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ── Stage 3: Device Health Center Diagnostics ─────────────────────────
  async function loadDeviceHealthData() {
    try {
      const devices = await FleetApi.getDeviceHealth();
      state.devicesHealth = devices;
      renderDeviceHealthTable(devices);
    } catch (err) {
      console.error('[Device Health] Load failed:', err);
    }
  }

  function renderDeviceHealthTable(devices) {
    if (!dom.vdHealthTableBody) return;

    const devBadge = document.getElementById('vdDeviceCountBadge');
    if (devBadge) devBadge.textContent = devices.length;

    const connectedSockets = devices.filter(d => d.connectionStatus === 'CONNECTED').length;
    const activeChannels = devices.filter(d => d.jt1078Media && d.jt1078Media.ch1Status === 'READY').length;

    const elSockets = document.getElementById('healthKpiSockets');
    if (elSockets) elSockets.textContent = `${connectedSockets} / ${devices.length}`;
    const elChannels = document.getElementById('healthKpiChannels');
    if (elChannels) elChannels.textContent = `${activeChannels * 2} Ready`;

    if (devices.length === 0) {
      dom.vdHealthTableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted);">
            No connected JT/T 808 dashcam hardware terminals detected.
          </td>
        </tr>
      `;
      return;
    }

    dom.vdHealthTableBody.innerHTML = devices.map(d => {
      const isOnline = d.connectionStatus === 'CONNECTED';
      const socketStatus = isOnline
        ? `<span class="kpi-status-pill online">● CONNECTED</span>`
        : `<span class="kpi-status-pill offline">○ OFFLINE</span>`;

      const authStatus = d.jt808Socket && d.jt808Socket.authenticated
        ? `<span style="color:#10b981;font-weight:700;font-size:10px;">0x0102 AUTHENTICATED</span>`
        : `<span style="color:#dc2626;font-weight:600;font-size:10px;">0x0102 UNREGISTERED</span>`;

      const latencyMs = d.jt808Socket && d.jt808Socket.latencyMs ? `${d.jt808Socket.latencyMs} ms` : 'N/A';
      const lastHb = d.jt808Socket && d.jt808Socket.lastHeartbeat
        ? new Date(d.jt808Socket.lastHeartbeat).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })
        : 'None';

      const ch1Status = d.jt1078Media && d.jt1078Media.ch1Status === 'READY'
        ? `<span style="color:#10b981;font-weight:600;">CH1: Ready</span>`
        : `<span style="color:#94a3b8;">CH1: Offline</span>`;
      const ch2Status = d.jt1078Media && d.jt1078Media.ch2Status === 'READY'
        ? `<span style="color:#10b981;font-weight:600;">CH2: Ready</span>`
        : `<span style="color:#94a3b8;">CH2: Offline</span>`;

      const pairedVeh = d.pairedVehicle
        ? `<div class="hsrp-plate-badge" style="font-size:10px;"><span class="hsrp-ind" style="font-size:8px;padding:2px 3px;">IND</span><span class="hsrp-number" style="font-size:10px;padding:2px 5px;">${d.pairedVehicle.plateNumber}</span></div>`
        : `<span class="badge-chip" style="background:#fef2f2;color:#dc2626;font-size:10px;">UNPAIRED</span>`;

      return `
        <tr>
          <!-- Terminal / IMEI -->
          <td>
            <div style="font-family:monospace;font-weight:700;font-size:12px;color:var(--text-primary);">${d.terminalId}</div>
            <div style="font-size:10px;color:var(--text-muted);">${d.hardwareDiagnostics && d.hardwareDiagnostics.simNumber !== 'Not Available' ? 'SIM ' + escapeHtml(d.hardwareDiagnostics.simNumber) : ''}</div>
          </td>

          <!-- Model -->
          <td>
            <div style="font-weight:600;font-size:12px;">${escapeHtml(d.model) || 'Not Available'}</div>
            <div style="font-size:10px;color:var(--text-muted);">FW ${escapeHtml(d.hardwareDiagnostics ? d.hardwareDiagnostics.firmwareVersion : '') || 'Not Available'}</div>
          </td>

          <!-- JT808 Socket & Auth -->
          <td>
            ${socketStatus}
            <div style="margin-top:2px;">${authStatus}</div>
          </td>

          <!-- Heartbeat & Latency -->
          <td>
            <div style="font-weight:700;font-size:11px;font-family:monospace;color:#0284c7;">⚡ ${latencyMs}</div>
            <div style="font-size:10px;color:var(--text-muted);">Last: ${lastHb} IST</div>
          </td>

          <!-- CH1 / CH2 Video -->
          <td>
            <div style="font-size:11px;">${ch1Status} • ${ch2Status}</div>
            <div style="font-size:10px;color:var(--text-muted);">120s Quota Protection</div>
          </td>

          <!-- GPS Freshness & Fix -->
          <td>
            <div style="font-size:11px;font-weight:600;">${d.gpsTelemetry.speed}</div>
            <div style="font-size:10px;color:var(--text-muted);font-family:monospace;">${d.gpsTelemetry.coordinates}</div>
          </td>

          <!-- Hardware Telemetry (Explicit "Not Available" for unsupported per prompt) -->
          <td>
            <div style="font-size:11px;color:var(--text-muted);">Satellites: <span style="font-weight:600;color:var(--text-secondary);">${d.gpsTelemetry.satellites}</span></div>
            <div style="font-size:10px;color:var(--text-muted);">Voltage: <span style="font-weight:600;color:var(--text-secondary);">${d.hardwareDiagnostics.externalVoltage}</span></div>
          </td>

          <!-- Paired Vehicle -->
          <td>
            ${pairedVeh}
          </td>

          <!-- Actions -->
          <td style="text-align:right;">
            <button class="btn-ctrl-outline" onclick="window.InurumApp.streamFromMap('${d.pairedVehicle ? d.pairedVehicle.id : ''}')" style="padding:4px 8px;font-size:11px;" ${!d.pairedVehicle ? 'disabled' : ''}>
              Live Stream
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function openVehicleProfileDrawer(vehicleId) {
    const v = state.vehicles.find(veh => veh.id === vehicleId);
    if (!v || !dom.drawerVehicleProfile) return;

    const elPlate = document.getElementById('drawerPlateText');
    if (elPlate) elPlate.textContent = v.plateNumber;
    const elTitle = document.getElementById('drawerVehicleTitle');
    if (elTitle) elTitle.textContent = v.label;
    const elModel = document.getElementById('drawerVehicleModel');
    if (elModel) elModel.textContent = `${v.model || 'Commercial Fleet'} • ${v.year || '2024'}`;
    const elSpeed = document.getElementById('drawerSpeedVal');
    if (elSpeed) elSpeed.textContent = `${v.speed || 0} km/h`;
    const elIgnition = document.getElementById('drawerIgnitionVal');
    if (elIgnition) {
      elIgnition.textContent = v.ignition ? 'ON' : 'OFF';
      elIgnition.style.color = v.ignition ? '#10b981' : '#64748b';
    }
    const elHeading = document.getElementById('drawerHeadingVal');
    if (elHeading) elHeading.textContent = `${v.heading || 0}°`;
    const elAddress = document.getElementById('drawerAddressVal');
    if (elAddress) elAddress.textContent = v.address || 'Address unavailable';
    const elCoords = document.getElementById('drawerCoordsVal');
    if (elCoords) elCoords.textContent = v.lat ? `${v.lat.toFixed(4)}°N, ${v.lng.toFixed(4)}°E` : 'GPS Inactive';

    const elTermId = document.getElementById('drawerTerminalId');
    if (elTermId) elTermId.textContent = v.assignedDeviceId || v.terminalId || 'Unpaired';
    const elDriverName = document.getElementById('drawerDriverName');
    if (elDriverName) elDriverName.textContent = v.driverName || 'Unassigned';
    const elDriverPhone = document.getElementById('drawerDriverPhone');
    if (elDriverPhone) elDriverPhone.textContent = v.driverPhone || 'No Phone';
    const elDriverLicense = document.getElementById('drawerDriverLicense');
    if (elDriverLicense) elDriverLicense.textContent = v.driverLicense ? `DL: ${v.driverLicense}` : 'No License';
    const elDriverAvatar = document.getElementById('drawerDriverAvatar');
    if (elDriverAvatar) elDriverAvatar.textContent = v.driverName ? v.driverName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'DR';

    // Hook Drawer Action Buttons
    const btnLive = document.getElementById('btnDrawerLaunchLive');
    if (btnLive) {
      btnLive.onclick = () => {
        closeVehicleProfileDrawer();
        selectVehicle(v.id);
        navigateTo('live');
        startLiveStreaming();
      };
    }
    const btnTrips = document.getElementById('btnDrawerRouteReplay');
    if (btnTrips) {
      btnTrips.onclick = () => {
        closeVehicleProfileDrawer();
        navigateTo('trips');
        setTimeout(() => {
          if (dom.tripsVehicleSelect) {
            dom.tripsVehicleSelect.value = v.assignedDeviceId || v.terminalId;
            loadTripsForVehicle(v.assignedDeviceId || v.terminalId);
          }
        }, 120);
      };
    }
    const btnSafety = document.getElementById('btnDrawerSafetyEvents');
    if (btnSafety) {
      btnSafety.onclick = () => {
        closeVehicleProfileDrawer();
        navigateTo('safety');
      };
    }

    dom.drawerVehicleProfile.style.display = 'flex';
  }

  function closeVehicleProfileDrawer() {
    if (dom.drawerVehicleProfile) dom.drawerVehicleProfile.style.display = 'none';
  }

  function openVehicleEditModal(vehicleId = null) {
    if (!dom.modalVehicleEdit) return;
    const titleEl = document.getElementById('modalVehicleEditTitle');
    const inputId = document.getElementById('editVehicleId');
    const inputPlate = document.getElementById('inputVehiclePlate');
    const inputLabel = document.getElementById('inputVehicleLabel');
    const inputModel = document.getElementById('inputVehicleModel');
    const inputYear = document.getElementById('inputVehicleYear');
    const inputDriver = document.getElementById('inputVehicleDriver');
    const inputPhone = document.getElementById('inputVehicleDriverPhone');
    const inputLicense = document.getElementById('inputVehicleDriverLicense');

    if (vehicleId) {
      const v = state.vehicles.find(veh => veh.id === vehicleId);
      if (!v) return;
      if (titleEl) titleEl.textContent = `Edit Vehicle: ${v.plateNumber}`;
      if (inputId) inputId.value = v.id;
      if (inputPlate) inputPlate.value = v.plateNumber || '';
      if (inputLabel) inputLabel.value = v.label || '';
      if (inputModel) inputModel.value = v.model || '';
      if (inputYear) inputYear.value = v.year || 2024;
      if (inputDriver) inputDriver.value = v.driverName || '';
      if (inputPhone) inputPhone.value = v.driverPhone || '';
      if (inputLicense) inputLicense.value = v.driverLicense || '';
    } else {
      if (titleEl) titleEl.textContent = 'Add New Fleet Vehicle';
      if (inputId) inputId.value = '';
      if (dom.formVehicleEdit) dom.formVehicleEdit.reset();
    }

    dom.modalVehicleEdit.style.display = 'flex';
  }

  function closeVehicleEditModal() {
    if (dom.modalVehicleEdit) dom.modalVehicleEdit.style.display = 'none';
  }

  async function handleSaveVehicle() {
    const inputId = document.getElementById('editVehicleId');
    const vehicleId = inputId ? inputId.value : null;

    const vehicleData = {
      plateNumber: document.getElementById('inputVehiclePlate').value.trim().toUpperCase(),
      label: document.getElementById('inputVehicleLabel').value.trim(),
      model: document.getElementById('inputVehicleModel').value.trim() || null,
      year: parseInt(document.getElementById('inputVehicleYear').value, 10) || null,
      driverName: document.getElementById('inputVehicleDriver').value.trim() || null,
      driverPhone: document.getElementById('inputVehicleDriverPhone').value.trim(),
      driverLicense: document.getElementById('inputVehicleDriverLicense').value.trim()
    };

    try {
      if (vehicleId) {
        showToast(`Updating vehicle ${vehicleData.plateNumber}...`, 'info');
        await FleetApi.updateVehicle(vehicleId, vehicleData);
        showToast('Vehicle updated successfully!', 'success');
      } else {
        showToast(`Adding vehicle ${vehicleData.plateNumber}...`, 'info');
        await FleetApi.createVehicle(vehicleData);
        showToast('Vehicle added successfully!', 'success');
      }
      closeVehicleEditModal();
      await loadFleetData();
      renderVehiclesDirectory();
    } catch (err) {
      console.error('[Vehicle Edit] Save failed:', err);
      showToast(`Save failed: ${err.message || 'Operation failed'}`, 'error');
    }
  }

  async function handleToggleVehicleStatus(vehicleId) {
    try {
      showToast('Updating vehicle operational status...', 'info');
      const res = await FleetApi.toggleVehicleStatus(vehicleId);
      showToast(res.message || 'Vehicle status updated.', 'success');
      await loadFleetData();
      renderVehiclesDirectory();
    } catch (err) {
      console.error('[Vehicle Status] Toggle failed:', err);
      showToast(`Status update failed: ${err.message || 'Permission denied'}`, 'error');
    }
  }

  function openPairDeviceModal(vehicleId) {
    const v = state.vehicles.find(veh => veh.id === vehicleId);
    if (!v || !dom.modalPairDevice) return;

    const inputVehId = document.getElementById('pairVehicleId');
    if (inputVehId) inputVehId.value = v.id;
    const displayVeh = document.getElementById('pairVehicleDisplay');
    if (displayVeh) displayVeh.textContent = `${v.plateNumber} • ${v.label}`;

    const selectTerminal = document.getElementById('selectPairTerminal');
    if (selectTerminal) {
      const pairedTerminalIds = state.vehicles.map(veh => veh.assignedDeviceId).filter(Boolean);
      // Cameras the backend knows (Device Health list); open that tab once to load them
      const devices = state.devicesHealth || [];

      selectTerminal.innerHTML = devices.length === 0
        ? '<option value="" disabled selected>No dashcams found. Open the Device Health tab first.</option>'
        : devices.map(d => {
        const isPairedToOther = pairedTerminalIds.includes(d.terminalId) && d.terminalId !== v.assignedDeviceId;
        return `
          <option value="${d.terminalId}" ${isPairedToOther ? 'disabled' : ''} ${d.terminalId === v.assignedDeviceId ? 'selected' : ''}>
            ${d.terminalId}${d.model ? ' • ' + d.model : ''} ${isPairedToOther ? '(Paired to other)' : ''}
          </option>
        `;
      }).join('');
    }

    dom.modalPairDevice.style.display = 'flex';
  }

  function closePairDeviceModal() {
    if (dom.modalPairDevice) dom.modalPairDevice.style.display = 'none';
  }

  async function handleConfirmPair() {
    const inputVehId = document.getElementById('pairVehicleId');
    const selectTerminal = document.getElementById('selectPairTerminal');
    if (!inputVehId || !selectTerminal) return;

    const vehicleId = inputVehId.value;
    const terminalId = selectTerminal.value;

    try {
      showToast(`Pairing terminal ${terminalId} to vehicle...`, 'info');
      await FleetApi.pairDevice(vehicleId, terminalId);
      showToast('Dashcam terminal paired successfully with 1:1 hardware exclusivity!', 'success');
      closePairDeviceModal();
      await loadFleetData();
      renderVehiclesDirectory();
      if (state.vdSubtab === 'health') await loadDeviceHealthData();
    } catch (err) {
      console.error('[Device Pairing] Pair failed:', err);
      showToast(`Pairing failed: ${err.message || 'Operation failed'}`, 'error');
    }
  }

  async function handleUnpairDevice(vehicleId) {
    if (!confirm('Are you sure you want to unpair this dashcam hardware from the vehicle?')) return;
    try {
      showToast('Unpairing dashcam terminal...', 'info');
      await FleetApi.unpairDevice(vehicleId);
      showToast('Dashcam unpaired successfully.', 'success');
      await loadFleetData();
      renderVehiclesDirectory();
      if (state.vdSubtab === 'health') await loadDeviceHealthData();
    } catch (err) {
      console.error('[Device Pairing] Unpair failed:', err);
      showToast(`Unpairing failed: ${err.message || 'Operation failed'}`, 'error');
    }
  }

  // ==========================================================================
  // STAGE 4: TRIPS & GPS ROUTE REPLAY IMPLEMENTATION
  // ==========================================================================
  function initTripsReplay() {
    bindTripsEvents();
    populateTripsVehicleSelect();
    initTripsMap();

    // Auto-load trips for first vehicle
    const initialTerminal = (state.selectedVehicle && (state.selectedVehicle.assignedDeviceId || state.selectedVehicle.terminalId))
      || (state.vehicles[0] && (state.vehicles[0].assignedDeviceId || state.vehicles[0].terminalId));
    if (!initialTerminal) return;

    if (dom.tripsVehicleSelect) dom.tripsVehicleSelect.value = initialTerminal;
    loadTripsForVehicle(initialTerminal);
  }

  function bindTripsEvents() {
    // Vehicle selector change
    if (dom.tripsVehicleSelect && !dom.tripsVehicleSelect.dataset.bound) {
      dom.tripsVehicleSelect.dataset.bound = 'true';
      dom.tripsVehicleSelect.addEventListener('change', (e) => {
        loadTripsForVehicle(e.target.value);
      });
    }

    // Load Replay button
    if (dom.btnLoadTripReplay && !dom.btnLoadTripReplay.dataset.bound) {
      dom.btnLoadTripReplay.dataset.bound = 'true';
      dom.btnLoadTripReplay.addEventListener('click', () => {
        const tripId = dom.tripsRouteSelect ? dom.tripsRouteSelect.value : null;
        if (tripId) loadSelectedTrip(tripId);
        else showToast('Please select a trip first.', 'warning');
      });
    }

    // Play / Pause Replay
    if (dom.btnTripPlayPause && !dom.btnTripPlayPause.dataset.bound) {
      dom.btnTripPlayPause.dataset.bound = 'true';
      dom.btnTripPlayPause.addEventListener('click', () => {
        if (state.tripPlaybackTimer) pauseTripPlayback();
        else startTripPlayback();
      });
    }

    // Seek -15s
    if (dom.btnTripRewind && !dom.btnTripRewind.dataset.bound) {
      dom.btnTripRewind.dataset.bound = 'true';
      dom.btnTripRewind.addEventListener('click', () => {
        seekTripPlayback(Math.max(0, state.tripPlaybackIdx - 5));
      });
    }

    // Seek +15s
    if (dom.btnTripForward && !dom.btnTripForward.dataset.bound) {
      dom.btnTripForward.dataset.bound = 'true';
      dom.btnTripForward.addEventListener('click', () => {
        seekTripPlayback(Math.min((state.tripPoints.length - 1), state.tripPlaybackIdx + 5));
      });
    }

    // Playback Speed multiplier buttons
    if (dom.tripSpeedBtns) {
      dom.tripSpeedBtns.forEach(btn => {
        if (!btn.dataset.bound) {
          btn.dataset.bound = 'true';
          btn.addEventListener('click', () => {
            dom.tripSpeedBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.tripPlaybackSpeed = parseInt(btn.dataset.speed, 10) || 1;
            if (state.tripPlaybackTimer) {
              pauseTripPlayback();
              startTripPlayback();
            }
          });
        }
      });
    }

    // Timeline Scrubber Rail Click / Drag
    if (dom.tripScrubberRail && !dom.tripScrubberRail.dataset.bound) {
      dom.tripScrubberRail.dataset.bound = 'true';
      dom.tripScrubberRail.addEventListener('click', (e) => {
        if (!state.tripPoints || state.tripPoints.length === 0) return;
        const rect = dom.tripScrubberRail.getBoundingClientRect();
        let pct = (e.clientX - rect.left) / rect.width;
        pct = Math.max(0, Math.min(1, pct));
        const targetIdx = Math.floor(pct * (state.tripPoints.length - 1));
        seekTripPlayback(targetIdx);
      });
    }
  }

  function populateTripsVehicleSelect() {
    if (!dom.tripsVehicleSelect) return;
    dom.tripsVehicleSelect.innerHTML = state.vehicles.map(v => `
      <option value="${v.assignedDeviceId || v.terminalId}">
        ${v.plateNumber} • ${v.label}
      </option>
    `).join('');
  }

  async function loadTripsForVehicle(terminalId) {
    try {
      showToast(`Loading trips for terminal ${terminalId}...`, 'info');
      const trips = await FleetApi.getTrips(terminalId);
      if (dom.tripsRouteSelect) {
        if (trips.length === 0) {
          dom.tripsRouteSelect.innerHTML = '<option value="">No historical trips found for this vehicle</option>';
          showToast('No trips recorded for this vehicle.', 'info');
          return;
        }
        dom.tripsRouteSelect.innerHTML = trips.map(t => `
          <option value="${t.id}">
            ${t.startTime.substring(11, 16)} - ${t.endTime.substring(11, 16)} • ${t.startLocation} &rarr; ${t.endLocation} (${t.distanceKm} km)
          </option>
        `).join('');

        // Auto load first trip
        loadSelectedTrip(trips[0].id);
      }
    } catch (err) {
      console.error('[Trips] Failed to load trips:', err);
    }
  }

  function initTripsMap() {
    if (state.tripsMap) {
      setTimeout(() => state.tripsMap.invalidateSize(), 100);
      return;
    }
    const container = document.getElementById('tripRouteMapContainer');
    if (!container) return;

    state.tripsMap = L.map('tripRouteMapContainer', {
      zoomControl: true,
      attributionControl: false
    }).setView([22.7533, 75.8937], 13);

    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: 'Map data &copy; Google'
    }).addTo(state.tripsMap);

    setTimeout(() => {
      if (state.tripsMap) state.tripsMap.invalidateSize();
    }, 200);
  }

  async function loadSelectedTrip(tripId) {
    try {
      pauseTripPlayback();
      const res = await FleetApi.getTripDetail(tripId);
      const trip = res.trip;
      state.currentTrip = trip;
      state.tripPoints = trip.points || [];
      state.tripPlaybackIdx = 0;

      // Update Summary Cards
      const elTitle = document.getElementById('tripDetailTitle');
      if (elTitle) elTitle.textContent = `Trip: ${trip.startLocation} to ${trip.endLocation}`;
      const elVeh = document.getElementById('tripDetailVehicle');
      if (elVeh) elVeh.textContent = `${trip.plateNumber} • ${trip.vehicleLabel || 'Fleet Vehicle'}`;
      const elDist = document.getElementById('tripKpiDistance');
      if (elDist) elDist.textContent = `${trip.distanceKm} km`;
      const elMaxSpeed = document.getElementById('tripKpiMaxSpeed');
      if (elMaxSpeed) elMaxSpeed.textContent = `${trip.maxSpeed} km/h`;
      const elAvgSpeed = document.getElementById('tripKpiAvgSpeed');
      if (elAvgSpeed) elAvgSpeed.textContent = `${trip.avgSpeed} km/h`;
      const elAlerts = document.getElementById('tripKpiAlerts');
      if (elAlerts) elAlerts.textContent = `${(trip.safetyEvents && trip.safetyEvents.length) || 0} Events`;

      const elOriginTime = document.getElementById('tripOriginTime');
      if (elOriginTime) elOriginTime.textContent = `${trip.startTime.substring(11, 16)} IST`;
      const elOriginAddr = document.getElementById('tripOriginAddress');
      if (elOriginAddr) elOriginAddr.textContent = trip.startLocation;
      const elDestTime = document.getElementById('tripDestTime');
      if (elDestTime) elDestTime.textContent = `${trip.endTime.substring(11, 16)} IST`;
      const elDestAddr = document.getElementById('tripDestAddress');
      if (elDestAddr) elDestAddr.textContent = trip.endLocation;

      // Render Events Milestones
      renderTripEventsList(trip);

      // Render Leaflet Polyline & Markers
      renderTripPolyline(trip);

      // Reset Scrubber to start
      seekTripPlayback(0);
      showToast(`Loaded trip replay (${trip.distanceKm} km, ${trip.points.length} GPS points).`, 'success');
    } catch (err) {
      console.error('[Trips] Failed to load trip detail:', err);
      showToast(`Trip load failed: ${err.message || 'Inaccessible'}`, 'error');
    }
  }

  function renderTripEventsList(trip) {
    if (!dom.tripEventsList) return;
    const events = [];

    // Milestone 1: Start
    events.push({
      time: trip.startTime.substring(11, 19),
      label: 'Ignition ON • Departure',
      idx: 0,
      icon: '🟢'
    });

    // Milestone 2: Safety Events
    if (trip.safetyEvents) {
      trip.safetyEvents.forEach(ev => {
        const matchIdx = trip.points.findIndex(p => p.timestamp >= ev.timestamp);
        events.push({
          time: ev.timestamp.substring(11, 19),
          label: `${ev.type === 'OVERSPEED' ? 'Overspeed Alert (' + ev.speed + ' km/h)' : 'Harsh Braking'}`,
          idx: matchIdx >= 0 ? matchIdx : 10,
          icon: ev.type === 'OVERSPEED' ? '⚠️' : '🛑'
        });
      });
    }

    // Milestone 3: GPS Outage Gap
    const gapIdx = trip.points.findIndex(p => p.isGap);
    if (gapIdx >= 0) {
      events.push({
        time: trip.points[gapIdx].timestamp.substring(11, 19),
        label: 'GPS Outage Gap (Flyover Tunnel - 45s)',
        idx: gapIdx,
        icon: '📡'
      });
    }

    // Milestone 4: End
    events.push({
      time: trip.endTime.substring(11, 19),
      label: 'Ignition OFF • Arrival',
      idx: trip.points.length - 1,
      icon: '🏁'
    });

    dom.tripEventsList.innerHTML = events.map(e => `
      <div class="trip-event-item" onclick="window.InurumApp.seekTripTo(${e.idx})">
        <div style="display:flex;align-items:center;gap:8px;">
          <span>${e.icon}</span>
          <div>
            <div class="trip-event-time">${e.time} IST</div>
            <div class="trip-event-label">${e.label}</div>
          </div>
        </div>
        <span style="font-size:10px;color:var(--primary-blue);font-weight:700;">Jump &rarr;</span>
      </div>
    `).join('');
  }

  function renderTripPolyline(trip) {
    if (!state.tripsMap) return;

    // Clean up previous layers
    if (state.tripPolyline) state.tripsMap.removeLayer(state.tripPolyline);
    state.tripGapPolylines.forEach(layer => state.tripsMap.removeLayer(layer));
    state.tripGapPolylines = [];
    state.tripEventMarkers.forEach(layer => state.tripsMap.removeLayer(layer));
    state.tripEventMarkers = [];
    if (state.tripVehicleMarker) state.tripsMap.removeLayer(state.tripVehicleMarker);

    const validPoints = trip.points.filter(p => p.lat !== null && p.lng !== null);
    if (validPoints.length === 0) return;

    const latLngs = validPoints.map(p => [p.lat, p.lng]);

    // Draw solid polyline for the driven route
    state.tripPolyline = L.polyline(latLngs, {
      color: '#2563eb',
      weight: 5,
      opacity: 0.85,
      lineJoin: 'round'
    }).addTo(state.tripsMap);

    state.tripsMap.fitBounds(state.tripPolyline.getBounds(), { padding: [40, 40] });

    // Identify GPS Gaps and render dashed amber line
    for (let i = 0; i < trip.points.length; i++) {
      if (trip.points[i].isGap) {
        let prevValid = null;
        for (let j = i - 1; j >= 0; j--) {
          if (trip.points[j].lat !== null) { prevValid = trip.points[j]; break; }
        }
        let nextValid = null;
        for (let j = i + 1; j < trip.points.length; j++) {
          if (trip.points[j].lat !== null) { nextValid = trip.points[j]; break; }
        }

        if (prevValid && nextValid) {
          const gapLine = L.polyline([[prevValid.lat, prevValid.lng], [nextValid.lat, nextValid.lng]], {
            color: '#f59e0b',
            weight: 4,
            dashArray: '6, 8',
            opacity: 0.9
          }).addTo(state.tripsMap);
          state.tripGapPolylines.push(gapLine);

          // Add Gap Warning Icon on Map
          const gapCenter = [(prevValid.lat + nextValid.lat) / 2, (prevValid.lng + nextValid.lng) / 2];
          const gapMarker = L.marker(gapCenter, {
            icon: L.divIcon({
              className: 'gap-map-icon',
              html: '<div style="background:#fffbeb;border:1.5px solid #d97706;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 2px 4px rgba(0,0,0,0.15);" title="GPS Outage Gap: AB Road Tunnel">📡</div>',
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            })
          }).addTo(state.tripsMap);
          state.tripEventMarkers.push(gapMarker);
        }
      }
    }

    // Place Start & End Markers
    const startPt = validPoints[0];
    const endPt = validPoints[validPoints.length - 1];

    const startMarker = L.marker([startPt.lat, startPt.lng], {
      icon: L.divIcon({
        className: 'route-start-icon',
        html: '<div style="background:#10b981;color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;box-shadow:0 2px 6px rgba(0,0,0,0.2);">A</div>',
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      })
    }).addTo(state.tripsMap);
    state.tripEventMarkers.push(startMarker);

    const endMarker = L.marker([endPt.lat, endPt.lng], {
      icon: L.divIcon({
        className: 'route-end-icon',
        html: '<div style="background:#ef4444;color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;box-shadow:0 2px 6px rgba(0,0,0,0.2);">B</div>',
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      })
    }).addTo(state.tripsMap);
    state.tripEventMarkers.push(endMarker);

    // Place Safety Markers on route
    if (trip.safetyEvents) {
      trip.safetyEvents.forEach(ev => {
        const evMarker = L.marker([ev.lat, ev.lng], {
          icon: L.divIcon({
            className: 'route-safety-icon',
            html: `<div style="background:${ev.type === 'OVERSPEED' ? '#f59e0b' : '#dc2626'};color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 2px 6px rgba(0,0,0,0.2);">${ev.type === 'OVERSPEED' ? '⚠️' : '🛑'}</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          })
        }).addTo(state.tripsMap);
        evMarker.bindPopup(`<strong>${ev.type}</strong><br>Speed: ${ev.speed} km/h<br>${ev.timestamp.substring(11, 19)} IST`);
        state.tripEventMarkers.push(evMarker);
      });
    }

    // Vehicle Animated Marker
    const vehicleIcon = L.divIcon({
      className: 'trip-vehicle-marker',
      html: `
        <div id="tripVehicleMarkerIcon" style="width:34px;height:34px;background:#0f172a;border:2.5px solid #ffffff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,0.35);transform:rotate(${startPt.heading || 0}deg);transition:transform 0.15s ease;">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:#38bdf8;"><polygon points="12 2 19 21 12 17 5 21 12 2"/></svg>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });

    state.tripVehicleMarker = L.marker([startPt.lat, startPt.lng], { icon: vehicleIcon }).addTo(state.tripsMap);
  }

  function startTripPlayback() {
    if (!state.tripPoints || state.tripPoints.length === 0) return;
    const playIcon = document.getElementById('iconTripPlay');
    const pauseIcon = document.getElementById('iconTripPause');
    if (playIcon) playIcon.style.display = 'none';
    if (pauseIcon) pauseIcon.style.display = 'block';

    if (state.tripPlaybackIdx >= state.tripPoints.length - 1) {
      state.tripPlaybackIdx = 0;
    }

    const intervalMs = Math.max(80, Math.round(600 / state.tripPlaybackSpeed));
    state.tripPlaybackTimer = setInterval(() => {
      if (state.tripPlaybackIdx < state.tripPoints.length - 1) {
        state.tripPlaybackIdx++;
        updateTripPlaybackFrame(state.tripPlaybackIdx);
      } else {
        pauseTripPlayback();
      }
    }, intervalMs);
  }

  function pauseTripPlayback() {
    if (state.tripPlaybackTimer) {
      clearInterval(state.tripPlaybackTimer);
      state.tripPlaybackTimer = null;
    }
    const playIcon = document.getElementById('iconTripPlay');
    const pauseIcon = document.getElementById('iconTripPause');
    if (playIcon) playIcon.style.display = 'block';
    if (pauseIcon) pauseIcon.style.display = 'none';
  }

  function seekTripPlayback(index) {
    state.tripPlaybackIdx = Math.max(0, Math.min(state.tripPoints.length - 1, index));
    updateTripPlaybackFrame(state.tripPlaybackIdx);
  }

  function updateTripPlaybackFrame(index) {
    const pt = state.tripPoints[index];
    if (!pt) return;

    // Update Progress Scrubber
    const pct = ((index / (state.tripPoints.length - 1)) * 100).toFixed(2);
    if (dom.tripScrubberProgress) dom.tripScrubberProgress.style.width = `${pct}%`;
    if (dom.tripScrubberNeedle) dom.tripScrubberNeedle.style.left = `${pct}%`;
    if (dom.tripScrubberCurrentTime) {
      dom.tripScrubberCurrentTime.textContent = pt.timestamp ? pt.timestamp.substring(11, 19) : '00:00';
    }

    // Transparent GPS Gap handling
    if (pt.isGap || pt.lat === null) {
      if (dom.tripGapWarningBanner) dom.tripGapWarningBanner.style.display = 'flex';
      if (dom.hudCurrentSpeed) dom.hudCurrentSpeed.textContent = 'SIGNAL LOST';
      if (dom.hudCurrentHeading) dom.hudCurrentHeading.textContent = 'NO FIX';
      return;
    } else {
      if (dom.tripGapWarningBanner) dom.tripGapWarningBanner.style.display = 'none';
    }

    // Update Map Vehicle Position & Heading
    if (state.tripVehicleMarker) {
      state.tripVehicleMarker.setLatLng([pt.lat, pt.lng]);
      const markerEl = document.getElementById('tripVehicleMarkerIcon');
      if (markerEl) markerEl.style.transform = `rotate(${pt.heading || 0}deg)`;
    }

    // Update HUD
    if (dom.hudCurrentSpeed) dom.hudCurrentSpeed.textContent = `${pt.speed} km/h`;
    if (dom.hudCurrentTime) dom.hudCurrentTime.textContent = pt.timestamp.substring(11, 19);
    if (dom.hudCurrentHeading) dom.hudCurrentHeading.textContent = `${pt.heading}°`;
    if (dom.hudCurrentIgnition) {
      dom.hudCurrentIgnition.textContent = pt.ignition ? 'ON' : 'OFF';
      dom.hudCurrentIgnition.style.color = pt.ignition ? '#10b981' : '#dc2626';
    }
  }

  // Handle browser tab closure to terminate hardware stream
  window.addEventListener('beforeunload', () => {
    if (state.isStreaming && state.selectedVehicle) {
      FleetApi.stopLiveStream(state.selectedVehicle.terminalId);
    }
  });
  window.addEventListener('pagehide', () => {
    if (state.isStreaming && state.selectedVehicle) {
      FleetApi.stopLiveStream(state.selectedVehicle.terminalId);
    }
  });

  // =========================================================================
  // STAGE 2, 3, 4, 5: SAAS ADMIN, USER RBAC, REPORTS & COST CONTROLS
  // =========================================================================

  let adminTab = 'orgs';
  let adminOrgsCache = [];
  let adminUsersCache = [];

  function initAdminConsole() {
    bindAdminTabs();
    loadSaasMetricsAndOrgs();
    loadAdminUsers();
    loadCostControlSettings();
    loadAdminAuditLogs();
    bindAdminModalEvents();
  }

  function bindAdminTabs() {
    const tabBtns = document.querySelectorAll('#viewAdmin [data-admintab]');
    const panes = {
      orgs: document.getElementById('adminPaneOrgs'),
      users: document.getElementById('adminPaneUsers'),
      cost: document.getElementById('adminPaneCost'),
      audit: document.getElementById('adminPaneAudit')
    };
    const primaryBtn = document.getElementById('btnAdminActionPrimary');

    tabBtns.forEach(btn => {
      btn.onclick = () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        adminTab = btn.dataset.admintab;

        Object.keys(panes).forEach(k => {
          if (panes[k]) panes[k].style.display = k === adminTab ? 'flex' : 'none';
        });

        if (primaryBtn) {
          if (adminTab === 'orgs') {
            primaryBtn.style.display = 'block';
            primaryBtn.textContent = '+ Add Organization';
            primaryBtn.onclick = () => openModal('modalAddOrg');
          } else if (adminTab === 'users') {
            primaryBtn.style.display = 'block';
            primaryBtn.textContent = '+ Invite User';
            primaryBtn.onclick = () => openModal('modalInviteUser');
          } else {
            primaryBtn.style.display = 'none';
          }
        }
      };
    });

    if (primaryBtn) {
      primaryBtn.onclick = () => openModal('modalAddOrg');
    }
  }

  async function loadSaasMetricsAndOrgs() {
    try {
      if (FleetApi.user && FleetApi.user.role === 'SUPER_ADMIN') {
        const metrics = await FleetApi.getSaasMetrics();
        if (metrics) {
          const elTotal = document.getElementById('saasKpiTotalOrgs');
          const elActive = document.getElementById('saasKpiActiveOrgs');
          const elDevices = document.getElementById('saasKpiTotalDevices');
          const elStorage = document.getElementById('saasKpiStorageUsed');
          if (elTotal) elTotal.textContent = metrics.totalOrganizations || 0;
          if (elActive) elActive.textContent = `${metrics.activeOrganizations || 0} Active`;
          if (elDevices) elDevices.textContent = metrics.totalDevices || 0;
          if (elStorage) elStorage.textContent = (metrics.totalStorageUsedMb / 1024).toFixed(2);
        }
      }

      const orgs = await FleetApi.getOrganizations();
      adminOrgsCache = orgs || [];
      renderAdminOrgsTable(adminOrgsCache);

      // Populate tenant filter in users pane & invite modal
      const tenantSelect = document.getElementById('adminUserTenantFilter');
      const userTenantSelect = document.getElementById('selectUserTenant');
      if (tenantSelect) {
        tenantSelect.innerHTML = '<option value="ALL">All Tenants</option>' +
          adminOrgsCache.map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('');
        tenantSelect.onchange = () => filterAdminUsers();
      }
      if (userTenantSelect) {
        userTenantSelect.innerHTML = adminOrgsCache.map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('');
      }
    } catch (err) {
      console.warn('[Admin] Failed to load SaaS metrics/orgs:', err.message);
    }
  }

  function renderAdminOrgsTable(orgs) {
    const tbody = document.getElementById('adminOrgsTableBody');
    const countEl = document.getElementById('saasOrgsCount');
    if (!tbody) return;
    if (countEl) countEl.textContent = `${orgs.length} Organizations`;

    if (orgs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted);">No customer organizations found.</td></tr>';
      return;
    }

    tbody.innerHTML = orgs.map(org => {
      const isSuspended = org.status === 'SUSPENDED';
      const planBadge = org.plan === 'ENTERPRISE'
        ? '<span class="plan-badge enterprise">ENTERPRISE</span>'
        : '<span class="plan-badge inr_500">₹500 / VEH / YR</span>';

      const statusBadge = isSuspended
        ? '<span class="kpi-status-pill offline">SUSPENDED</span>'
        : '<span class="kpi-status-pill online">ACTIVE</span>';

      const expiryStr = org.subscriptionEnd ? new Date(org.subscriptionEnd).toLocaleDateString() : 'N/A';
      const storageGb = ((org.storageUsedBytes || 0) / (1024 * 1024 * 1024)).toFixed(2);
      const storageCapGb = org.storageQuotaBytes ? ((org.storageQuotaBytes) / (1024 * 1024 * 1024)).toFixed(0) : '—';

      return `
        <tr>
          <td>
            <div style="font-weight:700;color:var(--text-primary);">${escapeHtml(org.name)}</div>
            <div style="font-size:11px;color:var(--text-muted);">${escapeHtml(org.code || org.id)} • ${escapeHtml(org.contactEmail || '')}</div>
          </td>
          <td>${planBadge}</td>
          <td>${statusBadge}</td>
          <td>
            <div style="font-weight:600;">${org.vehiclesCount || 0} Vehicles</div>
            <div style="font-size:11px;color:var(--text-muted);">${org.camerasCount || 0} Cameras</div>
          </td>
          <td>
            <div style="font-size:12px;font-weight:600;">${storageGb} / ${storageCapGb} GB</div>
            <div style="font-size:10px;color:var(--text-muted);">Cloud Storage</div>
          </td>
          <td>
            <div style="font-size:12px;font-weight:600;">${org.streamingMinutesUsed || 0} min</div>
            <div style="font-size:10px;color:var(--text-muted);">this month</div>
          </td>
          <td style="font-size:12px;">${expiryStr}</td>

          <td style="text-align:right;">
            <button class="btn-ctrl-outline" onclick="window.InurumApp.toggleOrgStatus('${org.id}')" style="padding:4px 8px;font-size:11px;color:${isSuspended ? '#10b981' : '#b91c1c'};">
              ${isSuspended ? '▶️ Activate' : '⏸️ Suspend'}
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  async function handleToggleOrgStatus(tenantId) {
    try {
      const res = await FleetApi.toggleOrganizationStatus(tenantId);
      showToast(res.message || 'Organization status updated', 'success');
      await loadSaasMetricsAndOrgs();
    } catch (err) {
      showToast(err.message || 'Failed to toggle organization status', 'danger');
    }
  }

  async function loadAdminUsers() {
    try {
      const users = await FleetApi.getAdminUsers();
      adminUsersCache = users || [];
      renderAdminUsersTable(adminUsersCache);
    } catch (err) {
      console.warn('[Admin] Failed to load users:', err.message);
    }
  }

  function filterAdminUsers() {
    const filterTenant = document.getElementById('adminUserTenantFilter')?.value || 'ALL';
    let filtered = adminUsersCache;
    if (filterTenant !== 'ALL') {
      filtered = filtered.filter(u => u.tenantId === filterTenant);
    }
    renderAdminUsersTable(filtered);
  }

  function renderAdminUsersTable(users) {
    const tbody = document.getElementById('adminUsersTableBody');
    if (!tbody) return;

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted);">No users found.</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(user => {
      const isInactive = user.status === 'INACTIVE';
      const roleClass = (user.role || 'customer').toLowerCase();
      const statusBadge = isInactive
        ? '<span class="badge-chip offline">INACTIVE</span>'
        : '<span class="badge-chip online">ACTIVE</span>';

      const scopeText = user.allowedVehicles && user.allowedVehicles.length > 0
        ? `<span style="color:#0369a1;font-weight:600;">${user.allowedVehicles.length} Vehicles</span>`
        : '<span style="color:var(--text-muted);">All Organization Vehicles</span>';

      const tenantObj = adminOrgsCache.find(o => o.id === user.tenantId);
      const tenantName = tenantObj ? tenantObj.name : user.tenantId;

      return `
        <tr>
          <td>
            <div style="font-weight:700;color:var(--text-primary);">${escapeHtml(user.name)}</div>
            <div style="font-size:11px;color:var(--text-muted);">${escapeHtml(user.email)}</div>
          </td>
          <td><span style="font-size:12px;font-weight:600;">${escapeHtml(tenantName)}</span></td>
          <td><span class="role-badge ${roleClass}">${escapeHtml(user.role)}</span></td>
          <td>
            <div style="font-size:12px;">${scopeText}</div>
            <button class="btn-ctrl-outline" onclick="window.InurumApp.openVehicleScopeModal('${user.id}')" style="padding:2px 6px;font-size:10px;margin-top:2px;">
              ✏️ Restrict Scope
            </button>
          </td>
          <td>${statusBadge}</td>
          <td style="font-size:11px;color:var(--text-muted);">${user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}</td>
          <td style="text-align:right;">
            <div style="display:flex;gap:4px;justify-content:flex-end;">
              <button class="btn-ctrl-outline" onclick="window.InurumApp.openResetPasswordModal('${user.id}')" title="Reset Password" style="padding:4px 6px;font-size:11px;">
                🔑
              </button>
              <button class="btn-ctrl-outline" onclick="window.InurumApp.toggleUserStatus('${user.id}')" style="padding:4px 6px;font-size:11px;color:${isInactive ? '#10b981' : '#b91c1c'};">
                ${isInactive ? 'Activate' : 'Deactivate'}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  async function handleToggleUserStatus(userId) {
    try {
      const res = await FleetApi.toggleUserStatus(userId);
      showToast(res.message || 'User status updated', 'success');
      await loadAdminUsers();
    } catch (err) {
      showToast(err.message || 'Failed to toggle user status', 'danger');
    }
  }

  function openVehicleScopeModal(userId) {
    const user = adminUsersCache.find(u => u.id === userId);
    if (!user) return;
    const inputId = document.getElementById('scopeUserId');
    const subtitle = document.getElementById('vehicleScopeSubtitle');
    const container = document.getElementById('vehicleScopeChecklist');
    if (inputId) inputId.value = userId;
    if (subtitle) subtitle.textContent = `User: ${user.name} (${user.email})`;

    const tenantVehicles = state.vehicles.filter(v => user.tenantId === 'PLATFORM' || v.tenantId === user.tenantId);
    const userAllowed = new Set(user.allowedVehicles || []);

    if (container) {
      if (tenantVehicles.length === 0) {
        container.innerHTML = '<div style="font-size:11px;color:var(--text-muted);">No vehicles configured in this tenant.</div>';
      } else {
        container.innerHTML = tenantVehicles.map(v => {
          const isChecked = userAllowed.has(v.terminalId);
          return `
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;padding:4px;border-radius:4px;">
              <input type="checkbox" value="${v.terminalId}" ${isChecked ? 'checked' : ''} class="scope-checkbox">
              <span style="font-weight:700;">${escapeHtml(v.plateNumber)}</span>
              <span style="color:var(--text-muted);font-size:11px;">(Terminal ${v.terminalId})</span>
            </label>
          `;
        }).join('');
      }
    }
    openModal('modalVehicleScope');
  }

  function openResetPasswordModal(userId) {
    const user = adminUsersCache.find(u => u.id === userId);
    if (!user) return;
    const inputId = document.getElementById('resetPasswordUserId');
    const subtitle = document.getElementById('resetPasswordSubtitle');
    if (inputId) inputId.value = userId;
    if (subtitle) subtitle.textContent = `User: ${user.name} (${user.email})`;
    const passInput = document.getElementById('inputNewPassword');
    if (passInput) passInput.value = '';
    openModal('modalResetPassword');
  }

  async function loadCostControlSettings() {
    try {
      const controls = await FleetApi.getCostControls();
      if (!controls) return;
      const elDuration = document.getElementById('costMaxStreamDuration');
      const elMinutes = document.getElementById('costMonthlyStreamMinutes');
      const elConcurrent = document.getElementById('costMaxConcurrentStreams');
      const elRoutine = document.getElementById('costVideoRetentionDays');
      const elIncident = document.getElementById('costIncidentRetentionDays');
      const elLastPurged = document.getElementById('costLastPurgedBytes');

      if (elDuration) elDuration.value = controls.maxStreamDurationSeconds || 120;
      if (elMinutes) elMinutes.value = controls.monthlyStreamingQuotaMinutes || 120;
      if (elConcurrent) elConcurrent.value = controls.maxConcurrentStreams || 2;
      if (elRoutine) elRoutine.value = controls.routineVideoRetentionDays || 7;
      if (elIncident) elIncident.value = controls.incidentVideoRetentionDays || 30;
      if (elLastPurged) elLastPurged.textContent = `${(controls.lastPurgeBytesCleaned / (1024 * 1024)).toFixed(2)} MB`;
    } catch (err) {
      console.warn('[Admin] Failed to load cost controls:', err.message);
    }
  }

  async function loadAdminAuditLogs() {
    try {
      const logs = await FleetApi.getAuditLogs(30);
      const tbody = document.getElementById('adminAuditTableBody');
      if (!tbody) return;

      if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">No audit events recorded.</td></tr>';
        return;
      }

      tbody.innerHTML = logs.map(l => {
        const timeStr = new Date(l.timestamp).toLocaleString();
        const detailsStr = l.details ? JSON.stringify(l.details) : '';
        return `
          <tr>
            <td style="font-size:11px;color:var(--text-muted);font-family:monospace;">${timeStr}</td>
            <td style="font-weight:600;font-size:12px;">${escapeHtml(l.actorId || 'system')}</td>
            <td><span style="font-size:11px;color:var(--text-muted);">${escapeHtml(l.tenantId || 'GLOBAL')}</span></td>
            <td><span class="badge-chip" style="background:#f1f5f9;color:#334155;font-weight:700;">${escapeHtml(l.action)}</span></td>
            <td style="font-family:monospace;font-size:11px;">${escapeHtml(l.resource || '-')}</td>
            <td style="font-size:11px;color:var(--text-secondary);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${escapeHtml(detailsStr)}
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.warn('[Admin] Failed to load audit logs:', err.message);
    }
  }

  function bindAdminModalEvents() {
    // Add Org Form
    const formAddOrg = document.getElementById('formAddOrg');
    if (formAddOrg) {
      formAddOrg.onsubmit = async (e) => {
        e.preventDefault();
        try {
          const name = document.getElementById('inputOrgName').value.trim();
          const code = document.getElementById('inputOrgCode').value.trim().toUpperCase();
          const plan = document.getElementById('selectOrgPlan').value;
          const contactEmail = document.getElementById('inputOrgEmail').value.trim();
          await FleetApi.createOrganization({ name, code, plan, contactEmail });
          closeModal('modalAddOrg');
          showToast(`Organization ${name} provisioned successfully!`, 'success');
          formAddOrg.reset();
          await loadSaasMetricsAndOrgs();
        } catch (err) {
          showToast(err.message || 'Failed to create organization', 'danger');
        }
      };
    }

    // Invite User Form
    const formInviteUser = document.getElementById('formInviteUser');
    if (formInviteUser) {
      formInviteUser.onsubmit = async (e) => {
        e.preventDefault();
        try {
          const name = document.getElementById('inputUserName').value.trim();
          const email = document.getElementById('inputUserEmail').value.trim();
          const tenantId = document.getElementById('selectUserTenant').value;
          const role = document.getElementById('selectUserRole').value;
          const password = document.getElementById('inputUserPassword').value;

          await FleetApi.inviteUser({ name, email, tenantId, role, password });
          closeModal('modalInviteUser');
          showToast(`User ${name} invited successfully!`, 'success');
          formInviteUser.reset();
          await loadAdminUsers();
        } catch (err) {
          showToast(err.message || 'Failed to invite user', 'danger');
        }
      };
    }

    // Save Vehicle Scope
    const btnSaveScope = document.getElementById('btnSaveVehicleScope');
    if (btnSaveScope) {
      btnSaveScope.onclick = async () => {
        try {
          const userId = document.getElementById('scopeUserId').value;
          const checked = Array.from(document.querySelectorAll('.scope-checkbox:checked')).map(cb => cb.value);
          await FleetApi.setUserVehicleAccess(userId, checked);
          closeModal('modalVehicleScope');
          showToast(`Vehicle access permissions updated (${checked.length} vehicles assigned).`, 'success');
          await loadAdminUsers();
        } catch (err) {
          showToast(err.message || 'Failed to update vehicle permissions', 'danger');
        }
      };
    }

    // Reset Password Form
    const formResetPassword = document.getElementById('formResetPassword');
    if (formResetPassword) {
      formResetPassword.onsubmit = async (e) => {
        e.preventDefault();
        try {
          const userId = document.getElementById('resetPasswordUserId').value;
          const newPassword = document.getElementById('inputNewPassword').value;
          await FleetApi.resetUserPassword(userId, newPassword);
          closeModal('modalResetPassword');
          showToast('User password reset successfully.', 'success');
        } catch (err) {
          showToast(err.message || 'Failed to reset password', 'danger');
        }
      };
    }

    // Cost Controls Form
    const formCost = document.getElementById('formCostControls');
    if (formCost) {
      formCost.onsubmit = async (e) => {
        e.preventDefault();
        try {
          const updates = {
            maxStreamDurationSeconds: parseInt(document.getElementById('costMaxStreamDuration').value, 10),
            monthlyStreamingQuotaMinutes: parseInt(document.getElementById('costMonthlyStreamMinutes').value, 10),
            maxConcurrentStreams: parseInt(document.getElementById('costMaxConcurrentStreams').value, 10),
            routineVideoRetentionDays: parseInt(document.getElementById('costVideoRetentionDays').value, 10),
            incidentVideoRetentionDays: parseInt(document.getElementById('costIncidentRetentionDays').value, 10)
          };
          await FleetApi.updateCostControls(updates);
          showToast('Cost control limits saved successfully!', 'success');
        } catch (err) {
          showToast(err.message || 'Failed to update cost limits', 'danger');
        }
      };
    }

    // Media Cleanup Button
    const btnCleanup = document.getElementById('btnRunMediaCleanup');
    if (btnCleanup) {
      btnCleanup.onclick = async () => {
        const feedback = document.getElementById('cleanupStatusFeedback');
        try {
          if (feedback) feedback.textContent = 'Running media purge on local video storage...';
          const res = await FleetApi.cleanupExpiredMedia();
          const cleanedMb = (res.result.cleanedBytes / (1024 * 1024)).toFixed(2);
          showToast(`Media cleanup complete: ${cleanedMb} MB freed across ${res.result.cleanedFilesCount} files.`, 'success');
          if (feedback) feedback.textContent = `Last purge cleaned ${cleanedMb} MB (${res.result.cleanedFilesCount} files).`;
          await loadCostControlSettings();
        } catch (err) {
          showToast(err.message || 'Media cleanup failed', 'danger');
          if (feedback) feedback.textContent = 'Cleanup failed.';
        }
      };
    }

    // Modal Close Buttons
    ['AddOrg', 'InviteUser', 'VehicleScope', 'ResetPassword'].forEach(m => {
      const btnClose = document.getElementById(`btnClose${m}Modal`);
      const btnCancel = document.getElementById(`btnCancel${m}`);
      if (btnClose) btnClose.onclick = () => closeModal(`modal${m}`);
      if (btnCancel) btnCancel.onclick = () => closeModal(`modal${m}`);
    });
  }

  function openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.style.display = 'flex';
  }

  function closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.style.display = 'none';
  }

  // =========================================================================
  // STAGE 4: REPORTS & ANALYTICS
  // =========================================================================

  function initReports() {
    initReportFilters();
    loadReportData();
  }

  function initReportFilters() {
    const selectVeh = document.getElementById('selectReportVehicle');
    if (selectVeh && selectVeh.options.length <= 1) {
      selectVeh.innerHTML = '<option value="">All Vehicles</option>' +
        state.vehicles.map(v => `<option value="${v.terminalId}">${escapeHtml(v.plateNumber)} (${v.terminalId})</option>`).join('');
    }

    const startInput = document.getElementById('inputReportStartDate');
    const endInput = document.getElementById('inputReportEndDate');
    const now = new Date();
    const past7 = new Date(now.getTime() - 7 * 86400000);

    if (startInput && !startInput.value) {
      startInput.value = past7.toISOString().slice(0, 10);
    }
    if (endInput && !endInput.value) {
      endInput.value = now.toISOString().slice(0, 10);
    }

    const btnRun = document.getElementById('btnRunReport');
    if (btnRun) {
      btnRun.onclick = () => loadReportData();
    }

    const btnExport = document.getElementById('btnExportReportCsv');
    if (btnExport) {
      btnExport.onclick = () => exportReportCsv();
    }
  }

  async function loadReportData() {
    const type = document.getElementById('selectReportType')?.value || 'fleet_utilization';
    const terminalId = document.getElementById('selectReportVehicle')?.value || '';
    const startDate = document.getElementById('inputReportStartDate')?.value || '';
    const endDate = document.getElementById('inputReportEndDate')?.value || '';

    try {
      const summary = await FleetApi.getReportsSummary({ type, terminalId, startDate, endDate });
      renderReportSummary(type, summary);
    } catch (err) {
      showToast(err.message || 'Failed to generate report', 'danger');
    }
  }

  function renderReportSummary(type, report) {
    if (!report) return;

    // Update KPI Cards
    const kpi1Lbl = document.getElementById('reportKpi1Label');
    const kpi1Val = document.getElementById('reportKpi1Val');
    const kpi2Lbl = document.getElementById('reportKpi2Label');
    const kpi2Val = document.getElementById('reportKpi2Val');
    const kpi3Lbl = document.getElementById('reportKpi3Label');
    const kpi3Val = document.getElementById('reportKpi3Val');
    const kpi4Lbl = document.getElementById('reportKpi4Label');
    const kpi4Val = document.getElementById('reportKpi4Val');

    const tableTitle = document.getElementById('reportTableTitle');
    const tableMeta = document.getElementById('reportTableMeta');
    const thead = document.getElementById('reportTableHead');
    const tbody = document.getElementById('reportTableBody');

    if (type === 'fleet_utilization') {
      if (kpi1Lbl) kpi1Lbl.textContent = 'Active Vehicles';
      if (kpi1Val) kpi1Val.textContent = report.totalVehicles || 0;
      if (kpi2Lbl) kpi2Lbl.textContent = 'Driving Hours';
      if (kpi2Val) kpi2Val.textContent = `${(report.totalEngineHours || 0).toFixed(1)} hrs`;
      if (kpi3Lbl) kpi3Lbl.textContent = 'Distance Travelled';
      if (kpi3Val) kpi3Val.textContent = `${(report.totalDistanceKm || 0).toFixed(1)} km`;
      if (kpi4Lbl) kpi4Lbl.textContent = 'Fleet Score';
      if (kpi4Val) kpi4Val.textContent = report.fleetScore != null ? `${report.fleetScore} / 100` : 'Not Available';

      if (tableTitle) tableTitle.textContent = 'FLEET UTILIZATION & DRIVING ACTIVITY';
      if (tableMeta) tableMeta.textContent = `Generated: ${new Date().toLocaleDateString()}`;
      if (thead) thead.innerHTML = '<tr><th>Date</th><th>Vehicle</th><th>Engine Hours</th><th>Idle Hours</th><th>Distance</th><th>Max Speed</th></tr>';
      if (tbody) {
        tbody.innerHTML = (report.records || []).map(r => `
          <tr>
            <td>${r.date}</td>
            <td style="font-weight:700;">${escapeHtml(r.plateNumber)}</td>
            <td>${(r.engineHours || 0).toFixed(1)} hrs</td>
            <td>${r.idleHours != null ? r.idleHours.toFixed(1) + ' hrs' : 'Not Available'}</td>
            <td>${(r.distanceKm || 0).toFixed(1)} km</td>
            <td>${r.maxSpeedKmH || 0} km/h</td>
          </tr>
        `).join('');
      }
    } else if (type === 'vehicle_activity') {
      if (kpi1Lbl) kpi1Lbl.textContent = 'Tracked Fleet';
      if (kpi1Val) kpi1Val.textContent = report.totalVehicles || 0;
      if (kpi2Lbl) kpi2Lbl.textContent = 'Total GPS Distance';
      if (kpi2Val) kpi2Val.textContent = `${(report.totalDistanceKm || 0).toFixed(1)} km`;
      if (kpi3Lbl) kpi3Lbl.textContent = 'Max Speed';
      if (kpi3Val) kpi3Val.textContent = `${report.maxSpeedRecorded || 0} km/h`;
      if (kpi4Lbl) kpi4Lbl.textContent = 'Active Trips';
      if (kpi4Val) kpi4Val.textContent = report.activeTrips || 0;

      if (tableTitle) tableTitle.textContent = 'VEHICLE ACTIVITY & MILEAGE (HAVERSINE)';
      if (thead) thead.innerHTML = '<tr><th>Vehicle</th><th>Terminal</th><th>Status</th><th>Today Odometer</th><th>Speed</th><th>Fuel Sensor</th></tr>';
      if (tbody) {
        tbody.innerHTML = (report.records || []).map(r => `
          <tr>
            <td style="font-weight:700;">${escapeHtml(r.plateNumber)}</td>
            <td style="font-family:monospace;">${r.terminalId}</td>
            <td><span class="badge-chip ${r.status === 'ONLINE' ? 'online' : 'offline'}">${r.status}</span></td>
            <td>${(r.distanceKm || 0).toFixed(1)} km</td>
            <td>${r.speed || 0} km/h</td>
            <td style="color:var(--text-muted);">${r.fuelSensor || 'Not Available'}</td>
          </tr>
        `).join('');
      }
    } else if (type === 'speeding') {
      if (kpi1Lbl) kpi1Lbl.textContent = 'Speeding Events';
      if (kpi1Val) kpi1Val.textContent = report.speedingEventsCount || 0;
      if (kpi2Lbl) kpi2Lbl.textContent = 'Max Speed Exceeded';
      if (kpi2Val) kpi2Val.textContent = `${report.maxSpeedObserved || 0} km/h`;
      if (kpi3Lbl) kpi3Lbl.textContent = 'Harsh Braking';
      if (kpi3Val) kpi3Val.textContent = report.harshBrakingCount || 0;
      if (kpi4Lbl) kpi4Lbl.textContent = 'Compliance Rate';
      if (kpi4Val) kpi4Val.textContent = report.complianceRate != null ? `${report.complianceRate}%` : 'Not Available';

      if (tableTitle) tableTitle.textContent = 'SPEEDING & CRITICAL HARSH DRIVING INCIDENTS';
      if (thead) thead.innerHTML = '<tr><th>Incident Time</th><th>Vehicle</th><th>Driver</th><th>Severity</th><th>Speed</th><th>Status</th></tr>';
      if (tbody) {
        tbody.innerHTML = (report.records || []).map(r => `
          <tr>
            <td>${new Date(r.timestamp).toLocaleString()}</td>
            <td style="font-weight:700;">${escapeHtml(r.plateNumber)}</td>
            <td>${escapeHtml(r.driverName || 'Unassigned')}</td>
            <td><span class="badge-chip" style="background:#fee2e2;color:#b91c1c;">${r.severity}</span></td>
            <td style="color:var(--color-danger);font-weight:700;">${r.speed != null ? r.speed + ' km/h' : '—'}</td>
            <td>${r.coached ? 'Coached' : 'Pending Review'}</td>
          </tr>
        `).join('');
      }
    } else if (type === 'safety_trends') {
      if (kpi1Lbl) kpi1Lbl.textContent = 'Total Incidents';
      if (kpi1Val) kpi1Val.textContent = report.totalIncidents || 0;
      if (kpi2Lbl) kpi2Lbl.textContent = 'Critical Incidents';
      if (kpi2Val) kpi2Val.textContent = report.criticalIncidents || 0;
      if (kpi3Lbl) kpi3Lbl.textContent = 'Coached %';
      if (kpi3Val) kpi3Val.textContent = `${report.coachedPercentage || 0}%`;
      if (kpi4Lbl) kpi4Lbl.textContent = 'Triage Queue';
      if (kpi4Val) kpi4Val.textContent = `${report.pendingTriage || 0} pending`;

      if (tableTitle) tableTitle.textContent = 'SAFETY INCIDENT TRENDS & DRIVER COACHING';
      if (thead) thead.innerHTML = '<tr><th>Date</th><th>Type</th><th>Vehicle</th><th>Driver</th><th>Category</th><th>Coached By</th></tr>';
      if (tbody) {
        tbody.innerHTML = (report.records || []).map(r => `
          <tr>
            <td>${new Date(r.timestamp).toLocaleDateString()}</td>
            <td style="font-weight:600;">${escapeHtml(r.type)}</td>
            <td>${escapeHtml(r.plateNumber)}</td>
            <td>${escapeHtml(r.driverName || 'Unassigned')}</td>
            <td>${escapeHtml(r.coachingCategory || 'Pending')}</td>
            <td>${escapeHtml(r.coachedBy || 'Pending')}</td>
          </tr>
        `).join('');
      }
    } else if (type === 'device_connectivity') {
      if (kpi1Lbl) kpi1Lbl.textContent = 'Online Terminals';
      if (kpi1Val) kpi1Val.textContent = report.onlineTerminals || 0;
      if (kpi2Lbl) kpi2Lbl.textContent = 'Offline Terminals';
      if (kpi2Val) kpi2Val.textContent = report.offlineTerminals || 0;
      if (kpi3Lbl) kpi3Lbl.textContent = 'TCP Socket Status';
      if (kpi3Val) kpi3Val.textContent = report.socketStatus || 'Unknown';
      if (kpi4Lbl) kpi4Lbl.textContent = 'Fleet Availability';
      if (kpi4Val) kpi4Val.textContent = report.availabilityRate != null ? `${report.availabilityRate}%` : 'No cameras';

      if (tableTitle) tableTitle.textContent = 'DEVICE CONNECTIVITY & TCP SESSION HEALTH';
      if (thead) thead.innerHTML = '<tr><th>Terminal IMEI</th><th>Vehicle</th><th>Status</th><th>Last Ping</th><th>IP Address</th><th>Port</th></tr>';
      if (tbody) {
        tbody.innerHTML = (report.records || []).map(r => `
          <tr>
            <td style="font-family:monospace;font-weight:700;">${r.terminalId}</td>
            <td>${escapeHtml(r.plateNumber)}</td>
            <td><span class="badge-chip ${r.status === 'ONLINE' ? 'online' : 'offline'}">${r.status}</span></td>
            <td>${r.lastHeartbeat ? new Date(r.lastHeartbeat).toLocaleString() : 'Never'}</td>
            <td>${r.remoteIp || 'Not Available'}</td>
            <td>${r.remotePort || 'Not Available'}</td>
          </tr>
        `).join('');
      }
    } else if (type === 'storage_usage') {
      if (kpi1Lbl) kpi1Lbl.textContent = 'Storage Consumed';
      if (kpi1Val) kpi1Val.textContent = `${report.totalStorageGb || 0} GB`;
      if (kpi2Lbl) kpi2Lbl.textContent = 'Streaming Quota Used';
      if (kpi2Val) kpi2Val.textContent = `${report.streamingMinutesUsed || 0} min`;
      if (kpi3Lbl) kpi3Lbl.textContent = 'Peak Concurrent';
      if (kpi3Val) kpi3Val.textContent = report.peakConcurrentStreams != null ? report.peakConcurrentStreams : 'Not Available';
      if (kpi4Lbl) kpi4Lbl.textContent = 'Budget Target';
      if (kpi4Val) kpi4Val.textContent = '₹500 / veh / yr';

      if (tableTitle) tableTitle.textContent = 'STORAGE UTILIZATION & STREAMING QUOTA BREAKDOWN';
      if (thead) thead.innerHTML = '<tr><th>Tenant</th><th>Storage Consumed</th><th>Storage Quota</th><th>Stream Used</th><th>Stream Quota</th><th>Status</th></tr>';
      if (tbody) {
        tbody.innerHTML = (report.records || []).map(r => `
          <tr>
            <td style="font-weight:700;">${escapeHtml(r.tenantName)}</td>
            <td>${r.storageUsedGb} GB</td>
            <td>${r.storageQuotaGb} GB</td>
            <td>${r.streamingMinutesUsed} min</td>
            <td>${r.streamingQuotaMinutes} min</td>
            <td>${r.streamingMinutesUsed < r.streamingQuotaMinutes
              ? '<span class="badge-chip online">WITHIN QUOTA</span>'
              : '<span class="badge-chip offline">QUOTA USED UP</span>'}</td>
          </tr>
        `).join('');
      }
    }
  }

  async function exportReportCsv() {
    const type = document.getElementById('selectReportType')?.value || 'fleet_utilization';
    const terminalId = document.getElementById('selectReportVehicle')?.value || '';
    const startDate = document.getElementById('inputReportStartDate')?.value || '';
    const endDate = document.getElementById('inputReportEndDate')?.value || '';

    const query = new URLSearchParams({ type, terminalId, startDate, endDate }).toString();
    const url = `/api/v1/reports/export-csv?${query}`;

    try {
      showToast('Generating authorized CSV export...', 'info');
      const response = await fetch(url, {
        headers: FleetApi.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`CSV Export failed: HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `report_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      showToast('CSV export downloaded successfully.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to export CSV', 'danger');
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Global Namespace Hook for Map & Table Callbacks ───────────────────
  window.InurumApp = {
    selectVehicle,
    streamFromMap: (vehicleId) => {
      selectVehicle(vehicleId);
      navigateTo('live');
      startLiveStreaming();
    },
    reviewIncident: (eventId) => {
      openIncidentDetailView(eventId);
    },
    openIncidentDetail: (eventId) => {
      openIncidentDetailView(eventId);
    },
    dismissSafetyEvent: (eventId, e) => {
      if (e) e.stopPropagation();
      const inc = (state.safetyIncidents || []).find(i => (i.id || i.incident_id) === eventId);
      if (inc) {
        inc.triageStatus = 'DISMISSED';
        inc.status = 'DISMISSED';
      }
      renderSamsaraSafetyCards(state.safetyIncidents || []);
      showToast('Safety event dismissed.', 'info');
    },
    toggleStarEvent: (eventId, e) => {
      if (e) e.stopPropagation();
      const inc = (state.safetyIncidents || []).find(i => (i.id || i.incident_id) === eventId);
      if (inc) {
        inc.starred = !inc.starred;
      }
      renderSamsaraSafetyCards(state.safetyIncidents || []);
    },
    openVideoRetrieval: (vehicleId, date, time) => {
      openVideoRetrievalModal(vehicleId, date, time);
    },
    closeVideoRetrieval: () => {
      closeVideoRetrievalModal();
    },
    playRecording: (recordingId) => {
      openVideoRetrievalModal(state.vcSelectedVehicleId);
    },
    requestRetrievalForClip: (clipId) => {
      openVideoRetrievalModal(state.vcSelectedVehicleId);
    },
    openVehicleProfile: (vehicleId) => openVehicleProfileDrawer(vehicleId),
    openVehicleEdit: (vehicleId) => openVehicleEditModal(vehicleId),
    openPairDevice: (vehicleId) => openPairDeviceModal(vehicleId),
    unpairVehicleDevice: (vehicleId) => handleUnpairDevice(vehicleId),
    toggleVehicleStatus: (vehicleId) => handleToggleVehicleStatus(vehicleId),
    seekTripTo: (idx) => seekTripPlayback(idx),
    toggleOrgStatus: (tenantId) => handleToggleOrgStatus(tenantId),
    toggleUserStatus: (userId) => handleToggleUserStatus(userId),
    openVehicleScopeModal: (userId) => openVehicleScopeModal(userId),
    openResetPasswordModal: (userId) => openResetPasswordModal(userId)
  };

})();

