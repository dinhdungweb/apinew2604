'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import Cookies from 'js-cookie';

interface User {
  username: string;
  role: string;
}

interface AppContextType {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isClient, setIsClient] = useState(false);

  // Khởi tạo state từ localStorage chỉ khi ở client-side
  useEffect(() => {
    setIsClient(true);
    const storedToken = localStorage.getItem('token');
    const storedRole = localStorage.getItem('role');
    
    if (storedToken) {
      setToken(storedToken);
      
      if (storedRole) {
        setUser({
          username: 'User', // Sẽ được cập nhật sau khi fetch dữ liệu user
          role: storedRole
        });
      }
    }
  }, []);

  const logout = () => {
    setToken(null);
    setUser(null);
    if (isClient) {
      // Xóa từ localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      
      // Xóa cookie
      Cookies.remove('token');
    }
  };

  return (
    <AppContext.Provider
      value={{
        token,
        user,
        isLoading,
        setToken,
        setUser,
        setIsLoading,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}; 