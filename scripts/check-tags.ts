/**
 * Check how many tags each question has
 */

import { readFile } from 'fs/promises';

async function checkTags() {
  console.log('🔍 Analyzing tags in scraped data...\n');

  const data = await readFile('scraped-problems.json', 'utf-8');
  const problems = JSON.parse(data);

  const tagCounts: Record<number, number> = {};
  const allTags = new Set<string>();
  const multiTagExamples: any[] = [];

  problems.forEach((p: any) => {
    const numTags = p.tags?.length || 0;
    tagCounts[numTags] = (tagCounts[numTags] || 0) + 1;
    
    if (p.tags) {
      p.tags.forEach((tag: string) => allTags.add(tag));
      
      if (numTags > 1 && multiTagExamples.length < 10) {
        multiTagExamples.push({
          name: p.name,
          tags: p.tags,
          difficulty: p.difficulty
        });
      }
    }
  });

  console.log('📊 Tag Count Distribution:');
  console.log('='.repeat(60));
  Object.entries(tagCounts)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .forEach(([count, questions]) => {
      const percentage = ((questions / problems.length) * 100).toFixed(2);
      console.log(`Questions with ${count} tag(s): ${questions} (${percentage}%)`);
    });

  console.log('\n🏷️  All Unique Tags:');
  console.log('='.repeat(60));
  Array.from(allTags).sort().forEach(tag => {
    const count = problems.filter((p: any) => p.tags?.includes(tag)).length;
    console.log(`  ${tag}: ${count} questions`);
  });

  if (multiTagExamples.length > 0) {
    console.log('\n📝 Examples of Questions with Multiple Tags:');
    console.log('='.repeat(60));
    multiTagExamples.forEach((ex, i) => {
      console.log(`${i + 1}. ${ex.name} [${ex.difficulty}]`);
      console.log(`   Tags: ${ex.tags.join(', ')}`);
      console.log();
    });
  }

  console.log('\n💡 Recommendation:');
  if (tagCounts[0] + tagCounts[1] === problems.length) {
    console.log('✅ All questions have 0 or 1 tag - ENUM is perfect!');
  } else {
    console.log('⚠️  Some questions have multiple tags - consider keeping array or choosing primary tag');
  }
}

checkTags();






