import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Col, Divider, Empty, Input, Row, Space, Tag, Typography, Pagination } from 'antd';
import { Sprout } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { productsService } from '../../services/productsService';

const { Title, Paragraph, Text } = Typography;
const { Search } = Input;

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [total, setTotal] = useState(0);

  const load = async (opts = {}) => {
    setLoading(true);
    try {
      const res = await productsService.list({ page: opts.page || page, limit, search });
      setItems(res?.data?.items || []);
      setTotal(res?.data?.pagination?.total || 0);
    } catch (e) {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    load({ page });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <div style={{ background: '#f5fbf7', minHeight: '100vh' }}>
      {/* Top nav */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size={10} align="center">
          <Sprout style={{ color: '#1f7a4d' }} size={28} aria-hidden="true" />
          <Title level={4} style={{ margin: 0, color: '#1f7a4d' }}>AgriSense</Title>
        </Space>
        <Space>
          {isAuthenticated ? (
            <Link to="/dashboard">
              <Button type="primary">Go to Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link to="/login">
                <Button>Login</Button>
              </Link>
              <Link to="/login">
                <Button type="primary">Sign up</Button>
              </Link>
            </>
          )}
        </Space>
      </div>

      {/* Hero */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 20px 8px' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Title style={{ marginBottom: 8, color: '#145c39' }}>Smart farming assistant for Bangladesh</Title>
          <Paragraph style={{ margin: 0, color: '#3c6e57' }}>
            Monitor sensors, get AI advice, and sell your harvest directly.
          </Paragraph>
        </div>

        <div style={{ maxWidth: 700, margin: '16px auto 32px' }}>
          <Search
            size="large"
            placeholder="Search products..."
            enterButton
            loading={loading}
            onSearch={(v) => setSearch(v.trim())}
            onChange={(e) => setSearch(e.target.value)}
            value={search}
            allowClear
          />
        </div>
      </div>

      {/* Feature highlights */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 24px' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card bordered style={{ borderRadius: 16, borderColor: '#d6efe3' }}>
              <Tag color="#1f7a4d" style={{ borderRadius: 12, color: '#fff' }}>IoT</Tag>
              <Title level={4} style={{ marginTop: 8 }}>Live Sensor Monitoring</Title>
              <Paragraph>Track soil moisture, pH, temperature, and more from your fields.</Paragraph>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card bordered style={{ borderRadius: 16, borderColor: '#d6efe3' }}>
              <Tag color="#1f7a4d" style={{ borderRadius: 12, color: '#fff' }}>AI</Tag>
              <Title level={4} style={{ marginTop: 8 }}>AI-powered Insights</Title>
              <Paragraph>Get actionable Bangla recommendations tailored to your crop and weather.</Paragraph>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card bordered style={{ borderRadius: 16, borderColor: '#d6efe3' }}>
              <Tag color="#1f7a4d" style={{ borderRadius: 12, color: '#fff' }}>Market</Tag>
              <Title level={4} style={{ marginTop: 8 }}>Sell Your Produce</Title>
              <Paragraph>Post products with price and unit, manage listings from your dashboard.</Paragraph>
            </Card>
          </Col>
        </Row>
      </div>

      <Divider style={{ margin: '8px 0 16px' }} />

      {/* Product list */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 40px' }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 16 }}>Latest products</Title>
        {items.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: 24 }}>
            <Empty description={loading ? 'Loading...' : 'No products found'} />
          </div>
        ) : (
          <>
            <Row gutter={[16, 16]}>
              {items.map((p) => (
                <Col xs={24} sm={12} md={8} lg={6} key={p.id}>
                  <Card hoverable style={{ borderRadius: 16, borderColor: '#cfeee0' }}>
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Product</Text>
                      <Title level={5} style={{ margin: 0 }}>{p.product_name}</Title>
                      <Text>
                        <Text strong>{p.unit_price}</Text> per {p.unit}
                      </Text>
                      {p?.users?.full_name && (
                        <Text style={{ fontSize: 12 }}>
                          Farmer: <Text strong style={{ color: '#1f7a4d' }}>{p.users.full_name}</Text>
                        </Text>
                      )}
                      {p.description && (
                        <Paragraph style={{ marginTop: 4, color: '#666' }} ellipsis={{ rows: 3 }}>
                          {p.description}
                        </Paragraph>
                      )}
                      {p.users?.location_address && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Location: {p.users.location_address}
                        </Text>
                      )}
                      {p?.users?.mobile_number && (
                        <Text style={{ fontSize: 12 }}>
                          Contact: <Text strong style={{ color: '#145c39' }}>{p.users.mobile_number}</Text>
                        </Text>
                      )}
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Pagination
                current={page}
                pageSize={limit}
                total={total}
                onChange={(p) => setPage(p)}
                showSizeChanger={false}
              />
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ background: '#e9f6ef' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px', textAlign: 'center' }}>
          <Text type="secondary">© {new Date().getFullYear()} AgriSense — Empowering farmers with data and AI</Text>
        </div>
      </div>
    </div>
  );
}


