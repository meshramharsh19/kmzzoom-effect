import React, { useEffect, useState, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { loadKmlFiles, normalizePath } from './NetworkLinkLoader';

const parseCoordinates = (coordString) => {
  return coordString.trim().split(/\s+/).map(coord => {
    const [lon, lat, alt] = coord.split(',').map(Number);
    return [lat, lon];
  });
};

const loadImageFromZip = async (zip, imagePath, baseDir = '') => {
  const normalizedPath = normalizePath(baseDir, imagePath);
  let imageFile = zip.file(normalizedPath);

  if (!imageFile) {
    const fileName = imagePath.split('/').pop();
    const files = Object.values(zip.files).filter(f => f.name.endsWith(fileName));
    if (files.length > 0) {
      imageFile = files[0];
    }
  }

  if (!imageFile) {
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

const KmlMap = ({ kmlContent, isActive, zip, baseDir }) => {
  const map = useMap();
  const [overlays, setOverlays] = useState([]);

  const processGroundOverlay = useCallback(async (groundOverlay, baseDir) => {
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
      return null;
    }

    const bounds = L.latLngBounds([[south, west], [north, east]]);
    return { bounds, imageUrl };
  }, [zip]);

  const updateVisibleTiles = useCallback(async () => {
    if (!isActive || !kmlContent || !zip) return;

    try {
      const allKmlFiles = await loadKmlFiles(zip, 'doc.kml', '', new Set());

      const allOverlayPromises = allKmlFiles.flatMap(({ kmlText, basePath }) => {
        const xmlDoc = new DOMParser().parseFromString(kmlText, 'application/xml');
        const groundOverlays = xmlDoc.getElementsByTagNameNS("http://www.opengis.net/kml/2.2", "GroundOverlay") ||
                             xmlDoc.getElementsByTagName("GroundOverlay");

        return Array.from(groundOverlays).map(overlay => processGroundOverlay(overlay, basePath));
      });

      const newOverlays = (await Promise.all(allOverlayPromises))
        .filter(overlay => overlay !== null);

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
  }, [map, kmlContent, isActive, zip, processGroundOverlay]);

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

export default KmlMap;
