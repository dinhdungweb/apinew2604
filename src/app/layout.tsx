'use client';

import './globals.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AppProvider } from '@/context/AppContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { Suspense } from 'react';
import WorkerInitializer from '@/components/WorkerInitializer';

function AppWithThemedToast({ children }: { children: React.ReactNode }) {
  const { isDarkMode } = useTheme();
  
  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme={isDarkMode ? "dark" : "light"}
      />
      {children}
    </>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="font-sans antialiased bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen overflow-x-hidden">
        <AppProvider>
          <ThemeProvider>
            <AppWithThemedToast>
              {/* Khởi tạo worker khi ứng dụng khởi động */}
              <Suspense fallback={null}>
                <WorkerInitializer />
              </Suspense>
              {children}
            </AppWithThemedToast>
          </ThemeProvider>
        </AppProvider>
      </body>
    </html>
  );
}
