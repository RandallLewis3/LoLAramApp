<template>
  <section class="task-manager">
    <form class="task-form" @submit.prevent="addTask">
      <label for="task-input">New task</label>
      <div class="input-row">
        <input
          id="task-input"
          v-model="newTask"
          type="text"
          placeholder="Add a new task"
          aria-label="Task description"
        />
        <button type="submit">Add</button>
      </div>
      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    </form>

    <div class="task-list-wrapper" v-if="tasks.length">
      <h2>Tasks</h2>
      <ul class="task-list">
        <li v-for="task in tasks" :key="task.id" :class="{ completed: task.completed }">
          <button class="checkbox" type="button" @click="toggleTask(task.id)" :aria-pressed="task.completed">
            <span>{{ task.completed ? '✔' : '○' }}</span>
          </button>
          <span class="task-text">{{ task.text }}</span>
          <button class="delete-button" type="button" @click="deleteTask(task.id)">Delete</button>
        </li>
      </ul>
    </div>

    <p v-else class="empty-state">No tasks yet. Add one to get started.</p>
  </section>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';

interface Task {
  id: number;
  text: string;
  completed: boolean;
}

export default defineComponent({
  name: 'TaskManager',
  setup() {
    const newTask = ref('');
    const tasks = ref<Task[]>([]);
    const errorMessage = ref('');
    const nextId = ref(1);

    function addTask() {
      const trimmed = newTask.value.trim();
      if (!trimmed) {
        errorMessage.value = 'Please enter a task description.';
        return;
      }

      tasks.value.push({
        id: nextId.value++,
        text: trimmed,
        completed: false
      });

      newTask.value = '';
      errorMessage.value = '';
    }

    function deleteTask(id: number) {
      tasks.value = tasks.value.filter((task) => task.id !== id);
    }

    function toggleTask(id: number) {
      const task = tasks.value.find((item) => item.id === id);
      if (task) {
        task.completed = !task.completed;
      }
    }

    return {
      newTask,
      tasks,
      errorMessage,
      addTask,
      deleteTask,
      toggleTask
    };
  }
});
</script>

<style scoped>
.task-manager {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 14px 40px rgba(15, 23, 42, 0.06);
}

.task-form {
  display: grid;
  gap: 0.75rem;
}

.input-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.75rem;
}

input {
  border: 1px solid #d1d5db;
  border-radius: 0.75rem;
  padding: 0.9rem 1rem;
  font-size: 1rem;
}

button {
  border: none;
  border-radius: 0.75rem;
  background: #2563eb;
  color: white;
  padding: 0.9rem 1.2rem;
  font-weight: 600;
  cursor: pointer;
}

button:hover {
  background: #1d4ed8;
}

.error-message {
  color: #b91c1c;
  margin: 0;
}

.task-list-wrapper {
  margin-top: 1.5rem;
}

.task-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.75rem;
}

.task-list li {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.75rem;
  align-items: center;
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.85rem;
  background: #f8fafc;
}

.task-list li.completed {
  background: #e0f2fe;
}

.checkbox {
  width: 2.5rem;
  height: 2.5rem;
  display: grid;
  place-items: center;
  background: #e5e7eb;
  border-radius: 0.75rem;
  font-weight: 700;
}

.task-text {
  color: #111827;
  word-break: break-word;
}

.delete-button {
  background: transparent;
  color: #ef4444;
  padding: 0.75rem 1rem;
}

.empty-state {
  color: #6b7280;
  margin: 0;
}

@media (max-width: 640px) {
  .task-list li {
    grid-template-columns: auto 1fr;
  }

  .delete-button {
    width: 100%;
    justify-self: start;
  }
}
</style>
