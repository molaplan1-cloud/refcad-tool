import React, { useState, useCallback } from 'react';
import { jsPDF } from 'jspdf';

const genId = () => Math.random().toString(36).substr(2, 9);

const ROOM_TYPES = [
  { id: 'chilled', name: 'Chilled Storage', temp: 2, color: '#3b82f6' },
  { id: 'frozen', name: 'Frozen Storage', temp: -18, color: '#1d4ed8' },
  { id: 'blast-chiller', name: 'Blast Chiller', temp: 0, color: '#06b6d4' },
  { id: 'blast-freezer', name: 'Blast Freezer', temp: -30, color: '#0891b2' },
  { id: 'fresh', name: 'Fresh Room', temp: -2, color: '#22c55e' }
];

const EQUIPMENT = [
  { id: 'door-900', name: 'Door 900mm', category: 'door', width: 0.9, height: 2.0, depth: 0.1 },
  { id: 'door-1200', name: 'Door 1200mm', category: 'door', width: 1.2, height: 2.2, depth: 0.1 },
  { id: 'evap-small', name: 'Evaporator Small', category: 'evaporator', width: 1.0, height: 0.5, depth: 0.5 },
  { id: 'evap-medium', name: 'Evaporator Medium', category: 'evaporator', width: 1.5, height: 0.6, depth: 0.6 },
  { id: 'evap-large', name: 'Evaporator Large', category: 'evaporator', width: 2.0, height: 0.7, depth: 0.7 }
];

function SimpleApp() {
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [viewMode, setViewMode] = useState('2d'); // '2d' or '3d'
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showAddEquipment, setShowAddEquipment] = useState(false);

  const addRoom = (typeId) => {
    const type = ROOM_TYPES.find(t => t.id === typeId);
    if (!type) return;
    
    const newRoom = {
      id: genId(),
      typeId,
      name: type.name,
      temp: type.temp,
      color: type.color,
      width: 4,
      depth: 4,
      height: 2.8,
      x: 0,
      z: 0,
      equipment: []
    };
    
    setRooms([...rooms, newRoom]);
    setSelectedRoom(newRoom.id);
    setShowAddRoom(false);
  };

  const addEquipmentToRoom = (roomId, equipmentId) => {
    const eq = EQUIPMENT.find(e => e.id === equipmentId);
    if (!eq) return;
    
    const newEquipment = {
      id: genId(),
      ...eq,
      x: 0,
      z: 0,
      y: 0
    };
    
    setRooms(rooms.map(room => {
      if (room.id === roomId) {
        return {
          ...room,
          equipment: [...(room.equipment || []), newEquipment]
        };
      }
      return room;
    }));
    
    setShowAddEquipment(false);
  };

  const updateRoom = (roomId, updates) => {
    setRooms(rooms.map(room => 
      room.id === roomId ? { ...room, ...updates } : room
    ));
  };

  const updateEquipment = (roomId, equipmentId, updates) => {
    setRooms(rooms.map(room => {
      if (room.id === roomId) {
        return {
          ...room,
          equipment: room.equipment.map(eq =>
            eq.id === equipmentId ? { ...eq, ...updates } : eq
          )
        };
      }
      return room;
    }));
  };

  const deleteRoom = (roomId) => {
    setRooms(rooms.filter(room => room.id !== roomId));
    if (selectedRoom === roomId) setSelectedRoom(null);
  };

  const deleteEquipment = (roomId, equipmentId) => {
    setRooms(rooms.map(room => {
      if (room.id === roomId) {
        return {
          ...room,
          equipment: room.equipment.filter(eq => eq.id !== equipmentId)
        };
      }
      return room;
    }));
  };

  const exportToPDF = () => {
    const pdf = new jsPDF();
    pdf.setFontSize(20);
    pdf.text('RefCAD Design', 20, 20);
    pdf.setFontSize(12);
    
    let y = 40;
    rooms.forEach((room, index) => {
      pdf.text(`${index + 1}. ${room.name}`, 20, y);
      pdf.text(`   Dimensions: ${room.width}m x ${room.depth}m x ${room.height}m`, 20, y + 8);
      pdf.text(`   Temperature: ${room.temp}°C`, 20, y + 16);
      if (room.equipment && room.equipment.length > 0) {
        pdf.text(`   Equipment: ${room.equipment.length} items`, 20, y + 24);
      }
      y += 40;
    });
    
    pdf.save('refcad-design.pdf');
  };

  const selectedRoomData = rooms.find(r => r.id === selectedRoom);

  return (
    <div className="simple-app">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <h1>RefCAD</h1>
          <span className="header-subtitle">Cold Room Designer</span>
        </div>
        <div className="header-right">
          <button className="header-btn" onClick={() => window.location.href = '/'}>
            ← Back to Home
          </button>
          <button className="header-btn primary" onClick={exportToPDF}>
            Export PDF
          </button>
        </div>
      </header>

      <div className="app-content">
        {/* Left Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-section">
            <h3>Rooms</h3>
            <button 
              className="add-btn"
              onClick={() => setShowAddRoom(true)}
            >
              + Add Room
            </button>
            <div className="room-list">
              {rooms.map(room => (
                <div 
                  key={room.id}
                  className={`room-item ${selectedRoom === room.id ? 'selected' : ''}`}
                  onClick={() => setSelectedRoom(room.id)}
                >
                  <div className="room-name">{room.name}</div>
                  <div className="room-temp">{room.temp}°C</div>
                  <button 
                    className="delete-btn"
                    onClick={(e) => { e.stopPropagation(); deleteRoom(room.id); }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {selectedRoomData && (
            <div className="sidebar-section">
              <h3>Equipment</h3>
              <button 
                className="add-btn"
                onClick={() => setShowAddEquipment(true)}
              >
                + Add Equipment
              </button>
              <div className="equipment-list">
                {selectedRoomData.equipment && selectedRoomData.equipment.map(eq => (
                  <div 
                    key={eq.id}
                    className="equipment-item"
                  >
                    <div className="equipment-name">{eq.name}</div>
                    <button 
                      className="delete-btn"
                      onClick={() => deleteEquipment(selectedRoom, eq.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main Canvas */}
        <main className="canvas">
          <div className="canvas-controls">
            <button 
              className={`view-btn ${viewMode === '2d' ? 'active' : ''}`}
              onClick={() => setViewMode('2d')}
            >
              2D View
            </button>
            <button 
              className={`view-btn ${viewMode === '3d' ? 'active' : ''}`}
              onClick={() => setViewMode('3d')}
            >
              3D View
            </button>
          </div>

          {viewMode === '2d' ? (
            <div className="canvas-2d">
              {rooms.map(room => (
                <div
                  key={room.id}
                  className={`room-2d ${selectedRoom === room.id ? 'selected' : ''}`}
                  style={{
                    left: `${room.x * 50 + 200}px`,
                    top: `${room.z * 50 + 200}px`,
                    width: `${room.width * 50}px`,
                    height: `${room.depth * 50}px`,
                    backgroundColor: room.color,
                    borderColor: selectedRoom === room.id ? '#000' : room.color
                  }}
                  onClick={() => setSelectedRoom(room.id)}
                >
                  <div className="room-label">{room.name}</div>
                  <div className="room-dimensions">
                    {room.width}m × {room.depth}m
                  </div>
                  {room.equipment && room.equipment.map(eq => (
                    <div
                      key={eq.id}
                      className="equipment-2d"
                      style={{
                        left: `${eq.x * 50 + room.width * 25}px`,
                        top: `${eq.z * 50 + room.depth * 25}px`,
                        width: `${eq.width * 50}px`,
                        height: `${eq.depth * 50}px`,
                        backgroundColor: eq.category === 'door' ? '#fbbf24' : '#94a3b8'
                      }}
                    />
                  ))}
                </div>
              ))}
              {rooms.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">❄️</div>
                  <div className="empty-text">Start by adding a room</div>
                  <button 
                    className="empty-btn"
                    onClick={() => setShowAddRoom(true)}
                  >
                    Add Your First Room
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="canvas-3d">
              <div className="isometric-view">
                {rooms.map(room => {
                  const w = room.width * 40;
                  const d = room.depth * 40;
                  const h = room.height * 40;
                  const x = room.x * 40 + 300;
                  const y = room.z * 40 + 200;
                  
                  return (
                    <div
                      key={room.id}
                      className="room-3d"
                      style={{
                        left: `${x}px`,
                        top: `${y}px`,
                        width: `${w}px`,
                        height: `${d}px`,
                        backgroundColor: room.color
                      }}
                    >
                      <div className="room-3d-front" style={{ height: `${h}px`, backgroundColor: room.color }} />
                      <div className="room-3d-side" style={{ height: `${h}px`, backgroundColor: room.color }} />
                      <div className="room-3d-top" style={{ backgroundColor: room.color }} />
                      <div className="room-3d-label">{room.name}</div>
                    </div>
                  );
                })}
                {rooms.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-icon">🎲</div>
                    <div className="empty-text">3D view requires rooms</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Right Sidebar - Properties */}
        <aside className="sidebar properties">
          {selectedRoomData ? (
            <div className="properties-panel">
              <h3>Room Properties</h3>
              <div className="property-group">
                <label>Name</label>
                <input
                  type="text"
                  value={selectedRoomData.name}
                  onChange={(e) => updateRoom(selectedRoom, { name: e.target.value })}
                />
              </div>
              <div className="property-group">
                <label>Width (m)</label>
                <input
                  type="number"
                  step="0.1"
                  value={selectedRoomData.width}
                  onChange={(e) => updateRoom(selectedRoom, { width: parseFloat(e.target.value) })}
                />
              </div>
              <div className="property-group">
                <label>Depth (m)</label>
                <input
                  type="number"
                  step="0.1"
                  value={selectedRoomData.depth}
                  onChange={(e) => updateRoom(selectedRoom, { depth: parseFloat(e.target.value) })}
                />
              </div>
              <div className="property-group">
                <label>Height (m)</label>
                <input
                  type="number"
                  step="0.1"
                  value={selectedRoomData.height}
                  onChange={(e) => updateRoom(selectedRoom, { height: parseFloat(e.target.value) })}
                />
              </div>
              <div className="property-group">
                <label>Temperature (°C)</label>
                <input
                  type="number"
                  step="1"
                  value={selectedRoomData.temp}
                  onChange={(e) => updateRoom(selectedRoom, { temp: parseFloat(e.target.value) })}
                />
              </div>
            </div>
          ) : (
            <div className="properties-panel empty">
              <div className="empty-properties">
                <div className="empty-icon">📋</div>
                <div className="empty-text">Select a room to edit properties</div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Add Room Modal */}
      {showAddRoom && (
        <div className="modal-overlay" onClick={() => setShowAddRoom(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Room</h2>
            <div className="room-types">
              {ROOM_TYPES.map(type => (
                <button
                  key={type.id}
                  className="room-type-btn"
                  onClick={() => addRoom(type.id)}
                  style={{ borderColor: type.color }}
                >
                  <div className="room-type-icon" style={{ backgroundColor: type.color }}>
                    {type.temp}°C
                  </div>
                  <div className="room-type-name">{type.name}</div>
                </button>
              ))}
            </div>
            <button className="modal-close" onClick={() => setShowAddRoom(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add Equipment Modal */}
      {showAddEquipment && selectedRoom && (
        <div className="modal-overlay" onClick={() => setShowAddEquipment(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Equipment</h2>
            <div className="equipment-types">
              {EQUIPMENT.map(eq => (
                <button
                  key={eq.id}
                  className="equipment-type-btn"
                  onClick={() => addEquipmentToRoom(selectedRoom, eq.id)}
                >
                  <div className="equipment-type-name">{eq.name}</div>
                  <div className="equipment-type-cat">{eq.category}</div>
                </button>
              ))}
            </div>
            <button className="modal-close" onClick={() => setShowAddEquipment(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f5f5f5;
        }

        .simple-app {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #ffffff;
        }

        .app-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          background: #ffffff;
          border-bottom: 1px solid #e5e5e5;
          height: 64px;
        }

        .header-left h1 {
          font-size: 24px;
          font-weight: 700;
          color: #1a1a1a;
        }

        .header-subtitle {
          font-size: 14px;
          color: #666;
          margin-left: 8px;
        }

        .header-right {
          display: flex;
          gap: 12px;
        }

        .header-btn {
          padding: 8px 16px;
          border: 1px solid #e5e5e5;
          background: #ffffff;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .header-btn:hover {
          background: #f5f5f5;
        }

        .header-btn.primary {
          background: #1a1a1a;
          color: #ffffff;
          border-color: #1a1a1a;
        }

        .header-btn.primary:hover {
          background: #333;
        }

        .app-content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .sidebar {
          width: 280px;
          background: #f9fafb;
          border-right: 1px solid #e5e5e5;
          padding: 16px;
          overflow-y: auto;
        }

        .sidebar-section {
          margin-bottom: 24px;
        }

        .sidebar-section h3 {
          font-size: 14px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .add-btn {
          width: 100%;
          padding: 10px;
          background: #1a1a1a;
          color: #ffffff;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 12px;
          transition: background 0.2s;
        }

        .add-btn:hover {
          background: #333;
        }

        .room-list, .equipment-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .room-item, .equipment-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: #ffffff;
          border: 1px solid #e5e5e5;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .room-item:hover, .equipment-item:hover {
          border-color: #1a1a1a;
        }

        .room-item.selected {
          border-color: #1a1a1a;
          background: #f0f0f0;
        }

        .room-name, .equipment-name {
          font-size: 14px;
          font-weight: 500;
          color: #1a1a1a;
        }

        .room-temp {
          font-size: 12px;
          color: #666;
        }

        .delete-btn {
          padding: 4px 8px;
          background: #fee2e2;
          color: #dc2626;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600;
          transition: background 0.2s;
        }

        .delete-btn:hover {
          background: #fecaca;
        }

        .canvas {
          flex: 1;
          background: #ffffff;
          position: relative;
          overflow: hidden;
        }

        .canvas-controls {
          position: absolute;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 8px;
          z-index: 10;
        }

        .view-btn {
          padding: 8px 16px;
          background: #ffffff;
          border: 1px solid #e5e5e5;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .view-btn:hover {
          background: #f5f5f5;
        }

        .view-btn.active {
          background: #1a1a1a;
          color: #ffffff;
          border-color: #1a1a1a;
        }

        .canvas-2d, .canvas-3d {
          width: 100%;
          height: 100%;
          position: relative;
        }

        .room-2d {
          position: absolute;
          border: 2px solid;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          opacity: 0.8;
        }

        .room-2d:hover {
          opacity: 1;
          transform: scale(1.02);
        }

        .room-2d.selected {
          opacity: 1;
          box-shadow: 0 0 0 3px rgba(0,0,0,0.2);
        }

        .room-label {
          color: #ffffff;
          font-size: 12px;
          font-weight: 600;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }

        .room-dimensions {
          color: #ffffff;
          font-size: 10px;
          opacity: 0.9;
        }

        .equipment-2d {
          position: absolute;
          border-radius: 2px;
          opacity: 0.7;
        }

        .isometric-view {
          width: 100%;
          height: 100%;
          position: relative;
          background: linear-gradient(135deg, #f5f5f5 0%, #e5e5e5 100%);
        }

        .room-3d {
          position: absolute;
          transform-style: preserve-3d;
          transform: rotateX(60deg) rotateZ(-45deg);
        }

        .room-3d-front {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          transform-origin: bottom;
          transform: rotateX(-90deg);
        }

        .room-3d-side {
          position: absolute;
          bottom: 0;
          right: 0;
          height: 100%;
          transform-origin: right;
          transform: rotateY(90deg);
        }

        .room-3d-top {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }

        .room-3d-label {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #ffffff;
          font-size: 12px;
          font-weight: 600;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
          white-space: nowrap;
        }

        .empty-state {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .empty-text {
          font-size: 16px;
          color: #666;
          margin-bottom: 16px;
        }

        .empty-btn {
          padding: 12px 24px;
          background: #1a1a1a;
          color: #ffffff;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        }

        .properties {
          width: 320px;
          background: #f9fafb;
          border-left: 1px solid #e5e5e5;
          padding: 16px;
          overflow-y: auto;
        }

        .properties-panel {
          background: #ffffff;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          padding: 16px;
        }

        .properties-panel.empty {
          border: none;
          background: transparent;
        }

        .properties-panel h3 {
          font-size: 16px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 16px;
        }

        .property-group {
          margin-bottom: 16px;
        }

        .property-group label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: #666;
          margin-bottom: 6px;
        }

        .property-group input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #e5e5e5;
          border-radius: 4px;
          font-size: 14px;
          color: #1a1a1a;
        }

        .property-group input:focus {
          outline: none;
          border-color: #1a1a1a;
        }

        .empty-properties {
          text-align: center;
          padding: 32px 16px;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: #ffffff;
          border-radius: 12px;
          padding: 24px;
          max-width: 600px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
        }

        .modal h2 {
          font-size: 20px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 20px;
        }

        .room-types, .equipment-types {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .room-type-btn, .equipment-type-btn {
          padding: 16px;
          background: #f9fafb;
          border: 2px solid #e5e5e5;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .room-type-btn:hover, .equipment-type-btn:hover {
          border-color: #1a1a1a;
          background: #ffffff;
        }

        .room-type-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
        }

        .room-type-name, .equipment-type-name {
          font-size: 14px;
          font-weight: 500;
          color: #1a1a1a;
          text-align: center;
        }

        .equipment-type-cat {
          font-size: 12px;
          color: #666;
        }

        .modal-close {
          width: 100%;
          padding: 12px;
          background: #f5f5f5;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: #666;
          transition: background 0.2s;
        }

        .modal-close:hover {
          background: #e5e5e5;
        }
      `}</style>
    </div>
  );
}

export default SimpleApp;