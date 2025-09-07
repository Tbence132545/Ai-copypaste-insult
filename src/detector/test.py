from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import json
import sys

# Load model once for faster inference
model_name = "roberta-base-openai-detector"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name)

def predict(text: str):
    """Return [human_prob, ai_prob] for a given text"""
    inputs = tokenizer(text, return_tensors="pt")
    outputs = model(**inputs)
    pred = torch.softmax(outputs.logits, dim=-1)
    return pred[0].tolist()

# Background worker, continuously reads lines from stdin
if __name__ == "__main__":
    while True:
        line = sys.stdin.readline()
        if not line:
            break  # EOF
        line = line.strip()
        if not line:
            continue
        try:
            result = predict(line)
            print(json.dumps(result), flush=True)
        except Exception as e:
            print(json.dumps([0.0, 1.0]), flush=True)  # fallback
