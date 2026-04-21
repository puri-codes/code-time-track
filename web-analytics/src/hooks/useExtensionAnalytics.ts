import { useCallback, useState } from 'react';
import axios from 'axios';
import { fetchExtensionAnalytics } from '../services/api';
import { ExtensionAnalytics } from '../types/analytics';

export const useExtensionAnalytics = () => {
  const [data, setData] = useState<ExtensionAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (userId: string, projectId?: string) => {
    if (!userId.trim()) {
      setData(null);
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetchExtensionAnalytics(userId, projectId);
      setData(response);
      return response;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error ?? err.message);
      } else {
        setError('Unexpected error while loading extension analytics.');
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    data,
    loading,
    error,
    load
  };
};

