import re
from typing import Final

# 19 Korean Initial Consonants (초성)
CHOSUNG_LIST: Final[list[str]] = [
    "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
    "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"
]

# ETF Major Brand Phonetic & Chosung Mappings
ETF_BRAND_MAPPINGS: Final[dict[str, dict[str, str]]] = {
    "KODEX": {"kr": "코덱스", "chosung": "ㅋㄷㅅ"},
    "TIGER": {"kr": "타이거", "chosung": "ㅌㅇㄱ"},
    "ACE": {"kr": "에이스", "chosung": "ㅇㅇㅅ"},
    "SOL": {"kr": "솔", "chosung": "ㅅㄹ"},
    "RISE": {"kr": "라이즈", "chosung": "ㄹㅇㅈ"},
    "KBSTAR": {"kr": "케이비스타", "chosung": "ㅋㅂㅅㅌ"},
    "PLUS": {"kr": "플러스", "chosung": "ㅍㄹㅅ"},
    "ARIRANG": {"kr": "아리랑", "chosung": "ㅇㄹㄹ"},
    "KOSEF": {"kr": "코세프", "chosung": "ㅋㅅㅍ"},
    "HANARO": {"kr": "하나로", "chosung": "ㅎㄴㄹ"},
    "TIMEFOLIO": {"kr": "타임폴리오", "chosung": "ㅌㅇㅍㄹㅇ"},
    "HEROES": {"kr": "히어로즈", "chosung": "ㅎㅇㄹㅈ"},
    "WOORI": {"kr": "우리", "chosung": "ㅇㄹ"},
    "WON": {"kr": "원", "chosung": "ㅇ"},
}


def extract_chosung(text: str) -> str:
    """
    Extract Hangul initial consonants (초성) from given text.
    Non-Hangul characters (digits, English letters, symbols) are preserved.
    Example:
      '삼성자산운용' -> 'ㅅㅅㅈㅅㅇㅇ'
      '미국S&P500' -> 'ㅁㄱS&P500'
      'KODEX 200' -> 'ㅋㄷㅅ 200' (via brand normalization)
    """
    if not text:
        return ""

    result = []
    # Check for brand replacements in uppercase
    upper_text = text.upper()
    replaced_text = text

    for brand, info in ETF_BRAND_MAPPINGS.items():
        if brand in upper_text:
            # Replace brand with Korean for chosung extraction
            replaced_text = re.sub(brand, info["kr"], replaced_text, flags=re.IGNORECASE)

    for char in replaced_text:
        code = ord(char)
        # Check if character is a Hangul Syllable (AC00 ~ D7A3)
        if 0xAC00 <= code <= 0xD7A3:
            chosung_index = (code - 0xAC00) // (21 * 28)
            result.append(CHOSUNG_LIST[chosung_index])
        else:
            result.append(char)

    return "".join(result)


def is_all_chosung(text: str) -> bool:
    """Check if the given string consists only of Hangul initial consonants and whitespace."""
    if not text or not text.strip():
        return False
    chosung_set = set(CHOSUNG_LIST)
    for ch in text.strip():
        if not ch.isspace() and ch not in chosung_set:
            return False
    return True


def normalize_query(query: str) -> dict:
    """
    Analyze user search query and expand potential brand keywords and chosung.
    Returns:
      {
        "original": query,
        "is_chosung": bool,
        "is_ticker": bool (6 digits),
        "expanded_terms": list of string query variants
      }
    """
    cleaned = query.strip()
    is_ticker = bool(re.fullmatch(r"\d{6}", cleaned))
    all_chosung = is_all_chosung(cleaned)

    expanded = {cleaned, cleaned.upper()}

    # Check if query matches brand korean or brand chosung
    for brand, info in ETF_BRAND_MAPPINGS.items():
        if cleaned.upper() == brand or cleaned == info["kr"] or cleaned == info["chosung"]:
            expanded.add(brand)
            expanded.add(info["kr"])
            expanded.add(info["chosung"])
        elif info["chosung"] in cleaned:
            expanded.add(cleaned.replace(info["chosung"], brand))
            expanded.add(cleaned.replace(info["chosung"], info["kr"]))
        elif info["kr"] in cleaned:
            expanded.add(cleaned.replace(info["kr"], brand))

    return {
        "original": cleaned,
        "is_chosung": all_chosung,
        "is_ticker": is_ticker,
        "expanded_terms": list(expanded),
    }
