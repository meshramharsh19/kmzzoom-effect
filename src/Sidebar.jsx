import React from 'react';

const styles = {
  sidebar: {
    width: '300px',
    padding: '20px',
    backgroundColor: '#f5f5f5',
    overflowY: 'auto',
    transition: 'transform 0.3s ease',
  },
  sidebarHidden: {
    transform: 'translateX(-100%)',
  },
  fileUpload: {
    marginBottom: '20px',
  },
  layerToggle: {
    marginBottom: '10px',
  }
};

const Sidebar = ({ layers, handleFileUpload, toggleLayer, sidebarVisible, setSidebarVisible }) => {
  return (
    <div style={{
      ...styles.sidebar,
      ...(sidebarVisible ? {} : styles.sidebarHidden)
    }}>
      <div style={styles.fileUpload}>
        <h2>File Uploads</h2>
        {Object.keys(layers).map((layerName) => (
          <div key={layerName} style={styles.layerToggle}>
            <label>
              {layerName}:
              <input
                type="file"
                onChange={(e) => handleFileUpload(e, layerName)}
                accept=".kmz"
              />
            </label>
          </div>
        ))}
      </div>

      <div>
        <h2>Toggle Layers</h2>
        {Object.keys(layers).map((layerName) => (
          <div key={layerName} style={styles.layerToggle}>
            <label>
              <input
                type="checkbox"
                checked={layers[layerName].isActive}
                onChange={() => toggleLayer(layerName)}
              />
              {layerName}
            </label>
          </div>
        ))}
      </div>

      <button
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          zIndex: 1000,
          padding: '10px',
          backgroundColor: 'white',
          border: '1px solid #ccc',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
        onClick={() => setSidebarVisible(!sidebarVisible)}
      >
        ☰
      </button>
    </div>
  );
};

export default Sidebar;
