import React, { useEffect, useMemo, useState } from 'react';
import { Card, Input, Select, Pagination, Badge, Empty, Spin } from 'antd';
import { adminService } from '../../services/adminService';
import { useAuth } from '../../context/AuthContext';

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

  const header = useMemo(() => (
    <div className="admin-filters">
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
      <div className="admin-header">
        <h2>Farmers</h2>
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


