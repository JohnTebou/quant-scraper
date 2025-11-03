"""
Generate categories using OpenAI o1-mini reasoning model.
This script analyzes 200 sample questions and generates 25-40 comprehensive categories.
"""

import json
import os
from pathlib import Path
from typing import List, Dict
from dotenv import load_dotenv
from openai import OpenAI
import random

# Load environment variables
load_dotenv('../.env.local')

# Configure OpenAI
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY not found in .env.local")

client = OpenAI(api_key=OPENAI_API_KEY)

print("✅ OpenAI configured successfully\n")

# Load questions
questions_file = Path('../all-questions-content.json')
if not questions_file.exists():
    print("❌ all-questions-content.json not found!")
    exit(1)

with open(questions_file, 'r', encoding='utf-8') as f:
    questions = json.load(f)

print(f"✅ Loaded {len(questions)} questions\n")

# Improved prompt - less prescriptive, more room for AI to think
PHASE1_PROMPT = """You are analyzing quantitative finance interview questions to create a comprehensive categorization system.

## Your Task:
Read through ALL the sample questions and identify RECURRING patterns, themes, and topics. Create categories that will help students organize and study these questions effectively.

## What to Look For:

### 1. Mathematical Domains
What areas of mathematics appear repeatedly across questions?
- Examples: Probability Theory, Calculus, Linear Algebra, Statistics, Combinatorics, etc.
- Only include if you see multiple questions using these concepts

### 2. Mathematical Techniques & Concepts
What specific methods or concepts are used frequently?
- Examples: Expected Value, Integration, Conditional Probability, Eigenvalues, Derivatives, Recursion, etc.
- Only include techniques that appear in multiple questions

### 3. Problem Objects & Scenarios
What physical objects or scenarios appear in multiple questions?
- Examples: Dice, Coins, Cards, Balls/Urns, etc.
- IMPORTANT: Only include objects that appear in 5+ questions. Skip one-off objects.

### 4. Problem Types
What types of problems do you see repeatedly?
- Examples: Optimization, Brainteasers, Game Theory, Geometric Probability, etc.

## Critical Rules:
1. **Base categories ONLY on what you actually see in the questions** - not on general quant knowledge
2. **Look for patterns that appear in MULTIPLE questions** (ideally 5+)
3. **Skip one-off scenarios** - If only one question mentions cherries, don't create a "Cherries" category
4. **Aim for 25-40 comprehensive categories** that cover the major themes
5. **Be specific enough to be useful** - "Probability Theory" and "Expected Value" are both valid (one broad, one specific)
6. **Use clear, professional names** - No cutesy names

## Output Format:
Return ONLY a JSON array of category strings, nothing else. No explanation.

Example format: ["Probability Theory", "Expected Value", "Calculus", "Integration", "Linear Algebra", "Dice", "Coins", "Brainteasers", "Optimization", "Random Variables", "Conditional Probability", "Combinatorics"]
"""

# Sample 200 questions
sample_size = 200
sample = random.sample(questions, min(sample_size, len(questions)))

# Build summary
sample_summary = "Sample of questions to analyze:\n\n"
for i, q in enumerate(sample[:30], 1):  # Show first 30
    sample_summary += f"{i}. {q['name']} [{q['difficulty']}] - Tags: {', '.join(q['tags'])}\n"
    sample_summary += f"   Text: {q['questionText'][:200]}...\n\n"

sample_summary += f"\n... and {len(sample) - 30} more questions with similar variety.\n"

user_message = f"{PHASE1_PROMPT}\n\n{sample_summary}\n\nGenerate comprehensive category set:"

print("🔍 Phase 1: Generating category set from sample questions...")
print(f"   Using o1-mini reasoning model (this may take 30-60 seconds)")
print(f"   Analyzing {len(sample)} sample questions...\n")

try:
    # Use o1-mini reasoning model
    response = client.chat.completions.create(
        model="o1-mini",
        messages=[
            {"role": "user", "content": user_message}
        ]
    )
    
    response_text = response.choices[0].message.content.strip()
    
    # Remove markdown code blocks if present
    if response_text.startswith('```'):
        response_text = response_text.split('```')[1]
        if response_text.startswith('json'):
            response_text = response_text[4:]
    
    categories = json.loads(response_text.strip())
    
    print(f"✅ Generated {len(categories)} categories\n")
    print("Categories:")
    for i, cat in enumerate(sorted(categories), 1):
        print(f"  {i:2d}. {cat}")
    
    # Save categories
    with open('generated_categories_v2.json', 'w', encoding='utf-8') as f:
        json.dump(sorted(categories), f, indent=2, ensure_ascii=False)
    
    # Save verification data
    verification_data = {
        "generated_categories": sorted(categories),
        "sample_questions_analyzed": [
            {
                "name": q['name'],
                "difficulty": q['difficulty'],
                "tags": q['tags'],
                "text_preview": q['questionText'][:300]
            }
            for q in sample
        ],
        "note": "Review these sample questions to verify that categories match what's actually in the questions"
    }
    
    with open('category_generation_verification_v2.json', 'w', encoding='utf-8') as f:
        json.dump(verification_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Saved {len(categories)} categories to generated_categories_v2.json")
    print(f"💾 Saved verification data to category_generation_verification_v2.json")
    print(f"\n✅ Done! Review the verification file to check if categories match the questions.")

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()







