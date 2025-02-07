import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import JSZip from 'jszip';

// Styles
const styles = {
  container: {
    display: 'flex',
    height: '100vh',
  },
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
  map: {
    flex: 1,
  },
  hamburger: {
    position: 'absolute',
    top: '10px',
    left: '10px',
    zIndex: 1000,
    padding: '10px',
    backgroundColor: 'white',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  fileUpload: {
    marginBottom: '20px',
  },
  layerToggle: {
    marginBottom: '10px',
  }
};

// Helper function to normalize file paths
const normalizePath = (baseDir, relativePath) => {
  console.log('Normalizing path:', baseDir, relativePath);
  
  // Remove leading slashes
  relativePath = relativePath.replace(/^\/+/, '');
  
  if (relativePath.startsWith('../')) {
    const baseSegments = baseDir.split('/').filter(Boolean);
    const relativeSegments = relativePath.split('/');
    
    let segments = [...baseSegments];
    for (const segment of relativeSegments) {
      if (segment === '..') {
        segments.pop();
      } else if (segment !== '.') {
        segments.push(segment);
      }
    }
    return segments.join('/');
  }
  
  if (baseDir && !relativePath.includes('/')) {
    return `${baseDir}/${relativePath}`;
  }
  
  return relativePath;
};

// Function to parse coordinates
const parseCoordinates = (coordString) => {
  return coordString.trim().split(/\s+/).map(coord => {
    const [lon, lat, alt] = coord.split(',').map(Number);
    return [lat, lon];
  });
};

// Function to load KML files recursively
const loadKmlFiles = async (zip, filePath, baseDir = '', loadedFiles = new Set()) => {
  console.log('Loading KML:', filePath, 'from baseDir:', baseDir);
  
  const normalizedPath = normalizePath(baseDir, filePath);
  
  if (loadedFiles.has(normalizedPath)) {
    return [];
  }
  loadedFiles.add(normalizedPath);

  const kmlFile = zip.file(normalizedPath);
  if (!kmlFile) {
    console.warn('KML file not found:', normalizedPath);
    return [];
  }

  const kmlText = await kmlFile.async('text');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(kmlText, 'application/xml');

  const currentDir = normalizedPath.split('/').slice(0, -1).join('/');

  const networkLinks = xmlDoc.getElementsByTagNameNS("http://www.opengis.net/kml/2.2", "NetworkLink") ||
                      xmlDoc.getElementsByTagName("NetworkLink");
  
  console.log(`Found ${networkLinks.length} NetworkLinks in ${normalizedPath}`);

  const linkedKmlPromises = Array.from(networkLinks).map(async (link) => {
    const href = link.getElementsByTagNameNS("http://www.opengis.net/kml/2.2", "href")[0]?.textContent ||
                link.getElementsByTagName("href")[0]?.textContent;
    
    if (href) {
      console.log('Following NetworkLink:', href);
      return loadKmlFiles(zip, href, currentDir, loadedFiles);
    }
    return [];
  });

  const linkedResults = await Promise.all(linkedKmlPromises);
  
  return [{
    kmlText,
    basePath: currentDir
  }].concat(linkedResults.flat());
};

// Function to load images from ZIP
const loadImageFromZip = async (zip, imagePath, baseDir = '') => {
  console.log('Loading image:', imagePath, 'from baseDir:', baseDir);
  
  const normalizedPath = normalizePath(baseDir, imagePath);
  let imageFile = zip.file(normalizedPath);
  
  if (!imageFile) {
    // Try finding by filename only
    const fileName = imagePath.split('/').pop();
    const files = Object.values(zip.files).filter(f => f.name.endsWith(fileName));
    if (files.length > 0) {
      imageFile = files[0];
    }
  }
  
  if (!imageFile) {
    console.warn('Image not found:', normalizedPath);
    return null;
  }
  
  try {
    const imageBlob = await imageFile.async('blob');
    return URL.createObjectURL(imageBlob);
  } catch (error) {
    console.error('Error loading image:', error);
    return null;
  }
};

// KmlMap Component
const KmlMap = ({ kmlContent, isActive, zip, baseDir }) => {
  const map = useMap();
  const [overlays, setOverlays] = useState([]);

  const processGroundOverlay = useCallback(async (groundOverlay, baseDir) => {
    console.log('Processing GroundOverlay from:', baseDir);
    
    const icon = groundOverlay.getElementsByTagNameNS("http://www.opengis.net/kml/2.2", "Icon")[0] ||
                groundOverlay.getElementsByTagName("Icon")[0];
    if (!icon) return null;

    const href = icon.getElementsByTagNameNS("http://www.opengis.net/kml/2.2", "href")[0]?.textContent ||
                icon.getElementsByTagName("href")[0]?.textContent;
    if (!href) return null;

    const imageUrl = await loadImageFromZip(zip, href, baseDir);
    if (!imageUrl) return null;

    const latLonBox = groundOverlay.getElementsByTagNameNS("http://www.opengis.net/kml/2.2", "LatLonBox")[0] ||
                     groundOverlay.getElementsByTagName("LatLonBox")[0];
    if (!latLonBox) return null;

    const getCoord = (tag) => {
      const element = latLonBox.getElementsByTagNameNS("http://www.opengis.net/kml/2.2", tag)[0] ||
                     latLonBox.getElementsByTagName(tag)[0];
      return parseFloat(element?.textContent);
    };

    const north = getCoord("north");
    const south = getCoord("south");
    const east = getCoord("east");
    const west = getCoord("west");

    if (isNaN(north) || isNaN(south) || isNaN(east) || isNaN(west)) {
      console.warn('Invalid coordinates');
      return null;
    }

    const bounds = L.latLngBounds([[south, west], [north, east]]);
    return { bounds, imageUrl };
  }, [zip]);

  const updateVisibleTiles = useCallback(async () => {
    if (!isActive || !kmlContent || !zip) return;

    try {
      const allKmlFiles = await loadKmlFiles(zip, 'doc.kml', '', new Set());
      console.log(`Loaded ${allKmlFiles.length} KML files`);

      const allOverlayPromises = allKmlFiles.flatMap(({ kmlText, basePath }) => {
        const xmlDoc = new DOMParser().parseFromString(kmlText, 'application/xml');
        const groundOverlays = xmlDoc.getElementsByTagNameNS("http://www.opengis.net/kml/2.2", "GroundOverlay") ||
                             xmlDoc.getElementsByTagName("GroundOverlay");
        
        console.log(`Found ${groundOverlays.length} GroundOverlays in ${basePath}`);
        
        return Array.from(groundOverlays).map(overlay => processGroundOverlay(overlay, basePath));
      });

      const newOverlays = (await Promise.all(allOverlayPromises))
        .filter(overlay => overlay !== null);

      console.log(`Processing ${newOverlays.length} overlays`);

      setOverlays(prev => {
        prev.forEach(overlay => {
          if (overlay.leafletOverlay) {
            map.removeLayer(overlay.leafletOverlay);
          }
          URL.revokeObjectURL(overlay.imageUrl);
        });

        return newOverlays.map(overlay => {
          const leafletOverlay = L.imageOverlay(overlay.imageUrl, overlay.bounds).addTo(map);
          return { ...overlay, leafletOverlay };
        });
      });

      if (newOverlays.length > 0) {
        const allBounds = L.latLngBounds(newOverlays.map(o => o.bounds));
        map.fitBounds(allBounds);
      }

    } catch (error) {
      console.error('Error updating tiles:', error);
    }
  }, [map, kmlContent, isActive, zip, baseDir, processGroundOverlay]);

  useEffect(() => {
    if (!isActive) return;
    updateVisibleTiles();
    
    return () => {
      setOverlays(prev => {
        prev.forEach(overlay => {
          if (overlay.leafletOverlay) {
            map.removeLayer(overlay.leafletOverlay);
          }
          URL.revokeObjectURL(overlay.imageUrl);
        });
        return [];
      });
    };
  }, [isActive, updateVisibleTiles, map]);

  return null;
};

// Main Map Component
const Map = () => {
  const [layers, setLayers] = useState({
    Orthophotos: { kmlContent: null, isActive: false, zip: null, baseDir: '' },
    DTM: { kmlContent: null, isActive: false, zip: null, baseDir: '' },
    DSM: { kmlContent: null, isActive: false, zip: null, baseDir: '' },
  });
  const [sidebarVisible, setSidebarVisible] = useState(true);

  const handleFileUpload = async (e, layerName) => {
    console.log('File upload started for:', layerName);
    const file = e.target.files[0];
    
    if (!file || !file.name.endsWith('.kmz')) {
      alert('Please upload a valid KMZ file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const zip = await JSZip.loadAsync(event.target.result);
        console.log('Files in KMZ:', Object.keys(zip.files));

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
    <div style={styles.container}>
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
      </div>

      <MapContainer
        center={[20.5937, 77.9629]}
        zoom={5}
        minZoom={3}
        maxZoom={21}
        style={styles.map}
      >
        <TileLayer
          url="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
        />
        {Object.entries(layers).map(([layerName, { kmlContent, isActive, zip, baseDir }]) => (
          <KmlMap
            key={layerName}
            kmlContent={kmlContent}
            isActive={isActive}
            zip={zip}
            baseDir={baseDir}
          />
        ))}
      </MapContainer>

      <button 
        style={styles.hamburger}
        onClick={() => setSidebarVisible(!sidebarVisible)}
      >
        ☰
      </button>
    </div>
  );
};

export default Map;