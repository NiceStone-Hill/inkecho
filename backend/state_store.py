"""用户阅读状态的轻量存储。

Demo 阶段先使用内存。
以后换 SQLite / PostgreSQL 时，
只需要替换这个文件即可。
"""

from schemas import AnnotationResponse


_ANNOTATIONS: dict[
    str,
    list[AnnotationResponse]
] = {}


def list_annotations(
    session_id: str,
) -> list[AnnotationResponse]:
    """获取某个用户的全部批注。"""

    return sorted(
        _ANNOTATIONS.get(
            session_id,
            [],
        ),
        key=lambda item: (
            item.stage_id,
            item.segment_index,
            item.created_at,
        ),
    )


def get_annotations_up_to_stage(
    session_id: str,
    max_stage_id: int,
) -> list[AnnotationResponse]:
    """只返回用户已经读到的批注。"""

    return [
        item
        for item in list_annotations(
            session_id
        )
        if item.stage_id <= max_stage_id
    ]


def add_annotation(
    annotation: AnnotationResponse,
) -> AnnotationResponse:
    """保存批注。"""

    _ANNOTATIONS.setdefault(
        annotation.session_id,
        [],
    ).append(annotation)

    return annotation


def delete_annotation(
    session_id: str,
    annotation_id: str,
) -> bool:
    """删除批注。

    返回 True 表示删除成功。
    """

    annotations = _ANNOTATIONS.get(
        session_id,
        [],
    )

    remaining = [
        item
        for item in annotations
        if item.id != annotation_id
    ]

    if len(remaining) == len(
        annotations
    ):
        return False

    _ANNOTATIONS[
        session_id
    ] = remaining

    return True