/**
 * @fileoverview Functions for calculating baseline agreement and related glyph statistics.
 */

/**
 * Computes the frequency of each glyph in the combined input texts.
 * Assumes glyphs are single characters.
 *
 * @param {string} text1 - The first input text.
 * @param {string} text2 - The second input text.
 * @returns {Map<string, number>} A map where keys are glyphs and values are their frequencies (normalized).
 */
function computeGlyphFrequencies(text1, text2) {
  const combinedText = text1 + text2;
  if (combinedText.length === 0) {
    return new Map();
  }
  const counts = new Map();
  for (const char of combinedText) {
    counts.set(char, (counts.get(char) || 0) + 1);
  }

  const totalGlyphs = combinedText.length;
  const frequencies = new Map();
  for (const [glyph, count] of counts) {
    frequencies.set(glyph, count / totalGlyphs);
  }
  return frequencies;
}

/**
 * Calculates per-glyph reliability r[i] = C[i][i].
 * Assumes probMatrix C is a 2D array where C[i][j] is P(observed j | true i).
 * Assumes glyphsList is an ordered list of glyphs corresponding to rows/columns of C.
 *
 * @param {number[][]} probMatrix - The probability matrix.
 * @param {string[]} glyphsList - An ordered list of unique glyphs.
 * @returns {Map<string, number>} A map of glyph to its reliability score.
 */
function calculateGlyphReliabilities(probMatrix, glyphsList) {
  const reliabilities = new Map();
  glyphsList.forEach((glyph, index) => {
    if (probMatrix[index] && probMatrix[index][index] !== undefined) {
      reliabilities.set(glyph, probMatrix[index][index]);
    } else {
      // Handle cases where glyph might not be in matrix or matrix is malformed
      reliabilities.set(glyph, 0); // Default to 0 reliability if missing
    }
  });
  return reliabilities;
}

/**
 * Calculates baseline agreement for each glyph g: S_g = sum_k C[g][k]^2.
 * Assumes probMatrix C is a 2D array where C[i][j] is P(observed j | true i).
 * Assumes glyphsList is an ordered list of glyphs corresponding to rows/cols of C.
 *
 * @param {number[][]} probMatrix - The probability matrix.
 * @param {string[]} glyphsList - An ordered list of unique glyphs.
 * @returns {Map<string, number>} A map of glyph to its baseline agreement score S_g.
 */
function calculatePerGlyphBaselineAgreements(probMatrix, glyphsList) {
  const sGlyphMap = new Map();
  
  glyphsList.forEach((glyph, index) => {
    if (probMatrix[index]) {
      const s_g = probMatrix[index].reduce((sumSq, prob) => sumSq + prob * prob, 0);
      sGlyphMap.set(glyph, s_g);
    } else {
      // Handle cases where glyph might not be in matrix or matrix is malformed
      sGlyphMap.set(glyph, 0); // Default to 0 if missing
    }
  });
  
  return sGlyphMap;
}

/**
 * Calculates the overall baseline agreement S_baseline = sum_g f_g * S_g.
 *
 * @param {Map<string, number>} glyphFrequencies - Map of glyph frequencies (f_g).
 * @param {Map<string, number>} perGlyphBaselineAgreements - Map of per-glyph baseline agreements (S_g).
 * @returns {number} The overall baseline agreement score S_baseline.
 */
function calculateOverallBaselineAgreement(glyphFrequencies, perGlyphBaselineAgreements) {
  let sBaseline = 0;
  let totalWeight = 0;
  let debugCount = 0;
  const maxDebugEntries = 10;
  
  console.log('[calculateOverallBaselineAgreement] Starting calculation...');
  
  // Convert to array and sort by contribution to show the most impactful glyphs
  const contributions = [];
  for (const [glyph, freq] of glyphFrequencies) {
    const s_g = perGlyphBaselineAgreements.get(glyph) || 0;
    const contribution = freq * s_g;
    contributions.push({ glyph, freq, s_g, contribution });
    sBaseline += contribution;
    totalWeight += freq;
  }
  
  // Sort by contribution (highest first) for better debugging
  contributions.sort((a, b) => b.contribution - a.contribution);
  
  // Always log the top contributors
  console.log('[calculateOverallBaselineAgreement] Top contributors to S_baseline:');
  contributions.slice(0, 5).forEach(({ glyph, freq, s_g, contribution }) => {
    const displayGlyph = glyph === '\n' ? '\\n' : glyph === ' ' ? 'SPACE' : glyph;
    console.log(`  ${displayGlyph}: freq=${freq.toFixed(4)}, S_g=${s_g.toFixed(4)}, contrib=${contribution.toFixed(6)}`);
  });
  
  console.log(`[calculateOverallBaselineAgreement] Final result: S_baseline=${sBaseline.toFixed(6)}, Total weight=${totalWeight.toFixed(6)}, Num glyphs=${glyphFrequencies.size}`);
  
  return sBaseline;
}

export {
    computeGlyphFrequencies,
    calculateGlyphReliabilities,
    calculatePerGlyphBaselineAgreements,
    calculateOverallBaselineAgreement
};

// Node.js style exports (if needed)
/*
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    computeGlyphFrequencies,
    calculateGlyphReliabilities,
    calculatePerGlyphBaselineAgreements,
    calculateOverallBaselineAgreement
  };
}
*/ 