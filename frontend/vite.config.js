import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// GitHub Pages 部署在仓库子路径下（https://NiceStone-Hill.github.io/inkecho/），
// 生产构建需要设置 base，否则静态资源会按根路径请求导致 404 空白页。
// 本地开发（vite dev）不受影响，仍使用根路径。
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/inkecho/' : '/',
  plugins: [react()],
}))
