<template>
  <main class="app-shell">
    <section class="hero">
      <h1>ARAM Archipelago</h1>
      <p>Connect with friends, complete checks, and unlock champions in real time.</p>
    </section>

    <SessionBoard />
  </main>
</template>

<script lang="ts">
import SessionBoard from './components/SessionBoard.vue';

export default {
  name: 'App',
  components: {
    SessionBoard
  }
};
</script>

<style scoped>
:root {
  color-scheme: light;
  font-family: Inter, system-ui, sans-serif;
}

.app-shell {
  width: 100%;
  padding: 1rem 0;
}

.hero {
  text-align: center;
  margin-bottom: 2rem;
}

.hero h1 {
  margin-bottom: 0.5rem;
  font-size: clamp(2.25rem, 4vw, 3rem);
}

.hero p {
  color: #555;
  line-height: 1.6;
}
</style>
