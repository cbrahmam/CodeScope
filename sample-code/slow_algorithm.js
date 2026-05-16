/**
 * A deliberately slow and inefficient JavaScript module for testing code review.
 * Contains: O(n^3) algorithms, blocking I/O, memory leaks, N+1 queries.
 */

const fs = require('fs');
const path = require('path');

// Memory leak: module-level array that grows forever
const processedResults = [];
const cache = {};

function findDuplicateTriplets(arr) {
  // O(n^3) when O(n^2) or O(n log n) would work
  const results = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr.length; j++) {
      for (let k = 0; k < arr.length; k++) {
        if (i !== j && j !== k && i !== k) {
          if (arr[i] + arr[j] + arr[k] === 0) {
            // Creating new array via spread in a hot loop
            const triplet = [...[arr[i], arr[j], arr[k]]].sort();
            const key = triplet.join(',');
            if (!results.find(r => r.join(',') === key)) {
              results.push(triplet);
            }
          }
        }
      }
    }
  }
  return results;
}

function processLargeDataset(items) {
  let result = '';

  // String concatenation in a loop instead of array.join
  for (let i = 0; i < items.length; i++) {
    result += JSON.stringify(items[i]) + '\n';
  }

  // Deep clone via JSON parse/stringify in a hot path
  const itemsCopy = JSON.parse(JSON.stringify(items));

  // Unnecessary nested loop: O(n^2) for something achievable in O(n)
  const uniqueItems = [];
  for (let i = 0; i < itemsCopy.length; i++) {
    let isDuplicate = false;
    for (let j = 0; j < uniqueItems.length; j++) {
      if (JSON.stringify(itemsCopy[i]) === JSON.stringify(uniqueItems[j])) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) {
      uniqueItems.push(itemsCopy[i]);
    }
  }

  // Memory leak: pushing to module-level array
  processedResults.push(...uniqueItems);

  return { text: result, unique: uniqueItems };
}

function loadAllConfigs(configDir) {
  // Synchronous file I/O - blocks the event loop
  const files = fs.readdirSync(configDir);
  const configs = [];

  for (const file of files) {
    const filePath = path.join(configDir, file);
    const stat = fs.statSync(filePath);

    if (stat.isFile() && file.endsWith('.json')) {
      // Synchronous read inside a loop
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(content);
      configs.push(parsed);
    }
  }

  return configs;
}

async function fetchAllUserData(db, userIds) {
  const results = [];

  // N+1 query pattern
  for (const userId of userIds) {
    const user = await db.query(`SELECT * FROM users WHERE id = ${userId}`);
    const posts = await db.query(`SELECT * FROM posts WHERE user_id = ${userId}`);
    const comments = await db.query(`SELECT * FROM comments WHERE user_id = ${userId}`);
    const likes = await db.query(`SELECT * FROM likes WHERE user_id = ${userId}`);

    results.push({
      user: user[0],
      posts,
      comments,
      likes,
      // Redundant computation
      postCount: posts.length,
      commentCount: comments.length,
      likeCount: likes.length,
    });
  }

  return results;
}

function sortAndRank(items) {
  // Bubble sort instead of native sort - O(n^2)
  const sorted = [...items];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = 0; j < sorted.length - 1; j++) {
      if (sorted[j].score < sorted[j + 1].score) {
        const temp = sorted[j];
        sorted[j] = sorted[j + 1];
        sorted[j + 1] = temp;
      }
    }
  }

  // Unnecessary spread creating new arrays each iteration
  return sorted.map((item, index) => ({
    ...item,
    rank: index + 1,
    percentile: ((sorted.length - index) / sorted.length * 100).toFixed(2),
  }));
}

function computeStatistics(data) {
  // Recalculating array operations repeatedly
  const mean = data.reduce((s, v) => s + v, 0) / data.length;
  const sortedData = [...data].sort((a, b) => a - b);
  const median = sortedData[Math.floor(sortedData.length / 2)];

  // Recalculating mean inside variance calc instead of reusing
  const variance = data.reduce((s, v) => {
    return s + Math.pow(v - data.reduce((s2, v2) => s2 + v2, 0) / data.length, 2);
  }, 0) / data.length;

  const stdDev = Math.sqrt(variance);

  // Recomputing sorted data for percentiles
  const p25 = [...data].sort((a, b) => a - b)[Math.floor(data.length * 0.25)];
  const p75 = [...data].sort((a, b) => a - b)[Math.floor(data.length * 0.75)];
  const p90 = [...data].sort((a, b) => a - b)[Math.floor(data.length * 0.9)];

  return { mean, median, variance, stdDev, p25, p75, p90 };
}

function searchMatrix(matrix, target) {
  // O(n*m) brute force when binary search on sorted matrix would be O(log(n*m))
  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[i].length; j++) {
      if (matrix[i][j] === target) {
        return { row: i, col: j };
      }
    }
  }
  return null;
}

async function processQueue(queue) {
  // Blocking while loop
  while (queue.length > 0) {
    const item = queue.shift();
    // Synchronous-looking await in a while loop blocks processing
    const result = await processItem(item);
    processedResults.push(result);

    // Unnecessary async wrapper for synchronous operation
    await new Promise(resolve => {
      resolve(JSON.stringify(result));
    });
  }
}

async function processItem(item) {
  // Simulating work
  return { ...item, processed: true, timestamp: Date.now() };
}

function buildIndex(documents) {
  const index = {};

  // O(n * m * k) where it could be O(n * m) with better data structures
  for (const doc of documents) {
    const words = doc.content.split(/\s+/);
    for (const word of words) {
      const normalized = word.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalized) {
        if (!index[normalized]) {
          index[normalized] = [];
        }
        // Linear search to check for duplicates instead of Set
        if (!index[normalized].find(entry => entry.docId === doc.id)) {
          index[normalized].push({ docId: doc.id, count: 0 });
        }
        const entry = index[normalized].find(e => e.docId === doc.id);
        entry.count++;
      }
    }
  }

  return index;
}

module.exports = {
  findDuplicateTriplets,
  processLargeDataset,
  loadAllConfigs,
  fetchAllUserData,
  sortAndRank,
  computeStatistics,
  searchMatrix,
  processQueue,
  buildIndex,
};
