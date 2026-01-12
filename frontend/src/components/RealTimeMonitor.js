useEffect(() => {
  console.log("API BASE FROM VITE:", import.meta.env.VITE_API_BASE_URL);
}, []);

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";

const RealTimeMonitor = ({
  latitude = 40.7128,
  longitude = -74.006,
  onDataUpdate,
}) => {
  /* ------------------ STATE ------------------ */

  const [realtimeData, setRealtimeData] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const [manualData, setManualData] = useState({
    temperature: 22,
    humidity: 65,
    windSpeed: 3.5,
    co: 250,
    no2: 15,
    o3: 30,
    so2: 5,
    pm25: 15,
    pm10: 25,
  });

  const wsRef = useRef(null);

  /* ------------------ HELPERS ------------------ */

  const getAQIColor = (aqi) => {
    if (aqi <= 50) return "#00ff88";
    if (aqi <= 100) return "#ffff00";
    if (aqi <= 150) return "#ff8800";
    if (aqi <= 200) return "#ff4444";
    if (aqi <= 300) return "#aa00aa";
    return "#660000";
  };

  const getStatusColor = (status) => {
    if (status === "connected") return "#00ff88";
    if (status === "error") return "#ff8800";
    return "#ff4444";
  };

  const updateManualData = (field, value) => {
    const updated = { ...manualData, [field]: Number(value) };
    setManualData(updated);
    onDataUpdate?.(updated);
  };

  const toggleMode = () => {
    setIsEditing((prev) => !prev);
    onDataUpdate?.(manualData);
  };

  const getDisplayData = () => {
    if (isEditing) {
      return {
        aqi: {
          value: 50,
          status: "Good",
          pm25: manualData.pm25,
          co: manualData.co,
          no2: manualData.no2,
          o3: manualData.o3,
          so2: manualData.so2,
        },
        weather: {
          temperature: manualData.temperature,
          humidity: manualData.humidity,
          wind_speed: manualData.windSpeed,
          description: "Manual Input",
        },
      };
    }
    return realtimeData;
  };

  /* ------------------ WEBSOCKET ------------------ */

  const connectWebSocket = useCallback(() => {
    try {
      const API_BASE =
        import.meta.env.https://green-guard-vl8a.onrender.com || "http://localhost:8020";

      const WS_BASE = API_BASE.replace(/^http/, "ws");

      const ws = new WebSocket(
        `${WS_BASE}/ws/realtime-monitoring?latitude=${latitude}&longitude=${longitude}`
      );

      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus("connected");
        setIsLoading(true);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data?.type === "realtime_update") {
          setRealtimeData(data);
          setAlerts(data.alerts || []);
          setIsLoading(false);
        }
      };

      ws.onerror = () => {
        setConnectionStatus("error");
      };

      ws.onclose = () => {
        setConnectionStatus("disconnected");
        setTimeout(connectWebSocket, 5000); // auto-reconnect
      };
    } catch {
      setConnectionStatus("error");
    }
  }, [latitude, longitude]);

  useEffect(() => {
    connectWebSocket();
    return () => wsRef.current?.close();
  }, [connectWebSocket]);

  const displayData = getDisplayData();

  /* ------------------ UI ------------------ */

  return (
    <div className="glass-panel rounded-3xl p-8">

      {/* HEADER */}
      <div className="flex justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-neon-green">
            Real-Time Monitor
            {isEditing && (
              <span className="ml-2 text-xs bg-neon-green text-black px-2 py-1 rounded">
                MANUAL
              </span>
            )}
          </h2>
          <p className="text-neon-cyan/70">
            {isEditing ? "Manual Mode" : "Live Data Streaming"}
          </p>
        </div>

        <div className="text-right">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getStatusColor(connectionStatus) }}
            />
            <span className="text-sm text-neon-cyan">
              {connectionStatus}
            </span>
          </div>

          <button
            onClick={toggleMode}
            className="px-3 py-1 rounded-full text-xs bg-neon-cyan/20 text-neon-cyan border"
          >
            {isEditing ? "Real-Time Mode" : "Manual Mode"}
          </button>
        </div>
      </div>

      {/* BODY */}
      {isLoading && !isEditing ? (
        <div className="text-center py-12">
          <div className="animate-spin w-10 h-10 border-4 border-neon-green border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-neon-cyan/70">Connecting...</p>
        </div>
      ) : displayData ? (
        <div className="space-y-6">
          <div className="text-center">

            {/* AQI */}
            <div className="mb-4">
              <div
                className="w-24 h-24 mx-auto rounded-full flex items-center justify-center text-2xl font-bold border-4"
                style={{
                  color: getAQIColor(displayData.aqi?.value || 50),
                  borderColor: getAQIColor(displayData.aqi?.value || 50),
                  backgroundColor: `${getAQIColor(
                    displayData.aqi?.value
