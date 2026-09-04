import React, { useState } from 'react';
import Map, { NavigationControl, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Project, BusinessRecord } from '../../types';
import { Users, Crosshair, Map as MapIcon, Route, Building, Info } from 'lucide-react';

const MOCK_OPERATIONAL = {
  type: 'FeatureCollection' as const,
  features: [{ type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [[[-97.8, 30.2], [-97.7, 30.3], [-97.6, 30.2], [-97.7, 30.1], [-97.8, 30.2]]] } }]
};

const osmStyle = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap Contributors',
      maxzoom: 19
    }
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm'
    }
  ]
};

const MOCK_EXPANSION = {
  type: 'FeatureCollection' as const,
  features: [
    { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [[[-97.9, 30.3], [-97.8, 30.4], [-97.7, 30.3], [-97.8, 30.2], [-97.9, 30.3]]] } },
    { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [[[-97.6, 30.1], [-97.5, 30.2], [-97.4, 30.1], [-97.5, 30.0], [-97.6, 30.1]]] } }
  ]
};

const MOCK_COMPETITORS = {
  type: 'FeatureCollection' as const,
  features: [
    { type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: [-97.75, 30.25] } },
    { type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: [-97.72, 30.28] } },
    { type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: [-97.68, 30.22] } }
  ]
};

const MOCK_ROUTES = {
  type: 'FeatureCollection' as const,
  features: [
    { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: [[-97.75, 30.25], [-97.9, 30.3]] } },
    { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: [[-97.72, 30.28], [-97.5, 30.2]] } }
  ]
};

interface MarketMapDashboardProps {
  project: Project;
  businessRecord: BusinessRecord | null;
}

export default function MarketMapDashboard({ project, businessRecord }: MarketMapDashboardProps) {
  const [layers, setLayers] = useState({
    operational: true,
    competitors: true,
    expansion: false,
    routes: false,
  });

  const toggleLayer = (key: keyof typeof layers) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const competitors = businessRecord?.competitor_landscape || [];
  const activeFlightsMock = 12; // Example stat

  return (
    <div className="flex flex-col h-full bg-surface-50 overflow-hidden text-navy-900">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-4 gap-4 p-4 shrink-0">
        <div className="bg-white p-4 rounded-xl border border-surface-200 shadow-sm flex flex-col justify-center">
          <div className="text-xs text-navy-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Users size={14} /> Total Competitors
          </div>
          <div className="text-2xl font-bold">{competitors.length}</div>
          <div className="text-xs text-amber-600 mt-1 flex items-center gap-1">
            Avg Rating {businessRecord?.competitor_avg_bbb || 'N/A'}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-surface-200 shadow-sm flex flex-col justify-center">
          <div className="text-xs text-navy-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <MapIcon size={14} /> Operational Area
          </div>
          <div className="text-2xl font-bold">50 mi²</div>
          <div className="text-xs text-emerald-600 mt-1">Healthy density</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-surface-200 shadow-sm flex flex-col justify-center">
          <div className="text-xs text-navy-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Crosshair size={14} /> Expansion Zones
          </div>
          <div className="text-2xl font-bold">3</div>
          <div className="text-xs text-navy-400 mt-1">Pending approval</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-surface-200 shadow-sm flex flex-col justify-center">
          <div className="text-xs text-navy-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Route size={14} /> Active Routes
          </div>
          <div className="text-2xl font-bold">{activeFlightsMock}</div>
          <div className="text-xs text-crimson-600 mt-1">2 flags reported</div>
        </div>
      </div>

      <div className="flex-1 flex gap-4 px-4 pb-4 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-64 bg-white rounded-xl border border-surface-200 shadow-sm flex flex-col shrink-0 overflow-hidden">
          <div className="p-4 border-b border-surface-100 flex justify-between items-center">
            <h3 className="font-bold">Data Layers</h3>
            <span className="text-xs bg-navy-100 text-navy-700 px-2 py-0.5 rounded-full">4</span>
          </div>
          <div className="p-2 space-y-1 overflow-y-auto">
            <button
              onClick={() => toggleLayer('operational')}
              className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition-colors ${
                layers.operational ? 'bg-blue-50 border border-blue-200' : 'hover:bg-surface-50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <MapIcon size={16} className={layers.operational ? 'text-blue-600' : 'text-navy-400'} />
                <span className={`text-sm font-medium ${layers.operational ? 'text-blue-900' : 'text-navy-700'}`}>Operational Area</span>
              </div>
              <div className={`w-3 h-3 rounded-full ${layers.operational ? 'bg-blue-500' : 'bg-surface-300'}`} />
            </button>
            <button
              onClick={() => toggleLayer('competitors')}
              className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition-colors ${
                layers.competitors ? 'bg-amber-50 border border-amber-200' : 'hover:bg-surface-50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <Building size={16} className={layers.competitors ? 'text-amber-600' : 'text-navy-400'} />
                <span className={`text-sm font-medium ${layers.competitors ? 'text-amber-900' : 'text-navy-700'}`}>Competitors</span>
              </div>
              <div className={`w-3 h-3 rounded-full ${layers.competitors ? 'bg-amber-500' : 'bg-surface-300'}`} />
            </button>
            <button
              onClick={() => toggleLayer('expansion')}
              className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition-colors ${
                layers.expansion ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-surface-50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <Crosshair size={16} className={layers.expansion ? 'text-emerald-600' : 'text-navy-400'} />
                <span className={`text-sm font-medium ${layers.expansion ? 'text-emerald-900' : 'text-navy-700'}`}>Expansion Zones</span>
              </div>
              <div className={`w-3 h-3 rounded-full ${layers.expansion ? 'bg-emerald-500' : 'bg-surface-300'}`} />
            </button>
            <button
              onClick={() => toggleLayer('routes')}
              className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition-colors ${
                layers.routes ? 'bg-purple-50 border border-purple-200' : 'hover:bg-surface-50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <Route size={16} className={layers.routes ? 'text-purple-600' : 'text-navy-400'} />
                <span className={`text-sm font-medium ${layers.routes ? 'text-purple-900' : 'text-navy-700'}`}>Routes</span>
              </div>
              <div className={`w-3 h-3 rounded-full ${layers.routes ? 'bg-purple-500' : 'bg-surface-300'}`} />
            </button>
          </div>
        </div>

        {/* Center Map */}
        <div className="flex-1 bg-white rounded-xl border border-surface-200 shadow-sm relative overflow-hidden">
          <Map
            initialViewState={{
              longitude: -97.7431,
              latitude: 30.2672,
              zoom: 10,
            }}
            mapStyle={osmStyle as any}
            attributionControl={false}
          >
            <NavigationControl position="bottom-right" />
            
            {/* Operational Area */}
            <Source id="operational" type="geojson" data={MOCK_OPERATIONAL}>
              <Layer
                id="operational-fill"
                type="fill"
                paint={{ 'fill-color': '#3b82f6', 'fill-opacity': 0.2 }}
                layout={{ visibility: layers.operational ? 'visible' : 'none' }}
              />
              <Layer
                id="operational-line"
                type="line"
                paint={{ 'line-color': '#2563eb', 'line-width': 2 }}
                layout={{ visibility: layers.operational ? 'visible' : 'none' }}
              />
            </Source>

            {/* Expansion Zones */}
            <Source id="expansion" type="geojson" data={MOCK_EXPANSION}>
              <Layer
                id="expansion-fill"
                type="fill"
                paint={{ 'fill-color': '#10b981', 'fill-opacity': 0.2 }}
                layout={{ visibility: layers.expansion ? 'visible' : 'none' }}
              />
              <Layer
                id="expansion-line"
                type="line"
                paint={{ 'line-color': '#059669', 'line-width': 2, 'line-dasharray': [2, 2] }}
                layout={{ visibility: layers.expansion ? 'visible' : 'none' }}
              />
            </Source>

            {/* Routes */}
            <Source id="routes" type="geojson" data={MOCK_ROUTES}>
              <Layer
                id="routes-line"
                type="line"
                paint={{ 'line-color': '#8b5cf6', 'line-width': 3, 'line-dasharray': [1, 2] }}
                layout={{ visibility: layers.routes ? 'visible' : 'none' }}
              />
            </Source>

            {/* Competitors */}
            <Source id="competitors" type="geojson" data={MOCK_COMPETITORS}>
              <Layer
                id="competitors-point"
                type="circle"
                paint={{ 'circle-radius': 6, 'circle-color': '#f59e0b', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' }}
                layout={{ visibility: layers.competitors ? 'visible' : 'none' }}
              />
            </Source>
          </Map>
        </div>

        {/* Right Sidebar */}
        <div className="w-64 bg-white rounded-xl border border-surface-200 shadow-sm p-4 flex flex-col shrink-0">
          <h3 className="text-xs text-navy-500 uppercase tracking-wider mb-4">Live Status</h3>
          <div className="flex-1 flex flex-col items-center justify-center">
            {/* Mock Donut Chart using Tailwind rounded divs */}
            <div className="relative w-32 h-32 mb-6">
              <svg viewBox="0 0 36 36" className="w-full h-full text-blue-500">
                <path
                  className="stroke-surface-200"
                  strokeWidth="4"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="stroke-current"
                  strokeDasharray="75, 100"
                  strokeWidth="4"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold">{competitors.length}</span>
                <span className="text-2xs text-navy-500 uppercase">Points</span>
              </div>
            </div>
            
            <div className="w-full space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"/> Active items</span>
                <span className="font-bold">{competitors.length}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-surface-300"/> Pending</span>
                <span className="font-bold">0</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-crimson-500"/> Issues</span>
                <span className="font-bold">2</span>
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-surface-50 rounded-lg border border-surface-100 flex items-start gap-2">
             <Info size={14} className="text-navy-400 mt-0.5 shrink-0" />
             <p className="text-xs text-navy-600">
               Data is currently loaded from the project snapshot. Map points will update as new data arrives.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
