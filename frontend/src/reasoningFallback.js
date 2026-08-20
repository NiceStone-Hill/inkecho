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

const SYNONYM_GROUPS = {
  通信: ["通信", "联系", "传信", "消息", "联络"],
  通道: ["排水管", "管道", "隐藏路径", "隐藏通道", "出口"],
  外界: ["外界", "外面", "墙外", "外部"],
  维修身份: ["电工", "维修人员", "维修工", "工人身份"],
  停电: ["停电", "灯灭", "照明故障", "供电故障"],
};

const CLUE_CONCEPTS = {
  通道: ["排水管", "管道", "路径", "通道", "出口", "老鼠", "消失", "不见"],
  通信: ["通信", "联系", "联络", "传信", "消息", "布信"],
  外界: ["外界", "外面", "墙外", "外部", "记者", "哈奇"],
  物资交换: ["五美元", "零钱", "纸币", "钱", "交换", "工具", "物资"],
  化学破坏: ["硝酸", "化学", "腐蚀", "钢条", "窗栏"],
  停电: ["停电", "灯灭", "照明", "供电", "电线"],
  维修身份: ["电工", "维修人员", "维修工", "工人身份", "换装", "制服"],
};

function canonicalize(value) {
  let result = String(value || "").toLowerCase().replace(/\s/g, "").replaceAll("和", "与");
  Object.entries(SYNONYM_GROUPS).forEach(([canonical, variants]) => {
    variants.forEach((variant) => {
      result = result.replaceAll(variant, canonical);
    });
  });
  return result.replace(/[。！？,.，]/g, "");
}

function concepts(value) {
  const normalized = canonicalize(value);
  return new Set(
    Object.entries(CLUE_CONCEPTS)
      .filter(([, terms]) =>
        terms.some((term) => normalized.includes(canonicalize(term))),
      )
      .map(([concept]) => concept),
  );
}

function clueIsExpressed(annotation, theory) {
  const normalizedTheory = canonicalize(theory);
  const phrases = [annotation.quote, annotation.note]
    .map(canonicalize)
    .filter(Boolean);
  if (phrases.some((phrase) => normalizedTheory.includes(phrase))) {
    return true;
  }

  const clueConcepts = concepts(`${annotation.quote || ""} ${annotation.note || ""}`);
  const theoryConcepts = concepts(theory);
  return [...clueConcepts].some((concept) => theoryConcepts.has(concept));
}

function buildClueAdoption(progress, v1, v2, finalReasoning) {
  return (progress.annotations || []).slice(0, 4).flatMap((item) => {
    const clue = clip(item.quote || item.note, 120);
    if (!clue) {
      return [];
    }

    const adoptedAt = clueIsExpressed(item, v1)
      ? "V1"
      : clueIsExpressed(item, v2)
        ? "V2"
        : clueIsExpressed(item, finalReasoning)
          ? "FINAL"
          : "NOT_USED";
    const noticedAt = item.stageId
      ? `阅读阶段 S${String(item.stageId).padStart(2, "0")}`
      : "批注记录";

    return [{
      clue,
      noticed_at: noticedAt,
      adopted_at: adoptedAt,
      role: clip(item.note, 160) || "被你标记为值得继续追踪的文本线索",
      basis: adoptedAt === "NOT_USED"
        ? `这条线索于${noticedAt}被记录，但没有在 V1、V2 或最终推理中找到可核对的同义机制。`
        : `这条线索于${noticedAt}被记录，并以原词或同义机制在 ${adoptedAt} 首次进入理论。`,
    }];
  });
}

export function buildLocalReasoningJourney(progress) {
  const v1 = clip(progress.hypothesisV1?.text, 180);
  const v2 = clip(progress.hypothesisV2?.text || v1, 180);
  const finalReasoning = clip(progress.finalReasoning?.text || v2, 360);
  const stressAnswer = clip(progress.stressAnswer, 100);
  const changed = canonicalize(v1) !== canonicalize(v2);
  const firstAnnotation = progress.annotations?.find((item) => item.quote?.trim());
  const confidence = progress.hypothesisV2?.confidence || progress.hypothesisV1?.confidence || "medium";
  const evidenceIds = progress.stressResult?.rationale_evidence_ids || [];
  const clueAdoption = buildClueAdoption(progress, v1, v2, finalReasoning);
  const firstClueRecord = clueAdoption[0];
  const worldClaims = [
    { stage: "V1", label: "最初世界模型", claim: clip(v1, 220), confidence: progress.hypothesisV1?.confidence || "medium" },
    ...(changed ? [{ stage: "V2", label: "压力审查后的模型", claim: clip(v2, 220), confidence }] : []),
    { stage: "FINAL", label: "揭晓前的最终模型", claim: clip(finalReasoning, 220), confidence },
  ].slice(0, 3);

  return {
    world_model: {
      initial_world_model: clip(v1, 240),
      final_world_model: clip(finalReasoning, 300),
      biggest_reconstruction: changed
        ? "你没有简单替换答案，而是重新定义了原有线索在整个系统中的作用。"
        : "你保留了核心判断，并把它从局部解释扩展为一条完整路径。",
      missing_bridge: "从解释单个异常，到说明通信、条件制造与最终离场如何彼此连接。",
      claims: worldClaims,
      impacts: [
        {
          evidence_ids: evidenceIds,
          evidence_summary: evidenceIds.length
            ? `${evidenceIds.join(" · ")} 让最初解释的证明边界变得可见`
            : "压力问题让最初解释中的未证前提变得可见",
          challenged_assumption: clip(progress.stressResult?.selected_assumption || "最初解释中有一步超出了文本已经证明的范围", 180),
          operation: changed ? "ROLE_REDEFINED" : "CLAIM_REINFORCED",
          operation_label: changed ? "重新定义" : "审查后保留",
          before_claim: clip(v1, 180),
          after_claim: clip(v2, 180),
          user_basis: clip(progress.stressAnswer || "用户没有留下独立回应；只能确认最终选择。", 220),
          counterfactual: clip(`如果没有这次撞击，解释最可能继续停留在 V1：${v1}`, 220),
        },
        ...(canonicalize(v2) !== canonicalize(finalReasoning)
          ? [{
              evidence_ids: [],
              evidence_summary: "后续阅读材料让局部解释必须连接成完整的逃脱路径",
              challenged_assumption: "解释一个局部异常，就足以解释完整越狱",
              operation: "LINK_CREATED",
              operation_label: "建立因果连接",
              before_claim: clip(v2, 180),
              after_claim: clip(finalReasoning, 180),
              user_basis: "最终推理加入了 V2 中尚未明确连接的后续步骤。",
              counterfactual: clip(`如果没有后续线索，理论最可能停在 V2：${v2}`, 220),
            }]
          : []),
      ],
    },
    headline: changed
      ? "你没有放弃最初线索，而是在压力审查后重新定义了它在方案中的作用。"
      : "你保留了最初判断，并在最终推理中补齐了后续连接。",
    shift: {
      kept: changed ? `你从 V1 延续了这条核心线索：${v1}` : `你在审查后保留了 V1：${v1}`,
      changed: changed ? `你把原来的解释修正为：${v2}` : "压力测试后，你没有改变原有判断。",
      added: finalReasoning !== v2 ? `最终推理进一步连接为：${finalReasoning}` : "最终推理没有再加入新的机制。",
    },
    pressure_handling: changed
      ? "你回应了未证前提，并通过 V2 收窄或重新定义了原有机制。"
      : "你回应了质疑后仍保留原判断；主要变化发生在最终机制的补充上。",
    confidence_insight: (() => {
      const before = progress.hypothesisV1?.confidence || "medium";
      const after = progress.hypothesisV2?.confidence || before;
      const labels = { low: "低", medium: "中", high: "高" };
      if (before === after) {
        return `确信度保持在${labels[after]}；${changed ? "你调整了解释，但仍保留相同的把握程度。" : "压力审查没有改变你的判断强度。"}`;
      }
      const order = ["low", "medium", "high"];
      const direction = order.indexOf(after) > order.indexOf(before) ? "上升" : "下降";
      return `确信度从${labels[before]}变为${labels[after]}，呈${direction}；${direction === "上升" ? "新解释让因果链更完整。" : "你看见了解释中的不确定部分。"}`;
    })(),
    theory_components: [
      {
        subject: changed ? "核心解释" : "核心判断",
        before: clip(v1, 120),
        after: clip(v2, 120),
        status: changed ? "CHANGED" : "KEPT",
        source_stages: ["V1", "CP2", "V2"],
      },
      ...(finalReasoning !== v2
        ? [{
            subject: "最终连接",
            before: "V2 尚未形成完整的端到端路径",
            after: clip(finalReasoning, 120),
            status: "ADDED",
            source_stages: ["V2", "FINAL"],
          }]
        : []),
    ],
    final_reconstruction: finalReasoning,
    late_arriving_clue: firstAnnotation
      ? firstClueRecord?.adopted_at === "V2" || firstClueRecord?.adopted_at === "FINAL"
        ? {
            clue: clip(firstAnnotation.quote, 180),
            arrived_at: firstClueRecord.adopted_at,
            basis: firstClueRecord.basis,
            evidence_ids: [],
          }
        : firstClueRecord?.adopted_at === "V1"
          ? {
              clue: clip(firstAnnotation.quote, 180),
              arrived_at: "NOT_USED",
              basis: "这条线索已经在 V1 进入理论，因此它不是后期才加入的线索。",
              evidence_ids: [],
            }
          : {
              clue: clip(firstAnnotation.quote, 180),
              arrived_at: "ANNOTATION_ONLY",
              basis: "这条线索被批注记录，但没有在 V1、V2 或最终推理中找到可核对的同义机制。",
              evidence_ids: [],
            }
      : {
          clue: "现有记录不足以确定一条更晚进入推理的具体线索",
          arrived_at: "NOT_USED",
          basis: "本地复盘不会在缺少直接记录时虚构一个晚到线索。",
          evidence_ids: [],
        },
    clue_adoption: clueAdoption,
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
    solution_coverage: [
      ["隐藏通道与外界联系", ["排水", "通道", "联系", "外界"]],
      ["工具或物资进入牢房", ["工具", "物资", "酸", "硝酸"]],
      ["制造照明故障", ["停电", "照明", "供电", "故障"]],
      ["利用维修人员身份离场", ["电工", "维修", "身份", "换装"]],
    ].map(([mechanism, terms]) => {
      const hits = terms.filter((term) => finalReasoning.includes(term)).length;
      const status = hits >= 2 ? "COVERED" : hits === 1 ? "PARTIAL" : "NOT_CONNECTED";
      return {
        mechanism,
        status,
        note: status === "COVERED"
          ? "你的最终推理已经连接了这一机制。"
          : status === "PARTIAL"
            ? "你注意到了相关线索，但尚未写清它在因果链中的作用。"
            : "这项机制没有明确进入你的最终推理。",
      };
    }),
    solution_path: SOLUTION_PATH,
    source: "client-fallback",
  };
}
