import React, { useState } from 'react';
import LeafletMap from './LeafletMap';
import Sidebar from './Sidebar';
import KmlMap from './KmlMap';
import JSZip from 'jszip';
import { loadKmlFiles } from './NetworkLinkLoader';

const Map = () => {
  const [layers, setLayers] = useState({
    Orthophotos: { kmlContent: null, isActive: false, zip: null, baseDir: '' },
    DTM: { kmlContent: null, isActive: false, zip: null, baseDir: '' },
    DSM: { kmlContent: null, isActive: false, zip: null, baseDir: '' },
  });
  const [sidebarVisible, setSidebarVisible] = useState(true);

  const handleFileUpload = async (e, layerName) => {
    const file = e.target.files[0];

    if (!file || !file.name.endsWith('.kmz')) {
      alert('Please upload a valid KMZ file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const zip = await JSZip.loadAsync(event.target.result);
        const kmlFiles = await loadKmlFiles(zip, 'doc.kml');
        if (kmlFiles.length === 0) {
          throw new Error('No valid KML files found in KMZ');
        }

        setLayers(prev => ({
          ...prev,
          [layerName]: {
            kmlContent: kmlFiles[0].kmlText,
            isActive: true,
            zip: zip,
            baseDir: kmlFiles[0].basePath,
          },
        }));

      } catch (error) {
        console.error('Error processing KMZ:', error);
        alert('Error loading KMZ file: ' + error.message);
      }
    };

    reader.onerror = (error) => {
      console.error('File reading error:', error);
      alert('Error reading file');
    };

    reader.readAsArrayBuffer(file);
  };

  const toggleLayer = (layerName) => {
    setLayers(prev => ({
      ...prev,
      [layerName]: {
        ...prev[layerName],
        isActive: !prev[layerName].isActive,
      },
    }));
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar
        layers={layers}
        handleFileUpload={handleFileUpload}
        toggleLayer={toggleLayer}
        sidebarVisible={sidebarVisible}
        setSidebarVisible={setSidebarVisible}
      />
      <LeafletMap>
        {Object.entries(layers).map(([layerName, { kmlContent, isActive, zip, baseDir }]) => (
          <KmlMap
            key={layerName}
            kmlContent={kmlContent}
            isActive={isActive}
            zip={zip}
            baseDir={baseDir}
          />
        ))}
      </LeafletMap>
    </div>
  );
};

export default Map;
