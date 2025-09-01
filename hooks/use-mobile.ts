import { useState, useEffect } from 'react';
import { RESPONSIVE_BREAKPOINTS } from '@/utils/constants';

export function useMobile() {
  const [isMobile, setIsMobile] = useState(false);
  const [screenSize, setScreenSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('lg');

  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setIsMobile(true);
        setScreenSize('sm');
      } else if (width < 768) {
        setIsMobile(false);
        setScreenSize('md');
      } else if (width < 1024) {
        setIsMobile(false);
        setScreenSize('lg');
      } else {
        setIsMobile(false);
        setScreenSize('xl');
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const getResponsiveSizes = () => {
    return RESPONSIVE_BREAKPOINTS[screenSize];
  };

  return { isMobile, screenSize, getResponsiveSizes };
}

// Backward compatibility - keep the old useIsMobile export
export function useIsMobile() {
  const { isMobile } = useMobile();
  return isMobile;
}
