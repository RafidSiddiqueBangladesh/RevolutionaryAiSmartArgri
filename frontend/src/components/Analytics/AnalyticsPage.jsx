import React, { useState } from 'react';
import { Layout, Typography, message } from 'antd';
import AnalyticsReport from './AnalyticsReport';
import { analyticsAPI } from '../../services/analyticsService';

const { Content } = Layout;
const { Title } = Typography;

const AnalyticsPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await analyticsAPI.getFarmAnalysis();
      setAnalysisData(data.data);
      message.success('Farm analysis completed successfully');
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err);
      message.error('Failed to analyze farm data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout style={{ padding: '20px' }}>
      <Content>
        <Title level={2}>Farm Analytics</Title>
        <AnalyticsReport 
          loading={loading}
          error={error}
          data={analysisData}
          onAnalyze={handleAnalyze}
        />
      </Content>
    </Layout>
  );
};

export default AnalyticsPage;