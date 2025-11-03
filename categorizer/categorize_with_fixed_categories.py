"""
Categorize all questions using a fixed set of categories.
Questions that don't fit any category will have an empty list.
"""

import json
import time
from pathlib import Path
from typing import List, Dict
from dotenv import load_dotenv
from openai import OpenAI
import os

# Load environment variables
load_dotenv('../.env.local')

# Configure OpenAI
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY not found in .env.local")

client = OpenAI(api_key=OPENAI_API_KEY)

print("✅ OpenAI configured successfully\n")

# Fixed categories
FIXED_CATEGORIES = [
    "Linear Algebra",
    "Uniform Random Variables",
    "Normal Random Variables",
    "Exponential Random Variables",
    "Hypergeometric Random Variables",
    "Binomial Random Variables",
    "Poisson Random Variables",
    "Continuous Random Variables",
    "Discrete Random Variables",
    "Coins",
    "Dice",
    "Cards",
    "Grids",
    "Martingales",
    "Markov Chains",
    "Stochastic Processes",
    "Random Walks",
    "Game Theory",
    "Calculus",
    "Geometry",
    "Algebraic Manipulation",
    "Combinatorics"
]

print(f"📋 Using {len(FIXED_CATEGORIES)} fixed categories:\n")
for i, cat in enumerate(FIXED_CATEGORIES, 1):
    print(f"  {i:2d}. {cat}")
print()

# Save fixed categories
with open('fixed_categories.json', 'w', encoding='utf-8') as f:
    json.dump(FIXED_CATEGORIES, f, indent=2, ensure_ascii=False)

# Load questions
questions_file = Path('../all-questions-content.json')
if not questions_file.exists():
    print("❌ all-questions-content.json not found!")
    exit(1)

with open(questions_file, 'r', encoding='utf-8') as f:
    questions = json.load(f)

print(f"✅ Loaded {len(questions)} questions\n")

# Categorization prompt
CATEGORIZATION_PROMPT = """You are categorizing quantitative finance interview questions. You MUST actually understand the problem and solution method before categorizing.

## CRITICAL: Understand the Problem First!
1. **Read the question carefully** - What is the problem actually asking?
2. **Think about the solution method** - What mathematical techniques are needed?
3. **Check if content is complete** - Scraping may have cut off text, be cautious
4. **Only assign categories if you're confident** - Don't guess based on keywords alone

## Available Categories:
{categories}

## Category Definitions (Use ONLY if the problem actually uses these):

**Random Variable Types** (assign ONLY if the problem explicitly involves these distributions):
- **Uniform Random Variables**: Problem involves uniform distribution U(a,b) or discrete uniform
- **Normal Random Variables**: Problem involves normal/Gaussian distribution N(μ,σ²)
- **Exponential Random Variables**: Problem involves exponential distribution Exp(λ)
- **Hypergeometric Random Variables**: Problem involves sampling without replacement from finite population
- **Binomial Random Variables**: Problem involves binomial distribution Bin(n,p) - repeated independent trials
- **Poisson Random Variables**: Problem involves Poisson distribution Pois(λ) - rare events
- **Continuous Random Variables**: Problem uses continuous distributions (normal, exponential, uniform continuous)
- **Discrete Random Variables**: Problem uses discrete distributions (binomial, Poisson, discrete uniform, hypergeometric)

**Object Types**:
- **Coins**: Problem involves coin flips/tosses
- **Dice**: Problem involves dice rolls
- **Cards**: Problem involves cards/deck of cards
- **Grids**: Problem involves grid paths/lattice paths (like Catalan numbers)

**Stochastic Processes** (ONLY if the problem involves time-dependent random processes):
- **Martingales**: Problem uses martingale property (E[X_{n+1}|X_n] = X_n)
- **Markov Chains**: Problem involves Markov chain (future depends only on current state)
- **Stochastic Processes**: General stochastic process (Brownian motion, etc.)
- **Random Walks**: Problem involves random walk (sum of random steps)

**Mathematical Domains**:
- **Linear Algebra**: Problem uses matrices, eigenvalues, eigenvectors, linear transformations
- **Calculus**: Problem uses derivatives, integrals, optimization via calculus
- **Geometry**: Problem involves geometric shapes, areas, volumes, distances
- **Algebraic Manipulation**: Problem requires algebraic simplification/manipulation
- **Combinatorics**: Problem involves counting, permutations, combinations
- **Game Theory**: Problem involves strategic decision-making, Nash equilibrium

## Rules:
1. **Think through the solution method** - What would you actually do to solve this?
2. **Be precise** - Don't assign "Discrete Random Variables" just because something is discrete
3. **Don't assign both Discrete AND Uniform** - Choose the most specific one
4. **Cards problems are usually Combinatorics + Cards** - Not necessarily "Discrete Random Variables"
5. **If uncertain, return []** - Better to miss a category than assign wrong one
6. **Try multiple times** - If unsure, think again before responding

## Examples:
- **Coin flip question**: Uses binomial distribution → ["Coins", "Binomial Random Variables"]
- **Poker hands**: Counting combinations → ["Cards", "Combinatorics"] (NOT "Discrete Random Variables")
- **Free sundae**: If it's a counting problem → ["Combinatorics"], if it doesn't fit → []
- **Matrix eigenvalue problem**: ["Linear Algebra"]
- **Derivative optimization**: ["Calculus"]
- **Grid path counting**: ["Grids", "Combinatorics"]
- **Brainteaser with no clear math**: []

## Output Format:
Return ONLY a JSON array of category strings. No explanation.
"""

def categorize_question(question: Dict, rate_limit_delay: float = 0.1, max_retries: int = 3) -> List[str]:
    """Categorize a single question with retry logic."""
    categories_str = "\n".join([f"- {cat}" for cat in FIXED_CATEGORIES])
    system_prompt = CATEGORIZATION_PROMPT.format(categories=categories_str)
    
    user_prompt = f"""Question Name: {question['name']}
Existing Tags: {', '.join(question['tags'])}
Difficulty: {question['difficulty']}

Question Text:
{question['questionText'][:1000]}

**INSTRUCTIONS:**
1. Read the problem carefully and understand what it's asking
2. Think about HOW you would solve it - what methods/techniques?
3. Assign categories ONLY if you're confident the problem actually uses those concepts
4. If the content seems incomplete or unclear, be conservative
5. Return [] if no categories fit confidently

Assign this question to appropriate categories (or return [] if none fit)."""
    
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,  # Slightly higher for more thoughtful responses
                max_tokens=1000,
            )
            
            response_text = response.choices[0].message.content.strip()
            
            # Remove markdown code blocks if present
            if response_text.startswith('```'):
                response_text = response_text.split('```')[1]
                if response_text.startswith('json'):
                    response_text = response_text[4:]
            
            categories = json.loads(response_text.strip())
            
            # Validate categories are from fixed list
            valid_categories = [cat for cat in categories if cat in FIXED_CATEGORIES]
            
            # Check for conflicting categories
            random_var_types = [
                "Uniform Random Variables", "Normal Random Variables", "Exponential Random Variables",
                "Hypergeometric Random Variables", "Binomial Random Variables", "Poisson Random Variables",
                "Continuous Random Variables", "Discrete Random Variables"
            ]
            
            assigned_rv_types = [cat for cat in valid_categories if cat in random_var_types]
            
            # If multiple random variable types assigned, keep only the most specific ones
            if len(assigned_rv_types) > 1:
                # Remove the generic ones if specific ones exist
                if any(cat in ["Uniform Random Variables", "Normal Random Variables", "Exponential Random Variables",
                               "Hypergeometric Random Variables", "Binomial Random Variables", "Poisson Random Variables"]
                       for cat in assigned_rv_types):
                    valid_categories = [cat for cat in valid_categories 
                                      if cat not in ["Continuous Random Variables", "Discrete Random Variables"]]
            
            # Rate limiting
            time.sleep(rate_limit_delay)
            
            return valid_categories
        
        except json.JSONDecodeError as e:
            if attempt < max_retries - 1:
                continue  # Retry on JSON parse error
            print(f"❌ JSON decode error after {max_retries} attempts for '{question['name']}': {e}")
            return []
        except Exception as e:
            if attempt < max_retries - 1:
                continue  # Retry on other errors
            print(f"❌ Error categorizing '{question['name']}' after {max_retries} attempts: {e}")
            return []
    
    return []  # Fallback if all retries fail

# Categorize all questions
print("🚀 Starting categorization...\n")
print(f"   Rate: 0.1s per question = ~{len(questions) * 0.1 / 60:.1f} minutes total\n")

categorized_questions = []
start_time = time.time()

for i, question in enumerate(questions, 1):
    categories = categorize_question(question, rate_limit_delay=0.1, max_retries=3)
    
    categorized_q = question.copy()
    categorized_q['aiCategories'] = categories
    categorized_questions.append(categorized_q)
    
    # Progress update
    if i % 10 == 0 or i == len(questions):
        elapsed = time.time() - start_time
        rate = i / elapsed if elapsed > 0 else 0
        eta = (len(questions) - i) / rate if rate > 0 else 0
        
        print(f"Progress: {i}/{len(questions)} ({i/len(questions)*100:.1f}%) | "
              f"Rate: {rate:.1f} q/s | "
              f"ETA: {eta/60:.1f} min")
    
    # Periodic save every 10 questions
    if i % 10 == 0:
        with open('categorized_questions_progress.json', 'w', encoding='utf-8') as f:
            json.dump(categorized_questions, f, indent=2, ensure_ascii=False)
        print(f"   💾 Progress saved ({i} questions)")

# Save final results
with open('categorized_questions_final.json', 'w', encoding='utf-8') as f:
    json.dump(categorized_questions, f, indent=2, ensure_ascii=False)

elapsed = time.time() - start_time
print(f"\n✅ Categorization complete!")
print(f"   Total time: {elapsed/60:.1f} minutes")
print(f"   Average: {elapsed/len(questions):.2f}s per question")

# Analyze results
from collections import Counter

all_categories = []
categories_per_question = []
no_category_count = 0

for q in categorized_questions:
    cats = q.get('aiCategories', [])
    all_categories.extend(cats)
    categories_per_question.append(len(cats))
    if len(cats) == 0:
        no_category_count += 1

category_counts = Counter(all_categories)

print(f"\n📊 Category Analysis")
print(f"{'='*80}")
print(f"Total questions: {len(categorized_questions)}")
print(f"Questions with NO categories: {no_category_count} ({no_category_count/len(categorized_questions)*100:.1f}%)")
print(f"Questions with categories: {len(categorized_questions) - no_category_count}")
print(f"Average categories per question: {sum(categories_per_question)/len(categories_per_question):.2f}")
print(f"Max categories on one question: {max(categories_per_question)}")

print(f"\nCategory Usage:")
print(f"{'-'*80}")
for cat in FIXED_CATEGORIES:
    count = category_counts.get(cat, 0)
    pct = count / len(categorized_questions) * 100 if count > 0 else 0
    status = "✓" if count > 0 else "✗"
    print(f"{status} {cat:35s} {count:4d} questions ({pct:5.1f}%)")

print(f"\n💾 Saved final results to categorized_questions_final.json")

