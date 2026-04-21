import { useCallback, useState } from 'react';
import axios from 'axios';
import { fetchComparisonAnalytics } from '../services/api';
import { ComparisonAnalytics } from '../types/analytics';

export const useComparisonAnalytics = () => {
  const [data, setData] = useState<ComparisonAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (userId: string, repo: string) => {
    if (!userId.trim() || !repo.trim()) {
      setData(null);
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetchComparisonAnalytics(userId, repo);
      setData(response);
      return response;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error ?? err.message);
      } else {
        setError('Unexpected error while loading comparison analytics.');
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
