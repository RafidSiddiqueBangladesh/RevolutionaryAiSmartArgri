import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const DeviceManager = ({ user }) => {
  const [devices, setDevices] = useState([]);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkForm, setLinkForm] = useState({
    apiKey: '',
    deviceName: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await api.get('/device/my-devices');
      setDevices(response.data.devices || []);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    }
  };

  const handleLinkDevice = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.post('/device/link', linkForm);

      setSuccess('Device linked successfully!');
      setLinkForm({ apiKey: '', deviceName: '' });
      setShowLinkForm(false);
      fetchDevices();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to link device');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkDevice = async (deviceId) => {
    if (!confirm('Are you sure you want to unlink this device?')) return;

    try {
      await api.delete(`/device/${deviceId}/unlink`);
      
      setSuccess('Device unlinked successfully!');
      fetchDevices();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to unlink device');
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Online': return 'status-online';
      case 'Recently Active': return 'status-recently-active';
      case 'Offline': return 'status-offline';
      default: return 'status-unknown';
    }
  };

  const has = (v) => v !== null && v !== undefined;
  const fmt = (v, suffix = '') => (has(v) ? `${v}${suffix}` : '—');

  // Load per-farmer optimal settings
  const [optimal, setOptimal] = useState(null);
  useEffect(() => {
    const loadOptimal = async () => {
      try {
        const res = await api.get('/device/optimal-settings');
        if (res?.data?.data?.optimal_json) setOptimal(res.data.data.optimal_json);
      } catch (e) {
        // ignore
      }
    };
    loadOptimal();
  }, []);

  // ----- Visualization helpers (defaults; overridden by saved optimal if present) -----
  const fallbackRanges = {
    moisture: { min: 0, max: 100, optimal: [45, 65], unit: '%', label: 'Moisture' },
    ph: { min: 0, max: 14, optimal: [6.0, 7.5], unit: '', label: 'pH Level' },
    temperature: { min: 0, max: 50, optimal: [18, 30], unit: '°C', label: 'Temperature' },
    humidity: { min: 0, max: 100, optimal: [40, 70], unit: '%', label: 'Humidity' },
    light: { min: 0, max: 2000, optimal: [300, 800], unit: ' lux', label: 'Light' },
    conductivity: { min: 0, max: 1000, optimal: [200, 400], unit: ' μS/cm', label: 'Conductivity' },
    n: { min: 0, max: 100, optimal: [30, 50], unit: ' ppm', label: 'N' },
    p: { min: 0, max: 80, optimal: [15, 35], unit: ' ppm', label: 'P' },
    k: { min: 0, max: 100, optimal: [30, 60], unit: ' ppm', label: 'K' }
  };

  const computeRanges = (opt) => {
    if (!opt) return fallbackRanges;
    const map = (key, def) => opt[key]
      ? { min: opt[key].min, max: opt[key].max, optimal: [opt[key].optimalMin, opt[key].optimalMax], unit: def.unit, label: def.label }
      : def;
    return {
      moisture: map('moisture', fallbackRanges.moisture),
      ph: map('ph', fallbackRanges.ph),
      temperature: map('temperature', fallbackRanges.temperature),
      humidity: map('humidity', fallbackRanges.humidity),
      light: map('light', fallbackRanges.light),
      conductivity: map('conductivity', fallbackRanges.conductivity),
      n: map('n', fallbackRanges.n),
      p: map('p', fallbackRanges.p),
      k: map('k', fallbackRanges.k)
    };
  };

  const ranges = computeRanges(optimal);

  // ======== Optimal History (for graphs) ========
  const [history, setHistory] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [graphCols, setGraphCols] = useState(3);
  const [range, setRange] = useState('1d'); // 1h,1d,1w,1m,1y,all

  // when devices load, pick first device for history
  useEffect(() => {
    if (devices && devices.length > 0) {
      const firstId = devices[0].device_id || devices[0].id;
      setSelectedDeviceId(firstId || null);
    }
  }, [devices]);

  // fetch sensor history for selected device
  useEffect(() => {
    const loadSensorHistory = async () => {
      if (!selectedDeviceId) return;
      try {
        const q = range === 'all' ? '' : `&range=${encodeURIComponent(range)}`;
        const res = await api.get(`/device/sensor-history?deviceId=${selectedDeviceId}&limit=200${q}`);
        setHistory(Array.isArray(res?.data?.data) ? res.data.data : []);
      } catch (e) {
        setHistory([]);
      }
    };
    loadSensorHistory();
  }, [selectedDeviceId, range]);

  // responsive column count for graphs
  useEffect(() => {
    const updateCols = () => {
      const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
      if (w < 640) setGraphCols(1);        // mobile
      else if (w < 1024) setGraphCols(2);  // tablet
      else setGraphCols(3);                // desktop
    };
    updateCols();
    window.addEventListener('resize', updateCols);
    return () => window.removeEventListener('resize', updateCols);
  }, []);

  const clamp = (v, min, max) => Math.max(min, Math.min(max, Number(v)));

  const getStatus = (value, [optMin, optMax], min, max) => {
    if (value === null || value === undefined || isNaN(value)) return { text: '—', color: '#9ca3af' };
    const inOptimal = value >= optMin && value <= optMax;
    if (inOptimal) return { text: 'Optimal', color: '#10b981' };
    const range = max - min || 1;
    const distance = value < optMin ? (optMin - value) : (value - optMax);
    const ratio = distance / range; // normalized distance from optimal band
    if (ratio <= 0.08) return { text: 'Near optimal', color: '#10b981' }; // close = still green
    if (ratio <= 0.20) return { text: 'Moderate', color: '#f59e0b' }; // mid = yellow
    return { text: 'Far', color: '#ef4444' }; // far = red
  };

  const Meter = ({ value, config }) => {
    const v = clamp(value, config.min, config.max);
    const pct = ((v - config.min) / (config.max - config.min)) * 100;
    const [optMin, optMax] = config.optimal;
    const optStart = ((optMin - config.min) / (config.max - config.min)) * 100;
    const optWidth = ((optMax - optMin) / (config.max - config.min)) * 100;
    const status = getStatus(v, config.optimal, config.min, config.max);
    return (
      <div className="meter">
        <div className="meter-bar" style={{ position: 'relative', height: 10, background: '#e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
          {/* Base filled value */}
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: status.color, borderRadius: 6, zIndex: 1 }}></div>
          {/* Optimal band overlay above main fill with high-contrast stroke */}
          <div
            style={{
              position: 'absolute',
              left: `${optStart}%`,
              width: `${optWidth}%`,
              top: -1,
              bottom: -1,
              borderRadius: 6,
              zIndex: 2,
              pointerEvents: 'none',
              border: '2px solid rgba(255,255,255,0.95)',
              boxShadow: '0 0 0 1px rgba(16,185,129,0.6), inset 0 0 0 9999px rgba(16,185,129,0.15)'
            }}
          ></div>
        </div>
        <div className="meter-legend" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginTop: 4 }}>
          <span>{config.min}</span>
          <span>opt {optMin}-{optMax}</span>
          <span>{config.max}</span>
        </div>
        <div className="meter-status" style={{ marginTop: 4, fontSize: 12, color: status.color }}>
          {status.text}
        </div>
      </div>
    );
  };

  // Small inline SVG graph for optimal band over time
  const paramsOrder = ['moisture','ph','temperature','humidity','light','conductivity','n','p','k'];
  const buildSeries = (key) => {
    const r = ranges[key];
    // Use sensor_data_history rows when available (mapped in backend). Expect fields by names below
    const mapKey = {
      moisture: 'moisture_level',
      ph: 'ph_level',
      temperature: 'temperature',
      humidity: 'humidity',
      light: 'light_intensity',
      conductivity: 'soil_conductivity',
      n: 'nitrogen_level',
      p: 'phosphorus_level',
      k: 'potassium_level'
    }[key];

    // Fallback to optimal history if sensor history is not yet wired; try both
    let points = [];
    if (history && history.length && history[0].optimal_json) {
      points = history
        .map(h => ({ t: new Date(h.created_at).getTime(), vmin: h.optimal_json?.[key]?.optimalMin, vmax: h.optimal_json?.[key]?.optimalMax }))
        .filter(p => typeof p.vmin === 'number' && typeof p.vmax === 'number');
    } else {
      points = (history || [])
        .map(h => ({ t: new Date(h.recorded_at || h.created_at).getTime(), val: Number(h[mapKey]) }))
        .filter(p => !Number.isNaN(p.val));
    }

    // If we have direct values, render a single line (use lower=upper) else render band
    const isSingle = points.length && points[0].val !== undefined;
    if (isSingle) {
      const xs = points.map(p => p.t);
      const minT = Math.min(...xs);
      const maxT = Math.max(...xs);
      const spanT = Math.max(1, maxT - minT);
      const width = 300;
      const height = 72;
      // dynamic y-scale based on data with small padding
      const dataMin = Math.min(...points.map(p => p.val));
      const dataMax = Math.max(...points.map(p => p.val));
      const pad = (dataMax - dataMin) * 0.1 || 1; // 10% or 1 unit
      const yMin = Math.max(r.min, dataMin - pad);
      const yMax = Math.min(r.max, dataMax + pad);
      const yRange = Math.max(1e-6, yMax - yMin);
      const y = (val) => {
        const cl = clamp(val, yMin, yMax);
        const pct = (cl - yMin) / yRange;
        return height - pct * height;
      };
      const x = (t) => ((t - minT) / spanT) * width;
      const line = points.map(p => `${x(p.t)},${y(p.val)}`).join(' ');
      return { width, height, lower: line, upper: line, axis: { vmin: yMin, vmax: yMax, minT, maxT }, isSingle: true };
    }

    if (points.length < 2) return null;
    const xs = points.map(p => p.t);
    const minT = Math.min(...xs);
    const maxT = Math.max(...xs);
    const spanT = Math.max(1, maxT - minT);
    const width = 300;
    const height = 72;
    // dynamic y-scale based on band values
    const dataMin = Math.min(...points.map(p => Math.min(p.vmin, p.vmax)));
    const dataMax = Math.max(...points.map(p => Math.max(p.vmin, p.vmax)));
    const pad = (dataMax - dataMin) * 0.1 || 1;
    const yMin = Math.max(r.min, dataMin - pad);
    const yMax = Math.min(r.max, dataMax + pad);
    const yRange = Math.max(1e-6, yMax - yMin);
    const y = (val) => {
      const cl = clamp(val, yMin, yMax);
      const pct = (cl - yMin) / yRange;
      return height - pct * height;
    };
    const x = (t) => ((t - minT) / spanT) * width;
    const lower = points.map(p => `${x(p.t)},${y(p.vmin)}`).join(' ');
    const upper = points.map(p => `${x(p.t)},${y(p.vmax)}`).join(' ');
    return { width, height, lower, upper, axis: { vmin: yMin, vmax: yMax, minT, maxT }, isSingle: false };
  };

  return (
    <div className="device-manager">
      <div className="device-header">
        <h3>My IoT Devices</h3>
        <button 
          onClick={() => setShowLinkForm(!showLinkForm)}
          className="btn-add-device"
        >
          {showLinkForm ? 'Cancel' : '+ Add Device'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {showLinkForm && (
        <div className="link-device-form">
          <h4>Link New Device</h4>
          <form onSubmit={handleLinkDevice}>
            <div className="form-group">
              <label htmlFor="apiKey">Device API Key</label>
              <input
                type="text"
                id="apiKey"
                value={linkForm.apiKey}
                onChange={(e) => setLinkForm({...linkForm, apiKey: e.target.value})}
                placeholder="Enter 32-character API key"
                maxLength="32"
                required
              />
              <small>Find this key on your ESP32 device or documentation</small>
            </div>
            <div className="form-group">
              <label htmlFor="deviceName">Device Name (Optional)</label>
              <input
                type="text"
                id="deviceName"
                value={linkForm.deviceName}
                onChange={(e) => setLinkForm({...linkForm, deviceName: e.target.value})}
                placeholder="e.g., Field A Sensor, Main Farm Monitor"
              />
            </div>
            <button type="submit" disabled={loading} className="btn">
              {loading ? 'Linking...' : 'Link Device'}
            </button>
          </form>
        </div>
      )}

      <div className="devices-grid">
        {devices.length === 0 ? (
          <div className="no-devices">
            <p>No devices linked yet</p>
            <p>Click "Add Device" to link your first IoT sensor</p>
          </div>
        ) : (
          devices.map(device => (
            <div key={device.device_id || device.id || device.device_api_key} className="device-card">
              <div className="device-info">
                <h4>{device.device_name}</h4>
                <div className="device-details">
                  <span className="api-key">
                    API: {device.device_api_key.substring(0, 8)}...
                  </span>
                  <span
                    className={`device-status ${getStatusClass(device.status)}`}
                  >
                    ● {device.status}
                  </span>
                </div>
                {device.last_seen && (
                  <div className="last-seen">
                    Last seen: {new Date(device.last_seen).toLocaleString()}
                  </div>
                )}
                
                {/* Sensor Data Display */}
                <div className="sensor-data">
                  <h5>Current Readings</h5>
                <div className="sensor-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${graphCols}, minmax(0, 1fr))`,
                  gap: 12
                }}>
                  {/* Moisture */}
                  <div className="sensor-item">
                    <span className="sensor-label">{ranges.moisture.label}</span>
                    <span className="sensor-value">{fmt(device.moisture_level, ranges.moisture.unit)}</span>
                    <Meter value={device.moisture_level} config={ranges.moisture} />
                  </div>
                  {/* pH */}
                  <div className="sensor-item">
                    <span className="sensor-label">{ranges.ph.label}</span>
                    <span className="sensor-value">{fmt(device.ph_level, ranges.ph.unit)}</span>
                    <Meter value={device.ph_level} config={ranges.ph} />
                  </div>
                  {/* Temperature */}
                  <div className="sensor-item">
                    <span className="sensor-label">{ranges.temperature.label}</span>
                    <span className="sensor-value">{fmt(device.temperature, ranges.temperature.unit)}</span>
                    <Meter value={device.temperature} config={ranges.temperature} />
                  </div>
                  {/* Humidity */}
                  <div className="sensor-item">
                    <span className="sensor-label">{ranges.humidity.label}</span>
                    <span className="sensor-value">{fmt(device.humidity, ranges.humidity.unit)}</span>
                    <Meter value={device.humidity} config={ranges.humidity} />
                  </div>
                  {/* Light */}
                  <div className="sensor-item">
                    <span className="sensor-label">{ranges.light.label}</span>
                    <span className="sensor-value">{fmt(device.light_intensity, ranges.light.unit)}</span>
                    <Meter value={device.light_intensity} config={ranges.light} />
                  </div>
                  {/* Conductivity */}
                  <div className="sensor-item">
                    <span className="sensor-label">{ranges.conductivity.label}</span>
                    <span className="sensor-value">{fmt(device.soil_conductivity, ranges.conductivity.unit)}</span>
                    <Meter value={device.soil_conductivity} config={ranges.conductivity} />
                  </div>
                  {/* N */}
                  <div className="sensor-item">
                    <span className="sensor-label">{ranges.n.label}</span>
                    <span className="sensor-value">{fmt(device.nitrogen_level, ranges.n.unit)}</span>
                    <Meter value={device.nitrogen_level} config={ranges.n} />
                  </div>
                  {/* P */}
                  <div className="sensor-item">
                    <span className="sensor-label">{ranges.p.label}</span>
                    <span className="sensor-value">{fmt(device.phosphorus_level, ranges.p.unit)}</span>
                    <Meter value={device.phosphorus_level} config={ranges.p} />
                  </div>
                  {/* K */}
                  <div className="sensor-item">
                    <span className="sensor-label">{ranges.k.label}</span>
                    <span className="sensor-value">{fmt(device.potassium_level, ranges.k.unit)}</span>
                    <Meter value={device.potassium_level} config={ranges.k} />
                  </div>
                </div>
                  {device.sensor_last_updated ? (
                    <div className="sensor-updated">
                      Data updated: {new Date(device.sensor_last_updated).toLocaleString()}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="device-actions">
                <button 
                  onClick={() => handleUnlinkDevice(device.device_id)}
                  className="btn-unlink"
                >
                  Unlink
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Sensor Data History Graphs */}
      <div className="device-card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h4 style={{ margin: 0 }}>Sensor Data History {selectedDeviceId ? `(Device ${String(selectedDeviceId).slice(0,8)}…)` : ''}</h4>
          <div>
            <select value={range} onChange={(e) => setRange(e.target.value)} style={{ padding: '4px 8px' }}>
              <option value="1h">Last 1 hour</option>
              <option value="1d">Last day</option>
              <option value="1w">Last week</option>
              <option value="1m">Last month</option>
              <option value="1y">Last year</option>
              <option value="all">All time</option>
            </select>
          </div>
        </div>
        <div className="graph-grid" style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${graphCols}, minmax(0, 1fr))`,
          gap: 12
        }}>
          {paramsOrder.map(k => {
            const s = buildSeries(k);
            return (
              <div key={k} className="graph-item" style={{ background: 'transparent' }}>
                <div className="graph-label">{ranges[k].label}</div>
                {s ? (
                  <svg width={s.width + 36} height={s.height + 26}>
                    {/* Y-axis labels */}
                    <text x={0} y={12} fontSize="10" fill="#6b7280">{Math.round(s.axis.vmax * 100) / 100}</text>
                    <text x={0} y={s.height/2 + 12} fontSize="10" fill="#9ca3af">{Math.round(((s.axis.vmin + s.axis.vmax)/2) * 100) / 100}</text>
                    <text x={0} y={s.height + 12} fontSize="10" fill="#6b7280">{Math.round(s.axis.vmin * 100) / 100}</text>

                    {/* Plot area background */}
                    <g transform="translate(36,4)">
                      <rect x={0} y={0} width={s.width} height={s.height} rx={6} fill="#f8fafc" />
                      {/* Gridlines */}
                      <line x1={0} y1={0} x2={s.width} y2={0} stroke="#e5e7eb" strokeWidth="1" />
                      <line x1={0} y1={s.height/2} x2={s.width} y2={s.height/2} stroke="#eef2f7" strokeWidth="1" />
                      <line x1={0} y1={s.height} x2={s.width} y2={s.height} stroke="#e5e7eb" strokeWidth="1" />
                      {/* Series */}
                      <polyline points={s.lower} fill="none" stroke="#22c55e" strokeWidth="2" />
                      {!s.isSingle && <polyline points={s.upper} fill="none" stroke="#16a34a" strokeWidth="2" />}
                    </g>

                    {/* X-axis labels */}
                    <text x={36} y={s.height + 22} fontSize="10" fill="#6b7280">
                      {new Date(s.axis.minT).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </text>
                    <text x={36 + s.width - 36} y={s.height + 22} fontSize="10" fill="#6b7280" textAnchor="end">
                      {new Date(s.axis.maxT).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </text>
                  </svg>
                ) : (
                  <div className="graph-empty">Not enough history</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DeviceManager;
