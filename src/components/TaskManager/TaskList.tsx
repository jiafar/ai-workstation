import React, { useState } from 'react';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  priority?: 'low' | 'medium' | 'high';
  createdAt: Date;
}

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Implement file watcher',
    description: 'Add file system watching for auto-reload',
    status: 'in_progress',
    priority: 'high',
    createdAt: new Date(),
  },
  {
    id: '2',
    title: 'Add syntax highlighting',
    status: 'todo',
    priority: 'medium',
    createdAt: new Date(),
  },
  {
    id: '3',
    title: 'Setup project structure',
    status: 'done',
    priority: 'high',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
];

export const TaskList: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const tasksByStatus = {
    todo: tasks.filter((t) => t.status === 'todo'),
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    done: tasks.filter((t) => t.status === 'done'),
  };

  const handleAddTask = () => {
    if (newTaskTitle.trim()) {
      const newTask: Task = {
        id: Date.now().toString(),
        title: newTaskTitle.trim(),
        status: 'todo',
        createdAt: new Date(),
      };
      setTasks((prev) => [newTask, ...prev]);
      setNewTaskTitle('');
      setShowAddTask(false);
    }
  };

  const handleToggleStatus = (taskId: string) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        const statusOrder: Task['status'][] = ['todo', 'in_progress', 'done'];
        const currentIndex = statusOrder.indexOf(task.status);
        const nextIndex = (currentIndex + 1) % statusOrder.length;
        return { ...task, status: statusOrder[nextIndex] };
      })
    );
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-500';
      case 'medium':
        return 'text-yellow-500';
      case 'low':
        return 'text-green-500';
      default:
        return 'text-text-muted';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'todo':
        return 'To Do';
      case 'in_progress':
        return 'In Progress';
      case 'done':
        return 'Done';
      default:
        return status;
    }
  };

  const renderTaskGroup = (status: keyof typeof tasksByStatus, tasks: Task[]) => (
    <div className="mb-6">
      <h3 className="text-text-primary font-medium mb-3 flex items-center space-x-2">
        <span>{getStatusLabel(status)}</span>
        <span className="text-text-muted text-sm">({tasks.length})</span>
      </h3>
      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="bg-bg-surface border border-border-primary rounded p-3 hover:border-accent-blue transition-colors cursor-pointer"
            onClick={() => handleToggleStatus(task.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h4 className="text-text-primary">{task.title}</h4>
                  {task.priority && (
                    <span className={`text-xs ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  )}
                </div>
                {task.description && (
                  <p className="text-text-secondary text-sm mt-1">{task.description}</p>
                )}
              </div>
              <span className="ml-2 text-text-muted">
                {status === 'done' ? '✓' : status === 'in_progress' ? '▶' : '○'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-bg-secondary">
      <div className="p-4 border-b border-border-primary">
        <h2 className="text-text-primary font-semibold mb-3">Tasks</h2>
        <button
          onClick={() => setShowAddTask(!showAddTask)}
          className="w-full px-3 py-2 bg-accent-blue text-white rounded hover:bg-opacity-90 transition-colors text-sm font-medium"
        >
          Add Task
        </button>
      </div>

      {showAddTask && (
        <div className="p-4 border-b border-border-primary bg-bg-surface">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
            placeholder="Task title..."
            className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue mb-2"
            autoFocus
          />
          <div className="flex space-x-2">
            <button
              onClick={handleAddTask}
              className="flex-1 px-3 py-1 bg-accent-blue text-white rounded text-sm hover:bg-opacity-90"
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowAddTask(false);
                setNewTaskTitle('');
              }}
              className="flex-1 px-3 py-1 bg-bg-primary text-text-primary rounded text-sm hover:bg-bg-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {renderTaskGroup('todo', tasksByStatus.todo)}
        {renderTaskGroup('in_progress', tasksByStatus.in_progress)}
        {renderTaskGroup('done', tasksByStatus.done)}
      </div>
    </div>
  );
};
