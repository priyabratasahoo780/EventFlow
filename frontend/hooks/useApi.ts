import { useState } from 'react';
import api from '../services/api';

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = async <T = any>(method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string, data?: any): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await api[method](url, data);
      return response.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'API error';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    request,
  };
}
