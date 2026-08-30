import { useEventStore } from '../store/useEventStore';

export function useTasks(userLocation?: { latitude: number; longitude: number } | null) {
  const store = useEventStore();

  return {
    tasks: store.events,
    isLoading: store.isLoading,
    filters: store.filters,
    filteredTasks: store.getFilteredEvents(userLocation),
    topRecommendation: store.getTopRecommendation(userLocation),
    loadTasks: store.loadEvents,
    addTask: store.addEvent,
    updateTask: store.updateEvent,
    updateTaskStatus: store.updateTaskStatus,
    deleteTask: store.deleteEvent,
    clearCompletedTasks: store.clearCompletedEvents,
    toggleTaskCompletion: store.toggleEventCompletion,
    setFilters: store.setFilters,
  };
}
