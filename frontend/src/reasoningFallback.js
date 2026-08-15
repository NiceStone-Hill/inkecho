const SOLUTION_PATH = [
  {
    step_id: 1,
    text: "老鼠没有从门缝离开却全部消失，证明牢房存在第二个未被注意的出口——那个通向围墙外的废弃排水管。",
    evidence_ids: ["E02"],
  },
  {
    step_id: 2,
    text: "教授通过排水管把布信与五美元送出，球场男孩捡到后交给记者哈奇，双方由此建立起一条外部通信线。",
    evidence_ids: ["E02"],
  },
  {
    step_id: 3,
    text: "通信线逐步升级为可以双向传递零钱、工具与化学品的运输通道，纸币面额的变化正是这次交换留下的痕迹。",
    evidence_ids: ["E01", "E02"],
  },
  {
    step_id: 4,
    text: "教授用运进来的硝酸处理牢门钢条、窗栏和供电线，为离开牢房与制造停电准备条件。",
    evidence_ids: ["E02", "E03"],
  },
  {
    step_id: 5,
    text: "停电后，教授离开牢房，与混入维修人员中的哈奇会合并换上电工服，最终以电工身份从正门离开。",
    evidence_ids: ["E03"],
  },
];

function clip(value, length) {
  return String(value || "").trim().slice(0, length);
}

export function buildLocalReasoningJourney(progress) {
  const v1 = clip(progress.hypothesisV1?.text, 180);
  const v2 = clip(progress.hypothesisV2?.text || v1, 180);
  const finalReasoning = clip(progress.finalReasoning?.text || v2, 360);
  const stressAnswer = clip(progress.stressAnswer, 100);
  const changed = v1 !== v2;
  const firstAnnotation = progress.annotations?.find((item) => item.quote?.trim());

  return {
    shift: {
      kept: changed ? `你从 V1 延续了这条核心线索：${v1}` : `你在审查后保留了 V1：${v1}`,
      changed: changed ? `你把原来的解释修正为：${v2}` : "压力测试后，你没有改变原有判断。",
      added: finalReasoning !== v2 ? `最终推理进一步连接为：${finalReasoning}` : "最终推理没有再加入新的机制。",
    },
    final_reconstruction: finalReasoning,
    late_arriving_clue: firstAnnotation
      ? {
          clue: clip(firstAnnotation.quote, 180),
          arrived_at: "ANNOTATION_ONLY",
          basis: "这条线索出现在你的批注中；本地复盘不推断它是否已被转述进其他版本。",
          evidence_ids: [],
        }
      : {
          clue: "现有记录不足以确定一条更晚进入推理的具体线索",
          arrived_at: "NOT_USED",
          basis: "本地复盘不会在缺少直接记录时虚构一个晚到线索。",
          evidence_ids: [],
        },
    reasoning_map: [
      { stage: "V1", label: "最初判断", detail: clip(v1, 100), evidence_ids: [] },
      {
        stage: "CP2",
        label: "回应质疑",
        detail: stressAnswer || clip(progress.stressResult?.pressure_question, 100),
        evidence_ids: progress.stressResult?.rationale_evidence_ids || [],
      },
      { stage: "V2", label: "审查决定", detail: clip(v2, 100), evidence_ids: [] },
      { stage: "FINAL", label: "最终连接", detail: clip(finalReasoning, 100), evidence_ids: [] },
    ],
    solution_path: SOLUTION_PATH,
    source: "client-fallback",
  };
}
