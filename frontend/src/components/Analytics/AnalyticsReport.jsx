import React from 'react';
import { Card, Typography, Divider, Spin, Alert, Button } from 'antd';
import { BarChartOutlined, BulbOutlined, ThunderboltOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const AnalyticsReport = ({ loading, error, data, onAnalyze }) => {
  // If loading, show spinner
  if (loading) {
    return (
      <Card className="card-centered-lg">
        <Spin size="large" />
        <Paragraph className="mt-20">
          Analyzing your farm data with AI...
        </Paragraph>
      </Card>
    );
  }

  // If error, show error message
  if (error) {
    return (
      <Card>
        <Alert
          message="Analysis Error"
          description={error.message || "Failed to analyze farm data. Please try again."}
          type="error"
          showIcon
        />
        <Button
          type="primary"
          onClick={onAnalyze}
          className="mt-16"
        >
          Try Again
        </Button>
      </Card>
    );
  }

  // If no data and not loading, show analyze button
  if (!data) {
    return (
      <Card className="card-centered-md">
        <BarChartOutlined className="icon-xl brand-accent mb-16" />
        <Title level={4}>Farm Analysis</Title>
        <Paragraph>
          Get AI-powered insights about your farm's condition and recommendations
          for optimal crop growth based on sensor data and weather information.
        </Paragraph>
        <Button
          type="primary"
          size="large"
          onClick={onAnalyze}
          icon={<ThunderboltOutlined />}
        >
          Analyze Farm Data
        </Button>
      </Card>
    );
  }

  // Get the analysis data
  const analysis = data.analysis.analysis || data.analysis.recommendations;
  const actionRequired = data.analysis.actionRequired;
  const alertMessage = data.analysis.message;
  const alertRecord = data.alert;

  return (
    <Card>
      <Title level={3}>Farm Analysis Report</Title>
      <Text type="secondary">Generated on {new Date(data.timestamp).toLocaleString()}</Text>
      
      {/* Show alert banner if action is required */}
      {actionRequired && (
        <>
          <Divider />
          <Alert
            message="Critical Alert - Immediate Action Required"
            description={alertMessage}
            type="warning"
            showIcon
            className="mb-16"
          />
          {alertRecord && (
            <Alert
              message={alertRecord.is_sms_sent ? "SMS Alert Sent" : "SMS Alert Pending"}
              description={alertRecord.is_sms_sent ? "Critical alert message has been sent to your mobile." : "SMS is being sent to notify you of this critical condition."}
              type={alertRecord.is_sms_sent ? "success" : "info"}
              showIcon
              className="mb-16"
            />
          )}
        </>
      )}
      
      <Divider />
      
      <div className="analysis-content">
        <Title level={4}><BulbOutlined /> Farm Analysis & Recommendations</Title>
        
        {/* Display the analysis text with proper formatting */}
        {analysis && analysis.split('\n\n').map((paragraph, index) => (
          <Paragraph key={index}>
            {paragraph}
          </Paragraph>
        ))}
      </div>
      
      <Divider />
      
      <Button 
        type="primary" 
        onClick={onAnalyze} 
        icon={<ThunderboltOutlined />}
      >
        Refresh Analysis
      </Button>
    </Card>
  );
};

export default AnalyticsReport;
