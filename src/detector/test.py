# test.py
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import sys
import json

model_name = "roberta-base-openai-detector"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name)

# Read pasted text from first argument if provided, else from stdin
if len(sys.argv) > 1:
    text = sys.argv[1]
else:
    text = sys.stdin.readline().strip()

inputs = tokenizer(text, return_tensors="pt")
outputs = model(**inputs)
pred = torch.softmax(outputs.logits, dim=-1)
print(json.dumps(pred.tolist()))
