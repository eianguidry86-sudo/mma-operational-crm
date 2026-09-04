import React, { useState, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { UploadCloud, CheckCircle, AlertTriangle, ArrowRight, MapPin, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CsvUploaderProps {
  onComplete: (data: any[]) => void;
  onCancel: () => void;
}

const CANONICAL_FIELDS = [
  { key: 'customer_id', label: 'Customer ID', required: true, type: 'string' },
  { key: 'address', label: 'Street Address', required: true, type: 'string' },
  { key: 'total_revenue', label: 'Total Revenue', required: true, type: 'number' },
  { key: 'total_visits', label: 'Total Visits', required: true, type: 'number' },
  { key: 'first_name', label: 'First Name', required: false, type: 'string' },
  { key: 'last_name', label: 'Last Name', required: false, type: 'string' },
  { key: 'city', label: 'City', required: false, type: 'string' },
  { key: 'state', label: 'State', required: false, type: 'string' },
  { key: 'zip_code', label: 'Zip Code', required: false, type: 'string' },
  { key: 'primary_service_type', label: 'Primary Service', required: false, type: 'string' },
  { key: 'first_service_date', label: 'First Service Date', required: false, type: 'date' },
  { key: 'last_service_date', label: 'Last Service Date', required: false, type: 'date' },
  { key: 'avg_ticket_size', label: 'Avg Ticket Size', required: false, type: 'number' },
  { key: 'lifetime_value', label: 'Lifetime Value', required: false, type: 'number' },
  { key: 'status', label: 'Status', required: false, type: 'string' },
  { key: 'acquisition_channel', label: 'Acquisition Channel', required: false, type: 'string' }
];

export default function CsvUploader({ onComplete, onCancel }: CsvUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'upload' | 'mapping' | 'geocoding' | 'saving' | 'done'>('upload');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    parseFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv'))) {
      setFile(droppedFile);
      parseFile(droppedFile);
    } else {
      setError('Please upload a valid CSV file.');
    }
  };

  const parseFile = (f: File) => {
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.meta.fields) {
          setHeaders(results.meta.fields);
          setParsedData(results.data);
          autoMapFields(results.meta.fields);
          setStep('mapping');
        } else {
          setError('Could not detect headers in CSV.');
        }
      },
      error: (err: any) => {
        setError(`Failed to parse CSV: ${err.message}`);
      }
    });
  };

  const autoMapFields = (csvHeaders: string[]) => {
    const initialMapping: Record<string, string> = {};
    CANONICAL_FIELDS.forEach(field => {
      const match = csvHeaders.find(h => {
        const normalizedH = h.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalizedF = field.key.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalizedL = field.label.toLowerCase().replace(/[^a-z0-9]/g, '');
        return normalizedH === normalizedF || normalizedH === normalizedL || normalizedH.includes(normalizedF);
      });
      if (match) {
        initialMapping[field.key] = match;
      }
    });
    setMapping(initialMapping);
  };

  const geocodeAddress = async (address: string): Promise<{ lat: number, lng: number } | null> => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return null;
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        return data.results[0].geometry.location;
      }
    } catch (e) {
      console.warn("Geocoding failed for", address);
    }
    return null;
  };

  const processAndSave = async () => {
    // Validate required fields
    const missing = CANONICAL_FIELDS.filter(f => f.required && !mapping[f.key] && f.key !== 'customer_id');
    if (missing.length > 0) {
      setError(`Please map all required fields: ${missing.map(m => m.label).join(', ')}`);
      return;
    }

    setStep('geocoding');
    setError(null);

    const processedData = [];
    let processedCount = 0;

    for (const row of parsedData) {
      const normalizedRow: any = {
        customer_id: mapping.customer_id && row[mapping.customer_id] ? row[mapping.customer_id] : crypto.randomUUID(),
      };

      // Apply mapping
      for (const field of CANONICAL_FIELDS) {
        if (field.key === 'customer_id') continue;
        const csvKey = mapping[field.key];
        if (csvKey && row[csvKey] !== undefined && row[csvKey] !== '') {
          let val = row[csvKey];
          if (field.type === 'number') {
            val = parseFloat(String(val).replace(/[^0-9.-]+/g, '')) || 0;
          }
          normalizedRow[field.key] = val;
        }
      }

      // Geocode
      if (normalizedRow.address) {
        const fullAddress = [
          normalizedRow.address,
          normalizedRow.city,
          normalizedRow.state,
          normalizedRow.zip_code
        ].filter(Boolean).join(', ');
        
        const coords = await geocodeAddress(fullAddress);
        if (coords) {
          normalizedRow.lat = coords.lat;
          normalizedRow.lng = coords.lng;
        }
      }

      processedData.push(normalizedRow);
      processedCount++;
      setProgress(Math.round((processedCount / parsedData.length) * 100));
    }

    setStep('done');
    onComplete(processedData);
  };

  return (
    <div className="bg-white rounded-xl border border-surface-200 overflow-hidden shadow-sm flex flex-col max-h-[80vh]">
      <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between shrink-0">
        <h2 className="text-lg font-bold text-navy-900">Import CRM Data</h2>
        {step === 'mapping' && (
          <div className="flex items-center gap-3">
            <button onClick={onCancel} className="btn-secondary py-1.5 text-sm">Cancel</button>
            <button onClick={processAndSave} className="btn-primary py-1.5 text-sm flex items-center gap-2">
              Confirm & Geocode <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="p-6 overflow-y-auto flex-1">
        {error && (
          <div className="mb-6 p-4 bg-crimson-50 text-crimson-700 rounded-lg border border-crimson-100 flex gap-3 items-start">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {step === 'upload' && (
          <div 
            className="border-2 border-dashed border-surface-300 rounded-xl p-12 text-center hover:bg-surface-50 transition-colors cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud size={48} className="mx-auto text-navy-300 mb-4" />
            <h3 className="text-lg font-bold text-navy-800 mb-1">Upload CSV File</h3>
            <p className="text-sm text-navy-500 mb-6">Drag and drop your client's CRM export, or click to browse</p>
            <button className="btn-secondary">Select File</button>
            <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-start gap-3">
              <CheckCircle size={18} className="text-blue-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-blue-900">File Parsed Successfully</h4>
                <p className="text-xs text-blue-700 mt-1">Found {parsedData.length} records and {headers.length} columns. Please map your columns to our system fields below.</p>
              </div>
            </div>

            <div className="border border-surface-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-surface-50 text-navy-500 border-b border-surface-200">
                    <th className="px-4 py-3 font-medium w-1/2">System Field</th>
                    <th className="px-4 py-3 font-medium w-1/2">Your CSV Column</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {CANONICAL_FIELDS.map((field) => (
                    <tr key={field.key} className="hover:bg-surface-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-navy-800">{field.label}</span>
                          {field.required && <span className="text-[10px] uppercase font-bold text-crimson-600 bg-crimson-50 px-1.5 py-0.5 rounded">Required</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select 
                          className="form-select w-full text-sm py-1.5"
                          value={mapping[field.key] || ''}
                          onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                        >
                          <option value="">-- Ignore this field --</option>
                          {headers.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(step === 'geocoding' || step === 'saving') && (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="relative mb-6">
              <Loader2 size={48} className="text-blue-600 animate-spin" />
              {step === 'geocoding' && <MapPin size={20} className="text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-0.5" />}
            </div>
            <h3 className="text-xl font-bold text-navy-900 mb-2">
              {step === 'geocoding' ? 'Geocoding Addresses...' : 'Saving to Database...'}
            </h3>
            <p className="text-sm text-navy-500 max-w-md mx-auto mb-6">
              {step === 'geocoding' 
                ? 'We are converting all customer addresses into exact latitude and longitude coordinates for spatial analysis.'
                : 'Securely inserting records into Supabase.'}
            </p>
            
            <div className="w-full max-w-md bg-surface-100 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-blue-600 h-2.5 transition-all duration-300 ease-out" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="text-xs text-navy-400 mt-2">{progress}% Complete</div>
          </div>
        )}
      </div>
    </div>
  );
}
