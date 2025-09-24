const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const scheduledAnalyticsService = require('../services/scheduledAnalyticsService');
const supabase = require('../config/database');

const router = express.Router();

// Get scheduled analytics status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const status = scheduledAnalyticsService.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting scheduled analytics status:', error);
    res.status(500).json({ 
      error: 'Failed to get scheduled analytics status',
      message: error.message 
    });
  }
});

// Manually trigger daily analytics
router.post('/trigger-daily', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Trigger daily analytics in background
    scheduledAnalyticsService.triggerDailyAnalytics();
    
    res.json({
      success: true,
      message: 'Daily analytics triggered successfully'
    });
  } catch (error) {
    console.error('Error triggering daily analytics:', error);
    res.status(500).json({ 
      error: 'Failed to trigger daily analytics',
      message: error.message 
    });
  }
});

// Manually trigger moisture check
router.post('/trigger-moisture-check', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Trigger moisture check in background
    scheduledAnalyticsService.triggerMoistureCheck();
    
    res.json({
      success: true,
      message: 'Moisture check triggered successfully'
    });
  } catch (error) {
    console.error('Error triggering moisture check:', error);
    res.status(500).json({ 
      error: 'Failed to trigger moisture check',
      message: error.message 
    });
  }
});


// Get farm analyses history
router.get('/analyses', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, user_id } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('farm_analyses')
      .select(`
        id,
        user_id,
        device_id,
        ai_analysis,
        action_required,
        sms_message,
        sms_sent,
        sms_sent_at,
        created_at,
        devices!inner (
          device_name
        ),
        users!inner (
          full_name,
          mobile_number
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by farmer if specified and user is admin
    if (user_id && req.user.role === 'admin') {
      query = query.eq('user_id', user_id);
    } else if (req.user.role === 'farmer') {
      // Farmers can only see their own analyses
      query = query.eq('user_id', req.user.id);
    }

    const { data: analyses, error: analysesError } = await query;

    if (analysesError) {
      console.error('Error fetching farm analyses:', analysesError);
      return res.status(500).json({ 
        error: 'Failed to fetch farm analyses',
        message: analysesError.message 
      });
    }

    // Get total count
    let countQuery = supabase
      .from('farm_analyses')
      .select('id', { count: 'exact', head: true });

    if (user_id && req.user.role === 'admin') {
      countQuery = countQuery.eq('user_id', user_id);
    } else if (req.user.role === 'farmer') {
      countQuery = countQuery.eq('user_id', req.user.id);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Error counting farm analyses:', countError);
      return res.status(500).json({ 
        error: 'Failed to count farm analyses',
        message: countError.message 
      });
    }

    res.json({
      success: true,
      data: {
        analyses,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error in farm analyses endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to fetch farm analyses',
      message: error.message 
    });
  }
});

// Get farm alerts history
router.get('/alerts', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, user_id, severity, alert_type } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('farm_alerts')
      .select(`
        id,
        user_id,
        device_id,
        alert_type,
        severity,
        message_bangla,
        message_english,
        sensor_data,
        is_sms_sent,
        sms_sent_at,
        voice_call_initiated,
        voice_call_id,
        voice_call_status,
        voice_call_completed_at,
        acknowledged,
        acknowledged_at,
        created_at,
        devices!inner (
          device_name
        ),
        users!inner (
          full_name,
          mobile_number
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by farmer if specified and user is admin
    if (user_id && req.user.role === 'admin') {
      query = query.eq('user_id', user_id);
    } else if (req.user.role === 'farmer') {
      // Farmers can only see their own alerts
      query = query.eq('user_id', req.user.id);
    }

    // Additional filters
    if (severity) {
      query = query.eq('severity', severity);
    }
    if (alert_type) {
      query = query.eq('alert_type', alert_type);
    }

    const { data: alerts, error: alertsError } = await query;

    if (alertsError) {
      console.error('Error fetching farm alerts:', alertsError);
      return res.status(500).json({ 
        error: 'Failed to fetch farm alerts',
        message: alertsError.message 
      });
    }

    // Get total count
    let countQuery = supabase
      .from('farm_alerts')
      .select('id', { count: 'exact', head: true });

    if (user_id && req.user.role === 'admin') {
      countQuery = countQuery.eq('user_id', user_id);
    } else if (req.user.role === 'farmer') {
      countQuery = countQuery.eq('user_id', req.user.id);
    }

    if (severity) {
      countQuery = countQuery.eq('severity', severity);
    }
    if (alert_type) {
      countQuery = countQuery.eq('alert_type', alert_type);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Error counting farm alerts:', countError);
      return res.status(500).json({ 
        error: 'Failed to count farm alerts',
        message: countError.message 
      });
    }

    res.json({
      success: true,
      data: {
        alerts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error in farm alerts endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to fetch farm alerts',
      message: error.message 
    });
  }
});

// Acknowledge an alert
router.patch('/alerts/:alertId/acknowledge', authenticateToken, async (req, res) => {
  try {
    const { alertId } = req.params;

    // Check if user owns this alert or is admin
    const { data: alert, error: alertError } = await supabase
      .from('farm_alerts')
      .select('user_id')
      .eq('id', alertId)
      .single();

    if (alertError || !alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    if (req.user.role !== 'admin' && alert.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update alert as acknowledged
    const { data: updatedAlert, error: updateError } = await supabase
      .from('farm_alerts')
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString()
      })
      .eq('id', alertId)
      .select()
      .single();

    if (updateError) {
      console.error('Error acknowledging alert:', updateError);
      return res.status(500).json({ 
        error: 'Failed to acknowledge alert',
        message: updateError.message 
      });
    }

    res.json({
      success: true,
      data: updatedAlert,
      message: 'Alert acknowledged successfully'
    });
  } catch (error) {
    console.error('Error in acknowledge alert endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to acknowledge alert',
      message: error.message 
    });
  }
});

// Get analytics dashboard data
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.role === 'admin' ? null : req.user.id;

    // Get recent analyses count
    let analysesQuery = supabase
      .from('farm_analyses')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (userId) {
      analysesQuery = analysesQuery.eq('user_id', userId);
    }

    const { count: recentAnalyses, error: analysesError } = await analysesQuery;

    // Get critical alerts count (including medium and high severity)
    let alertsQuery = supabase
      .from('farm_alerts')
      .select('id', { count: 'exact', head: true })
      .in('severity', ['critical', 'high', 'medium'])
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (userId) {
      alertsQuery = alertsQuery.eq('user_id', userId);
    }

    const { count: criticalAlerts, error: alertsError } = await alertsQuery;

    // Get unacknowledged alerts count
    let unacknowledgedQuery = supabase
      .from('farm_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('acknowledged', false);

    if (userId) {
      unacknowledgedQuery = unacknowledgedQuery.eq('user_id', userId);
    }

    const { count: unacknowledgedAlerts, error: unacknowledgedError } = await unacknowledgedQuery;

    if (analysesError || alertsError || unacknowledgedError) {
      console.error('Error fetching dashboard data:', { analysesError, alertsError, unacknowledgedError });
      return res.status(500).json({ 
        error: 'Failed to fetch dashboard data',
        message: 'Database query error'
      });
    }

    res.json({
      success: true,
      data: {
        recentAnalyses: recentAnalyses || 0,
        criticalAlerts: criticalAlerts || 0,
        unacknowledgedAlerts: unacknowledgedAlerts || 0,
        scheduledStatus: scheduledAnalyticsService.getStatus()
      }
    });
  } catch (error) {
    console.error('Error in analytics dashboard endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard data',
      message: error.message 
    });
  }
});

module.exports = router;
