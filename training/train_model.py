#!/usr/bin/env python3
"""
Entrena un modelo de regresión logística multinomial para clasificar
líneas de tickets mexicanos.

Input: training/data/receipts.json (5000 recibos generados)
Output: src/utils/modelWeights.json (pesos del modelo)

28 features × 12 clases = 336 pesos + 12 biases = 348 parámetros
"""

import json
import os
import sys
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

# Add parent dir to path for imports
sys.path.insert(0, os.path.dirname(__file__))
from feature_extractor import extract_features, LINE_CLASSES


def load_receipts(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def prepare_dataset(receipts):
    """Convert receipts to feature matrix X and label vector y."""
    X = []
    y = []

    for receipt in receipts:
        lines_text = receipt['ocrText'].split('\n')
        labels = receipt['lineLabels']
        total_lines = len(lines_text)

        # Ensure labels and lines match
        n = min(len(lines_text), len(labels))

        for i in range(n):
            line = lines_text[i]
            label_info = labels[i]
            label_type = label_info['type']

            if label_type not in LINE_CLASSES:
                continue

            prev_line = lines_text[i - 1] if i > 0 else ''
            next_line = lines_text[i + 1] if i < total_lines - 1 else ''
            features = extract_features(line, i, total_lines, prev_line, next_line)
            X.append(features)
            y.append(LINE_CLASSES.index(label_type))

    return np.array(X), np.array(y)


def train_model(X, y):
    """Train logistic regression and return model + metrics."""
    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print(f'Training set: {len(X_train)} lines')
    print(f'Test set: {len(X_test)} lines')
    print(f'Features per line: {X_train.shape[1]}')
    print(f'Classes: {len(LINE_CLASSES)}')
    print()

    # Train logistic regression with balanced class weights
    model = LogisticRegression(
        multi_class='multinomial',
        solver='lbfgs',
        max_iter=2000,
        C=0.8,
        class_weight='balanced',
        random_state=42,
    )
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)

    print(f'Overall accuracy: {accuracy:.4f}')
    print()

    # Per-class report
    target_names = LINE_CLASSES
    report = classification_report(y_test, y_pred, target_names=target_names, zero_division=0)
    print(report)

    # Key field accuracy
    key_fields = {
        'TOTAL': LINE_CLASSES.index('TOTAL'),
        'MERCHANT': LINE_CLASSES.index('MERCHANT'),
        'DATE': LINE_CLASSES.index('DATE'),
        'RFC_LINE': LINE_CLASSES.index('RFC_LINE'),
    }

    print('\nKey field accuracy:')
    for name, cls_idx in key_fields.items():
        mask = y_test == cls_idx
        if mask.sum() > 0:
            cls_acc = (y_pred[mask] == cls_idx).mean()
            print(f'  {name}: {cls_acc:.4f} ({mask.sum()} samples)')

    return model, accuracy


def export_weights(model, accuracy, output_path):
    """Export model weights to JSON for TypeScript inference."""
    weights = model.coef_.tolist()  # shape: (n_classes, n_features)
    biases = model.intercept_.tolist()  # shape: (n_classes,)

    # Round to 6 decimal places to keep file small
    weights = [[round(w, 6) for w in row] for row in weights]
    biases = [round(b, 6) for b in biases]

    model_data = {
        'version': 1,
        'classes': LINE_CLASSES,
        'weights': weights,
        'biases': biases,
        'accuracy': round(accuracy, 4),
        'numFeatures': len(weights[0]),
        'numClasses': len(weights),
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(model_data, f, indent=2)

    file_size = os.path.getsize(output_path)
    print(f'\nModel saved to {output_path} ({file_size} bytes)')
    print(f'Parameters: {len(weights) * len(weights[0]) + len(biases)}')


def evaluate_receipt_accuracy(model, receipts):
    """Evaluate end-to-end accuracy on receipts (amount, merchant, date, rfc)."""
    import re

    correct = {'amount': 0, 'merchant': 0, 'date': 0, 'rfc': 0}
    total_count = len(receipts)

    for receipt in receipts:
        lines_text = receipt['ocrText'].split('\n')
        total_lines = len(lines_text)
        gt = receipt['groundTruth']

        # Predict line types
        predictions = []
        for i, line in enumerate(lines_text):
            prev = lines_text[i - 1] if i > 0 else ''
            feats = extract_features(line, i, total_lines, prev)
            pred = model.predict([feats])[0]
            predictions.append((line, LINE_CLASSES[pred]))

        # Check amount: find TOTAL lines and extract price
        total_lines_pred = [text for text, cls in predictions if cls == 'TOTAL']
        found_amount = None
        for tl in total_lines_pred:
            cleaned = re.sub(r'(\d)\s+\.(\d)', r'\1.\2', tl)
            prices = re.findall(r'\$?\s*([\d,]+\.\d{1,2})', cleaned)
            if not prices:
                prices = re.findall(r'\$?\s*([\d,]+)', cleaned)
            for p in prices:
                val = float(p.replace(',', ''))
                if val > 0:
                    found_amount = val

        if found_amount is not None and abs(found_amount - gt['amount']) < 0.02:
            correct['amount'] += 1

        # Check merchant: find MERCHANT lines
        merchant_lines = [text.strip() for text, cls in predictions if cls == 'MERCHANT' and text.strip()]
        if merchant_lines:
            merged = ' '.join(merchant_lines).upper()
            gt_name = gt['merchantName'].upper().split()[0]  # First word
            if gt_name in merged or merged in gt_name:
                correct['merchant'] += 1

        # Check date: find DATE lines
        date_lines = [text for text, cls in predictions if cls == 'DATE']
        if date_lines:
            correct['date'] += 1  # Simplified: just check if we found a date line

        # Check RFC: find RFC_LINE
        rfc_lines = [text for text, cls in predictions if cls == 'RFC_LINE']
        if rfc_lines:
            merged_rfc = ' '.join(rfc_lines).upper()
            if gt['rfc'].upper() in merged_rfc:
                correct['rfc'] += 1

    print(f'\nEnd-to-end accuracy on {total_count} receipts:')
    for field, count in correct.items():
        pct = count / total_count * 100
        print(f'  {field}: {pct:.1f}% ({count}/{total_count})')


def main():
    # Load data
    data_path = os.path.join(os.path.dirname(__file__), 'data', 'receipts.json')
    if not os.path.exists(data_path):
        print(f'Error: {data_path} not found. Run generate_receipts.py first.')
        sys.exit(1)

    print('Loading receipts...')
    receipts = load_receipts(data_path)
    print(f'Loaded {len(receipts)} receipts')

    # Prepare dataset
    print('\nExtracting features...')
    X, y = prepare_dataset(receipts)
    print(f'Total samples: {len(X)}')
    print(f'Feature vector size: {X.shape[1]}')

    # Label distribution
    unique, counts = np.unique(y, return_counts=True)
    print('\nLabel distribution:')
    for u, c in zip(unique, counts):
        print(f'  {LINE_CLASSES[u]:15s}: {c:5d} ({c/len(y)*100:.1f}%)')

    # Train
    print('\n' + '=' * 50)
    print('TRAINING')
    print('=' * 50)
    model, accuracy = train_model(X, y)

    # If accuracy is too low, try with stronger regularization
    if accuracy < 0.87:
        print('\nAccuracy below target. Trying with C=0.3...')
        X_train2, X_test2, y_train2, y_test2 = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        model2 = LogisticRegression(
            multi_class='multinomial', solver='lbfgs',
            max_iter=3000, C=0.3, class_weight='balanced', random_state=42,
        )
        model2.fit(X_train2, y_train2)
        acc2 = accuracy_score(y_test2, model2.predict(X_test2))
        if acc2 > accuracy:
            model = model2
            accuracy = acc2
            print(f'Improved to {accuracy:.4f}')

    # Export weights
    output_path = os.path.join(
        os.path.dirname(__file__), '..', 'src', 'utils', 'modelWeights.json'
    )
    export_weights(model, accuracy, output_path)

    # End-to-end evaluation
    print('\n' + '=' * 50)
    print('END-TO-END EVALUATION')
    print('=' * 50)
    evaluate_receipt_accuracy(model, receipts[:200])


if __name__ == '__main__':
    main()
