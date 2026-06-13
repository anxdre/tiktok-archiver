<script setup>
const login = async () => {
  await $fetch('/api/login', {
    method: 'POST'
  })
}
</script>

<template>
  <button @click="login">
    Login TikTok
  </button>
</template>