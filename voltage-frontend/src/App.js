import React, { useState, useEffect, useCallback } from 'react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import './App.css';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [incidents, setIncidents] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [stats, setStats] = useState({ 
    total: 0, 
    critical: 0, 
    resolved: 0, 
    inProgress: 0,
    predicted: 0 
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    category: 'electricity',
    description: '',
    severity: 'medium',
    location: { building: '', room: '' }
  });

  // Fetch incidents with loading state
  const fetchIncidents = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/incidents');
      const data = await response.json();
      setIncidents(data);
      
      // Calculate stats
      const total = data.length;
      const critical = data.filter(inc => inc.severity === 'critical').length;
      const resolved = data.filter(inc => inc.status === 'resolved').length;
      const inProgress = data.filter(inc => inc.status === 'in-progress').length;
      setStats({ total, critical, resolved, inProgress });

      // Add notification for new critical incidents
      const newCritical = data.filter(inc => 
        inc.severity === 'critical' && 
        new Date(inc.createdAt) > new Date(Date.now() - 30000)
      );
      
      if (newCritical.length > 0) {
        newCritical.forEach(incident => {
          addNotification(`🚨 New Critical Incident: ${incident.title}`, 'critical');
        });
      }

    } catch (error) {
      console.error('Error fetching incidents:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch predictions
  const fetchPredictions = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3000/api/predictions');
      const data = await response.json();
      setPredictions(data);
      setStats(prev => ({ ...prev, predicted: data.length }));
    } catch (error) {
      console.error('Error fetching predictions:', error);
    }
  }, []);

  // Auto-refresh every 20 seconds
  useEffect(() => {
    fetchIncidents();
    fetchPredictions();
    
    const interval = setInterval(() => {
      fetchIncidents();
      fetchPredictions();
    }, 20000);
    
    return () => clearInterval(interval);
  }, [fetchIncidents, fetchPredictions]);

  // Auto-remove notifications
  useEffect(() => {
    const timer = setInterval(() => {
      if (notifications.length > 0) {
        setNotifications(prev => prev.slice(1));
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [notifications]);

  // Add notification
  const addNotification = (message, type = 'info') => {
    const newNotification = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date()
    };
    setNotifications(prev => [...prev, newNotification]);
  };

  // Filter incidents
  const filteredIncidents = incidents.filter(incident => {
    const matchesSearch = incident.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         incident.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         incident.location.building.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSeverity = severityFilter === 'all' || incident.severity === severityFilter;
    
    return matchesSearch && matchesSeverity;
  });

  // Chart data
  const severityChartData = {
    labels: ['Critical', 'High', 'Medium', 'Low'],
    datasets: [
      {
        data: [
          incidents.filter(inc => inc.severity === 'critical').length,
          incidents.filter(inc => inc.severity === 'high').length,
          incidents.filter(inc => inc.severity === 'medium').length,
          incidents.filter(inc => inc.severity === 'low').length,
        ],
        backgroundColor: ['#dc2626', '#ea580c', '#d97706', '#65a30d'],
        borderWidth: 2,
        borderColor: '#fff'
      }
    ]
  };

  const predictionChartData = {
    labels: predictions.map(pred => pred.location.building),
    datasets: [
      {
        label: 'Failure Probability %',
        data: predictions.map(pred => pred.probability),
        backgroundColor: predictions.map(pred => 
          pred.urgency === 'critical' ? '#dc2626' : 
          pred.urgency === 'high' ? '#ea580c' : '#d97706'
        ),
        borderWidth: 2,
        borderColor: '#fff'
      }
    ]
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3000/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          status: 'new'
        })
      });
      
      if (response.ok) {
        const newIncident = await response.json();
        addNotification(`✅ Incident reported: ${newIncident.title}`, 'success');
        setFormData({
          title: '', category: 'electricity', description: '', severity: 'medium',
          location: { building: '', room: '' }
        });
        fetchIncidents();
        fetchPredictions(); // Refresh predictions
      } else {
        throw new Error('Failed to submit incident');
      }
    } catch (error) {
      addNotification(`❌ Error: ${error.message}`, 'error');
    }
  };

  const updateIncidentStatus = async (incidentId, newStatus) => {
    try {
      const response = await fetch(`http://localhost:3000/api/incidents/${incidentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (response.ok) {
        const incident = incidents.find(inc => inc._id === incidentId);
        addNotification(`🔄 Status updated: ${incident.title} → ${newStatus}`, 'info');
        fetchIncidents();
      } else {
        throw new Error('Failed to update status');
      }
    } catch (error) {
      addNotification(`❌ Error: ${error.message}`, 'error');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'resolved': return '✅ Resolved';
      case 'in-progress': return '🔄 In Progress';
      case 'assigned': return '👨‍🔧 Assigned';
      default: return '🆕 New';
    }
  };

  const getUrgencyBadge = (urgency) => {
    switch (urgency) {
      case 'critical': return '🔴 Critical';
      case 'high': return '🟠 High';
      case 'medium': return '🟡 Medium';
      default: return '🟢 Low';
    }
  };

  return (
    <div className="app">
      {/* Notifications */}
      <div className="notifications-container">
        {notifications.map(notification => (
          <div key={notification.id} className={`notification ${notification.type}`}>
            <span className="notification-message">{notification.message}</span>
            <span className="notification-time">
              {new Date(notification.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1>⚡ VoltageGuard AI</h1>
          <p>Smart Predictive Maintenance System</p>
        </div>
        <div className="stats">
          <div className="stat">
            <span className="stat-number">{stats.total}</span>
            <span className="stat-label">Total</span>
          </div>
          <div className="stat critical">
            <span className="stat-number">{stats.critical}</span>
            <span className="stat-label">Critical</span>
          </div>
          <div className="stat predicted">
            <span className="stat-number">{stats.predicted}</span>
            <span className="stat-label">Predictions</span>
          </div>
          <div className="stat resolved">
            <span className="stat-number">{stats.resolved}</span>
            <span className="stat-label">Resolved</span>
          </div>
        </div>
      </header>

      <div className="main-container">
        {/* Sidebar */}
        <nav className="sidebar">
          <button 
            className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Dashboard
          </button>
          <button 
            className={`nav-btn ${activeTab === 'report' ? 'active' : ''}`}
            onClick={() => setActiveTab('report')}
          >
            🚨 Report Incident
          </button>
          <button 
            className={`nav-btn ${activeTab === 'incidents' ? 'active' : ''}`}
            onClick={() => setActiveTab('incidents')}
          >
            📋 All Incidents
          </button>
          <button 
            className={`nav-btn ${activeTab === 'predictions' ? 'active' : ''}`}
            onClick={() => setActiveTab('predictions')}
          >
            🔮 Predictions
          </button>
          <button 
            className={`nav-btn ${activeTab === 'technicians' ? 'active' : ''}`}
            onClick={() => setActiveTab('technicians')}
          >
            👨‍🔧 Technicians
          </button>
        </nav>

        {/* Main Content */}
        <main className="main-content">
          {activeTab === 'report' && (
            <div className="form-container">
              <h2>Report Voltage Incident</h2>
              <form onSubmit={handleSubmit} className="incident-form">
                <div className="form-group">
                  <label>Incident Title *</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="e.g., Voltage Drop in Hostel B"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Building *</label>
                    <input
                      type="text"
                      name="location.building"
                      value={formData.location.building}
                      onChange={handleChange}
                      placeholder="e.g., Hostel B"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Room Number</label>
                    <input
                      type="text"
                      name="location.room"
                      value={formData.location.room}
                      onChange={handleChange}
                      placeholder="e.g., 205"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Severity Level</label>
                  <select name="severity" value={formData.severity} onChange={handleChange}>
                    <option value="low">🟢 Low - Minor flickering</option>
                    <option value="medium">🟡 Medium - Equipment affected</option>
                    <option value="high">🟠 High - Multiple devices impacted</option>
                    <option value="critical">🔴 Critical - Complete blackout</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Detailed Description *</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows="3"
                    placeholder="Describe the issue in detail..."
                    required
                  />
                </div>

                <button type="submit" className="submit-btn">
                  🚨 Report Voltage Incident
                </button>
              </form>
            </div>
          )}

          {activeTab === 'incidents' && (
            <div className="incidents-container">
              <div className="incidents-header">
                <h2>All Reported Incidents</h2>
                <div className="incident-controls">
                  <div className="search-box">
                    <input
                      type="text"
                      placeholder="Search incidents..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="search-input"
                    />
                    <span className="search-icon">🔍</span>
                  </div>
                  <select 
                    value={severityFilter} 
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="filter-select"
                  >
                    <option value="all">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <button onClick={fetchIncidents} className="refresh-btn" disabled={isLoading}>
                    {isLoading ? '🔄 Refreshing...' : '🔄 Refresh'}
                  </button>
                </div>
              </div>

              <div className="incidents-table">
                <div className="table-header">
                  <div className="table-cell">Title</div>
                  <div className="table-cell">Location</div>
                  <div className="table-cell">Severity</div>
                  <div className="table-cell">Status</div>
                  <div className="table-cell">Date</div>
                  <div className="table-cell">Actions</div>
                </div>

                <div className="table-body">
                  {isLoading ? (
                    <div className="loading">🔄 Loading incidents...</div>
                  ) : filteredIncidents.length === 0 ? (
                    <div className="no-data">No incidents found</div>
                  ) : (
                    filteredIncidents.map(incident => (
                      <div key={incident._id} className="table-row">
                        <div className="table-cell">
                          <div className="incident-title">{incident.title}</div>
                          <div className="incident-desc">{incident.description}</div>
                        </div>
                        <div className="table-cell">
                          <div className="location">
                            <strong>🏢 {incident.location.building}</strong>
                            {incident.location.room && <div>🚪 Room {incident.location.room}</div>}
                          </div>
                        </div>
                        <div className="table-cell">
                          <span className={`severity-tag ${incident.severity}`}>
                            {getSeverityIcon(incident.severity)} {incident.severity}
                          </span>
                        </div>
                        <div className="table-cell">
                          <span className={`status-badge ${incident.status}`}>
                            {getStatusBadge(incident.status)}
                          </span>
                        </div>
                        <div className="table-cell">
                          {new Date(incident.createdAt).toLocaleDateString()}
                          <div className="time">{new Date(incident.createdAt).toLocaleTimeString()}</div>
                        </div>
                        <div className="table-cell">
                          <div className="action-buttons">
                            {incident.status !== 'resolved' && (
                              <>
                                <button 
                                  onClick={() => updateIncidentStatus(incident._id, 'in-progress')}
                                  className="action-btn progress"
                                >
                                  Start
                                </button>
                                <button 
                                  onClick={() => updateIncidentStatus(incident._id, 'resolved')}
                                  className="action-btn resolve"
                                >
                                  Resolve
                                </button>
                              </>
                            )}
                            {incident.status === 'resolved' && (
                              <span className="resolved-text">✅ Done</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="table-footer">
                Showing {filteredIncidents.length} of {incidents.length} incidents
                <span className="auto-refresh">🔄 Auto-refreshes every 20 seconds</span>
              </div>
            </div>
          )}

          {activeTab === 'predictions' && (
            <div className="predictions-container">
              <div className="predictions-header">
                <h2>🔮 AI-Powered Predictions</h2>
                <p>Smart forecasts based on historical incident patterns</p>
              </div>

              {predictions.length === 0 ? (
                <div className="no-predictions">
                  <div className="prediction-icon">📊</div>
                  <h3>No predictions available</h3>
                  <p>As more incidents are reported, AI will generate smart predictions</p>
                </div>
              ) : (
                <>
                  <div className="predictions-stats">
                    <div className="prediction-stat">
                      <span className="prediction-stat-number">{predictions.length}</span>
                      <span className="prediction-stat-label">Active Predictions</span>
                    </div>
                    <div className="prediction-stat critical">
                      <span className="prediction-stat-number">
                        {predictions.filter(p => p.urgency === 'critical').length}
                      </span>
                      <span className="prediction-stat-label">Critical Alerts</span>
                    </div>
                    <div className="prediction-stat high">
                      <span className="prediction-stat-number">
                        {predictions.filter(p => p.urgency === 'high').length}
                      </span>
                      <span className="prediction-stat-label">High Priority</span>
                    </div>
                  </div>

                  <div className="predictions-grid">
                    {predictions.map((prediction, index) => (
                      <div key={index} className={`prediction-card ${prediction.urgency}`}>
                        <div className="prediction-header">
                          <h3>🏢 {prediction.location.building}</h3>
                          <span className={`urgency-badge ${prediction.urgency}`}>
                            {getUrgencyBadge(prediction.urgency)}
                          </span>
                        </div>
                        
                        <div className="prediction-content">
                          <div className="prediction-issue">
                            {prediction.predicted_issue}
                          </div>
                          
                          <div className="prediction-details">
                            <div className="prediction-probability">
                              <span className="probability-value">{prediction.probability}%</span>
                              <span className="probability-label">Probability</span>
                            </div>
                            
                            <div className="prediction-meta">
                              <div className="prediction-reason">
                                <strong>Reason:</strong> {prediction.reason}
                              </div>
                              <div className="prediction-time">
                                <strong>Expected:</strong> {new Date(prediction.predicted_date).toLocaleDateString()}
                                {prediction.predicted_time && ` at ${prediction.predicted_time}`}
                              </div>
                              <div className="prediction-confidence">
                                <strong>Confidence:</strong> 
                                <span className={`confidence-${prediction.confidence}`}>
                                  {prediction.confidence}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="prediction-actions">
                          <button className="action-btn schedule">
                            📅 Schedule Maintenance
                          </button>
                          <button className="action-btn notify">
                            🔔 Notify Technicians
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="prediction-chart">
                    <h3>📈 Prediction Probability by Building</h3>
                    <div className="chart-container">
                      <Bar 
                        data={predictionChartData}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: {
                              display: false
                            }
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              max: 100,
                              title: {
                                display: true,
                                text: 'Probability %'
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'technicians' && (
            <div className="technicians-container">
              <div className="technicians-header">
                <h2>👨‍🔧 Technician Management</h2>
                <p>Assign and manage maintenance technicians</p>
              </div>

              <div className="technicians-stats">
                <div className="tech-stat">
                  <div className="tech-stat-icon">👥</div>
                  <div className="tech-stat-info">
                    <div className="tech-stat-number">8</div>
                    <div className="tech-stat-label">Total Technicians</div>
                  </div>
                </div>
                <div className="tech-stat available">
                  <div className="tech-stat-icon">✅</div>
                  <div className="tech-stat-info">
                    <div className="tech-stat-number">5</div>
                    <div className="tech-stat-label">Available</div>
                  </div>
                </div>
                <div className="tech-stat busy">
                  <div className="tech-stat-icon">🔄</div>
                  <div className="tech-stat-info">
                    <div className="tech-stat-number">3</div>
                    <div className="tech-stat-label">On Duty</div>
                  </div>
                </div>
              </div>

              <div className="technicians-grid">
                <div className="technician-card">
                  <div className="tech-avatar">⚡</div>
                  <div className="tech-info">
                    <h3>Rajesh Kumar</h3>
                    <p>Senior Electrical Technician</p>
                    <div className="tech-skills">
                      <span className="skill-tag">Voltage Systems</span>
                      <span className="skill-tag">Transformers</span>
                      <span className="skill-tag">Emergency Repair</span>
                    </div>
                  </div>
                  <div className="tech-status available">
                    <span className="status-dot"></span>
                    Available
                  </div>
                  <div className="tech-actions">
                    <button className="action-btn assign">Assign Task</button>
                    <button className="action-btn contact">Contact</button>
                  </div>
                </div>

                <div className="technician-card">
                  <div className="tech-avatar">🔧</div>
                  <div className="tech-info">
                    <h3>Priya Sharma</h3>
                    <p>Electrical Maintenance Expert</p>
                    <div className="tech-skills">
                      <span className="skill-tag">Circuit Analysis</span>
                      <span className="skill-tag">Preventive Maintenance</span>
                      <span className="skill-tag">Safety Systems</span>
                    </div>
                  </div>
                  <div className="tech-status available">
                    <span className="status-dot"></span>
                    Available
                  </div>
                  <div className="tech-actions">
                    <button className="action-btn assign">Assign Task</button>
                    <button className="action-btn contact">Contact</button>
                  </div>
                </div>

                <div className="technician-card">
                  <div className="tech-avatar">🚨</div>
                  <div className="tech-info">
                    <h3>Ankit Patel</h3>
                    <p>Emergency Response Specialist</p>
                    <div className="tech-skills">
                      <span className="skill-tag">Critical Repairs</span>
                      <span className="skill-tag">24/7 Support</span>
                      <span className="skill-tag">Rapid Deployment</span>
                    </div>
                  </div>
                  <div className="tech-status busy">
                    <span className="status-dot"></span>
                    On Duty - Hostel B
                  </div>
                  <div className="tech-actions">
                    <button className="action-btn assign" disabled>Busy</button>
                    <button className="action-btn contact">Contact</button>
                  </div>
                </div>

                <div className="technician-card">
                  <div className="tech-avatar">📊</div>
                  <div className="tech-info">
                    <h3>Sanjay Verma</h3>
                    <p>Electrical Systems Analyst</p>
                    <div className="tech-skills">
                      <span className="skill-tag">Data Analysis</span>
                      <span className="skill-tag">Predictive Maintenance</span>
                      <span className="skill-tag">System Optimization</span>
                    </div>
                  </div>
                  <div className="tech-status available">
                    <span className="status-dot"></span>
                    Available
                  </div>
                  <div className="tech-actions">
                    <button className="action-btn assign">Assign Task</button>
                    <button className="action-btn contact">Contact</button>
                  </div>
                </div>
              </div>

              <div className="assignment-panel">
                <h3>📋 Quick Assignment</h3>
                <div className="assignment-form">
                  <select className="tech-select">
                    <option>Select Technician</option>
                    <option>Rajesh Kumar - Electrical</option>
                    <option>Priya Sharma - Maintenance</option>
                    <option>Sanjay Verma - Analysis</option>
                  </select>
                  <select className="incident-select">
                    <option>Select Incident</option>
                    {incidents.filter(inc => inc.status === 'new').map(incident => (
                      <option key={incident._id} value={incident._id}>
                        {incident.title} - {incident.location.building}
                      </option>
                    ))}
                  </select>
                  <button className="assign-btn">🚀 Assign Now</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="dashboard">
              <div className="dashboard-header">
                <h2>📊 VoltageGuard AI Analytics</h2>
                <div className="live-indicator">
                  <span className="live-dot"></span>
                  AI PREDICTIVE MODE
                </div>
              </div>
              
              <div className="stats-grid">
                <div className="stat-card total">
                  <div className="stat-icon">📈</div>
                  <div className="stat-info">
                    <div className="stat-value">{stats.total}</div>
                    <div className="stat-label">Total Incidents</div>
                  </div>
                </div>
                <div className="stat-card critical">
                  <div className="stat-icon">🚨</div>
                  <div className="stat-info">
                    <div className="stat-value">{stats.critical}</div>
                    <div className="stat-label">Critical</div>
                  </div>
                </div>
                <div className="stat-card predicted">
                  <div className="stat-icon">🔮</div>
                  <div className="stat-info">
                    <div className="stat-value">{stats.predicted}</div>
                    <div className="stat-label">AI Predictions</div>
                  </div>
                </div>
                <div className="stat-card resolved">
                  <div className="stat-icon">✅</div>
                  <div className="stat-info">
                    <div className="stat-value">{stats.resolved}</div>
                    <div className="stat-label">Resolved</div>
                  </div>
                </div>
              </div>

              <div className="charts-grid">
                <div className="chart-card">
                  <h3>📈 Weekly Incident Trend</h3>
                  <div className="chart-container">
                    <Line 
                      data={{
                        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                        datasets: [{
                          label: 'Voltage Incidents',
                          data: [3, 5, 2, 8, 4, 6, 3],
                          borderColor: '#ef4444',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          tension: 0.4,
                          fill: true
                        }]
                      }}
                      options={{
                        responsive: true,
                        plugins: { legend: { display: false } }
                      }}
                    />
                  </div>
                </div>

                <div className="chart-card">
                  <h3>🎯 Severity Distribution</h3>
                  <div className="chart-container">
                    <Doughnut 
                      data={severityChartData}
                      options={{
                        responsive: true,
                        plugins: { legend: { position: 'bottom' } }
                      }}
                    />
                  </div>
                </div>

                <div className="chart-card">
                  <h3>🔮 Active Predictions</h3>
                  <div className="predictions-preview">
                    {predictions.slice(0, 3).map((prediction, index) => (
                      <div key={index} className="prediction-preview-item">
                        <div className="preview-building">
                          🏢 {prediction.location.building}
                        </div>
                        <div className="preview-probability">
                          {prediction.probability}% risk
                        </div>
                        <div className={`preview-urgency ${prediction.urgency}`}>
                          {prediction.urgency}
                        </div>
                      </div>
                    ))}
                    {predictions.length === 0 && (
                      <div className="no-predictions-preview">
                        No active predictions
                      </div>
                    )}
                  </div>
                </div>

                <div className="chart-card">
                  <h3>🔥 Critical Alerts</h3>
                  <div className="critical-list">
                    {incidents
                      .filter(inc => inc.severity === 'critical')
                      .slice(0, 3)
                      .map(incident => (
                        <div key={incident._id} className="critical-item">
                          <div className="critical-title">{incident.title}</div>
                          <div className="critical-location">{incident.location.building}</div>
                          <div className="critical-time">
                            {new Date(incident.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))
                    }
                    {incidents.filter(inc => inc.severity === 'critical').length === 0 && (
                      <div className="no-critical">No critical incidents 🎉</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;