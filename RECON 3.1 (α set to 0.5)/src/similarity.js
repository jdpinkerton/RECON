/**
 * @fileoverview Functions for calculating bias-aware similarity metrics.
 */

/**
 * Calculates the baseline-normalised similarity score (S_corr).
 * S_corr = (S_obs - S_baseline) / (1 - S_baseline)
 * Result is clamped to [0, 1].
 *
 * When S_baseline is very high (>0.98), indicating OCR with highly predictable error patterns:
 * - If S_obs >= S_baseline: S_corr = (S_obs - S_baseline) / (1 - S_baseline) [standard formula]
 * - If S_obs < S_baseline: S_corr = 0 (observed similarity is worse than expected by chance)
 *
 * @param {number} sObs - The observed similarity score (must be between 0 and 1).
 * @param {number} sBaseline - The baseline agreement score (must be between 0 and 1).
 * @returns {number} The baseline-normalised similarity score (S_corr), or NaN if inputs are invalid.
 */
function calculateScorr(sObs, sBaseline) {
  if (sObs < 0 || sObs > 1 || sBaseline < 0 || sBaseline > 1) {
    console.error("Error: sObs and sBaseline must be between 0 and 1.");
    return NaN;
  }

  const epsilon = 1e-9;
  const highQualityThreshold = 0.98; // Threshold for OCR with highly predictable error patterns

  // Always log the inputs for diagnosis
  console.log(`[calculateScorr] Input: sObs=${sObs.toFixed(6)}, sBaseline=${sBaseline.toFixed(6)}`);

  // Handle cases where sBaseline is 1 or extremely close to 1
  if (Math.abs(1.0 - sBaseline) < epsilon) {
    console.log(`[calculateScorr] S_baseline is effectively 1.0`);
    if (Math.abs(1.0 - sObs) < epsilon) {
      console.log(`[calculateScorr] Both S_obs and S_baseline are ~1.0, returning 1.0`);
      return 1.0; // Perfect similarity matches perfect baseline
    } else {
      console.log(`[calculateScorr] S_obs < 1.0 but S_baseline ~1.0, returning 0.0`);
      return 0.0; // Observed is worse than perfect baseline
    }
  }

  // Handle high-quality OCR case where S_baseline > 0.98
  if (sBaseline > highQualityThreshold) {
    console.log(`[calculateScorr] OCR with highly predictable error patterns detected (S_baseline > ${highQualityThreshold})`);
    
    if (sObs < sBaseline) {
      // Observed similarity is worse than expected by chance
      console.log(`[calculateScorr] S_obs < S_baseline (${sObs.toFixed(6)} < ${sBaseline.toFixed(6)}), returning 0.0`);
      return 0.0;
    } else {
      // Scale the improvement over baseline relative to the maximum possible improvement
      const improvement = sObs - sBaseline;
      const maxPossibleImprovement = 1.0 - sBaseline;
      const scaledScore = improvement / maxPossibleImprovement;
      
      console.log(`[calculateScorr] Improvement: ${improvement.toFixed(6)}, Max possible: ${maxPossibleImprovement.toFixed(6)}, Scaled: ${scaledScore.toFixed(6)}`);
      
      return Math.max(0, Math.min(1, scaledScore));
    }
  }

  // Standard calculation for lower-quality OCR
  const denominator = 1.0 - sBaseline;
  let sCorr = (sObs - sBaseline) / denominator;

  // Clamp S_corr to [0, 1]
  sCorr = Math.max(0, Math.min(1, sCorr));

  console.log(`[calculateScorr] Standard calculation: (${sObs.toFixed(6)} - ${sBaseline.toFixed(6)}) / ${denominator.toFixed(6)} = ${sCorr.toFixed(6)}`);

  return sCorr;
}

/**
 * Computes the Bayesian weighted similarity score (S_adj).
 * S_adj is the average probability that aligned characters (x_k, y_k) share the same true underlying character.
 * 
 * The weights w(x,y) from the weightTable are calculated using proper Bayesian reasoning:
 * w(x,y) = P(SameTrue | obs x,y)
 * 
 * This directly gives us the probability we want, so S_adj = (1/N) × Σ_k w(x_k, y_k)
 *
 * @param {Array<{char1: string, char2: string}>} alignment - An array of aligned character pairs.
 *                                                       Example: [{char1: 'a', char2: 'a'}, {char1: 'b', char2: 'c'}]
 * @param {Map<string, Map<string, number>>} weightTable - The pre-computed w(x,y) table.
 * @param {string[]} glyphsList - Ordered list of unique glyphs known to the weightTable.
 * @returns {number} The Bayesian weighted similarity score (S_adj), between 0 and 1.
 */
function computeWeightedSimilarity(alignment, weightTable, glyphsList) {
  if (!alignment || alignment.length === 0) {
    return 0; // Or based on convention, e.g., 1 if texts are considered identical by vacuity.
  }

  let sumOfWeights = 0;
  let numPairs = alignment.length;

  for (const pair of alignment) {
    const charX = pair.char1;
    const charY = pair.char2;
    let weight_k = 0;

    const xInTable = weightTable.has(charX);
    
    let w_k = -1; // Sentinel for not found in table

    if (xInTable && weightTable.get(charX).has(charY)) {
        w_k = weightTable.get(charX).get(charY);
    }

    if (w_k !== -1) {
      // w_k is already P(SameTrue | obs x,y), no transformation needed
      weight_k = w_k;
    } else {
      // Fallback: Missing characters handling (not in confusion matrix / weight table)
      // Binary comparison: 1 if equal, 0 if different.
      weight_k = (charX === charY) ? 1 : 0;
    }
    sumOfWeights += weight_k;
  }

  if (numPairs === 0) { // Should be caught by initial check, but defensive
    return 0;
  }

  return sumOfWeights / numPairs;
}

export { calculateScorr, computeWeightedSimilarity };