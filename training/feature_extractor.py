#!/usr/bin/env python3
"""
Extractor de features para líneas de tickets.
Mirror Python del featureExtractor.ts — DEBEN producir los mismos valores.

28 features numéricas por línea, todas en rango 0-1 o binarias.
"""

import re
import math

LINE_CLASSES = [
    'MERCHANT', 'ADDRESS', 'RFC_LINE', 'DATE', 'PRODUCT',
    'SUBTOTAL', 'TAX', 'TOTAL', 'PAYMENT', 'CHANGE',
    'DECORATION', 'NOISE',
]

# Patterns
PRICE_PATTERN = re.compile(
    r'\$?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})|\$?\s*\d+(?:\.\d{1,2})|\$\s*\d+'
)
DATE_PATTERN = re.compile(
    r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|'
    r'\d{4}[/-]\d{2}[/-]\d{2}|'
    r'\d{1,2}\s+de\s+\w+|'
    r'(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)',
    re.IGNORECASE
)
RFC_PATTERN = re.compile(r'[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}', re.IGNORECASE)

TOTAL_KEYWORDS = re.compile(r'\btotal\b', re.IGNORECASE)
SUBTOTAL_KEYWORDS = re.compile(r'\bsub\s*total\b', re.IGNORECASE)
TAX_KEYWORDS = re.compile(r'\biva\b|\bi\.v\.a\b|\bimpuesto\b', re.IGNORECASE)
PAYMENT_KEYWORDS = re.compile(
    r'\befectivo\b|\btarjeta\b|\bvisa\b|\bmastercard\b|\bdebito\b|\bcredito\b|\bpago\b',
    re.IGNORECASE
)
CHANGE_KEYWORDS = re.compile(r'\bcambio\b|\bvuelto\b', re.IGNORECASE)
ADDRESS_KEYWORDS = re.compile(
    r'\bcalle\b|\bav\b|\bavenida\b|\bblvd\b|\bboulevard\b|\bcol\b|\bcolonia\b|\bc\.?\s*p\.?\s*\d',
    re.IGNORECASE
)
DECORATION_PATTERN = re.compile(r'^[\s*=\-_#.]{3,}$')
QUANTITY_PATTERN = re.compile(
    r'\b\d+\s*[xX]\s*\d|\bcant\.?\b|\bpiezas?\b|\bpzas?\b|\bpcs\b|\bunidades?\b|\bund\b',
    re.IGNORECASE
)
PRODUCT_UNIT_KW = re.compile(
    r'\bkg\b|\bkilo\b|\bgramo\b|\bgr?\b|\blitro\b|\blt[s]?\b|\bml\b|\bpza\b|\bpieza\b|\bpz\b|\bunid\b',
    re.IGNORECASE
)


def has_price(text):
    """Check if text contains a price pattern."""
    cleaned = re.sub(r'(\d)\s+\.(\d)', r'\1.\2', text)
    cleaned = re.sub(r'\.\s+(\d)', r'.\1', cleaned)
    return bool(PRICE_PATTERN.search(cleaned))


def extract_price_values(text):
    """Extract all price values from text, return as list of floats."""
    cleaned = re.sub(r'(\d)\s+\.(\d)', r'\1.\2', text)
    cleaned = re.sub(r'\.\s+(\d)', r'.\1', cleaned)
    matches = PRICE_PATTERN.findall(cleaned)
    values = []
    for m in matches:
        try:
            v = float(m.replace('$', '').replace(',', '').strip())
            if v > 0 and v < 1_000_000:
                values.append(v)
        except ValueError:
            pass
    return values


def extract_features(line, line_index, total_lines, prev_line='', next_line=''):
    """
    Extract 28 features from a single line.
    Returns a list of 28 floats.
    """
    text = line.strip()
    features = []

    # 1. linePosition: normalized position (0=top, 1=bottom)
    features.append(line_index / max(total_lines - 1, 1))

    # 2. lineLength: normalized length (max 80)
    features.append(min(len(text) / 80.0, 1.0))

    # 3. wordCount: normalized word count (max 10)
    words = text.split()
    features.append(min(len(words) / 10.0, 1.0))

    # 4. digitRatio: proportion of digits
    digits = sum(1 for c in text if c.isdigit())
    features.append(digits / max(len(text), 1))

    # 5. letterRatio: proportion of letters
    letters = sum(1 for c in text if c.isalpha())
    features.append(letters / max(len(text), 1))

    # 6. hasPrice: contains price pattern
    features.append(1.0 if has_price(text) else 0.0)

    # 7. hasDollarSign: contains $
    features.append(1.0 if '$' in text else 0.0)

    # 8. isAllCaps: all alphabetic chars are uppercase
    alpha_chars = [c for c in text if c.isalpha()]
    features.append(1.0 if alpha_chars and all(c.isupper() for c in alpha_chars) else 0.0)

    # 9. startsWithNumber: starts with a digit
    features.append(1.0 if text and text[0].isdigit() else 0.0)

    # 10. containsTotalKw: "total" but NOT "subtotal"
    has_total = bool(TOTAL_KEYWORDS.search(text))
    has_subtotal = bool(SUBTOTAL_KEYWORDS.search(text))
    features.append(1.0 if has_total and not has_subtotal else 0.0)

    # 11. containsSubtotalKw
    features.append(1.0 if has_subtotal else 0.0)

    # 12. containsTaxKw
    features.append(1.0 if TAX_KEYWORDS.search(text) else 0.0)

    # 13. containsPaymentKw
    features.append(1.0 if PAYMENT_KEYWORDS.search(text) else 0.0)

    # 14. containsChangeKw
    features.append(1.0 if CHANGE_KEYWORDS.search(text) else 0.0)

    # 15. containsDatePattern
    features.append(1.0 if DATE_PATTERN.search(text) else 0.0)

    # 16. containsRfcPattern
    features.append(1.0 if RFC_PATTERN.search(text) else 0.0)

    # 17. containsAddressKw
    features.append(1.0 if ADDRESS_KEYWORDS.search(text) else 0.0)

    # 18. hasDecorationChars: line of *, =, -, _
    features.append(1.0 if DECORATION_PATTERN.match(text) else 0.0)

    # 19. distanceFromEnd: how close to the top (1=top, 0=bottom)
    features.append(1.0 - (line_index / max(total_lines - 1, 1)))

    # 20. prevLineHasPrice
    features.append(1.0 if has_price(prev_line) else 0.0)

    # 21. priceCount (number of prices in line, normalized by 5)
    prices = extract_price_values(text)
    features.append(min(len(prices) / 5.0, 1.0))

    # 22. maxPriceNorm (log-normalized max price value)
    max_price = max(prices) if prices else 0
    features.append(math.log(max_price + 1) / math.log(100001))

    # 23. hasQuantityPattern ("2 x", "cant.", "pzas", etc.)
    features.append(1.0 if QUANTITY_PATTERN.search(text) else 0.0)

    # 24. hasProductUnitKeywords ("kg", "lt", "ml", "pza", etc.)
    features.append(1.0 if PRODUCT_UNIT_KW.search(text) else 0.0)

    # 25. colonInLine
    features.append(1.0 if ':' in text else 0.0)

    # 26. isShortLine (< 5 chars)
    features.append(1.0 if len(text) < 5 else 0.0)

    # 27. nextLineHasPrice
    features.append(1.0 if has_price(next_line) else 0.0)

    # 28. prevLineHasTotal
    prev_has_total = bool(TOTAL_KEYWORDS.search(prev_line)) and not bool(SUBTOTAL_KEYWORDS.search(prev_line))
    features.append(1.0 if prev_has_total else 0.0)

    return features


def extract_all_features(ocr_text):
    """Extract features for all lines in an OCR text."""
    lines = ocr_text.split('\n')
    total = len(lines)
    result = []
    for i, line in enumerate(lines):
        prev = lines[i - 1] if i > 0 else ''
        nxt = lines[i + 1] if i < total - 1 else ''
        feat = extract_features(line, i, total, prev, nxt)
        result.append(feat)
    return result
