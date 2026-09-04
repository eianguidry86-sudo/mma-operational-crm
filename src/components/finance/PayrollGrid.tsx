import React from 'react';
import { useProjections } from '../../lib/ProjectionsContext';

export default function PayrollGrid() {
  const { currentProjection, updateProjection } = useProjections();
  const { payroll } = currentProjection;

  const addEmployee = () => {
    updateProjection({
      payroll: {
        employees: [...payroll.employees, { role: 'New Role', salary: 50000, count: 1 }],
      },
    });
  };

  const updateEmployee = (index: number, field: string, value: any) => {
    const newEmployees = [...payroll.employees];
    newEmployees[index] = { ...newEmployees[index], [field]: value };
    updateProjection({ payroll: { employees: newEmployees } });
  };

  return (
    <div className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-surface-200 bg-surface-50 flex justify-between items-center">
        <h3 className="font-semibold text-navy-900">Payroll Assumptions</h3>
        <button onClick={addEmployee} className="text-sm bg-crimson-600 text-white px-3 py-1.5 rounded-lg hover:bg-crimson-700">
          Add Role
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        <table className="w-full text-left text-sm text-navy-600">
          <thead className="text-xs text-navy-500 uppercase bg-surface-50 border-b border-surface-200">
            <tr>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Annual Salary</th>
              <th className="px-4 py-3 font-medium">Headcount</th>
            </tr>
          </thead>
          <tbody>
            {payroll.employees.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-4 text-center text-navy-400">No payroll data yet.</td></tr>
            ) : (
              payroll.employees.map((emp, idx) => (
                <tr key={idx} className="border-b border-surface-100 last:border-0 hover:bg-surface-50">
                  <td className="px-4 py-2">
                    <input type="text" value={emp.role} onChange={(e) => updateEmployee(idx, 'role', e.target.value)} className="w-full bg-transparent border-none focus:ring-0 p-1" />
                  </td>
                  <td className="px-4 py-2">
                    <input type="number" value={emp.salary} onChange={(e) => updateEmployee(idx, 'salary', Number(e.target.value))} className="w-full bg-transparent border-none focus:ring-0 p-1" />
                  </td>
                  <td className="px-4 py-2">
                    <input type="number" value={emp.count} onChange={(e) => updateEmployee(idx, 'count', Number(e.target.value))} className="w-full bg-transparent border-none focus:ring-0 p-1" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
