"""WorkPack 内容数据（人工审校，后端私有维护）。

内容来源：审定译文精选片段 + 事实母本 + Demo故事切片。
唯一知识来源原则：模型不得新增人物、密道、工具、动机或逃脱步骤，
本模块中的文本即为系统全部允许披露的原文与事实边界。
"""

from typing import Dict, List

from schemas import Evidence, SolutionStep, StageContent, StatementCard


# ---------------------------------------------------------------------------
# 证据账本（evidence ledger）
# 每条证据只映射当前及更早阶段允许出现的原文事实。
# ---------------------------------------------------------------------------

EVIDENCE: Dict[str, Evidence] = {
    "E01": Evidence(
        evidence_id="E01",
        text="范·杜森教授接受赌约：只带获准物品进入奇泽姆监狱十三号牢房，并承诺一周内自行离开。",
        source_stage=1,
    ),
    "E02": Evidence(
        evidence_id="E02",
        text="教授入狱时携带牙粉、擦亮的鞋、两张十美元和一张五美元，并戴着一顶八号帽；所有物品经过检查，未发现工具。",
        source_stage=1,
    ),
    "E03": Evidence(
        evidence_id="E03",
        text="从十三号牢房到自由世界要穿过七道门；牢门、窗栏和花岗岩墙看起来都不可能被突破。",
        source_stage=1,
    ),
    "E04": Evidence(
        evidence_id="E04",
        text="牢房里至少有五六只老鼠。教授惊动它们时，没有一只从门缝钻出，它们却全部不见了。",
        source_stage=2,
    ),
    "E05": Evidence(
        evidence_id="E05",
        text="牢房墙角有一个不起眼的圆孔，通向一根废弃已久、干燥且积满灰尘的排水管。",
        source_stage=2,
    ),
    "E06": Evidence(
        evidence_id="E06",
        text="一卷衬衫布从窗中落下，外面系着一张五美元。",
        source_stage=2,
    ),
    "E07": Evidence(
        evidence_id="E07",
        text="监狱长发现教授手中的钞票面额发生了变化。",
        source_stage=3,
    ),
    "E08": Evidence(
        evidence_id="E08",
        text="附近囚犯巴拉德听到排水管方向传来破碎的声音片段：“酸”“八号帽”。",
        source_stage=3,
    ),
    "E09": Evidence(
        evidence_id="E09",
        text="教授在窗口持续更新倒计时布条：还剩三天、两天……",
        source_stage=3,
    ),
}


# ---------------------------------------------------------------------------
# 阅读阶段（stage）与陈述卡
# ---------------------------------------------------------------------------

STAGE_1_SEGMENTS = [
    "“没有一间牢房能困住一个真正会思考的人。”范·杜森教授接受了这场赌约：只带获准物品进入"
    "奇泽姆监狱十三号牢房，并在一周内自行离开监狱重新出现。",
    "入狱前，教授要求携带牙粉、一双擦亮的鞋、两张十美元和一张五美元，并戴着一顶八号帽。"
    "狱方对全部物品进行了检查，没有发现任何工具。",
    "从十三号牢房到自由世界，要依次穿过七道门；牢门、窗栏和花岗岩墙壁看起来都坚不可摧。",
]

STAGE_2_SEGMENTS = [
    "第一夜，牢房里至少有五六只老鼠。教授惊动它们的时候，没有一只从门缝底下钻出去，"
    "但它们却全部从牢房里消失了。",
    "教授注意到墙角有一个不起眼的圆孔，通向一根废弃已久、干燥且积满灰尘的排水管。",
    "第二天，一卷衬衫布从窗口落下，布卷外面系着一张五美元纸币。",
]

STAGE_3_SEGMENTS = [
    "监狱长在例行检查时发现，教授手中的钞票面额已经与入狱时不同。",
    "附近牢房的囚犯巴拉德说，自己隔着墙听到几段破碎的声音，像是“酸”和“八号帽”。",
    "教授开始在窗口挂出倒计时布条，上面写着还剩三天、两天……",
]


STATEMENT_CARDS: List[StatementCard] = [
    StatementCard(
        card_id="SC01",
        text="从十三号牢房到自由世界要穿过七道门，牢门、窗栏和花岗岩墙都很坚固。",
        answer_type="physical_constraint",
    ),
    StatementCard(
        card_id="SC02",
        text="教授携带的物品都经过检查，没有发现任何工具。",
        answer_type="confirmed_fact",
    ),
    StatementCard(
        card_id="SC03",
        text="教授一定提前偷偷带了工具进牢房，只是狱方没有查出来。",
        answer_type="reader_assumption",
    ),
]


STAGES: List[StageContent] = [
    StageContent(
        stage_id=1,
        title="建立边界",
        order=1,
        segments=STAGE_1_SEGMENTS,
        statement_cards=STATEMENT_CARDS,
        allowed_evidence=[EVIDENCE["E01"], EVIDENCE["E02"], EVIDENCE["E03"]],
    ),
    StageContent(
        stage_id=2,
        title="异常开始出现",
        order=2,
        segments=STAGE_2_SEGMENTS,
        statement_cards=[],
        allowed_evidence=[
            EVIDENCE["E01"],
            EVIDENCE["E02"],
            EVIDENCE["E03"],
            EVIDENCE["E04"],
            EVIDENCE["E05"],
            EVIDENCE["E06"],
        ],
    ),
    StageContent(
        stage_id=3,
        title="监狱系统失去解释力",
        order=3,
        segments=STAGE_3_SEGMENTS,
        statement_cards=[],
        allowed_evidence=list(EVIDENCE.values()),
    ),
]

STAGES_BY_ID: Dict[int, StageContent] = {stage.stage_id: stage for stage in STAGES}


# ---------------------------------------------------------------------------
# 压力测试模板（5类，各1条），用于模型降级兜底
# ---------------------------------------------------------------------------

STRESS_CATEGORIES: List[str] = [
    "external_help",
    "hidden_tool",
    "physical_path",
    "deception",
    "unknown",
]

STRESS_TEMPLATES: Dict[str, Dict[str, object]] = {
    "external_help": {
        "keywords": "外面|外界|朋友|同伙|外援|有人接|有人帮|接应",
        "assumption": "牢房之外一定有人及时接应（尚未被文本证明）",
        "question": "这个外部帮手来自已读文本，还是你的推定？如果没有他，方案还成立吗？",
        "preferred_evidence_ids": ["E06"],
    },
    "hidden_tool": {
        "keywords": "工具|钥匙|锉刀|藏|偷偷带|暗藏|凶器",
        "assumption": "教授携带了未被搜查记录承认的工具（尚未被文本证明）",
        "question": "文本明确写了物品都经过检查，你依赖的工具是文本写的，还是你补上的？",
        "preferred_evidence_ids": ["E02"],
    },
    "physical_path": {
        "keywords": "排水管|通道|爬|洞|钻|地道|管道|墙缝|翻墙",
        "assumption": "这条通道足以让成年人通行（尚未被文本证明）",
        "question": "文本只说明这个孔洞的存在，你怎么确认它能容纳一个成年人通过？",
        "preferred_evidence_ids": ["E05", "E04"],
    },
    "deception": {
        "keywords": "假装|伪装|骗|迷惑|装死|装病|障眼法",
        "assumption": "某个举动的真实目的是迷惑守卫（尚未被文本证明）",
        "question": "文本确认过这个举动的目的吗，还是你自己解读出的迷惑作用？",
        "preferred_evidence_ids": ["E03"],
    },
    "unknown": {
        "keywords": "",
        "assumption": "方案中至少一个关键环节尚未被已读文本支持",
        "question": "这个方案里，哪一步能在已读文本中找到依据，哪一步只是你的推定？",
        "preferred_evidence_ids": [],
    },
}


# ---------------------------------------------------------------------------
# 谜底解决链（人工审核，non-AI，仅在完成阶段后由后端返回）
# ---------------------------------------------------------------------------

SOLUTION_STEPS: List[SolutionStep] = [
    SolutionStep(
        step_id=1,
        text="老鼠没有从门缝离开却全部消失，证明牢房存在第二个未被注意的出口——那个通向围墙外的废弃排水管。",
        evidence_ids=["E04", "E05"],
    ),
    SolutionStep(
        step_id=2,
        text="教授通过排水管把布信与五美元送出，球场男孩捡到后交给记者哈奇，双方由此建立起一条外部通信线。",
        evidence_ids=["E05", "E06"],
    ),
    SolutionStep(
        step_id=3,
        text="通信线逐步升级为可以双向传递零钱、工具与化学品的运输通道，纸币面额的变化正是这次交换留下的痕迹。",
        evidence_ids=["E06", "E07"],
    ),
    SolutionStep(
        step_id=4,
        text="教授用运进来的硝酸腐蚀牢门下部钢条与窗栏，也用同样的方式处理了院外的供电线；巴拉德听到的破碎声音正是这一过程的痕迹。",
        evidence_ids=["E08"],
    ),
    SolutionStep(
        step_id=5,
        text="约定夜晚，供电线被切断造成全监狱停电；教授拆下已被腐蚀的窗栏进入院子，与提前混入的哈奇换上电工服，两人以电工身份从正门离开。",
        evidence_ids=["E09"],
    ),
]


# ---------------------------------------------------------------------------
# 禁剧透词表：未来实体/机制，在 stage 1-3 的模型输出中一律不得出现
# ---------------------------------------------------------------------------

SPOILER_TERMS: List[str] = [
    "硝酸",
    "腐蚀",
    "钢条",
    "停电",
    "供电线",
    "电工",
    "换装",
    "混入",
    "正门",
    "记者哈奇",
    "哈奇",
    "球场男孩",
    "五步逃脱",
    "逃脱路径",
    "答案是",
    "正确答案",
    "标准答案",
]
