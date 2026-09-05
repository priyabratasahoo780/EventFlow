import { useAuthStore } from '../store/useAuthStore';

export function useAuth() {
  const { user, token, isLoading, login, logout, checkAuth } = useAuthStore();

  return {
    user,
    token,
    isAuthenticated: !!token,
    isLoading,
    login,
    logout,
    checkAuth,
  };
}
