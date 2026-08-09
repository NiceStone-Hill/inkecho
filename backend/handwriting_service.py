"""本地手写文字识别。

使用 PP-OCRv5_mobile_rec。

特点：
- 不调用外部 OCR API
- 模型只加载一次
- 输入是前端生成的 base64 PNG
- 输出识别文字 + 置信度
"""

import base64
import io
import json
import os
import threading

# ========================================
# Config
# ========================================

MODEL_NAME = os.environ.get(
    "HANDWRITING_OCR_MODEL",
    "PP-OCRv5_mobile_rec",
)

DEVICE = os.environ.get(
    "HANDWRITING_OCR_DEVICE",
    "cpu",
)

CPU_THREADS = int(
    os.environ.get(
        "HANDWRITING_OCR_CPU_THREADS",
        "4",
    )
)


# ========================================
# Singleton model
# ========================================

_model = None

_model_load_lock = (
    threading.Lock()
)

_inference_lock = (
    threading.Lock()
)


def _get_model():
    """模型只加载一次。"""

    global _model

    if _model is not None:
        return _model

    with _model_load_lock:

        if _model is None:

            print(
                "[Handwriting OCR] "
                f"Loading {MODEL_NAME}..."
            )

            from paddleocr import (
                TextRecognition,
            )

            _model = (
                TextRecognition(
                    model_name=MODEL_NAME,
                    device=DEVICE,
                    cpu_threads=CPU_THREADS,
                )
            )

            print(
                "[Handwriting OCR] "
                "Model ready."
            )

    return _model


# ========================================
# Decode image
# ========================================

def _decode_data_url(
    image_data_url: str,
):

    if not image_data_url:
        raise ValueError(
            "image_data_url is empty"
        )

    if "," not in image_data_url:
        raise ValueError(
            "invalid image data url"
        )

    header, encoded = (
        image_data_url.split(
            ",",
            1,
        )
    )

    if (
        "base64"
        not in header
    ):
        raise ValueError(
            "image must be base64"
        )

    try:

        from PIL import (
            Image,
        )

        raw = (
            base64.b64decode(
                encoded
            )
        )

        image = (
            Image.open(
                io.BytesIO(raw)
            )
            .convert("RGB")
        )

    except Exception as exc:

        raise ValueError(
            "cannot decode image"
        ) from exc

    return image


# ========================================
# Crop whitespace
# ========================================

def _crop_handwriting(
    image,
):
    """自动裁掉手写框四周的大量空白。"""

    from PIL import (
        Image,
        ImageChops,
    )

    white = Image.new(
        "RGB",
        image.size,
        "white",
    )

    diff = ImageChops.difference(
        image,
        white,
    )

    gray = diff.convert("L")

    # 忽略非常浅的抗锯齿像素
    mask = gray.point(
        lambda value:
            255
            if value > 18
            else 0
    )

    bbox = mask.getbbox()

    # 没找到笔迹
    if bbox is None:
        return image

    padding = 18

    left = max(
        0,
        bbox[0] - padding,
    )

    top = max(
        0,
        bbox[1] - padding,
    )

    right = min(
        image.width,
        bbox[2] + padding,
    )

    bottom = min(
        image.height,
        bbox[3] + padding,
    )

    return image.crop(
        (
            left,
            top,
            right,
            bottom,
        )
    )


# ========================================
# Result parser
# ========================================

def _parse_result(
    result,
):
    """兼容 PaddleOCR Result 对象。"""

    data = result.json

    if callable(data):
        data = data()

    if isinstance(
        data,
        str,
    ):
        data = json.loads(
            data
        )

    if not isinstance(
        data,
        dict,
    ):
        return "", None

    payload = data.get(
        "res",
        data,
    )

    text = str(
        payload.get(
            "rec_text",
            "",
        )
    ).strip()

    score = payload.get(
        "rec_score"
    )

    if score is not None:
        try:
            score = float(score)
        except (
            TypeError,
            ValueError,
        ):
            score = None

    return text, score


# ========================================
# Public API
# ========================================

def recognize_handwriting(
    image_data_url: str,
):
    """识别一行手写批注。

    return:
        (text, confidence)
    """

    image = (
        _decode_data_url(
            image_data_url
        )
    )

    image = (
        _crop_handwriting(
            image
        )
    )

    import numpy as np

    image_array = np.array(
        image
    )

    model = _get_model()

    # Demo 中并发很低。
    # 为避免模型对象同时 predict，
    # 做一个简单锁。
    with _inference_lock:

        outputs = (
            model.predict(
                input=image_array,
                batch_size=1,
            )
        )

    if not outputs:
        return "", None

    return _parse_result(
        outputs[0]
    )
