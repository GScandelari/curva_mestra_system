import { useState, useEffect, useCallback } from 'react';
import firebaseService from '../services/firebaseService';

/**
 * Custom hook for Firebase data operations with real-time updates and offline cache
 * 
 * @param {string} collectionName - Name of the Firestore collection
 * @param {Object} options - Query options (where, orderBy, limit)
 * @param {boolean} realTime - Enable real-time updates
 * @returns {Object} - { data, loading, error, isOffline, refresh, listenerId }
 */
export const useFirebaseData = (collectionName, options = {}, realTime = true) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [listenerId, setListenerId] = useState(null);

  // Handle data updates (both real-time and one-time)
  const handleDataUpdate = useCallback((result) => {
    if (result.success) {
      setData(result.data);
      setError(null);
      setIsOffline(result.fromCache || false);
    } else {
      setError(result.error);
      setIsOffline(true);
    }
    setLoading(false);
  }, []);

  // Load data once (for non-real-time mode)
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await firebaseService.getAll(collectionName, options);
      handleDataUpdate(result);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [collectionName, options, handleDataUpdate]);

  // Refresh data manually
  const refresh = useCallback(() => {
    if (realTime && listenerId) {
      // Real-time data will refresh automatically
      return;
    }
    loadData();
  }, [realTime, listenerId, loadData]);

  useEffect(() => {
    if (realTime) {
      // Setup real-time listener
      const id = firebaseService.onCollectionChange(collectionName, handleDataUpdate, options);
      setListenerId(id);

      return () => {
        if (id) {
          firebaseService.removeListener(id);
        }
      };
    } else {
      // Load data once
      loadData();
    }
  }, [collectionName, realTime, options, handleDataUpdate, loadData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (listenerId) {
        firebaseService.removeListener(listenerId);
      }
    };
  }, [listenerId]);

  return {
    data,
    loading,
    error,
    isOffline,
    refresh,
    listenerId
  };
};

/**
 * Custom hook for Firebase document operations with real-time updates
 * 
 * @param {string} collectionName - Name of the Firestore collection
 * @param {string} documentId - Document ID
 * @param {boolean} realTime - Enable real-time updates
 * @returns {Object} - { data, loading, error, isOffline, refresh, listenerId }
 */
export const useFirebaseDocument = (collectionName, documentId, realTime = true) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [listenerId, setListenerId] = useState(null);

  // Handle document updates
  const handleDocumentUpdate = useCallback((result) => {
    if (result.success) {
      setData(result.data);
      setError(null);
      setIsOffline(result.fromCache || false);
    } else {
      setError(result.error);
      setIsOffline(true);
    }
    setLoading(false);
  }, []);

  // Load document once (for non-real-time mode)
  const loadDocument = useCallback(async () => {
    if (!documentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await firebaseService.getById(collectionName, documentId);
      handleDocumentUpdate(result);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [collectionName, documentId, handleDocumentUpdate]);

  // Refresh document manually
  const refresh = useCallback(() => {
    if (realTime && listenerId) {
      // Real-time data will refresh automatically
      return;
    }
    loadDocument();
  }, [realTime, listenerId, loadDocument]);

  useEffect(() => {
    if (!documentId) {
      setLoading(false);
      return;
    }

    if (realTime) {
      // Setup real-time listener
      const id = firebaseService.onDocumentChange(collectionName, documentId, handleDocumentUpdate);
      setListenerId(id);

      return () => {
        if (id) {
          firebaseService.removeListener(id);
        }
      };
    } else {
      // Load document once
      loadDocument();
    }
  }, [collectionName, documentId, realTime, handleDocumentUpdate, loadDocument]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (listenerId) {
        firebaseService.removeListener(listenerId);
      }
    };
  }, [listenerId]);

  return {
    data,
    loading,
    error,
    isOffline,
    refresh,
    listenerId
  };
};

/**
 * Custom hook for Firebase operations (create, update, delete)
 * 
 * @param {string} collectionName - Name of the Firestore collection
 * @returns {Object} - { create, update, delete, loading, error }
 */
export const useFirebaseOperations = (collectionName) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const create = useCallback(async (data) => {
    setLoading(true);
    setError(null);
    try {
      const result = await firebaseService.create(collectionName, data);
      setLoading(false);
      return result;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  }, [collectionName]);

  const update = useCallback(async (id, data) => {
    setLoading(true);
    setError(null);
    try {
      const result = await firebaseService.update(collectionName, id, data);
      setLoading(false);
      return result;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  }, [collectionName]);

  const deleteDoc = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const result = await firebaseService.delete(collectionName, id);
      setLoading(false);
      return result;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  }, [collectionName]);

  return {
    create,
    update,
    delete: deleteDoc,
    loading,
    error
  };
};

/**
 * Custom hook for Firebase cache information
 * 
 * @returns {Object} - { isOnline, cacheSize, activeListeners, clearCache }
 */
export const useFirebaseCache = () => {
  const [cacheInfo, setCacheInfo] = useState({
    isOnline: true,
    cacheSize: 0,
    activeListeners: 0
  });

  useEffect(() => {
    const updateCacheInfo = () => {
      setCacheInfo(firebaseService.getCacheInfo());
    };

    // Update cache info periodically
    const interval = setInterval(updateCacheInfo, 5000);
    updateCacheInfo(); // Initial update

    return () => clearInterval(interval);
  }, []);

  const clearCache = useCallback(() => {
    firebaseService.clearCache();
    setCacheInfo(firebaseService.getCacheInfo());
  }, []);

  return {
    ...cacheInfo,
    clearCache
  };
};

export default useFirebaseData;