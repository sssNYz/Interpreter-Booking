// Language utility functions

export interface Language {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const getAvailableLanguages = async (): Promise<Language[]> => {
  try {
    // Request only active languages for booking flows
    const response = await fetch('/api/language?active=true');
    if (!response.ok) {
      throw new Error('Failed to fetch languages');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching languages:', error);
    return [];
  }
};

export const getLanguageByCode = async (code: string): Promise<Language | null> => {
  try {
    const languages = await getAvailableLanguages();
    return languages.find(lang => lang.code === code) || null;
  } catch (error) {
    console.error('Error fetching language by code:', error);
    return null;
  }
};
