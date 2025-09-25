import React, { useEffect, useMemo, useState } from 'react';
import { Card, Input, Select, Pagination, Badge, Empty, Spin, Button } from 'antd';
import { adminService } from '../../services/adminService';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const { Search } = Input;

const AdminDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [total, setTotal] = useState(0);

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [district, setDistrict] = useState('');
  const [crop, setCrop] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const res = await adminService.getFarmers({ page, limit, name, mobile, district, crop });
      const data = res?.data || {};
      setItems(data.items || []);
      setTotal(data.pagination?.total || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  const onSearch = () => {
    setPage(1);
    load();
  };

  const [running, setRunning] = useState(false);
  const analyzeAll = async () => {
    try {
      setRunning(true);
      const res = await adminService.analyzeOptimalForAll();
      // Simple toast-like feedback using alert for now
      alert(`Processed ${res.processed}/${res.total} farmers`);
    } catch (e) {
      alert('Failed to run optimal analysis.');
    } finally {
      setRunning(false);
    }
  };

  // Graphs: time range and histories per farmer device (first device)
  const [range, setRange] = useState('1d');
  const [graphData, setGraphData] = useState({}); // key: userId -> history rows
  const [graphCols, setGraphCols] = useState(3);
  const [collapsed, setCollapsed] = useState({}); // userId -> boolean

  useEffect(() => {
    const updateCols = () => {
      const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
      if (w < 640) setGraphCols(1);
      else if (w < 1024) setGraphCols(2);
      else setGraphCols(3);
    };
    updateCols();
    window.addEventListener('resize', updateCols);
    return () => window.removeEventListener('resize', updateCols);
  }, []);

  // fetch histories when items or range changes
  useEffect(() => {
    const fetchAll = async () => {
      const out = {};
      const q = range === 'all' ? '' : `&range=${encodeURIComponent(range)}`;
      for (const f of items) {
        if (!f.device?.id) continue;
        try {
          const res = await api.get(`/device/sensor-history?deviceId=${f.device.id}&limit=200${q}`);
          out[f.id] = Array.isArray(res?.data?.data) ? res.data.data : [];
        } catch (e) {
          out[f.id] = [];
        }
      }
      setGraphData(out);
    };
    if (items.length) fetchAll();
  }, [items, range]);

  // minimal sparkline builder (same approach as farmer view)
  const buildSeries = (historyRows, key, r) => {
    const mapKey = {
      moisture: 'moisture_level', ph: 'ph_level', temperature: 'temperature', humidity: 'humidity',
      light: 'light_intensity', conductivity: 'soil_conductivity', n: 'nitrogen_level', p: 'phosphorus_level', k: 'potassium_level'
    }[key];
    const pts = (historyRows || [])
      .map(h => ({ t: new Date(h.recorded_at || h.created_at).getTime(), val: Number(h[mapKey]) }))
      .filter(p => !Number.isNaN(p.val));
    if (pts.length < 2) return null;
    const xs = pts.map(p => p.t);
    const minT = Math.min(...xs), maxT = Math.max(...xs), spanT = Math.max(1, maxT - minT);
    const width = 260, height = 60;
    const dataMin = Math.min(...pts.map(p => p.val));
    const dataMax = Math.max(...pts.map(p => p.val));
    const pad = (dataMax - dataMin) * 0.1 || 1;
    const yMin = Math.max(r.min, dataMin - pad), yMax = Math.min(r.max, dataMax + pad);
    const yRange = Math.max(1e-6, yMax - yMin);
    const y = v => height - ((Math.max(yMin, Math.min(yMax, v)) - yMin) / yRange) * height;
    const x = t => ((t - minT) / spanT) * width;
    const line = pts.map(p => `${x(p.t)},${y(p.val)}`).join(' ');
    return { width, height, line, axis: { vmin: yMin, vmax: yMax, minT, maxT } };
  };

  const ranges = {
    moisture: { min: 0, max: 100, label: 'Moisture' },
    ph: { min: 0, max: 14, label: 'pH Level' },
    temperature: { min: 0, max: 50, label: 'Temperature' },
    humidity: { min: 0, max: 100, label: 'Humidity' },
    light: { min: 0, max: 2000, label: 'Light' },
    conductivity: { min: 0, max: 1000, label: 'Conductivity' },
    n: { min: 0, max: 100, label: 'N' },
    p: { min: 0, max: 80, label: 'P' },
    k: { min: 0, max: 100, label: 'K' }
  };
  const paramsOrder = ['moisture','ph','temperature','humidity','light','conductivity','n','p','k'];

  const header = useMemo(() => (
    <div className="admin-filters" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Input
        placeholder="Search name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        allowClear
        style={{ width: 220 }}
      />
      <Input
        placeholder="Mobile number"
        value={mobile}
        onChange={(e) => setMobile(e.target.value)}
        allowClear
        style={{ width: 200 }}
      />
      <Input
        placeholder="District"
        value={district}
        onChange={(e) => setDistrict(e.target.value)}
        allowClear
        style={{ width: 180 }}
      />
      <Input
        placeholder="Crop"
        value={crop}
        onChange={(e) => setCrop(e.target.value)}
        allowClear
        style={{ width: 160 }}
      />
      <Search placeholder="Apply filters" onSearch={onSearch} enterButton style={{ width: 180 }} />
    </div>
  ), [name, mobile, district, crop]);

  return (
    <div className="admin-dashboard">
      <div className="admin-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Farmers</h2>
        <Button type="primary" size="middle" onClick={analyzeAll} loading={running}>
          Analyze Optimal
        </Button>
      </div>
      <div style={{ marginTop: 12 }}>
        {header}
      </div>
      {loading ? (
        <div className="centered">
          <Spin />
        </div>
      ) : items.length === 0 ? (
        <Empty description="No farmers found" />
      ) : (
        <div className="card-list">
          {items.map((f) => (
            <Card key={f.id} className="farmer-card" title={f.fullName}>
              <div className="card-row"><strong>Mobile:</strong> {f.mobileNumber}</div>
              <div className="card-row"><strong>District:</strong> {f.district || 'N/A'}</div>
              <div className="card-row"><strong>Crop:</strong> {f.cropName || 'N/A'}</div>
              <div className="card-row"><strong>Land Size:</strong> {f.landSizeAcres ?? 'N/A'} {f.landSizeAcres ? 'acres' : ''}</div>
              {f.locationAddress && (
                <div className="card-row"><strong>Address:</strong> {f.locationAddress}</div>
              )}
              <div className="card-row">
                <strong>Device:</strong>{' '}
                {f.device ? (
                  <Badge status={f.device.isActive ? 'success' : 'default'} text={`${f.device.name || 'Device'} (${f.device.id.slice(0, 8)}...)`} />
                ) : (
                  <Badge status="error" text="Not added" />
                )}
              </div>
              {f.device && (
                <>
                  <div className="card-row"><strong>API Key:</strong> {f.device.apiKey || 'N/A'}</div>
                  {f.device.readings ? (
                    <div className="readings-grid">
                      <div><strong>Moisture:</strong> {f.device.readings.moisture_level}%</div>
                      <div><strong>pH:</strong> {f.device.readings.ph_level}</div>
                      <div><strong>Temp:</strong> {f.device.readings.temperature}°C</div>
                      <div><strong>Humidity:</strong> {f.device.readings.humidity}%</div>
                      <div><strong>Light:</strong> {f.device.readings.light_intensity} lux</div>
                      <div><strong>Conductivity:</strong> {f.device.readings.soil_conductivity} μS/cm</div>
                      <div><strong>N:</strong> {f.device.readings.nitrogen_level} ppm</div>
                      <div><strong>P:</strong> {f.device.readings.phosphorus_level} ppm</div>
                      <div><strong>K:</strong> {f.device.readings.potassium_level} ppm</div>
                      <div><strong>Updated:</strong> {new Date(f.device.readings.last_updated).toLocaleString()}</div>
                    </div>
                  ) : (
                    <div className="card-row">No readings found</div>
                  )}
                  {/* Graphs for this farmer */}
                  <div className="device-card" style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <h4 style={{ margin: 0, fontSize: 14 }}>Sensor Data History (Device {String(f.device.id).slice(0,8)}…)</h4>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select value={range} onChange={(e) => setRange(e.target.value)} style={{ padding: '2px 6px', fontSize: 12 }}>
                          <option value="1h">Last 1 hour</option>
                          <option value="1d">Last day</option>
                          <option value="1w">Last week</option>
                          <option value="1m">Last month</option>
                          <option value="1y">Last year</option>
                          <option value="all">All time</option>
                        </select>
                        <Button size="small" onClick={() => setCollapsed({ ...collapsed, [f.id]: !collapsed[f.id] })}>
                          {collapsed[f.id] ? 'Expand' : 'Collapse'}
                        </Button>
                      </div>
                    </div>
                    {!collapsed[f.id] && (
                      <div className="graph-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${graphCols}, minmax(0, 1fr))`, gap: 12 }}>
                        {paramsOrder.map(k => {
                          const s = buildSeries(graphData[f.id], k, ranges[k]);
                          return (
                            <div key={k} className="graph-item">
                              <div className="graph-label" style={{ fontSize: 12 }}>{ranges[k].label}</div>
                              {s ? (
                                <svg width={s.width + 36} height={s.height + 22}>
                                  <text x={0} y={10} fontSize="9" fill="#6b7280">{Math.round(s.axis.vmax * 100) / 100}</text>
                                  <text x={0} y={s.height + 10} fontSize="9" fill="#6b7280">{Math.round(s.axis.vmin * 100) / 100}</text>
                                  <g transform="translate(36,2)">
                                    <rect x={0} y={0} width={s.width} height={s.height} rx={6} fill="#f8fafc" />
                                    <line x1={0} y1={0} x2={s.width} y2={0} stroke="#e5e7eb" strokeWidth="1" />
                                    <line x1={0} y1={s.height} x2={s.width} y2={s.height} stroke="#e5e7eb" strokeWidth="1" />
                                    <polyline points={s.line} fill="none" stroke="#22c55e" strokeWidth="2" />
                                  </g>
                                  <text x={36} y={s.height + 18} fontSize="9" fill="#6b7280">{new Date(s.axis.minT).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</text>
                                  <text x={36 + s.width - 36} y={s.height + 18} fontSize="9" fill="#6b7280" textAnchor="end">{new Date(s.axis.maxT).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</text>
                                </svg>
                              ) : (
                                <div className="graph-empty">Not enough history</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
      <div className="admin-pagination">
        <Pagination
          current={page}
          pageSize={limit}
          total={total}
          onChange={(p, s) => { setPage(p); setLimit(s); }}
          showSizeChanger
        />
      </div>
    </div>
  );
};

export default AdminDashboard;


