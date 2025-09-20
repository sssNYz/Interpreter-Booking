// Interpreter utility functions

export interface InterpreterLanguage {
  id: number;
  empCode: string;
  languageCode: string;
  createdAt: string;
  language: {
    id: number;
    code: string;
    name: string;
    isActive: boolean;
  };
}

export interface Employee {
  id: number;
  empCode: string;
  prefixEn?: string;
  firstNameEn?: string;
  lastNameEn?: string;
  prefixTh?: string;
  firstNameTh?: string;
  lastNameTh?: string;
  fno?: string;
  deptPath?: string;
  positionTitle?: string;
  email?: string;
  telExt?: string;
  isActive: boolean;
  interpreterLanguages: InterpreterLanguage[];
}

export const getAvailableInterpreters = async (
  languageCode?: string,
  timeStart?: string,
  timeEnd?: string
): Promise<Employee[]> => {
  try {
    const params = new URLSearchParams();
    if (languageCode) params.set('language', languageCode);
    if (timeStart) params.set('timeStart', timeStart);
    if (timeEnd) params.set('timeEnd', timeEnd);
    const qs = params.toString();
    const url = qs
      ? `/api/employees/interpreters?${qs}`
      : '/api/employees/interpreters';
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch interpreters');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching interpreters:', error);
    return [];
  }
};

export const checkChairmanAvailability = async (
  chairmanEmail: string, 
  timeStart: string, 
  timeEnd: string
): Promise<{ available: boolean; conflictBooking?: any }> => {
  try {
    const response = await fetch('/api/booking-data/check-chairman-availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chairmanEmail, timeStart, timeEnd })
    });
    
    if (!response.ok) {
      throw new Error('Failed to check chairman availability');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error checking chairman availability:', error);
    return { available: false };
  }
};

export const getInterpreterDisplayName = (interpreter: Employee): string => {
  const firstName = interpreter.firstNameEn || interpreter.firstNameTh || '';
  const lastName = interpreter.lastNameEn || interpreter.lastNameTh || '';
  return `${firstName} ${lastName}`.trim() || interpreter.empCode;
};

export const getInterpreterLanguages = (interpreter: Employee): string[] => {
  return interpreter.interpreterLanguages
    .map(il => il.language.name)
    .filter(Boolean);
};
