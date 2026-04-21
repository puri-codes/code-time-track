import { useState } from 'react';
import axios from 'axios';
import { analyzeRepository } from '../services/api';
import { GitHubAnalytics } from '../types/analytics';

export const useRepoAnalytics = () => {
  const [data, setData] = useState<GitHubAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async (repo: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await analyzeRepository(repo);
      setData(response);
      return response;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error ?? err.message);
      } else {
        setError('Unexpected error while analyzing repository.');
      }
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    data,
    loading,
    error,
    runAnalysis
  };
};

