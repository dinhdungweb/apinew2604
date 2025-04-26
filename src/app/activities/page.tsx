'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import PageContainer from '@/components/ui/PageContainer';
import { PageHeader, PageSection } from '@/components/ui/PageSection';
import Card from '@/components/Card';
import { 
  ClipboardList, Eye, Search, Filter, RefreshCw, 
  User, Package, Settings, Key, FileText, Database,
  Calendar, Clock, ArrowUpDown
} from 'lucide-react';
import { toast } from 'react-toastify';

// Mock activity data
const generateMockActivities = (count: number) => {
  const activities = [];
  const users = [
    { id: 1, name: 'Admin', email: 'admin@example.com', avatar: '/avatars/admin.png' },
    { id: 2, name: 'John Doe', email: 'john@example.com', avatar: '/avatars/john.png' },
    { id: 3, name: 'Jane Smith', email: 'jane@example.com', avatar: '/avatars/jane.png' },
    { id: 4, name: 'Alex Johnson', email: 'alex@example.com', avatar: '/avatars/alex.png' },
  ];

  const actionTypes = [
    { type: 'product', actions: ['created', 'updated', 'deleted', 'synced'] },
    { type: 'user', actions: ['created', 'updated', 'deleted', 'logged in', 'logged out'] },
    { type: 'settings', actions: ['updated', 'reset'] },
    { type: 'api_key', actions: ['created', 'updated', 'deleted', 'revoked'] },
    { type: 'report', actions: ['generated', 'exported', 'downloaded'] },
    { type: 'backup', actions: ['created', 'restored', 'scheduled'] },
  ];

  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const actionType = actionTypes[Math.floor(Math.random() * actionTypes.length)];
    const action = actionType.actions[Math.floor(Math.random() * actionType.actions.length)];
    
    // Random date within last 7 days
    const createdAt = new Date(now.getTime() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000));
    
    let details = '';
    let targetName = '';
    
    switch (actionType.type) {
      case 'product':
        targetName = ['iPhone 15 Pro', 'Samsung Galaxy S24', 'Macbook Pro M3', 'AirPods Pro 2'][Math.floor(Math.random() * 4)];
        details = `Product ID: PRD-${Math.floor(1000 + Math.random() * 9000)}`;
        break;
      case 'user':
        targetName = ['John Doe', 'Jane Smith', 'Alex Johnson', 'Sarah Williams'][Math.floor(Math.random() * 4)];
        details = `Role: ${['Admin', 'Editor', 'Viewer'][Math.floor(Math.random() * 3)]}`;
        break;
      case 'settings':
        targetName = ['General Settings', 'API Configuration', 'Notification Settings', 'Security Settings'][Math.floor(Math.random() * 4)];
        details = `Section: ${targetName}`;
        break;
      case 'api_key':
        targetName = ['Production API Key', 'Development API Key', 'Testing API Key'][Math.floor(Math.random() * 3)];
        details = `Key ID: KEY-${Math.floor(1000 + Math.random() * 9000)}`;
        break;
      case 'report':
        targetName = ['Sales Report', 'Product Performance', 'User Activity', 'API Usage'][Math.floor(Math.random() * 4)];
        details = `Format: ${['PDF', 'CSV', 'Excel'][Math.floor(Math.random() * 3)]}`;
        break;
      case 'backup':
        targetName = ['Full Backup', 'Partial Backup', 'Configuration Backup'][Math.floor(Math.random() * 3)];
        details = `Size: ${Math.floor(10 + Math.random() * 990)}MB`;
        break;
    }
    
    activities.push({
      id: `act-${i}`,
      user,
      type: actionType.type,
      action,
      targetName,
      details,
      ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      createdAt,
      isImportant: Math.random() > 0.8,
    });
  }
  
  return activities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

// Format date
const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

// Format relative time
const formatRelativeTime = (date: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);
  
  if (diffSec < 60) {
    return 'just now';
  } else if (diffMin < 60) {
    return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  } else if (diffHour < 24) {
    return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  } else if (diffDay < 7) {
    return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  } else {
    return formatDate(date);
  }
};

// Get icon for activity type
const getActivityIcon = (type: string) => {
  switch (type) {
    case 'product':
      return <Package className="w-5 h-5" />;
    case 'user':
      return <User className="w-5 h-5" />;
    case 'settings':
      return <Settings className="w-5 h-5" />;
    case 'api_key':
      return <Key className="w-5 h-5" />;
    case 'report':
      return <FileText className="w-5 h-5" />;
    case 'backup':
      return <Database className="w-5 h-5" />;
    default:
      return <ClipboardList className="w-5 h-5" />;
  }
};

// Get color for activity type
const getActivityColor = (type: string) => {
  switch (type) {
    case 'product':
      return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
    case 'user':
      return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
    case 'settings':
      return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400';
    case 'api_key':
      return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'report':
      return 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400';
    case 'backup':
      return 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }
};

export default function ActivitiesPage() {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<any[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({
    types: [] as string[],
    users: [] as number[],
    period: 'all',
    important: false
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  // Fetch activities
  useEffect(() => {
    const fetchActivities = async () => {
      setLoading(true);
      try {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 800));
        const mockData = generateMockActivities(100);
        setActivities(mockData);
        setFilteredActivities(mockData);
      } catch (error) {
        console.error('Error fetching activities:', error);
        toast.error('Không thể tải dữ liệu hoạt động người dùng');
      } finally {
        setLoading(false);
      }
    };
    
    fetchActivities();
  }, []);
  
  // Filter activities
  useEffect(() => {
    let result = [...activities];
    
    // Search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(activity => 
        activity.targetName.toLowerCase().includes(term) ||
        activity.user.name.toLowerCase().includes(term) ||
        activity.action.toLowerCase().includes(term) ||
        activity.details.toLowerCase().includes(term)
      );
    }
    
    // Type filter
    if (activeFilters.types.length > 0) {
      result = result.filter(activity => activeFilters.types.includes(activity.type));
    }
    
    // User filter
    if (activeFilters.users.length > 0) {
      result = result.filter(activity => activeFilters.users.includes(activity.user.id));
    }
    
    // Period filter
    if (activeFilters.period !== 'all') {
      const now = new Date();
      let cutoff = new Date();
      
      switch (activeFilters.period) {
        case 'today':
          cutoff = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'yesterday':
          cutoff = new Date(now.setDate(now.getDate() - 1));
          cutoff.setHours(0, 0, 0, 0);
          break;
        case 'week':
          cutoff = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          cutoff = new Date(now.setMonth(now.getMonth() - 1));
          break;
      }
      
      result = result.filter(activity => activity.createdAt >= cutoff);
    }
    
    // Important filter
    if (activeFilters.important) {
      result = result.filter(activity => activity.isImportant);
    }
    
    setFilteredActivities(result);
    setPage(1); // Reset to first page when filters change
  }, [searchTerm, activeFilters, activities]);
  
  // Toggle filter
  const toggleFilter = (filterType: string, value: string | number) => {
    setActiveFilters(prev => {
      const newFilters = { ...prev };
      
      if (filterType === 'types') {
        if (newFilters.types.includes(value as string)) {
          newFilters.types = newFilters.types.filter(t => t !== value);
        } else {
          newFilters.types = [...newFilters.types, value as string];
        }
      } else if (filterType === 'users') {
        if (newFilters.users.includes(value as number)) {
          newFilters.users = newFilters.users.filter(u => u !== value);
        } else {
          newFilters.users = [...newFilters.users, value as number];
        }
      } else if (filterType === 'period') {
        newFilters.period = newFilters.period === value ? 'all' : value as string;
      } else if (filterType === 'important') {
        newFilters.important = !newFilters.important;
      }
      
      return newFilters;
    });
  };
  
  // Clear all filters
  const clearFilters = () => {
    setActiveFilters({
      types: [],
      users: [],
      period: 'all',
      important: false
    });
    setSearchTerm('');
  };
  
  // Pagination
  const totalPages = Math.ceil(filteredActivities.length / pageSize);
  const startIdx = (page - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, filteredActivities.length);
  const currentPageActivities = filteredActivities.slice(startIdx, endIdx);
  
  // View activity details
  const viewActivityDetails = (activityId: string) => {
    const activity = activities.find(a => a.id === activityId);
    if (activity) {
      toast.info(`Activity details: ${activity.user.name} ${activity.action} ${activity.targetName}`);
      // In a real application, this would open a modal with activity details
    }
  };
  
  // Refresh activities
  const refreshActivities = () => {
    setLoading(true);
    toast.info('Refreshing activities...');
    
    setTimeout(() => {
      const mockData = generateMockActivities(100);
      setActivities(mockData);
      setLoading(false);
      toast.success('Activities refreshed!');
    }, 800);
  };

  return (
    <Layout>
      <PageContainer>
        <PageHeader 
          title="User Activities" 
          description="Monitor and track user actions across the system"
          actions={
            <div className="flex gap-3">
              <button 
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm text-sm font-medium flex items-center gap-2 transition-colors"
                onClick={refreshActivities}
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          }
        />
        
        {/* Filters */}
        <Card className="mb-6">
          <div className="p-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search activities..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
                />
              </div>
              
              <div>
                <button 
                  className="w-full md:w-auto px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 font-medium flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => document.getElementById('filtersPanel')?.classList.toggle('hidden')}
                >
                  <Filter className="w-4 h-4" />
                  Filters
                  {(activeFilters.types.length > 0 || activeFilters.users.length > 0 || activeFilters.period !== 'all' || activeFilters.important) && (
                    <span className="bg-primary-600 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs">
                      {activeFilters.types.length + activeFilters.users.length + (activeFilters.period !== 'all' ? 1 : 0) + (activeFilters.important ? 1 : 0)}
                    </span>
                  )}
                </button>
              </div>
            </div>
            
            <div id="filtersPanel" className="hidden mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Activity Type</h3>
                  <div className="space-y-2">
                    {['product', 'user', 'settings', 'api_key', 'report', 'backup'].map((type) => (
                      <label key={type} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={activeFilters.types.includes(type)}
                          onChange={() => toggleFilter('types', type)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 capitalize">
                          {type.replace('_', ' ')}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Users</h3>
                  <div className="space-y-2">
                    {[
                      { id: 1, name: 'Admin' },
                      { id: 2, name: 'John Doe' },
                      { id: 3, name: 'Jane Smith' },
                      { id: 4, name: 'Alex Johnson' }
                    ].map((user) => (
                      <label key={user.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={activeFilters.users.includes(user.id)}
                          onChange={() => toggleFilter('users', user.id)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                          {user.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Time Period</h3>
                  <div className="space-y-2">
                    {[
                      { value: 'today', label: 'Today' },
                      { value: 'yesterday', label: 'Yesterday' },
                      { value: 'week', label: 'Last 7 days' },
                      { value: 'month', label: 'Last 30 days' }
                    ].map((period) => (
                      <label key={period.value} className="flex items-center">
                        <input
                          type="radio"
                          checked={activeFilters.period === period.value}
                          onChange={() => toggleFilter('period', period.value)}
                          className="rounded-full border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                          {period.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Other Filters</h3>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={activeFilters.important}
                        onChange={() => toggleFilter('important', '')}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Important activities only
                      </span>
                    </label>
                  </div>
                  
                  <button
                    onClick={clearFilters}
                    className="mt-4 px-3 py-1 text-sm text-primary-600 dark:text-primary-400 hover:underline focus:outline-none"
                  >
                    Clear all filters
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Card>
        
        {/* Activity List */}
        <Card loading={loading}>
          <div className="p-0">
            {loading ? (
              <div className="animate-pulse p-6 space-y-4">
                {[...Array(5)].map((_, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    </div>
                    <div className="h-8 w-8 rounded bg-gray-200 dark:bg-gray-700"></div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {filteredActivities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <ClipboardList className="h-16 w-16 text-gray-300 dark:text-gray-700 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No activities found</h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      {searchTerm || activeFilters.types.length > 0 || activeFilters.users.length > 0 || activeFilters.period !== 'all' || activeFilters.important
                        ? 'Try adjusting your filters to see more results'
                        : 'No user activities have been recorded yet'
                      }
                    </p>
                    {(searchTerm || activeFilters.types.length > 0 || activeFilters.users.length > 0 || activeFilters.period !== 'all' || activeFilters.important) && (
                      <button
                        onClick={clearFilters}
                        className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              <div className="flex items-center">
                                Type
                                <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400" />
                              </div>
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              <div className="flex items-center">
                                Action
                                <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400" />
                              </div>
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              <div className="flex items-center">
                                User
                                <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400" />
                              </div>
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              <div className="flex items-center">
                                Target
                                <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400" />
                              </div>
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              <div className="flex items-center">
                                Date & Time
                                <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400" />
                              </div>
                            </th>
                            <th scope="col" className="relative px-6 py-3">
                              <span className="sr-only">View</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                          {currentPageActivities.map((activity) => (
                            <tr key={activity.id} className={`${activity.isImportant ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''} hover:bg-gray-50 dark:hover:bg-gray-800/70`}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActivityColor(activity.type)}`}>
                                  <span className="mr-1">{getActivityIcon(activity.type)}</span>
                                  <span className="capitalize">{activity.type.replace('_', ' ')}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                                  {activity.action}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                    {activity.user.avatar ? (
                                      <img src={activity.user.avatar} alt={activity.user.name} className="h-8 w-8 rounded-full" />
                                    ) : (
                                      <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                    )}
                                  </div>
                                  <div className="ml-3">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                      {activity.user.name}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {activity.user.email}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900 dark:text-white">{activity.targetName}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{activity.details}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <Calendar className="h-4 w-4 text-gray-500 mr-1" />
                                  <div className="text-sm text-gray-900 dark:text-white">{formatDate(activity.createdAt)}</div>
                                </div>
                                <div className="flex items-center mt-1">
                                  <Clock className="h-3 w-3 text-gray-400 mr-1" />
                                  <div className="text-xs text-gray-500 dark:text-gray-400">{formatRelativeTime(activity.createdAt)}</div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button 
                                  onClick={() => viewActivityDetails(activity.id)}
                                  className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                                >
                                  <Eye className="h-5 w-5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Pagination */}
                    {filteredActivities.length > pageSize && (
                      <div className="px-6 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Showing <span className="font-medium">{startIdx + 1}</span> to <span className="font-medium">{endIdx}</span> of{' '}
                          <span className="font-medium">{filteredActivities.length}</span> results
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setPage(page > 1 ? page - 1 : 1)}
                            disabled={page === 1}
                            className={`px-3 py-1 rounded ${
                              page === 1
                                ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                          >
                            Previous
                          </button>
                          {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                            let pageNum;
                            
                            if (totalPages <= 5) {
                              pageNum = idx + 1;
                            } else if (page <= 3) {
                              pageNum = idx + 1;
                            } else if (page >= totalPages - 2) {
                              pageNum = totalPages - 4 + idx;
                            } else {
                              pageNum = page - 2 + idx;
                            }
                            
                            return (
                              <button
                                key={idx}
                                onClick={() => setPage(pageNum)}
                                className={`w-8 h-8 flex items-center justify-center rounded ${
                                  page === pageNum
                                    ? 'bg-primary-600 text-white'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                          <button
                            onClick={() => setPage(page < totalPages ? page + 1 : totalPages)}
                            disabled={page === totalPages}
                            className={`px-3 py-1 rounded ${
                              page === totalPages
                                ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </PageContainer>
    </Layout>
  );
} 