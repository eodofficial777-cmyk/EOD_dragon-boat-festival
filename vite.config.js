import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ★ 如果你的 GitHub repo 名稱不是 dragon-boat-festival，請改成你的 repo 名稱
export default defineConfig({
  plugins: [react()],
  base: '/EOD_dragon-boat-festival/',
})
