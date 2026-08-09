import type { UnlockedEvidence } from "./types.ts";

export const MVP_EVIDENCE: ReadonlyArray<Readonly<UnlockedEvidence>> = Object.freeze([
  Object.freeze({
    id: "E01",
    fact: "范·杜森入狱时经过彻底搜身，没有携带普通越狱工具或书写材料；监狱方面不会替他进行常规的信息传递。",
  }),
  Object.freeze({
    id: "E02",
    fact: "十三号牢房存在一个非标准边界通道，老鼠能够通过与牢门不同的路径离开当前空间。",
  }),
  Object.freeze({
    id: "E03",
    fact: "监狱没有内部电工；照明发生故障时，外部照明公司的维修人员可以因正常工作需要进入监狱。",
  }),
]);
