import React, { createContext, useContext, useState, ReactNode } from 'react';

// Basic interfaces for projection state based on the SCORE template structure
export interface ProjectionState {
  id?: string;
  name: string;
  startingBalances: {
    cash: number;
    inventory: number;
    equipment: number;
  };
  payroll: {
    employees: Array<{ role: string; salary: number; count: number }>;
  };
  sales: {
    products: Array<{ name: string; price: number; monthlyUnits: number[] }>;
  };
  opex: {
    categories: Array<{ name: string; monthlyCost: number }>;
  };
  cogs: {
    materials: number; // percentage of sales
  };
}

interface ProjectionsContextType {
  currentProjection: ProjectionState;
  updateProjection: (updates: Partial<ProjectionState>) => void;
  saveProjectionToSupabase: () => Promise<void>;
  loadProjectionFromSupabase: (id: string) => Promise<void>;
}

const defaultState: ProjectionState = {
  name: 'Default Forecast',
  startingBalances: { cash: 0, inventory: 0, equipment: 0 },
  payroll: { employees: [] },
  sales: { products: [] },
  opex: { categories: [] },
  cogs: { materials: 0 },
};

const ProjectionsContext = createContext<ProjectionsContextType | undefined>(undefined);

export function ProjectionsProvider({ children }: { children: ReactNode }) {
  const [currentProjection, setCurrentProjection] = useState<ProjectionState>(defaultState);

  const updateProjection = (updates: Partial<ProjectionState>) => {
    setCurrentProjection((prev) => ({ ...prev, ...updates }));
  };

  const saveProjectionToSupabase = async () => {
    // TODO: Implement Supabase insert/update logic
    console.log('Saving projection to Supabase:', currentProjection);
  };

  const loadProjectionFromSupabase = async (id: string) => {
    // TODO: Implement Supabase fetch logic
    console.log('Loading projection from Supabase:', id);
  };

  return (
    <ProjectionsContext.Provider
      value={{
        currentProjection,
        updateProjection,
        saveProjectionToSupabase,
        loadProjectionFromSupabase,
      }}
    >
      {children}
    </ProjectionsContext.Provider>
  );
}

export function useProjections() {
  const context = useContext(ProjectionsContext);
  if (context === undefined) {
    throw new Error('useProjections must be used within a ProjectionsProvider');
  }
  return context;
}
