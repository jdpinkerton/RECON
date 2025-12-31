/**
 * @fileoverview Functions for pre-computing Bayesian pair-weights w(x,y).
 */

/**
 * Pre-computes the w(x,y) table for Bayesian weighted similarity.
 * This implements proper Bayesian reasoning to calculate:
 * w(x,y) = P(SameTrue | obs x,y)
 * 
 * Using the likelihood ratio approach:
 * P(SameTrue | obs x,y) = LR(x,y) / (1 + LR(x,y))
 * where LR(x,y) = P(obs x,y | SameTrue) / P(obs x,y | DiffTrue)
 * 
 * P(obs x,y | SameTrue) = Σ_i π(i) * C[i→x] * C[i→y]
 * P(obs x,y | DiffTrue) = [Σ_i π(i) * C[i→x]] * [Σ_j π(j) * C[j→y]] - Σ_k π(k)² * C[k→x] * C[k→y]
 * 
 * This assumes equal prior odds P(SameTrue) = P(DiffTrue) = 0.5
 * 
 * Where:
 * - π(i) is the frequency of true glyph 'i' (glyphFrequencies).
 * - C[i→x] is the probability true glyph 'i' is observed as 'x'.
 * - glyphsList provides the mapping from glyph character to index in probMatrix.
 *
 * @param {number[][]} probMatrix - The probability matrix C. C[true_idx][obs_idx].
 * @param {Map<string, number>} glyphFrequencies - Map of true glyph frequencies (pi).
 * @param {string[]} glyphsList - Ordered list of unique glyphs. The order defines indices for probMatrix and pi.
 * @returns {Map<string, Map<string, number>>} The w(x,y) table. Outer key: obs_x, Inner key: obs_y, Value: w(x,y).
 */
function precomputeWeightTable(probMatrix, glyphFrequencies, glyphsList) {
  const weightTable = new Map();
  const numGlyphs = glyphsList.length;

  if (numGlyphs === 0 || probMatrix.length === 0) {
    return weightTable;
  }

  // Create a direct pi array for faster lookup, ensuring order matches glyphsList
  const pi = glyphsList.map(g => glyphFrequencies.get(g) || 0);

  // Precompute P_obs(obs) = sum_k P(True_k) * P(Obs_obs | True_k) for each observed glyph 'obs'
  const pObs = new Array(numGlyphs).fill(0);
  for (let obsIdx = 0; obsIdx < numGlyphs; obsIdx++) {
    for (let trueIdx = 0; trueIdx < numGlyphs; trueIdx++) {
      if (probMatrix[trueIdx] && probMatrix[trueIdx][obsIdx] !== undefined) {
        pObs[obsIdx] += pi[trueIdx] * probMatrix[trueIdx][obsIdx];
      }
    }
  }

  let debugCount = 0;
  const maxDebugEntries = 5;

  for (let xIdx = 0; xIdx < numGlyphs; xIdx++) {
    const obsX = glyphsList[xIdx];
    const weightsForX = new Map();

    for (let yIdx = 0; yIdx < numGlyphs; yIdx++) {
      const obsY = glyphsList[yIdx];

      // α is currently fixed at 0.5 (equal prior odds). See Appendix II for the generalized form.
      // Calculate P(obs x,y | SameTrue) = Σ_i π(i) * C[i→x] * C[i→y]
      let pObsXY_SameTrue = 0;
      for (let i = 0; i < numGlyphs; i++) {
        const c_ix = probMatrix[i] && probMatrix[i][xIdx] !== undefined ? probMatrix[i][xIdx] : 0;
        const c_iy = probMatrix[i] && probMatrix[i][yIdx] !== undefined ? probMatrix[i][yIdx] : 0;
        pObsXY_SameTrue += pi[i] * c_ix * c_iy;
      }

      // Calculate P(obs x,y | DiffTrue)
      // = P(obs x) * P(obs y) - Σ_k π(k)² * C[k→x] * C[k→y]
      // The subtraction removes the "same true character" cases from the independent assumption
      let pObsXY_DiffTrue = pObs[xIdx] * pObs[yIdx];
      for (let k = 0; k < numGlyphs; k++) {
        const c_kx = probMatrix[k] && probMatrix[k][xIdx] !== undefined ? probMatrix[k][xIdx] : 0;
        const c_ky = probMatrix[k] && probMatrix[k][yIdx] !== undefined ? probMatrix[k][yIdx] : 0;
        pObsXY_DiffTrue -= pi[k] * pi[k] * c_kx * c_ky;
      }

      let weight = 0.5; // Default to 0.5 if we can't determine (equal probability)

      if (pObsXY_SameTrue === 0 && pObsXY_DiffTrue === 0) {
        // Both probabilities are 0 - this character pair is impossible
        weight = 0;
      } else if (pObsXY_DiffTrue <= 0) {
        // If P(obs x,y | DiffTrue) <= 0, then this pair can only come from SameTrue
        weight = 1;
      } else {
        // Normal case: calculate likelihood ratio and convert to probability
        const lr = pObsXY_SameTrue / pObsXY_DiffTrue;
        weight = lr / (1 + lr);
      }

      // Ensure weight is in valid range [0,1]
      weight = Math.max(0, Math.min(1, weight));

      if (window.DEBUG_MODE && debugCount < maxDebugEntries) {
        console.log(`[precomputeWeightTable] w(${obsX},${obsY}) = ${weight.toFixed(4)}`);
        console.log(`  P(x,y|Same): ${pObsXY_SameTrue.toFixed(6)}, P(x,y|Diff): ${pObsXY_DiffTrue.toFixed(6)}`);
        if (pObsXY_DiffTrue > 0) {
          const lr = pObsXY_SameTrue / pObsXY_DiffTrue;
          console.log(`  LR: ${lr.toFixed(4)}`);
        }
        debugCount++;
      }
      
      weightsForX.set(obsY, weight);
    }
    weightTable.set(obsX, weightsForX);
  }

  if (window.DEBUG_MODE) {
    console.log(`[precomputeWeightTable] Computed ${numGlyphs * numGlyphs} weight values using proper Bayesian approach`);
  }

  return weightTable;
}

export { precomputeWeightTable };