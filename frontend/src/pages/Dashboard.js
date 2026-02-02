import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import AQIGaugeChart from '../components/AQIGaugeChart';
import AirQualityRadarChart from '../components/AirQualityRadarChart';
import RealTimeMonitor from '../components/RealTimeMonitor';
import { aqiAPI } from '../services/api';

const Dashboard = () => {
  const [location, setLocation] = useState(null);
  const [currentData, setCurrentData] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Get User Location on Mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        (err) => {
          console.error("Location access denied or failed:", err);
          // Fallback to NYC
          setLocation({ lat: 40.7128, lon: -74.0060 });
          setError("Location access denied. Showing default location (NYC).");
        }
      );
    } else {
      setLocation({ lat: 40.7128, lon: -74.0060 });
      setError("Geolocation not supported. Showing default location.");
    }
  }, []);

  // Fetch Data when Location or Trigger Changes
  // Handle manual data updates from RealTimeMonitor
  const handleRealtimeDataUpdate = (data) => {
    if (currentData) {
      setCurrentData({
        ...currentData,
        temperature: data.temperature,
        humidity: data.humidity,
        wind_speed: data.windSpeed,
        pm25: data.pm25,
        pm10: data.pm10,
        co2: data.co2 || data.co, // Handle mismatch
        aqi: Math.round(((data.pm25 || 0) * 5 + (data.pm10 || 0) * 2 + (data.co2 || data.co || 0) * 0.1) / 3)
      });
    }
  };

  useEffect(() => {
    if (!location) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const { lat, lon } = location;
        const [currentAqiResponse, forecastResponse] = await Promise.all([
          aqiAPI.getCurrentAQI(lat, lon),
          aqiAPI.getForecast(lat, lon, 7)
        ]);
        setCurrentData(currentAqiResponse);
        setForecast(forecastResponse.forecast.map((item, index) => ({ day: `Day ${index + 1}`, aqi: item.aqi })));
        setError(null); // Clear previous errors on success
      } catch (err) {
        console.error(err);
        setError('Failed to fetch data');
      }
      setLoading(false);
    };

    fetchData();
  }, [location, refreshTrigger]);

  const getAqiColor = (aqi) => {
    if (aqi <= 50) return 'text-green-600';
    if (aqi <= 100) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {currentData && currentData.aqi > 100 && (
        <div className="bg-red-500 text-white px-4 py-3 text-center font-semibold shadow-lg">
          ⚠️ Air Quality Alert: High AQI detected! Avoid outdoor activities.
        </div>
      )}
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Dashboard</h1>
            <p className="text-gray-600">
              Real-time air quality & weather for
              {location ? ` (${location.lat.toFixed(2)}, ${location.lon.toFixed(2)})` : " locating..."}
            </p>
          </div>
          <button
            onClick={() => setRefreshTrigger(prev => prev + 1)}
            className="mt-4 md:mt-0 bg-white hover:bg-gray-50 text-gray-800 font-semibold py-2 px-4 border border-gray-400 rounded shadow transition duration-200 flex items-center"
            disabled={loading}
          >
            <span className={`mr-2 ${loading ? 'animate-spin' : ''}`}>🔄</span>
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>

        {/* Real-Time Monitor */}
        <div className="mb-8">
          {location && (
            <RealTimeMonitor
              latitude={location.lat}
              longitude={location.lon}
              onDataUpdate={handleRealtimeDataUpdate}
              refreshTrigger={refreshTrigger}
            />
          )}
        </div>
        {loading && (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
          </div>
        )}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}
        {currentData && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center mb-4">
                <div className="bg-green-100 p-3 rounded-full mr-4">
                  <span className="text-2xl">🌬️</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-700">Air Quality Index</h2>
                  <p className="text-sm text-gray-500">Current AQI</p>
                </div>
              </div>
              <p className={`text-3xl font-bold ${getAqiColor(currentData.aqi)}`}>{currentData.aqi}</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center mb-4">
                <div className="bg-blue-100 p-3 rounded-full mr-4">
                  <span className="text-2xl">🌡️</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-700">CO₂ Level</h2>
                  <p className="text-sm text-gray-500">Parts per million</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-blue-600">{currentData.co2} ppm</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center mb-4">
                <div className="bg-purple-100 p-3 rounded-full mr-4">
                  <span className="text-2xl">💨</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-700">Wind Speed</h2>
                  <p className="text-sm text-gray-500">Meters per second</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-purple-600">{currentData.wind_speed || 'N/A'} m/s</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-red-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center mb-4">
                <div className="bg-red-100 p-3 rounded-full mr-4">
                  <span className="text-2xl">🌡️</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-700">Temperature</h2>
                  <p className="text-sm text-gray-500">Celsius</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-red-600">{currentData.temperature}°C</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-indigo-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center mb-4">
                <div className="bg-indigo-100 p-3 rounded-full mr-4">
                  <span className="text-2xl">💧</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-700">Humidity</h2>
                  <p className="text-sm text-gray-500">Percentage</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-indigo-600">{currentData.humidity}%</p>
            </div>
          </div>
        )}
        {currentData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <AQIGaugeChart aqi={currentData.aqi} loading={loading} />
            <AirQualityRadarChart
              aqi={currentData.aqi}
              pm25={currentData.pm25}
              pm10={currentData.pm10}
              co2={currentData.co2}
              temperature={currentData.temperature}
              humidity={currentData.humidity}
              loading={loading}
            />
          </div>
        )}
        {forecast.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">📈 7-Day AQI Forecast</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={forecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="day" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#f8f9fa',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="aqi"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 6 }}
                  activeDot={{ r: 8, stroke: '#10b981', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
