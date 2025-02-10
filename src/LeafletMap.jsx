import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const LeafletMap = ({ children }) => {
  return (
    <MapContainer
      center={[20.5937, 77.9629]}
      zoom={5}
      minZoom={3}
      maxZoom={19}
      style={{ flex: 1 }}
    >
      <TileLayer
        url="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
      />
      {children}
    </MapContainer>
  );
};

export default LeafletMap;
