import React from 'react';
import { useProjections } from '../../lib/ProjectionsContext';

export default function SalesGrid() {
  const { currentProjection, updateProjection } = useProjections();
  const { sales } = currentProjection;

  const addProduct = () => {
    updateProjection({
      sales: {
        products: [...sales.products, { name: 'New Product', price: 100, monthlyUnits: Array(12).fill(0) }],
      },
    });
  };

  const updateProduct = (index: number, field: string, value: any) => {
    const newProducts = [...sales.products];
    newProducts[index] = { ...newProducts[index], [field]: value };
    updateProjection({ sales: { products: newProducts } });
  };

  return (
    <div className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden mt-6">
      <div className="p-4 border-b border-surface-200 bg-surface-50 flex justify-between items-center">
        <h3 className="font-semibold text-navy-900">Sales Forecast (Year 1)</h3>
        <button onClick={addProduct} className="text-sm bg-crimson-600 text-white px-3 py-1.5 rounded-lg hover:bg-crimson-700">
          Add Product/Service
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        <table className="w-full text-left text-sm text-navy-600">
          <thead className="text-xs text-navy-500 uppercase bg-surface-50 border-b border-surface-200">
            <tr>
              <th className="px-4 py-3 font-medium min-w-[200px]">Product/Service</th>
              <th className="px-4 py-3 font-medium">Unit Price ($)</th>
              {Array.from({ length: 12 }).map((_, i) => (
                <th key={i} className="px-4 py-3 font-medium text-center">M{i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sales.products.length === 0 ? (
              <tr><td colSpan={14} className="px-4 py-4 text-center text-navy-400">No sales data yet.</td></tr>
            ) : (
              sales.products.map((prod, pIdx) => (
                <tr key={pIdx} className="border-b border-surface-100 last:border-0 hover:bg-surface-50">
                  <td className="px-4 py-2">
                    <input type="text" value={prod.name} onChange={(e) => updateProduct(pIdx, 'name', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 p-1" />
                  </td>
                  <td className="px-4 py-2">
                    <input type="number" value={prod.price} onChange={(e) => updateProduct(pIdx, 'price', Number(e.target.value))} className="w-[80px] bg-transparent border-none focus:ring-0 p-1" />
                  </td>
                  {prod.monthlyUnits.map((val, mIdx) => (
                    <td key={mIdx} className="px-2 py-2">
                      <input 
                        type="number" 
                        value={val} 
                        onChange={(e) => {
                          const newUnits = [...prod.monthlyUnits];
                          newUnits[mIdx] = Number(e.target.value);
                          updateProduct(pIdx, 'monthlyUnits', newUnits);
                        }} 
                        className="w-[60px] bg-transparent border-none focus:ring-0 p-1 text-center" 
                      />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
