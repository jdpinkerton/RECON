import { toProbMatrix } from './confusion.js';
import { 
    computeGlyphFrequencies, 
    calculateGlyphReliabilities, // Not directly used by calculateStatistics but part of baseline.js
    calculatePerGlyphBaselineAgreements, 
    calculateOverallBaselineAgreement 
} from './baseline.js';
import { calculateScorr, computeWeightedSimilarity } from './similarity.js';
import { precomputeWeightTable } from './weights.js';

// Expose functions to the main RECON script via a global object
// This allows script.js to call these modularized functions
if (window) {
    window.RECON_BIAS_TOOLS = {
        toProbMatrix,
        computeGlyphFrequencies,
        calculateGlyphReliabilities,
        calculatePerGlyphBaselineAgreements,
        calculateOverallBaselineAgreement,
        calculateScorr,
        precomputeWeightTable,
        computeWeightedSimilarity
    };
}

// Optionally, you could also export them for use in other ES6 modules if needed 