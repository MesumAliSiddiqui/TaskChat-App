import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/client';

export const useChatTasks = (chat) => {
  const [activeTaskCount, setActiveTaskCount] = useState(0);

  const fetchActiveTaskCount = useCallback(async () => {
    if (!chat?._id) return;
    try {
      const { data } = await api.get('/tasks');
      const allTasks = Array.isArray(data) ? data : (data.tasks || []);
      const chatMemberIds = chat?.members?.map(m => (m._id || m.id)?.toString()) || [];

      const count = allTasks.filter(task => {
        if (task.status === 'completed') return false;

        const assignedByStr = (task.assignedBy?._id || task.assignedBy)?.toString();
        if (!chatMemberIds.includes(assignedByStr)) return false;

        const assignedTo = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
        const assignedToIds = assignedTo.map(t => (t?._id || t)?.toString());

        return assignedToIds.some(id => chatMemberIds.includes(id));
      }).length;

      setActiveTaskCount(count);
    } catch (error) {
      console.warn('Failed to fetch task count:', error);
    }
  }, [chat]);

  useFocusEffect(
    useCallback(() => {
      fetchActiveTaskCount();
    }, [fetchActiveTaskCount])
  );

  return {
    activeTaskCount,
    fetchActiveTaskCount,
  };
};
