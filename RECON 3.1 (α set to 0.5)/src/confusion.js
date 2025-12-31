/**
 * Converts a count matrix to a probability matrix.
 * Each row in the output matrix will sum to 1.
 *
 * @param {number[][]} countMatrix - The input matrix of counts.
 * @returns {number[][]} The probability matrix.
 */
function toProbMatrix(countMatrix) {
  if (!countMatrix || countMatrix.length === 0) {
    return [];
  }

  return countMatrix.map(row => {
    const sum = row.reduce((acc, val) => acc + val, 0);
    if (sum === 0) {
      // Fallback for rows with zero counts: uniform distribution.
      // Alternatively, an identity matrix row could be used if appropriate
      // for the specific use case (e.g., if columns represent the same glyphs as rows).
      // For now, uniform distribution is a general approach.
      const numCols = row.length || 1; // Avoid division by zero if row is empty
      return Array(numCols).fill(1 / numCols);
    }
    return row.map(count => count / sum);
  });
}

export { toProbMatrix }; 