import React, { createContext, useContext, useState } from 'react';

export type ThreadKey = 'queue' | 'visited' | 'parent' | 'bug';
export type HighlightableThread = 'queue' | 'visited' | 'parent';

interface HighlightContextValue {
  hoveredThread: HighlightableThread | null;
  setHoveredThread: (thread: HighlightableThread | null) => void;
}

const HighlightContext = createContext<HighlightContextValue>({
  hoveredThread: null,
  setHoveredThread: () => undefined,
});

export const HighlightProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [hoveredThread, setHoveredThread] =
    useState<HighlightableThread | null>(null);

  return (
    <HighlightContext.Provider value={{ hoveredThread, setHoveredThread }}>
      {children}
    </HighlightContext.Provider>
  );
};

export function useHighlight(): HighlightContextValue {
  return useContext(HighlightContext);
}
