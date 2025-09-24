import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, InputNumber, Popconfirm, message } from 'antd';
import { priceService } from '../../services/priceService';

const AdminPrices = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

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

  const onAdd = () => {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  };

  const onEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      cropName: record.crop_name,
      unit: record.unit,
      price: Number(record.price)
    });
    setOpen(true);
  };

  const onDelete = async (record) => {
    try {
      await priceService.remove(record.id);
      message.success('Deleted');
      load();
    } catch (e) {
      message.error('Delete failed');
    }
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await priceService.update(editing.id, {
          cropName: values.cropName,
          unit: values.unit,
          price: values.price
        });
        message.success('Updated');
      } else {
        await priceService.createOrUpsert(values);
        message.success('Saved');
      }
      setOpen(false);
      load();
    } catch (e) {
      message.error('Save failed');
    }
  };

  const columns = [
    { title: 'Crop', dataIndex: 'crop_name', key: 'crop' },
    { title: 'Unit', dataIndex: 'unit', key: 'unit' },
    { title: 'Price', dataIndex: 'price', key: 'price', render: (v) => Number(v) },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <>
          <Button size="small" onClick={() => onEdit(record)} style={{ marginRight: 8 }}>Edit</Button>
          <Popconfirm title="Delete price?" onConfirm={() => onDelete(record)}>
            <Button size="small" danger>Delete</Button>
          </Popconfirm>
        </>
      )
    }
  ];

  return (
    <div className="content-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 className="content-title" style={{ margin: 0 }}>Crop Price List</h3>
        <Button type="primary" onClick={onAdd}>Add Price</Button>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} dataSource={data} pagination={false} />

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        title={editing ? 'Edit Price' : 'Add Price'}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Crop Name" name="cropName" rules={[{ required: true, message: 'Enter crop name' }]}>
            <Input placeholder="e.g., Rice" />
          </Form.Item>
          <Form.Item label="Unit" name="unit" rules={[{ required: true, message: 'Select unit' }]}>
            <Select options={priceService.units.map(u => ({ value: u, label: u }))} />
          </Form.Item>
          <Form.Item label="Price" name="price" rules={[{ required: true, message: 'Enter price' }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="e.g., 40" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminPrices;


