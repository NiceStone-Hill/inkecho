# UNPROVEN Pressure Test MVP

一个独立、无数据库、无多轮状态、无 Agent framework 的 TypeScript 模块。

## 本地测试

需要 Node.js 22.6 或更高版本：

```bash
cd pressure-test
npm test
npm run typecheck
```

测试使用本地模拟的大模型响应，不会发送网络请求，也不会消耗 API 额度。

## 环境变量

运行真实模型前，在服务端配置：

```bash
export OPENAI_API_KEY="your-secret-key"
export AI_BASE_URL="https://api.openai.com/v1"
export AI_MODEL="gpt-4o-mini"
export AI_TIMEOUT_MS="10000"
```

`OPENAI_API_KEY` 必填。其余变量有上述默认值。不要把 API Key 放进 Vite 前端变量或提交到 Git。

## 使用

```ts
import { runPressureTest } from "./src/index.ts";

const result = await runPressureTest(input);
```

模块只接受 CP2、E01、E02、E03。输入不可用、模型请求失败、JSON 解析失败或字段校验失败时，统一返回规定的 `UNCLEAR` fallback。
