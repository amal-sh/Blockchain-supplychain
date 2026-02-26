"use client"
import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth } from '../../../context/AuthContext';

export default function InsuranceClaim() {
  const { user, logout, loading: authLoading } = useAuth();

  const [userFarms, setUserFarms] = useState([]);
  const [existingClaims, setExistingClaims] = useState([]);
  const [isLoadingFarms, setIsLoadingFarms] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState({ text: "", isError: false });
  const [showForm, setShowForm] = useState(false);

  // IoT sensor data state
  const [sensorData, setSensorData] = useState([]);
  const [farmImages, setFarmImages] = useState([]);
  const [evidenceAlerts, setEvidenceAlerts] = useState([]);
  const [isLoadingSensorData, setIsLoadingSensorData] = useState(false);
  const [sensorValidation, setSensorValidation] = useState({ isValid: false, reason: "" });

  const [formData, setFormData] = useState({
    farmId: '',
    farmName: '',
    claimType: '',
    cropType: '',
    affectedArea: '',
    damageDescription: '',
    estimatedLoss: '',
    damageDate: '',
    contactPhone: '',
    additionalInfo: ''
  });

  const claimTypes = [
    'Weather Damage (Drought, Flood, Hail)',
    'Pest Infestation',
    'Disease Outbreak',
    'Fire Damage',
    'Equipment Failure',
    'Other'
  ];

  // Define sensor thresholds for abnormal conditions
  const sensorThresholds = {
    temperature: { min: 15, max: 35, droughtMin: 40, floodMax: 10 },
    humidity: { min: 40, max: 80, droughtMax: 30, floodMin: 85 },
    soil: { min: 30, max: 70, droughtMax: 20, floodMin: 80 },
    rain: { normal: 10, drought: 2, flood: 50 }
  };

  // Fetch sensor data based on the logged-in user's farm
  useEffect(() => {
    if (user && user._id) {
      const fetchSensorData = async () => {
        setIsLoadingSensorData(true);
        try {
          // Fetch data from the same API endpoint as the farmer dashboard
          const res = await fetch(`/api/sensor-data?farmId=${user._id}`);
          if (!res.ok) {
            throw new Error(`Failed to fetch sensor data: ${res.statusText}`);
          }
          let json = await res.json();

          // Process data to ensure correct types
          const processedData = json.map(entry => ({
            ...entry,
            timestamp: new Date(entry.timestamp),
            temperature: Number(entry.temperature),
            humidity: Number(entry.humidity),
            soil: Number(entry.soil),
            rain: Number(entry.rain)
          }));
          setSensorData(processedData);
        } catch (error) {
          console.error("Failed to fetch sensor data:", error);
        } finally {
          setIsLoadingSensorData(false);
        }
      };

      const fetchImages = async () => {
        try {
          const res = await fetch('/api/farm-images');
          if (res.ok) {
            const data = await res.json();
            // Format dates
            const formatted = data.map(img => ({
              ...img,
              timestamp: new Date(img.timestamp)
            }));
            setFarmImages(formatted);
          }
        } catch (error) {
          console.error("Error fetching images:", error);
        }
      };

      fetchSensorData();
      fetchImages();

      const interval = setInterval(() => {
        fetchSensorData();
        fetchImages();
      }, 30000); // Update every 30 seconds
      return () => clearInterval(interval);
    }
  }, [user]);

  // Correlate Images with Sensor Alerts
  useEffect(() => {
    if (sensorData.length === 0 || farmImages.length === 0) return;

    // We consider it a matched event if the image and sensor reading are within 60 seconds
    const TIME_WINDOW_MS = 60 * 1000;

    const matchedEvidence = [];

    // Reverse iterate to find the most recent images first
    farmImages.forEach(img => {
      // Find the closest sensor reading to this image capture
      let closestReading = null;
      let minDiff = Infinity;

      sensorData.forEach(reading => {
        const diff = Math.abs(img.timestamp.getTime() - reading.timestamp.getTime());
        if (diff < minDiff && diff <= TIME_WINDOW_MS) {
          minDiff = diff;
          closestReading = reading;
        }
      });

      if (closestReading) {
        // Evaluate what threshold breached at this exact reading based on NamuddeSensor logic
        const alerts = [];
        if (closestReading.temperature > 20) alerts.push("High Temperature (>20°C)");
        if (closestReading.soil < 30) alerts.push("Low Soil Moisture (<30%)");

        if (alerts.length > 0) {
          matchedEvidence.push({
            imagePath: img.imagePath,
            reading: closestReading,
            alerts: alerts,
            timestamp: closestReading.timestamp,
            hashId: img.reportedHash
          });
        }
      }
    });

    setEvidenceAlerts(matchedEvidence);

  }, [sensorData, farmImages]);

  // Validate sensor conditions based on claim type
  const validateSensorConditions = (claimType) => {
    if (sensorData.length === 0) {
      return { isValid: false, reason: "No sensor data available" };
    }

    // Get recent data (last 24 hours)
    const now = new Date();
    const recentData = sensorData.filter(entry => {
      const timeDiff = now - entry.timestamp;
      return timeDiff <= 24 * 60 * 60 * 1000;
    });

    if (recentData.length === 0) {
      return { isValid: false, reason: "No recent sensor data available" };
    }

    // Get latest readings
    const latest = recentData[recentData.length - 1];
    const avgTemp = recentData.reduce((sum, d) => sum + d.temperature, 0) / recentData.length;
    const avgHumidity = recentData.reduce((sum, d) => sum + d.humidity, 0) / recentData.length;
    const avgSoil = recentData.reduce((sum, d) => sum + d.soil, 0) / recentData.length;
    const totalRain = recentData.reduce((sum, d) => sum + d.rain, 0);

    switch (claimType) {
      case 'Weather Damage (Drought, Flood, Hail)':
        // Check for drought conditions
        if (avgTemp > sensorThresholds.temperature.droughtMin &&
          avgHumidity < sensorThresholds.humidity.droughtMax &&
          avgSoil < sensorThresholds.soil.droughtMax &&
          totalRain < sensorThresholds.rain.drought) {
          return {
            isValid: true,
            reason: `Drought conditions detected: Temp ${avgTemp.toFixed(1)}°C, Humidity ${avgHumidity.toFixed(1)}%, Soil ${avgSoil.toFixed(1)}%, Rain ${totalRain}mm`
          };
        }

        // Check for flood conditions
        if (avgHumidity > sensorThresholds.humidity.floodMin &&
          avgSoil > sensorThresholds.soil.floodMin &&
          totalRain > sensorThresholds.rain.flood) {
          return {
            isValid: true,
            reason: `Flood conditions detected: Humidity ${avgHumidity.toFixed(1)}%, Soil ${avgSoil.toFixed(1)}%, Rain ${totalRain}mm`
          };
        }

        // Check for extreme temperature (hail/storm indicator)
        if (latest.temperature < sensorThresholds.temperature.floodMax ||
          latest.temperature > sensorThresholds.temperature.droughtMin) {
          return {
            isValid: true,
            reason: `Extreme weather detected: Temperature ${latest.temperature}°C`
          };
        }

        return {
          isValid: false,
          reason: `Current conditions appear normal. Temp: ${avgTemp.toFixed(1)}°C, Humidity: ${avgHumidity.toFixed(1)}%, Soil: ${avgSoil.toFixed(1)}%, Rain: ${totalRain}mm`
        };

      case 'Fire Damage':
        if (avgTemp > sensorThresholds.temperature.droughtMin &&
          avgHumidity < sensorThresholds.humidity.droughtMax) {
          return {
            isValid: true,
            reason: `Fire risk conditions: High temp ${avgTemp.toFixed(1)}°C, Low humidity ${avgHumidity.toFixed(1)}%`
          };
        }
        return {
          isValid: false,
          reason: `No fire risk conditions detected. Current temp: ${avgTemp.toFixed(1)}°C, humidity: ${avgHumidity.toFixed(1)}%`
        };

      case 'Disease Outbreak':
      case 'Pest Infestation':
        // High humidity can lead to fungal diseases and pest issues
        if (avgHumidity > sensorThresholds.humidity.max && avgSoil > sensorThresholds.soil.max) {
          return {
            isValid: true,
            reason: `High moisture conditions favorable for pests/disease: Humidity ${avgHumidity.toFixed(1)}%, Soil ${avgSoil.toFixed(1)}%`
          };
        }
        return {
          isValid: false,
          reason: `Current moisture levels appear normal. Humidity: ${avgHumidity.toFixed(1)}%, Soil: ${avgSoil.toFixed(1)}%`
        };

      case 'Equipment Failure':
      case 'Other':
        // Allow these claims regardless of sensor data
        return {
          isValid: true,
          reason: "Claim type not dependent on environmental conditions"
        };

      default:
        return {
          isValid: false,
          reason: "Unknown claim type"
        };
    }
  };

  // Fetch user's farms
  useEffect(() => {
    if (user) {
      const fetchUserFarms = async () => {
        setIsLoadingFarms(true);
        try {
          const res = await fetch('/api/farmer/farms');
          if (res.ok) {
            const data = await res.json();
            const approvedFarms = data.farms.filter(farm => farm.approval === 'approved');
            setUserFarms(approvedFarms);
          }
        } catch (error) {
          console.error("Error fetching farms:", error);
        } finally {
          setIsLoadingFarms(false);
        }
      };
      fetchUserFarms();
    }
  }, [user]);

  // Fetch existing claims
  useEffect(() => {
    if (user) {
      const fetchClaims = async () => {
        try {
          const res = await fetch('/api/farmer/insurance-claims');
          if (res.ok) {
            const data = await res.json();
            setExistingClaims(data.claims || []);
          }
        } catch (error) {
          console.error("Error fetching claims:", error);
        }
      };
      fetchClaims();
    }
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Auto-fill farm name when farm is selected
    if (name === 'farmId') {
      const selectedFarm = userFarms.find(farm => farm._id === value);
      if (selectedFarm) {
        setFormData(prev => ({
          ...prev,
          farmName: selectedFarm.farmName
        }));
      }
    }

    // Validate sensor conditions when claim type changes
    if (name === 'claimType') {
      const validation = validateSensorConditions(value);
      setSensorValidation(validation);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate sensor conditions before submission
    const validation = validateSensorConditions(formData.claimType);
    setSensorValidation(validation);

    if (!validation.isValid) {
      setSubmitMessage({
        text: `Cannot submit claim: ${validation.reason}. Insurance claims can only be submitted during abnormal sensor conditions.`,
        isError: true
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage({ text: "", isError: false });

    try {
      const res = await fetch('/api/farmer/insurance-claims', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          sensorValidation: validation // Include sensor validation in the submission
        })
      });

      const data = await res.json();

      if (res.ok) {
        setSubmitMessage({
          text: `Insurance claim submitted successfully! Claim Number: ${data.claimNumber}. Sensor validation: ${validation.reason}`,
          isError: false
        });

        // Reset form
        setFormData({
          farmId: '',
          farmName: '',
          claimType: '',
          cropType: '',
          affectedArea: '',
          damageDescription: '',
          estimatedLoss: '',
          damageDate: '',
          contactPhone: '',
          additionalInfo: ''
        });
        setSensorValidation({ isValid: false, reason: "" });

        // Refresh claims list
        setTimeout(() => {
          window.location.reload();
        }, 3000);

      } else {
        setSubmitMessage({
          text: data.message || 'Failed to submit claim',
          isError: true
        });
      }
    } catch (error) {
      console.error('Error submitting claim:', error);
      setSubmitMessage({
        text: 'Network error. Please try again.',
        isError: true
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  // Auth guards
  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', textAlign: 'center' }}>
        <p style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>You are not logged in.</p>
        <Link href="/#signup" style={{ backgroundColor: '#059669', color: 'white', padding: '0.75rem 2rem', borderRadius: '9999px', textDecoration: 'none', fontWeight: '600' }}>
          Home
        </Link>
      </div>
    );
  }

  if (user.role !== "Farmer") {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', textAlign: 'center' }}>
        <p style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Access Denied</p>
        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>Your role does not have permission to access this page.</p>
        <Link href="/" style={{ backgroundColor: '#2563eb', color: 'white', padding: '0.75rem 2rem', borderRadius: '9999px', textDecoration: 'none', fontWeight: '600' }}>
          Go Back Home
        </Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <header style={{ width: '100%', padding: '1rem 1.5rem', backgroundColor: 'white', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'inherit' }}>
            <span style={{ fontSize: '1.125rem', fontWeight: 'bold' }}>🌿 AgriChain Farmer</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: '#374151', fontWeight: '500' }}>Welcome, {user.name}</span>
            <button
              onClick={logout}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', backgroundColor: '#ef4444', color: 'white', borderRadius: '0.375rem', border: 'none', cursor: 'pointer' }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ padding: '2rem' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
          {/* Back Navigation */}
          <Link
            href="/farmer-dashboard"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#2563eb', textDecoration: 'none', marginBottom: '1.5rem' }}
          >
            ← Back to Dashboard
          </Link>

          {/* Sensor Status Display */}
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.75rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem', color: '#111827' }}>Current Farm Conditions</h2>
            {isLoadingSensorData ? (
              <p style={{ color: '#6b7280' }}>Loading sensor data...</p>
            ) : sensorData.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.875rem' }}>
                <div style={{ textAlign: 'center', padding: '0.75rem', backgroundColor: '#f3f4f6', borderRadius: '0.5rem' }}>
                  <div style={{ fontWeight: '600', color: '#374151' }}>Temperature</div>
                  <div style={{ fontSize: '1.5rem', color: '#ef4444' }}>{sensorData[sensorData.length - 1]?.temperature}°C</div>
                </div>
                <div style={{ textAlign: 'center', padding: '0.75rem', backgroundColor: '#f3f4f6', borderRadius: '0.5rem' }}>
                  <div style={{ fontWeight: '600', color: '#374151' }}>Humidity</div>
                  <div style={{ fontSize: '1.5rem', color: '#3b82f6' }}>{sensorData[sensorData.length - 1]?.humidity}%</div>
                </div>
                <div style={{ textAlign: 'center', padding: '0.75rem', backgroundColor: '#f3f4f6', borderRadius: '0.5rem' }}>
                  <div style={{ fontWeight: '600', color: '#374151' }}>Soil Moisture</div>
                  <div style={{ fontSize: '1.5rem', color: '#a16207' }}>{sensorData[sensorData.length - 1]?.soil}%</div>
                </div>
                <div style={{ textAlign: 'center', padding: '0.75rem', backgroundColor: '#f3f4f6', borderRadius: '0.5rem' }}>
                  <div style={{ fontWeight: '600', color: '#374151' }}>Rainfall</div>
                  <div style={{ fontSize: '1.5rem', color: '#6b7280' }}>{sensorData[sensorData.length - 1]?.rain}mm</div>
                </div>
              </div>
            ) : (
              <p style={{ color: '#ef4444' }}>No sensor data available</p>
            )}
          </div>

          {/* Verified Alerts & Evidence Dashboard */}
          {evidenceAlerts.length > 0 && (
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.75rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '1.5rem' }}>📸</span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', margin: 0 }}>Verified Field Evidence</h2>
                <span style={{ fontSize: '0.75rem', backgroundColor: '#fee2e2', color: '#dc2626', padding: '0.25rem 0.5rem', borderRadius: '9999px', fontWeight: 'bold' }}>
                  {evidenceAlerts.length} Active Alerts
                </span>
              </div>
              <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                The following images were automatically captured by the IoT camera when abnormal field conditions were detected by the sensors.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {evidenceAlerts.map((evidence, idx) => (
                  <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', overflow: 'hidden' }}>
                    <div style={{ position: 'relative', width: '100%', height: '200px', backgroundColor: '#f3f4f6' }}>
                      {/* Using standard img tag since Next/Image requires remote pattern configuration */}
                      <img
                        src={evidence.imagePath}
                        alt="Farm Camera Evidence"
                        style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="%239ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
                        }}
                      />
                      <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
                        {formatDate(evidence.timestamp)} {evidence.timestamp.toLocaleTimeString()}
                      </div>
                    </div>

                    <div style={{ padding: '1rem' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#dc2626', marginBottom: '0.5rem' }}>
                        Alerts: {evidence.alerts.join(', ')}
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.75rem', textAlign: 'center' }}>
                        <div style={{ backgroundColor: '#fef2f2', padding: '0.5rem', borderRadius: '0.25rem' }}>
                          <span style={{ display: 'block', color: '#6b7280', marginBottom: '0.25rem' }}>Temp</span>
                          <span style={{ fontWeight: 'bold', color: evidence.reading.temperature > 20 ? '#dc2626' : '#374151' }}>
                            {evidence.reading.temperature}°C
                          </span>
                        </div>
                        <div style={{ backgroundColor: '#eff6ff', padding: '0.5rem', borderRadius: '0.25rem' }}>
                          <span style={{ display: 'block', color: '#6b7280', marginBottom: '0.25rem' }}>Humidity</span>
                          <span style={{ fontWeight: 'bold', color: '#2563eb' }}>
                            {evidence.reading.humidity}%
                          </span>
                        </div>
                        <div style={{ backgroundColor: '#fefce8', padding: '0.5rem', borderRadius: '0.25rem' }}>
                          <span style={{ display: 'block', color: '#6b7280', marginBottom: '0.25rem' }}>Soil</span>
                          <span style={{ fontWeight: 'bold', color: evidence.reading.soil < 30 ? '#d97706' : '#854d0e' }}>
                            {evidence.reading.soil}%
                          </span>
                        </div>
                      </div>
                      <div style={{ marginTop: '0.75rem', fontSize: '0.65rem', color: '#9ca3af', wordBreak: 'break-all' }}>
                        Hash (chain of custody): {evidence.hashId?.substring(0, 16)}...
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Page Header */}
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.75rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', marginBottom: '2rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#111827', margin: '0 0 0.5rem 0' }}>IoT-Validated Insurance Claims</h1>
              <p style={{ color: '#6b7280', margin: 0 }}>Submit insurance claims based on real-time sensor data validation</p>
            </div>

            <div>
              <button
                onClick={() => setShowForm(!showForm)}
                style={{
                  backgroundColor: '#2563eb',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                {showForm ? 'Cancel' : 'New Claim'}
              </button>
            </div>
          </div>

          {/* New Claim Form */}
          {showForm && (
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.75rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1.5rem' }}>Submit New Insurance Claim</h2>

              {/* Sensor Validation Status */}
              {formData.claimType && (
                <div style={{
                  marginBottom: '1.5rem',
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  backgroundColor: sensorValidation.isValid ? '#f0fdf4' : '#fef2f2',
                  color: sensorValidation.isValid ? '#166534' : '#991b1b',
                  border: `1px solid ${sensorValidation.isValid ? '#bbf7d0' : '#fecaca'}`
                }}>
                  <strong>{sensorValidation.isValid ? '✓ Claim Eligible:' : '✗ Claim Not Eligible:'}</strong> {sensorValidation.reason}
                </div>
              )}

              {submitMessage.text && (
                <div style={{
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  backgroundColor: submitMessage.isError ? '#fef2f2' : '#f0fdf4',
                  color: submitMessage.isError ? '#991b1b' : '#166534'
                }}>
                  {submitMessage.text}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  {/* Farm Selection */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>
                      Select Farm *
                    </label>
                    <select
                      name="farmId"
                      value={formData.farmId}
                      onChange={handleInputChange}
                      required
                      disabled={isLoadingFarms}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                      }}
                    >
                      <option value="">Select a farm...</option>
                      {userFarms.map(farm => (
                        <option key={farm._id} value={farm._id}>
                          {farm.farmName} - {farm.location}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Claim Type */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>
                      Claim Type * (Sensor validation required)
                    </label>
                    <select
                      name="claimType"
                      value={formData.claimType}
                      onChange={handleInputChange}
                      required
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                      }}
                    >
                      <option value="">Select claim type...</option>
                      {claimTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  {/* Rest of the form fields remain the same */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>
                      Crop Type *
                    </label>
                    <input
                      type="text"
                      name="cropType"
                      value={formData.cropType}
                      onChange={handleInputChange}
                      placeholder="e.g., Rice, Wheat, Mango"
                      required
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>
                      Affected Area (acres) *
                    </label>
                    <input
                      type="number"
                      name="affectedArea"
                      value={formData.affectedArea}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      required
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>
                      Estimated Loss (INR) *
                    </label>
                    <input
                      type="number"
                      name="estimatedLoss"
                      value={formData.estimatedLoss}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      required
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>
                      Date of Damage *
                    </label>
                    <input
                      type="date"
                      name="damageDate"
                      value={formData.damageDate}
                      onChange={handleInputChange}
                      required
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      name="contactPhone"
                      value={formData.contactPhone}
                      onChange={handleInputChange}
                      placeholder="+91 9876543210"
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>
                    Damage Description *
                  </label>
                  <textarea
                    name="damageDescription"
                    value={formData.damageDescription}
                    onChange={handleInputChange}
                    rows={4}
                    placeholder="Please describe the nature and extent of the damage..."
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>
                    Additional Information
                  </label>
                  <textarea
                    name="additionalInfo"
                    value={formData.additionalInfo}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Any additional details that might help with your claim..."
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    disabled={isSubmitting || isLoadingFarms || !sensorValidation.isValid}
                    style={{
                      backgroundColor: (isSubmitting || !sensorValidation.isValid) ? '#93c5fd' : '#2563eb',
                      color: 'white',
                      padding: '0.75rem 2rem',
                      borderRadius: '0.5rem',
                      border: 'none',
                      fontWeight: '600',
                      cursor: (isSubmitting || !sensorValidation.isValid) ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    {isSubmitting ? 'Submitting...' :
                      !sensorValidation.isValid && formData.claimType ? 'Claim Not Eligible' :
                        'Submit Claim'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Existing Claims */}
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.75rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1.5rem' }}>Your Insurance Claims</h2>

            {existingClaims.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <p style={{ color: '#6b7280' }}>No insurance claims found.</p>
                <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Submit your first claim using the form above when sensor conditions indicate damage.</p>
              </div>
            ) : (
              <div>
                {existingClaims.map(claim => (
                  <div key={claim._id} style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827', margin: '0 0 0.25rem 0' }}>
                          {claim.farmName}
                        </h3>
                        <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
                          Claim #{claim.claimNumber}
                        </p>
                        {claim.sensorValidation && (
                          <p style={{ fontSize: '0.75rem', color: '#059669', margin: '0.25rem 0 0 0', fontStyle: 'italic' }}>
                            IoT Validated: {claim.sensorValidation.reason}
                          </p>
                        )}
                      </div>
                      <div style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        backgroundColor: claim.status === 'approved' ? '#dcfce7' :
                          claim.status === 'rejected' ? '#fee2e2' :
                            claim.status === 'under_review' ? '#dbeafe' : '#fef3c7',
                        color: claim.status === 'approved' ? '#166534' :
                          claim.status === 'rejected' ? '#991b1b' :
                            claim.status === 'under_review' ? '#1e40af' : '#92400e'
                      }}>
                        {claim.status.replace('_', ' ').toUpperCase()}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                      <div>
                        <span style={{ fontWeight: '500', color: '#374151' }}>Claim Type:</span>
                        <p style={{ color: '#6b7280', margin: '0.25rem 0 0 0' }}>{claim.claimType}</p>
                      </div>
                      <div>
                        <span style={{ fontWeight: '500', color: '#374151' }}>Crop:</span>
                        <p style={{ color: '#6b7280', margin: '0.25rem 0 0 0' }}>{claim.cropType}</p>
                      </div>
                      <div>
                        <span style={{ fontWeight: '500', color: '#374151' }}>Affected Area:</span>
                        <p style={{ color: '#6b7280', margin: '0.25rem 0 0 0' }}>{claim.affectedArea} acres</p>
                      </div>
                      <div>
                        <span style={{ fontWeight: '500', color: '#374151' }}>Estimated Loss:</span>
                        <p style={{ color: '#6b7280', margin: '0.25rem 0 0 0' }}>{formatCurrency(claim.estimatedLoss)}</p>
                      </div>
                    </div>

                    <div style={{ paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb', fontSize: '0.875rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af' }}>
                        <span>Damage Date: {formatDate(claim.damageDate)}</span>
                        <span>Submitted: {formatDate(claim.submittedAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}