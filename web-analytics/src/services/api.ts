import axios from 'axios';
import { ComparisonAnalytics, ExtensionAnalytics, GitHubAnalytics } from '../types/analytics';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

const api = axios.create({
  baseURL: API_BASE_URL
});

export const analyzeRepository = async (repo: string): Promise<GitHubAnalytics> => {
  const response = await api.get<GitHubAnalytics>('/api/github/analyze', {
    params: { repo }
  });
  return response.data;
};

export const fetchExtensionAnalytics = async (userId: string, projectId?: string): Promise<ExtensionAnalytics> => {
  const response = await api.get<ExtensionAnalytics>('/api/extension/analytics', {
    params: {
      userId,
      projectId: projectId || undefined
    }
  });
  return response.data;
};

export const fetchComparisonAnalytics = async (userId: string, repo: string): Promise<ComparisonAnalytics> => {
  const response = await api.get<ComparisonAnalytics>('/api/analytics/comparison', {
    params: {
      userId,
      repo
    }
  });
  return response.data;
};

