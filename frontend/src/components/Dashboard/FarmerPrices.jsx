import React, { useEffect, useState } from 'react';
import { Table } from 'antd';
import { priceService } from '../../services/priceService';

const FarmerPrices = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const list = await priceService.list();
      setData(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const columns = [
    { title: 'Crop', dataIndex: 'crop_name', key: 'crop' },
    { title: 'Unit', dataIndex: 'unit', key: 'unit' },
    { title: 'Price', dataIndex: 'price', key: 'price', render: (v) => Number(v) }
  ];

  return (
    <div className="content-section">
      <h3 className="content-title">Current Crop Prices</h3>
      <Table rowKey="id" loading={loading} columns={columns} dataSource={data} pagination={false} />
    </div>
  );
};

export default FarmerPrices;


