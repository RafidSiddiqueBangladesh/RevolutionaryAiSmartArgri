import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, Select, Space, Table, Popconfirm, message } from 'antd';
import { productsService } from '../../../services/productsService';

const unitOptions = [
  { label: 'kg', value: 'kg' },
  { label: 'mon', value: 'mon' },
  { label: 'quintal', value: 'quintal' },
  { label: 'ton', value: 'ton' }
];

export default function SellPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await productsService.listMine();
      setItems(res?.items || res?.data?.items || []);
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onCreate = async (values) => {
    try {
      await productsService.create({
        productName: values.productName,
        unitPrice: values.unitPrice,
        unit: values.unit,
        description: values.description || ''
      });
      message.success('Product posted');
      form.resetFields();
      load();
    } catch (e) {
      message.error(e?.response?.data?.error || 'Failed to post product');
    }
  };

  const onUpdate = async (id, payload) => {
    try {
      await productsService.update(id, payload);
      message.success('Product updated');
      load();
    } catch (e) {
      message.error(e?.response?.data?.error || 'Failed to update');
    }
  };

  const onDelete = async (id) => {
    try {
      await productsService.remove(id);
      message.success('Product deleted');
      load();
    } catch (e) {
      message.error(e?.response?.data?.error || 'Failed to delete');
    }
  };

  const columns = useMemo(() => ([
    { title: 'Product', dataIndex: 'product_name', key: 'product_name' },
    { title: 'Price', key: 'price', render: (_, r) => `${r.unit_price} per ${r.unit}` },
    { title: 'Description', dataIndex: 'description', key: 'description' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button onClick={() => {
            form.setFieldsValue({
              productName: r.product_name,
              unitPrice: Number(r.unit_price),
              unit: r.unit,
              description: r.description || ''
            });
            form.__editingId = r.id;
          }}>
            Edit
          </Button>
          <Popconfirm title="Delete this product?" onConfirm={() => onDelete(r.id)}>
            <Button danger>Delete</Button>
          </Popconfirm>
        </Space>
      )
    }
  ]), [form]);

  const submit = () => {
    form.validateFields().then(async (values) => {
      if (form.__editingId) {
        const id = form.__editingId;
        form.__editingId = undefined;
        await onUpdate(id, {
          productName: values.productName,
          unitPrice: values.unitPrice,
          unit: values.unit,
          description: values.description || ''
        });
        form.resetFields();
      } else {
        await onCreate(values);
      }
    });
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Card title="Sell Products" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item name="productName" label="Product Name" rules={[{ required: true, min: 2, max: 120 }]}>
            <Input placeholder="e.g., IRRI rice" />
          </Form.Item>
          <Form.Item name="unitPrice" label="Unit Price" rules={[{ required: true, type: 'number', min: 0 }]}> 
            <InputNumber style={{ width: '100%' }} placeholder="e.g., 55" />
          </Form.Item>
          <Form.Item name="unit" label="Unit" rules={[{ required: true }]}> 
            <Select options={unitOptions} placeholder="Select unit" />
          </Form.Item>
          <Form.Item name="description" label="Description" rules={[{ max: 1000 }]}> 
            <Input.TextArea rows={3} placeholder="Short description" />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">{form.__editingId ? 'Update' : 'Post Product'}</Button>
            {form.__editingId && (
              <Button onClick={() => { form.resetFields(); form.__editingId = undefined; }}>Cancel Edit</Button>
            )}
          </Space>
        </Form>
      </Card>

      <Card title="My Products">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          columns={columns}
          pagination={false}
        />
      </Card>
    </div>
  );
}


