import { generateDiffs, applyPreprocessing as moduleApplyPreprocessing, tokenizeText as moduleTokenizeText } from './modules/diffEngine.js';
import { 
    CHANGE_TYPES, 
    punctuationRegex, 
    GRANULARITY_TYPES, 
    THEME_TYPES, 
    EXPORT_FORMAT_TYPES, 
    ESCAPE_TYPES,
    NAMED_ENTITY_TYPES,
    POS_PRIORITY_TAGS,
    UNKNOWN_POS_TAG,
    LOGOGRAM_MAP,
    LIGATURE_MAP,
    ARCHAIC_LETTER_MAP,
    UVW_NORMALIZATION_MAP,
    ALL_VARIANT_FORMS
} from './constants.js'; 
import './src/main.js'; // Import for side effects: populates window.RECON_BIAS_TOOLS
import {
    escapeCharacters,
    tokenizeWordsForMetrics,
    isNlpAvailable,
    memoize,
    tallyEntities,
    countCapitalizations,
    countCharacters,
    formatCharacterCounts,
    formatCapitalizationTally,
    formatCharacterCaseChanges,
    countPunctuation,
    formatPunctuationBreakdown,
    formatPOSDistribution,
    formatWordLengthDistribution,
    formatNamedEntities,
    formatTallyObject,
    formatWordFrequency,
    visualizeWhitespace
} from './modules/utility.js';

(() => {
    // Assumptions:
    // - fastest-levenshtein.js, constants.js, and stopwords.js are already included via <script> tags before this file
    // - constants.js defines: punctuationRegex, CHANGE_TYPES, GRANULARITY_TYPES, THEME_TYPES, EXPORT_FORMAT_TYPES, ESCAPE_TYPES, NAMED_ENTITY_TYPES, POS_PRIORITY_TAGS, UNKNOWN_POS_TAG, LOGOGRAM_MAP, LIGATURE_MAP, ARCHAIC_LETTER_MAP, UVW_NORMALIZATION_MAP, ALL_VARIANT_FORMS
    // - stopwords.js defines: stopwords (a Set of stopwords)
    // - diff_match_patch, Diff, and nlp (Compromise.js) are also assumed to be loaded beforehand if POS and NER analysis are desired.

    const DEBUG_MODE = false; // Set to false for production

    // Make DEBUG_MODE globally accessible for ES6 modules
    if (typeof window !== 'undefined') {
        window.DEBUG_MODE = DEBUG_MODE;
    }

    // Define constants for confusion matrix
    const ERROR_ANALYSIS_DELETE_TOKEN = "[DEL]";
    const ERROR_ANALYSIS_INSERT_TOKEN = "[INS]";

    // Initialize diff_match_patch instance
    const dmp = new diff_match_patch();
    Object.assign(dmp, {
        Diff_Timeout: 0,
        Match_Distance: 1000,
        Match_Threshold: 0.1,
        Patch_DeleteThreshold: 0.5,
        Patch_Margin: 4,
        Diff_EditCost: 6
    });

    // --- Normalization Maps (Imported from constants.js) ---

    // --- End Normalization Maps ---

    // Package normalization maps for easier passing
    // Use the imported constants directly
    const normalizationMaps = {
        logogramMap: LOGOGRAM_MAP,
        ligatureMap: LIGATURE_MAP,
        archaicLetterMap: ARCHAIC_LETTER_MAP,
        uvwNormalizationMap: UVW_NORMALIZATION_MAP
    };

    // --- DMP Settings Constants ---
    const SETTINGS_STORAGE_KEY = 'recon_dmp_settings';
    const DEFAULT_DMP_SETTINGS = {
        Diff_Timeout: 0,
        Diff_EditCost: 4, // Default DMP value
        Match_Threshold: 0.5, // Default DMP value
        Match_Distance: 1000, // Default DMP value
        Patch_DeleteThreshold: 0.5, // Default DMP value
        Patch_Margin: 4 // Default DMP value
    };

    // --- Visualization Settings Constants ---
    const VIS_SETTINGS_STORAGE_KEY = 'recon_visualization_settings';
    const DEFAULT_VIS_SETTINGS = {
        theme: THEME_TYPES.SYSTEM, // 'light', 'dark', 'system'
        highContrast: false
    };

    // Utility Functions

    const countUnits = (text, granularity, options) => {
        if (granularity === GRANULARITY_TYPES.CHARACTER) {
            return text.length;
        } else if (granularity === GRANULARITY_TYPES.WORD) {
            // Use moduleTokenizeText and pass normalizationMaps and DEBUG_MODE
            const tokens = moduleTokenizeText(text, granularity, options, normalizationMaps, DEBUG_MODE);
            return tokens.length;
        }
        return text.length; // Review if this default is still appropriate
    };

    const getWordFrequency = (text, options) => {
        // Use moduleTokenizeText and pass normalizationMaps and DEBUG_MODE
        const tokens = moduleTokenizeText(text, GRANULARITY_TYPES.WORD, options, normalizationMaps, DEBUG_MODE);
        return tokens.reduce((freq, token) => {
            const cleanedToken = token.replace(/[^\w\s']+|\s+$/g, '').trim(); // Improved regex
            const normalizedWord = options.includeCapitalization ? cleanedToken : cleanedToken.toLowerCase();
            if (normalizedWord) {
                freq[normalizedWord] = (freq[normalizedWord] || 0) + 1;
            }
            return freq;
        }, {});
    };

    const analyzePOS = memoize((text) => {
        if (!isNlpAvailable()) {
            console.warn('Compromise.js not loaded. POS analysis unavailable.');
            return {};
        }
        try {
            const doc = nlp(text);
            const terms = doc.terms().json();
            const posCounts = {};
            const priorityTags = POS_PRIORITY_TAGS; // Use constant

            priorityTags.forEach(tag => { posCounts[tag] = 0; });
            posCounts[UNKNOWN_POS_TAG] = 0; // Use constant

            terms.forEach(term => {
                const tags = term.terms?.[0]?.tags || [];
                let primaryTag = UNKNOWN_POS_TAG; // Use constant
                for (const t of priorityTags) {
                    if (tags.some(ta => ta.startsWith(t))) {
                        primaryTag = t;
                        break;
                    }
                }
                posCounts[primaryTag] = (posCounts[primaryTag] || 0) + 1;
            });
            return posCounts;
        } catch (error) {
            console.warn('Error in POS analysis:', error);
            return {};
        }
    });

    const analyzeNamedEntities = memoize((text) => {
        if (!isNlpAvailable()) {
            console.warn('Compromise.js not loaded. Named entity analysis unavailable.');
            return {
                [NAMED_ENTITY_TYPES.PEOPLE]: {},
                [NAMED_ENTITY_TYPES.PLACES]: {},
                [NAMED_ENTITY_TYPES.ORGANIZATIONS]: {}
            };
        }
        try {
            const doc = nlp(text);
            const peopleArr = doc.people().out('array');
            const placesArr = doc.places().out('array');
            const orgArr = doc.organizations().out('array');
    
            return {
                [NAMED_ENTITY_TYPES.PEOPLE]: tallyEntities(peopleArr),
                [NAMED_ENTITY_TYPES.PLACES]: tallyEntities(placesArr),
                [NAMED_ENTITY_TYPES.ORGANIZATIONS]: tallyEntities(orgArr)
            };
        } catch (error) {
            console.warn('Error in named entity analysis:', error);
            return {
                [NAMED_ENTITY_TYPES.PEOPLE]: {},
                [NAMED_ENTITY_TYPES.PLACES]: {},
                [NAMED_ENTITY_TYPES.ORGANIZATIONS]: {}
            };
        }
    });

    const calculateCapitalizationChanges = (text1, text2, options) => {
        const wordOptions = { ...options, includePunctuation: false, includeWhitespace: false };
        // Use moduleTokenizeText and pass normalizationMaps and DEBUG_MODE
        const words1 = moduleTokenizeText(text1, GRANULARITY_TYPES.WORD, wordOptions, normalizationMaps, DEBUG_MODE).filter(word => /[A-Z]/.test(word));
        const words2 = moduleTokenizeText(text2, GRANULARITY_TYPES.WORD, wordOptions, normalizationMaps, DEBUG_MODE).filter(word => /[A-Z]/.test(word));

        const freq1 = {};
        words1.forEach(word => { freq1[word] = (freq1[word] || 0) + 1; });
        const freq2 = {};
        words2.forEach(word => { freq2[word] = (freq2[word] || 0) + 1; });

        let removed = 0;
        let added = 0;
        let unchanged = 0;
        const removedCaps = {};
        const addedCaps = {};
        const unchangedCaps = {};

        const allWords = new Set([...Object.keys(freq1), ...Object.keys(freq2)]);

        allWords.forEach(word => {
            const count1 = freq1[word] || 0;
            const count2 = freq2[word] || 0;
            const minCount = Math.min(count1, count2);
            const diff1 = count1 - minCount;
            const diff2 = count2 - minCount;

            if (diff1 > 0) {
                removed += diff1;
                removedCaps[word] = diff1;
            }
            if (diff2 > 0) {
                added += diff2;
                addedCaps[word] = diff2;
            }
            if (minCount > 0) {
                unchanged += minCount;
                unchangedCaps[word] = minCount;
            }
        });

        return { removed, added, unchanged, removedCaps, addedCaps, unchangedCaps };
    };

    const calculateJaccardSimilarity = memoize((text1, text2, options) => {
        // Use moduleTokenizeText and pass normalizationMaps and DEBUG_MODE
        const set1 = new Set(moduleTokenizeText(text1, GRANULARITY_TYPES.WORD, options, normalizationMaps, DEBUG_MODE).map(w => w.toLowerCase()));
        const set2 = new Set(moduleTokenizeText(text2, GRANULARITY_TYPES.WORD, options, normalizationMaps, DEBUG_MODE).map(w => w.toLowerCase()));
        const intersection = new Set([...set1].filter(word => set2.has(word)));
        const union = new Set([...set1, ...set2]);
        const intersectionSize = intersection.size;
        const unionSize = union.size;
        const similarity = (unionSize > 0 ? (intersectionSize / unionSize) : 0) * 100;
        return { similarity, intersectionSize, unionSize };
    });

    const calculateCosineSimilarity = memoize((text1, text2, options) => {
        const freq1 = getWordFrequency(text1, options);
        const freq2 = getWordFrequency(text2, options);
        const allWords = new Set([...Object.keys(freq1), ...Object.keys(freq2)]);
        let dotProduct = 0, magnitude1Sq = 0, magnitude2Sq = 0;
        allWords.forEach(word => {
            const val1 = freq1[word] || 0;
            const val2 = freq2[word] || 0;
            dotProduct += val1 * val2;
            magnitude1Sq += val1 ** 2;
            magnitude2Sq += val2 ** 2;
        });
        const magnitude1 = Math.sqrt(magnitude1Sq);
        const magnitude2 = Math.sqrt(magnitude2Sq);
        const similarity = (magnitude1 && magnitude2 ? (dotProduct / (magnitude1 * magnitude2)) : 0) * 100;
        return { similarity, dotProduct, magnitude1, magnitude2 };
    });

    const calculateTypeTokenRatio = (freqObj, totalWords) => ((Object.keys(freqObj).length / totalWords) * 100).toFixed(2);

    const calculateAverageWordLength = (freqObj) => {
        let totalChars = 0, totalWords = 0;
        Object.entries(freqObj).forEach(([word, count]) => {
            totalChars += word.length * count;
            totalWords += count;
        });
        return totalWords === 0 ? '0.00' : (totalChars / totalWords).toFixed(2);
    };

    const calculateVocabularyOverlap = memoize((freq1, freq2) => {
        const set1 = new Set(Object.keys(freq1));
        const set2 = new Set(Object.keys(freq2));
        const common = new Set([...set1].filter(word => set2.has(word)));
        const averageUnique = (set1.size + set2.size) / 2;
        const overlap = (common.size / averageUnique) * 100;
        return overlap.toFixed(2);
    });

    const calculateLexicalDensity = memoize((posDistribution) => {
        if (!posDistribution) return '0.00';
        const contentTags = ['Noun', 'Verb', 'Adjective', 'Adverb'];
        const contentWords = Object.entries(posDistribution)
            .filter(([tag]) => contentTags.includes(tag))
            .reduce((acc, [_, count]) => acc + count, 0);
        const totalWords = Object.values(posDistribution).reduce((acc, count) => acc + count, 0);
        return totalWords === 0 ? '0.00' : ((contentWords / totalWords) * 100).toFixed(2);
    });

    const calculateStopwordAnalysis = memoize((freqObj, stopwordSet) => {
        let stopwordCount = 0, totalCount = 0;
        Object.entries(freqObj).forEach(([word, count]) => {
            if (stopwordSet.has(word.toLowerCase())) stopwordCount += count;
            totalCount += count;
        });
        return totalCount === 0 ? '0.00' : ((stopwordCount / totalCount) * 100).toFixed(2);
    });

    const calculateWordLengthDistribution = memoize((freqObj) =>
        Object.entries(freqObj).reduce((distribution, [word, count]) => {
            const length = word.length;
            distribution[length] = (distribution[length] || 0) + count;
            return distribution;
        }, {})
    );

    const computeLevenshteinDistance = (diffs, granularity) => {
        if (granularity === GRANULARITY_TYPES.CHARACTER) {
            let text1 = '', text2 = '';
            diffs.forEach(([op, text, insertedText]) => {
                if (op === CHANGE_TYPES.EQ_FINAL) { // Was EQUAL
                    text1 += text;
                    text2 += text;
                } else if (op === CHANGE_TYPES.DEL_CHAR_FINAL) { // Was DELETION
                    text1 += text;
                } else if (op === CHANGE_TYPES.INS_CHAR_FINAL) { // Was INSERTION
                    text2 += text;
                } else if (op === CHANGE_TYPES.SUB_CHAR) { // Was SUBSTITUTION
                    text1 += text;
                    text2 += insertedText;
                }
            });
            const distance = window.FastestLevenshtein.distance(text1, text2);
            return distance;
        } else { // Word granularity - this part of Levenshtein was for a word-based distance, not directly used for CER/NED
            return diffs.reduce((distance, [op, text]) => {
                if (op === CHANGE_TYPES.WORD_DELETION || op === CHANGE_TYPES.WORD_INSERTION) {
                    distance += countUnits(text, granularity, {}); // countUnits for words
                } else if (op === CHANGE_TYPES.WORD_SUBSTITUTION_FULL) {
                    distance += 1; // Each substitution is 1 edit
                }
                return distance;
            }, 0);
        }
    };

    // Helper function to generate character alignment for S_adj calculation
    // This function was identified as missing and is being re-added.
    function generateCharacterAlignment(diffs, granularity) {
        if (granularity !== GRANULARITY_TYPES.CHARACTER) {
            // S_adj is only meaningful for character-level comparisons
            return [];
        }
        const alignment = [];
        if (!diffs) return alignment;

        let equalPairs = 0;
        let diffPairs = 0;
        let insertPairs = 0;
        let deletePairs = 0;

        for (const diff of diffs) {
            const type = diff[0];
            const text1 = diff[1];
            const text2 = diff.length > 2 ? diff[2] : null; // text2 might not exist for pure ins/del

            if (type === CHANGE_TYPES.EQ_FINAL) { // Equivalent
                for (let i = 0; i < text1.length; i++) {
                    alignment.push({ char1: text1[i], char2: text1[i] });
                    equalPairs++;
                }
            } else if (type === CHANGE_TYPES.SUB_CHAR && text1 && text2) { // Substitution
                const len = Math.max(text1.length, text2.length);
                for (let i = 0; i < len; i++) {
                    const char1 = i < text1.length ? text1[i] : ERROR_ANALYSIS_INSERT_TOKEN;
                    const char2 = i < text2.length ? text2[i] : ERROR_ANALYSIS_DELETE_TOKEN;
                    alignment.push({ char1, char2 });
                    if (char1 === char2) {
                        equalPairs++;
                    } else {
                        diffPairs++;
                    }
                }
            } else if (type === CHANGE_TYPES.DEL_CHAR_FINAL && text1) { // Deletion
                 for (let i = 0; i < text1.length; i++) {
                    alignment.push({ char1: text1[i], char2: ERROR_ANALYSIS_DELETE_TOKEN });
                    deletePairs++;
                }
            } else if (type === CHANGE_TYPES.INS_CHAR_FINAL && text1) { // Insertion (text1 is the inserted text here)
                 for (let i = 0; i < text1.length; i++) {
                    alignment.push({ char1: ERROR_ANALYSIS_INSERT_TOKEN, char2: text1[i] });
                    insertPairs++;
                }
            }
            // Note: Word-level operations or other types are ignored for character alignment
        }

        if (DEBUG_MODE) {
            console.log(`[generateCharacterAlignment] Total pairs: ${alignment.length}`);
            console.log(`[generateCharacterAlignment] Equal: ${equalPairs}, Different: ${diffPairs}, Insertions: ${insertPairs}, Deletions: ${deletePairs}`);
            
            // Show some sample pairs for verification
            const sampleSize = Math.min(10, alignment.length);
            console.log(`[generateCharacterAlignment] First ${sampleSize} pairs:`, alignment.slice(0, sampleSize));
            
            // Show any non-equal pairs
            const nonEqualPairs = alignment.filter(pair => pair.char1 !== pair.char2).slice(0, 5);
            if (nonEqualPairs.length > 0) {
                console.log(`[generateCharacterAlignment] Sample non-equal pairs:`, nonEqualPairs);
            }
        }

        return alignment;
    }

    const calculateStatistics = (text1, text2, diffs, granularity, options) => {
        if (DEBUG_MODE) console.log('[calculateStatistics] Called with Text1 (len): ', text1.length, 'Text2 (len):', text2.length, 'Diffs (count):', diffs.length, 'Granularity:', granularity, 'Options:', JSON.stringify(options));

        const processedText1ForStats = moduleApplyPreprocessing(text1, options, normalizationMaps, DEBUG_MODE);
        const processedText2ForStats = moduleApplyPreprocessing(text2, options, normalizationMaps, DEBUG_MODE);
        if (DEBUG_MODE && granularity === GRANULARITY_TYPES.WORD) {
            console.log('[calculateStatistics:Word] Initial text1 for word count:', JSON.stringify(text1));
            console.log('[calculateStatistics:Word] Initial text2 for word count:', JSON.stringify(text2));
        }

        const stats = {};
        if (granularity === GRANULARITY_TYPES.WORD) {
            const wordOptionsNoWhitespace = { ...options, includeWhitespace: false };
            if (DEBUG_MODE) console.log('[calculateStatistics:Word] wordOptionsNoWhitespace for count:', JSON.stringify(wordOptionsNoWhitespace));
            
            const cleanText1ForCount = moduleApplyPreprocessing(text1, wordOptionsNoWhitespace, normalizationMaps, DEBUG_MODE);
            const cleanText2ForCount = moduleApplyPreprocessing(text2, wordOptionsNoWhitespace, normalizationMaps, DEBUG_MODE);
            if (DEBUG_MODE) {
                console.log('[calculateStatistics:Word] cleanText1ForCount (after preprocessing for word count):', JSON.stringify(cleanText1ForCount));
                console.log('[calculateStatistics:Word] cleanText2ForCount (after preprocessing for word count):', JSON.stringify(cleanText2ForCount));
            }

            const tokensText1ForCount = tokenizeWordsForMetrics(cleanText1ForCount);
            const tokensText2ForCount = tokenizeWordsForMetrics(cleanText2ForCount);
            if (DEBUG_MODE) {
                console.log('[calculateStatistics:Word] tokensText1ForCount:', JSON.stringify(tokensText1ForCount));
                console.log('[calculateStatistics:Word] tokensText2ForCount:', JSON.stringify(tokensText2ForCount));
            }

            stats.totalText1 = tokensText1ForCount.length;
            stats.totalText2 = tokensText2ForCount.length;
            if (DEBUG_MODE) console.log('[calculateStatistics:Word] stats.totalText1:', stats.totalText1, 'stats.totalText2:', stats.totalText2);

            stats.insertions = 0;
            stats.deletions = 0;
            stats.substitutions = 0;
            if (DEBUG_MODE) console.log('[calculateStatistics:Word] Initial S/I/D:', stats.substitutions, stats.insertions, stats.deletions);

            diffs.forEach(([type, text, insertedText]) => {
                const tokenForAnalysis = text; 
                const isWhitespaceToken = granularity === GRANULARITY_TYPES.WORD && (tokenForAnalysis === ' ' || tokenForAnalysis === '%%RECON_NEWLINE_TOKEN%%');

                if (DEBUG_MODE) {
                    console.log(`[calculateStatistics:Word Loop] --- Diff Item ---`);
                    console.log(`[calculateStatistics:Word Loop] Type: ${type} (Raw), Token: "${JSON.stringify(tokenForAnalysis)}", InsertedText: "${JSON.stringify(insertedText)}"`);
                    // console.log(`[calculateStatistics:Word Loop] CHANGE_TYPES values: DELETION_OLD=${CHANGE_TYPES.DELETION_OLD}, INSERTION_NEW=${CHANGE_TYPES.INSERTION_NEW}, SUBSTITUTION=${CHANGE_TYPES.SUBSTITUTION}`); // Log the constant values
                    console.log(`[calculateStatistics:Word Loop] CHANGE_TYPES values: WORD_DELETION=${CHANGE_TYPES.WORD_DELETION}, WORD_INSERTION=${CHANGE_TYPES.WORD_INSERTION}, WORD_SUBSTITUTION_FULL=${CHANGE_TYPES.WORD_SUBSTITUTION_FULL}`);
                    console.log(`[calculateStatistics:Word Loop] isWhitespaceToken: ${isWhitespaceToken}`);
                }

                if (type === CHANGE_TYPES.WORD_INSERTION) { 
                    if (!isWhitespaceToken) {
                        stats.insertions++;
                    }
                } else if (type === CHANGE_TYPES.WORD_DELETION) { 
                    if (!isWhitespaceToken) {
                        stats.deletions++;
                    }
                } else if (type === CHANGE_TYPES.WORD_SUBSTITUTION_FULL) { 
                    if (!isWhitespaceToken) {
                        stats.substitutions++;
                    }
                } else {
                    if (DEBUG_MODE) console.log(`[calculateStatistics:Word Loop] Type ${type} did not match S/I/D types (${CHANGE_TYPES.WORD_DELETION},${CHANGE_TYPES.WORD_INSERTION},${CHANGE_TYPES.WORD_SUBSTITUTION_FULL}).`);
                }
                if (DEBUG_MODE) console.log(`[calculateStatistics:Word Loop] Current S/I/D after item: S:${stats.substitutions}, I:${stats.insertions}, D:${stats.deletions}`);
            });

            if (DEBUG_MODE) console.log('[calculateStatistics:Word] Final S/I/D before WER:', stats.substitutions, stats.insertions, stats.deletions);
            stats.WER = (stats.totalText1 > 0 ? ((stats.substitutions + stats.deletions + stats.insertions) / stats.totalText1) : 0) * 100;
            const wordOptions = {
                includeWhitespace: false,
                includePunctuation: options.includePunctuation,
                includeCapitalization: options.includeCapitalization
            };
            const jaccardResult = calculateJaccardSimilarity(text1, text2, wordOptions);
            stats.JaccardSimilarity = jaccardResult.similarity;
            stats.jaccardIntersectionSize = jaccardResult.intersectionSize;
            stats.jaccardUnionSize = jaccardResult.unionSize;
            
            const cosineResult = calculateCosineSimilarity(text1, text2, wordOptions);
            stats.CosineSimilarity = cosineResult.similarity;
            stats.cosineDotProduct = cosineResult.dotProduct;
            stats.cosineMagnitude1 = cosineResult.magnitude1;
            stats.cosineMagnitude2 = cosineResult.magnitude2;

            stats.TTRText1 = calculateTypeTokenRatio(getWordFrequency(text1, wordOptions), stats.totalText1);
            stats.TTRText2 = calculateTypeTokenRatio(getWordFrequency(text2, wordOptions), stats.totalText2);
            stats.vocabularyOverlap = calculateVocabularyOverlap(
                getWordFrequency(text1, wordOptions),
                getWordFrequency(text2, wordOptions)
            );

            stats.posDistributionText1 = analyzePOS(text1);
            stats.posDistributionText2 = analyzePOS(text2);
            stats.namedEntitiesText1 = analyzeNamedEntities(text1);
            stats.namedEntitiesText2 = analyzeNamedEntities(text2);

            stats.lexicalDensityText1 = calculateLexicalDensity(stats.posDistributionText1);
            stats.lexicalDensityText2 = calculateLexicalDensity(stats.posDistributionText2);
            stats.averageWordLengthText1 = calculateAverageWordLength(getWordFrequency(text1, wordOptions));
            stats.averageWordLengthText2 = calculateAverageWordLength(getWordFrequency(text2, wordOptions));

            stats.stopwordAnalysisText1 = calculateStopwordAnalysis(getWordFrequency(text1, wordOptions), stopwords);
            stats.stopwordAnalysisText2 = calculateStopwordAnalysis(getWordFrequency(text2, wordOptions), stopwords);

            stats.wordLengthDistributionText1 = calculateWordLengthDistribution(getWordFrequency(text1, wordOptions));
            stats.wordLengthDistributionText2 = calculateWordLengthDistribution(getWordFrequency(text2, wordOptions));
            stats.wordFrequencyText1 = getWordFrequency(text1, wordOptions);
            stats.wordFrequencyText2 = getWordFrequency(text2, wordOptions);

        } else if (granularity === GRANULARITY_TYPES.CHARACTER) {
            // Use moduleApplyPreprocessing and pass normalizationMaps and DEBUG_MODE
            const processedText1 = moduleApplyPreprocessing(text1, options, normalizationMaps, DEBUG_MODE); // Use original texts for preprocessing
            const processedText2 = moduleApplyPreprocessing(text2, options, normalizationMaps, DEBUG_MODE);

            const totalCharactersText1 = processedText1.length;
            const totalCharactersText2 = processedText2.length;
            const distance = computeLevenshteinDistance(diffs, granularity); // `diffs` here is from generateDiffs on processedText1, processedText2
            const maxLength = Math.max(totalCharactersText1, totalCharactersText2);

            let sObs = 0;
            if (maxLength === 0) {
                sObs = (totalCharactersText1 === 0 && totalCharactersText2 === 0) ? 1 : 0; // Both empty = 100% similar, one empty = 0% similar
            } else {
                sObs = 1 - (distance / maxLength);
            }
            stats.sObsRaw = sObs; // Store the raw 0-1 observed similarity

            // >>> BIAS-AWARE METRICS INTEGRATION POINT <<<
            // The following block operationalizes the Normal Error Profile (NEP) terminology
            // used in the dissertation: we take the loaded confusion matrix (C) to compute
            // S_baseline, S_corr, and S_adj.
            // The condition below checks for character granularity, loaded CM data, and available tools.

            const biasTools = window.RECON_BIAS_TOOLS || {};
            const { 
                toProbMatrix,
                calculateGlyphReliabilities,
                calculatePerGlyphBaselineAgreements,
                calculateOverallBaselineAgreement,
                calculateScorr,
                precomputeWeightTable,
                computeWeightedSimilarity,
                computeGlyphFrequencies // ensure this is also checked from biasTools
            } = biasTools;

            const countMatrix = window.confusionMatrixData || [];
            const glyphsList = window.confusionMatrixGlyphs || [];

            if (DEBUG_MODE) {
                console.log('[calculateStatistics] Checking conditions for Bias-aware metrics.');
                console.log('[calculateStatistics] Granularity is character:', granularity === GRANULARITY_TYPES.CHARACTER);
                console.log('[calculateStatistics] countMatrix available (length > 0):', countMatrix.length > 0);
                console.log('[calculateStatistics] glyphsList available (length > 0):', glyphsList.length > 0);
                console.log('[calculateStatistics] RECON_BIAS_TOOLS and key functions available:');
                console.log('[calculateStatistics]   toProbMatrix:', !!toProbMatrix);
                console.log('[calculateStatistics]   computeGlyphFrequencies:', !!computeGlyphFrequencies);
                console.log('[calculateStatistics]   calculateGlyphReliabilities:', !!calculateGlyphReliabilities);
                console.log('[calculateStatistics]   calculatePerGlyphBaselineAgreements:', !!calculatePerGlyphBaselineAgreements);
                console.log('[calculateStatistics]   calculateOverallBaselineAgreement:', !!calculateOverallBaselineAgreement);
                console.log('[calculateStatistics]   calculateScorr:', !!calculateScorr);
                console.log('[calculateStatistics]   precomputeWeightTable:', !!precomputeWeightTable);
                console.log('[calculateStatistics]   computeWeightedSimilarity:', !!computeWeightedSimilarity);
            }

            if (granularity === GRANULARITY_TYPES.CHARACTER && 
                countMatrix.length > 0 && glyphsList.length > 0 &&
                toProbMatrix && computeGlyphFrequencies && calculateGlyphReliabilities && 
                calculatePerGlyphBaselineAgreements && calculateOverallBaselineAgreement && 
                calculateScorr && precomputeWeightTable && computeWeightedSimilarity) {
                
                try {
                    const probMatrix = toProbMatrix(countMatrix);
                    
                    const glyphReliabilitiesMap = calculateGlyphReliabilities(probMatrix, glyphsList);
                    const glyphErrorRates = new Map();
                    glyphReliabilitiesMap.forEach((reliability, glyph) => {
                        glyphErrorRates.set(glyph, 1 - reliability);
                    });
                    stats.glyphErrorRates = glyphErrorRates;

                    const glyphFrequenciesMap = computeGlyphFrequencies(processedText1, processedText2); 
                    const sGlyphMap = calculatePerGlyphBaselineAgreements(probMatrix, glyphsList);
                    const sBaseline = calculateOverallBaselineAgreement(glyphFrequenciesMap, sGlyphMap);
                    const sCorr = calculateScorr(sObs, sBaseline);
                    const weightTable = precomputeWeightTable(probMatrix, glyphFrequenciesMap, glyphsList);
                    
                    const characterAlignment = generateCharacterAlignment(diffs, granularity); 
                    const sAdj = computeWeightedSimilarity(characterAlignment, weightTable, glyphsList);

                    stats.sBaseline = parseFloat(sBaseline.toFixed(3));
                    stats.sCorr = parseFloat(sCorr.toFixed(3));
                    stats.sAdj = parseFloat(sAdj.toFixed(3));

                } catch (e) {
                    console.error("Error calculating bias-aware metrics:", e);
                    stats.sBaseline = 'Error';
                    stats.sCorr = 'Error';
                    stats.sAdj = 'Error';
                    stats.glyphErrorRates = 'Error';
                }
            }
            // >>> END OF BIAS-AWARE METRICS INTEGRATION <<<

            stats.totalText1 = totalCharactersText1;
            stats.totalText2 = totalCharactersText2;
            stats.distance = distance;
            stats.CER = ((distance / totalCharactersText1) * 100).toFixed(2);
            stats.NED = ((distance / maxLength) * 100).toFixed(2);
            stats.WER = 'N/A';
            stats.capitalizationsText1 = countCapitalizations(text1);
            stats.capitalizationsText2 = countCapitalizations(text2);

            const punctuationCountsText1 = countPunctuation(text1);
            const punctuationCountsText2 = countPunctuation(text2);

            stats.totalPunctuationText1 = punctuationCountsText1.total;
            stats.punctuationBreakdownText1 = punctuationCountsText1.breakdown;
            stats.totalPunctuationText2 = punctuationCountsText2.total;
            stats.punctuationBreakdownText2 = punctuationCountsText2.breakdown;

            stats.characterCountsText1 = countCharacters(text1);
            stats.characterCountsText2 = countCharacters(text2);

            // Old capitalizationChanges metric (word-based, potentially confusing in char mode)
            const oldCapChanges = calculateCapitalizationChanges(text1, text2, options);
            stats.wordLevelCapitalizationChanges = oldCapChanges; // Renamed for clarity

            // New Character Case Changes metric
            let charCaseChanges = {
                toLower: 0, // D -> d
                toUpper: 0, // d -> D
                total: 0,
                toLowerDetails: {}, // e.g. {"D→d": 1}
                toUpperDetails: {}  // e.g. {"d→D": 1}
            };

            if (diffs) { // Ensure diffs is not null or undefined
                diffs.forEach(diff => { 
                    if (diff[0] === CHANGE_TYPES.SUB_CHAR) {
                        const char1 = diff[1];
                        const char2 = diff[2];
                        // Ensure both are single characters before proceeding
                        if (typeof char1 === 'string' && char1.length === 1 && typeof char2 === 'string' && char2.length === 1) {
                            if (char1.toLowerCase() === char2.toLowerCase() && char1 !== char2) {
                                charCaseChanges.total++;
                                const changeDetailKey = `${char1}→${char2}`;
                                
                                const isChar1Upper = char1 === char1.toUpperCase() && char1 !== char1.toLowerCase();
                                const isChar1Lower = char1 === char1.toLowerCase() && char1 !== char1.toUpperCase();
                                const isChar2Upper = char2 === char2.toUpperCase() && char2 !== char2.toLowerCase();
                                const isChar2Lower = char2 === char2.toLowerCase() && char2 !== char2.toUpperCase();

                                if (isChar1Upper && isChar2Lower) {
                                    charCaseChanges.toLower++;
                                    charCaseChanges.toLowerDetails[changeDetailKey] = (charCaseChanges.toLowerDetails[changeDetailKey] || 0) + 1;
                                } else if (isChar1Lower && isChar2Upper) {
                                    charCaseChanges.toUpper++;
                                    charCaseChanges.toUpperDetails[changeDetailKey] = (charCaseChanges.toUpperDetails[changeDetailKey] || 0) + 1;
                                }
                            }
                        }
                    }
                });
            }
            stats.characterCaseChanges = charCaseChanges;
        }

        // Add Variant Analysis Results
        stats.variantAnalysis = calculateVariantAnalysis(text1, text2, options);

        return stats;
    };

    const displayDiffs = (diffsToDisplay, granularity, options) => {
        const visualRepresentation = document.getElementById('visualRepresentation');
        visualRepresentation.innerHTML = '';
        visualRepresentation.setAttribute('data-granularity', granularity);

        // Move createLineElement to the very top so it is always defined before use
        const createLineElement = (text, typeClass, isNewlineMarker = false) => {
            const lineElement = document.createElement('span');
            lineElement.className = 'diff-line';
            const contentSpan = document.createElement('span');
            contentSpan.className = typeClass;
            if (isNewlineMarker) {
                contentSpan.innerHTML = '↵';
            } else {
                contentSpan.textContent = text;
            }
            lineElement.appendChild(contentSpan);
            return lineElement;
        };

        // Wall-of-text mode for character comparison without whitespace
        if (granularity === GRANULARITY_TYPES.CHARACTER && !options.includeWhitespace) {
            const wallLine = document.createElement('div');
            wallLine.className = 'logical-line no-whitespace wall-of-text';
            
            // Process all diffs as a single continuous stream
            diffsToDisplay.forEach(([type, text1, text2]) => {
                switch (type) {
                    case CHANGE_TYPES.EQ_FINAL:
                        wallLine.appendChild(createLineElement(text1, 'unchanged'));
                        break;
                    case CHANGE_TYPES.INS_CHAR_FINAL:
                        wallLine.appendChild(createLineElement(text1, 'insertion'));
                        break;
                    case CHANGE_TYPES.DEL_CHAR_FINAL:
                        wallLine.appendChild(createLineElement(text1, 'deletion'));
                        break;
                    case CHANGE_TYPES.SUB_CHAR:
                        // Create a grouping container for the substitution's characters
                        const subGroupContainer = document.createElement('span');
                        subGroupContainer.className = 'wall-of-text-substitution-group'; // Class for specific styling if needed

                        if (text1) { // Original text characters (deleted)
                            text1.split('').forEach(char => {
                                subGroupContainer.appendChild(createLineElement(char, 'substitution-deleted'));
                            });
                        }
                        if (text2) { // New text characters (inserted)
                            text2.split('').forEach(char => {
                                subGroupContainer.appendChild(createLineElement(char, 'substitution-inserted'));
                            });
                        }
                        wallLine.appendChild(subGroupContainer);
                        break;
                }
            });
            
            visualRepresentation.appendChild(wallLine);
            return;
        } 
        // NEW: Wall-of-text mode for word comparison without whitespace
        else if (granularity === GRANULARITY_TYPES.WORD && !options.includeWhitespace) {
            const wallLine = document.createElement('div');
            // Ensure class matches what CSS expects for word-no-whitespace wall-of-text
            wallLine.className = 'logical-line no-whitespace'; // This should already be styled by existing CSS for word-no-whitespace
            
            diffsToDisplay.forEach(([type, text1, text2]) => {
                // Logic adapted from the problematic block in processFullSegment and the main renderTokenLoop
                switch (type) {
                    case CHANGE_TYPES.EQUAL: // DMP: 0
                        wallLine.appendChild(createLineElement(text1, 'unchanged'));
                        break;
                    case CHANGE_TYPES.WORD_INSERTION: // DMP: 1 (represents +text1 in our custom diffs)
                        wallLine.appendChild(createLineElement(text1, 'insertion'));
                        break;
                    case CHANGE_TYPES.WORD_DELETION: // DMP: -1 (represents -text1 in our custom diffs)
                        wallLine.appendChild(createLineElement(text1, 'deletion'));
                        break;
                    case CHANGE_TYPES.WORD_SUBSTITUTION_FULL: // Custom type 5: [original, new]
                        const subContainerWord = document.createElement('span');
                        subContainerWord.className = 'substitution-container diff-line'; // Standard class for subs
                        if (text1) subContainerWord.appendChild(createLineElement(text1, 'substitution-deleted'));
                        if (text2) subContainerWord.appendChild(createLineElement(text2, 'substitution-inserted'));
                        wallLine.appendChild(subContainerWord);
                        break;
                    // Fallback for any unexpected diff types, or if diffsToDisplay uses raw DMP types directly here
                    default: 
                        if (type === 0) { // dmp.DIFF_EQUAL from raw DMP
                            wallLine.appendChild(createLineElement(text1, 'unchanged'));
                        } else if (type === 1) { // dmp.DIFF_INSERT from raw DMP
                             wallLine.appendChild(createLineElement(text1, 'insertion'));
                        } else if (type === -1) { // dmp.DIFF_DELETE from raw DMP
                             wallLine.appendChild(createLineElement(text1, 'deletion'));
                        } else {
                            // Fallback for safety, prefer explicit handling
                            console.warn(`[displayDiffs:WordNoWhitespace] Unexpected diff type: ${type} for text:`, text1, text2);
                            if(text1) wallLine.appendChild(createLineElement(text1, 'unchanged'));
                            if(text2) wallLine.appendChild(createLineElement(text2, 'unchanged')); // Should ideally not happen with refined diffs
                        }
                        break;
                }
            });
            visualRepresentation.appendChild(wallLine);
            return; 
        }

        // Original display logic for other cases
        let lineNumber = 1;
        let currentLogicalLine = document.createElement('div');
        currentLogicalLine.className = 'logical-line' + (options.includeWhitespace ? '' : ' no-whitespace');
        // Add line number span
        const lineNumberSpan = document.createElement('span');
        lineNumberSpan.className = 'line-number';
        lineNumberSpan.textContent = lineNumber;
        currentLogicalLine.appendChild(lineNumberSpan);
        visualRepresentation.appendChild(currentLogicalLine);

        // Helper to track all logical lines for end-of-line marker
        const logicalLines = [currentLogicalLine];

        try {
            // Helper to create individual diff line elements (<span><span class="type">text</span></span>)
            // REDUNDANT DEFINITION REMOVED - Outer scope definition is used.
            /*
            const createLineElement = (text, typeClass, isNewlineMarker = false) => {
                const lineElement = document.createElement('span');
                lineElement.className = 'diff-line';

                const contentSpan = document.createElement('span');
                contentSpan.className = typeClass;
                
                if (isNewlineMarker) { 
                    contentSpan.innerHTML = '↵'; 
                                } else {
                    contentSpan.textContent = text; 
                }
                lineElement.appendChild(contentSpan);
                return lineElement;
            };
            */

            // Inner function to process a segment (text part or newline) and append to a parent
            const processFullSegment = (segmentText, segmentTypeClass, isChangeType, targetParent, addSpaceAfterWordParts) => {
                // Redundant wall-of-text logic for !options.includeWhitespace removed.
                // That case is handled by dedicated blocks at the start of displayDiffs.

                const isActualNewlineSegment = segmentText === '\n' || segmentText === '\r' || segmentText === '\r\n';
                const isPlaceholderNewlineSegment = granularity === GRANULARITY_TYPES.WORD && segmentText === '%%RECON_NEWLINE_TOKEN%%';

                if (isActualNewlineSegment || isPlaceholderNewlineSegment) {
                    let appendTargetForMarkerOrBr;
                    if (targetParent.classList.contains('substitution-container')) {
                        appendTargetForMarkerOrBr = targetParent;
                    } else {
                        appendTargetForMarkerOrBr = currentLogicalLine;
                    }

                    const getMarkerClass = () => { // Helper to determine marker class
                        if (segmentTypeClass === 'unchanged') return 'unchanged';
                        if (segmentTypeClass === 'insertion' || segmentTypeClass === 'substitution-inserted') return 'insert';
                        if (segmentTypeClass === 'deletion' || segmentTypeClass === 'substitution-deleted') return 'delete';
                        return 'unchanged'; // Fallback
                    };

                    if (isActualNewlineSegment && targetParent.classList.contains('substitution-container')) {
                        // Actual newline INSIDE a substitution container: use <br>
                        const brElement = document.createElement('br');
                        appendTargetForMarkerOrBr.appendChild(brElement);
                        // DO NOT advance currentLogicalLine for main display
                    } else {
                        // EITHER:
                        // 1. Placeholder newline (%%RECON_NEWLINE_TOKEN%%) - always advances currentLogicalLine.
                        // 2. Actual newline NOT inside a substitution container - advances currentLogicalLine.
                        const markerClass = getMarkerClass();
                        if (markerClass) { // Ensure markerClass is valid before creating element
                            const newlineMarkerElement = createLineElement('', `newline-marker ${markerClass}`, true);
                            appendTargetForMarkerOrBr.appendChild(newlineMarkerElement);
                        }
                        currentLogicalLine = document.createElement('div');
                        currentLogicalLine.className = 'logical-line' + (options.includeWhitespace ? '' : ' no-whitespace');
                        // Add line number span
                        lineNumber++;
                        const lineNumberSpan = document.createElement('span');
                        lineNumberSpan.className = 'line-number';
                        lineNumberSpan.textContent = lineNumber;
                        currentLogicalLine.appendChild(lineNumberSpan);
                        visualRepresentation.appendChild(currentLogicalLine);
                        logicalLines.push(currentLogicalLine);
                        return; // Handled this segment
                    }
                    return; // Handled this segment
                }

                // Fallback for segments that are not solely newlines/placeholders but may contain them.
                const parts = segmentText.split(/(\r\n|\r|\n)/g);
                parts.forEach((part, index) => {
                    if (part === '') return;

                    const getMarkerClassForPart = () => { // Helper for parts
                        if (segmentTypeClass === 'unchanged') return 'unchanged';
                        if (segmentTypeClass === 'insertion' || segmentTypeClass === 'substitution-inserted') return 'insert';
                        if (segmentTypeClass === 'deletion' || segmentTypeClass === 'substitution-deleted') return 'delete';
                        return 'unchanged';
                    };

                    // Check for placeholder within parts if granularity is word
                    if (granularity === GRANULARITY_TYPES.WORD && part === '%%RECON_NEWLINE_TOKEN%%') {
                        const markerClass = getMarkerClassForPart();
                        let appendTargetForPlaceholderPart;
                        if (targetParent.classList.contains('substitution-container')) {
                            appendTargetForPlaceholderPart = targetParent;
                        } else {
                            appendTargetForPlaceholderPart = currentLogicalLine;
                        }
                        if (markerClass) { // Ensure markerClass is valid
                            const newlineMarkerElement = createLineElement('', `newline-marker ${markerClass}`, true);
                            appendTargetForPlaceholderPart.appendChild(newlineMarkerElement);
                        }
                        currentLogicalLine = document.createElement('div');
                        currentLogicalLine.className = 'logical-line' + (options.includeWhitespace ? '' : ' no-whitespace');
                        // Add line number span
                        lineNumber++;
                        const lineNumberSpan = document.createElement('span');
                        lineNumberSpan.className = 'line-number';
                        lineNumberSpan.textContent = lineNumber;
                        currentLogicalLine.appendChild(lineNumberSpan);
                        visualRepresentation.appendChild(currentLogicalLine);
                        logicalLines.push(currentLogicalLine);
                        return; // Processed this part (it was a placeholder), continue to next part in forEach
                    }

                    // Existing logic for actual newlines within parts
                    if (part === '\n' || part === '\r' || part === '\r\n') {
                        if (targetParent.classList.contains('substitution-container')) {
                            // Actual newline INSIDE a substitution: use <br>
                            const brElement = document.createElement('br');
                            targetParent.appendChild(brElement);
                            // DO NOT advance currentLogicalLine for this case
                        } else {
                            // Actual newline NOT inside a substitution: use marker and advance currentLogicalLine
                            const markerClass = getMarkerClassForPart();
                            if (markerClass) { // Ensure markerClass is valid
                                const newlineMarkerElement = createLineElement('', `newline-marker ${markerClass}`, true);
                                currentLogicalLine.appendChild(newlineMarkerElement);
                            }
                            currentLogicalLine = document.createElement('div');
                            currentLogicalLine.className = 'logical-line' + (options.includeWhitespace ? '' : ' no-whitespace');
                            // Add line number span
                            lineNumber++;
                            const lineNumberSpan = document.createElement('span');
                            lineNumberSpan.className = 'line-number';
                            lineNumberSpan.textContent = lineNumber;
                            currentLogicalLine.appendChild(lineNumberSpan);
                            visualRepresentation.appendChild(currentLogicalLine);
                            logicalLines.push(currentLogicalLine);
                        }
                    } else { // Text part
                        const visualizedText = visualizeWhitespace(part, isChangeType);
                        const textElement = createLineElement(visualizedText, segmentTypeClass);
                        let appendTargetForText;
                        if (targetParent.classList.contains('substitution-container')) {
                            appendTargetForText = targetParent;
                        } else {
                            appendTargetForText = currentLogicalLine;
                        }
                        appendTargetForText.appendChild(textElement);
                    
                        if (addSpaceAfterWordParts && granularity === GRANULARITY_TYPES.WORD && index < parts.length - 1) {
                            // Only add a space if the NEXT part is not itself a newline/placeholder.
                            if (parts[index+1] && !(parts[index+1] === '\n' || parts[index+1] === '\r' || parts[index+1] === '\r\n' || (granularity === GRANULARITY_TYPES.WORD && parts[index+1] === '%%RECON_NEWLINE_TOKEN%%'))){
                                const spaceElement = createLineElement(' ', 'unchanged'); // Space is neutral
                                appendTargetForText.appendChild(spaceElement);
                            }
                        }
                    }
                });
            };

            diffsToDisplay.forEach(([type, text1, text2]) => {
                if (DEBUG_MODE) console.log('[renderTokenLoop] type:', type, 'text1:', JSON.stringify(text1), text2 ? 'text2:' + JSON.stringify(text2) : '');

                if (granularity === GRANULARITY_TYPES.CHARACTER) {
                    switch (type) {
                        case CHANGE_TYPES.EQ_FINAL:
                            processFullSegment(text1, 'unchanged', false, currentLogicalLine, false);
                            break;
                        case CHANGE_TYPES.INS_CHAR_FINAL:
                            processFullSegment(text1, 'insertion', true, currentLogicalLine, false);
                            break;
                        case CHANGE_TYPES.DEL_CHAR_FINAL:
                            processFullSegment(text1, 'deletion', true, currentLogicalLine, false);
                            break;
                        case CHANGE_TYPES.SUB_CHAR: {
                            // Split both sides on line breaks
                            const lines1 = String(text1).split(/\r\n|\r|\n/g);
                            const lines2 = String(text2).split(/\r\n|\r|\n/g);
                            const maxLines = Math.max(lines1.length, lines2.length);
                            // Pad shorter with empty strings
                            while (lines1.length < maxLines) lines1.push('');
                            while (lines2.length < maxLines) lines2.push('');
                            for (let i = 0; i < maxLines; i++) {
                                // If not the first line, start a new logical line
                                if (i > 0) {
                                    // Add end-of-line marker to previous logical line if it has content
                                    if (currentLogicalLine.childNodes.length > 1) {
                                        const eolMarker = document.createElement('span');
                                        eolMarker.className = 'line-break-marker';
                                        eolMarker.textContent = '↵';
                                        currentLogicalLine.appendChild(eolMarker);
                                    }
                                    currentLogicalLine = document.createElement('div');
                                    currentLogicalLine.className = 'logical-line' + (options.includeWhitespace ? '' : ' no-whitespace');
                                    lineNumber++;
                                    const lineNumberSpan = document.createElement('span');
                                    lineNumberSpan.className = 'line-number';
                                    lineNumberSpan.textContent = lineNumber;
                                    currentLogicalLine.appendChild(lineNumberSpan);
                                    visualRepresentation.appendChild(currentLogicalLine);
                                    logicalLines.push(currentLogicalLine);
                                }
                                const subContainerChar = document.createElement('span');
                                subContainerChar.className = 'substitution-container diff-line';
                                currentLogicalLine.appendChild(subContainerChar);
                                processFullSegment(lines1[i], 'substitution-deleted', true, subContainerChar, false);
                                processFullSegment(lines2[i], 'substitution-inserted', true, subContainerChar, false);
                            }
                            break;
                        }
                        default:
                            if (DEBUG_MODE) console.warn('[displayDiffs-Char] Unknown diff type:', type, text1, text2);
                            processFullSegment(text1, 'unchanged', false, currentLogicalLine, false);
                    }
                } else if (granularity === GRANULARITY_TYPES.WORD) {
                    switch (type) {
                        case CHANGE_TYPES.EQUAL:
                            processFullSegment(text1, 'unchanged', false, currentLogicalLine, true);
                            break;
                        case CHANGE_TYPES.WORD_INSERTION:
                            processFullSegment(text1, 'insertion', true, currentLogicalLine, true);
                            break;
                        case CHANGE_TYPES.WORD_DELETION:
                            processFullSegment(text1, 'deletion', true, currentLogicalLine, true);
                            break;
                        case CHANGE_TYPES.WORD_SUBSTITUTION_FULL: {
                            // Special whitespace handling
                            const isWhitespace1 = /^\s+$/.test(text1);
                            const isWhitespace2 = /^\s+$/.test(text2);
                            if (isWhitespace1 && isWhitespace2) {
                                if (text1.length === text2.length) {
                                    processFullSegment(text1, 'unchanged', false, currentLogicalLine, true);
                                } else if (text1.length < text2.length) {
                                    processFullSegment(text1, 'unchanged', false, currentLogicalLine, true);
                                    processFullSegment(text2.slice(text1.length), 'insertion', true, currentLogicalLine, true);
                                } else {
                                    processFullSegment(text2, 'unchanged', false, currentLogicalLine, true);
                                    processFullSegment(text1.slice(text2.length), 'deletion', true, currentLogicalLine, true);
                                }
                            } else {
                                const subContainerWord = document.createElement('span');
                                subContainerWord.className = 'substitution-container diff-line';
                                currentLogicalLine.appendChild(subContainerWord);
                                processFullSegment(text1, 'substitution-deleted', true, subContainerWord, true);
                                processFullSegment(text2, 'substitution-inserted', true, subContainerWord, false);
                            }
                            break;
                        }
                        default:
                            console.warn('[displayDiffs-Word] Unknown diff type:', type, text1, text2);
                            processFullSegment(text1, 'unchanged', false, currentLogicalLine, true);
                    }
                } else {
                    console.warn('[displayDiffs] Unknown granularity:', granularity);
                    processFullSegment(text1, 'unchanged', false, currentLogicalLine, false); // Fallback
                }
            });

            // After all diffs processed, add end-of-line marker to last logical line if it has content
            if (currentLogicalLine && currentLogicalLine.childNodes.length > 1) {
                const eolMarker = document.createElement('span');
                eolMarker.className = 'line-break-marker';
                eolMarker.textContent = '↵';
                currentLogicalLine.appendChild(eolMarker);
            }
            if (currentLogicalLine && currentLogicalLine.childNodes.length === 1) { // Only line number, no content
                visualRepresentation.removeChild(currentLogicalLine);
            }
            // Remove any logical lines that have only a line number (no content)
            logicalLines.forEach(line => {
                if (line.childNodes.length === 1 && line.querySelector('.line-number')) {
                    if (line.parentNode) line.parentNode.removeChild(line);
                }
            });

        } catch (error) {
            console.error('Error in displayDiffs:', error);
            visualRepresentation.innerHTML = '<p style="color:red;">Error displaying diffs. See console for details.</p>';
        }
    };

    // Updated exportDiffs function
    const exportDiffs = () => {
        const exportFormat = document.querySelector('input[name="exportFormat"]:checked')?.value;
        if (!exportFormat) {
            alert('Please select an export format.');
            return;
        }

        const diffs = window.currentDiffs || [];
        const stats = window.currentStats || {};
        const comparisonSettings = window.currentComparisonSettings || {};

        let content = '';
        let filename = '';

        try {
            if (exportFormat === EXPORT_FORMAT_TYPES.JSON) {
                // Use original texts for standoff JSON generation
                const originalText1 = window.text1 || '';
                const originalText2 = window.text2 || '';
                const dmpCurrentSettings = {
                    Diff_Timeout: dmp.Diff_Timeout,
                    Diff_EditCost: dmp.Diff_EditCost,
                    Match_Threshold: dmp.Match_Threshold,
                    Match_Distance: dmp.Match_Distance,
                    Patch_DeleteThreshold: dmp.Patch_DeleteThreshold,
                    Patch_Margin: dmp.Patch_Margin
                };
                const standoffData = generateStandoffJSON(
                    originalText1, 
                    originalText2, 
                    stats, // Pass current stats
                    comparisonSettings, // Pass current comparison settings (granularity, includes)
                    dmpCurrentSettings // Pass current DMP settings
                );
                content = JSON.stringify(standoffData, null, 2);
                filename = 'recon_standoff.json';
            } else if (exportFormat === EXPORT_FORMAT_TYPES.XML) {
                const granularity = comparisonSettings.granularity || GRANULARITY_TYPES.WORD; // Default to word if undefined
                const options = comparisonSettings.options || {};
                const dmpSettings = { // Ensure dmpSettings are defined for XML export too
                    Diff_Timeout: dmp.Diff_Timeout,
                    Diff_EditCost: dmp.Diff_EditCost,
                    Match_Threshold: dmp.Match_Threshold,
                    Match_Distance: dmp.Match_Distance,
                    Patch_DeleteThreshold: dmp.Patch_DeleteThreshold,
                    Patch_Margin: dmp.Patch_Margin
                };

                let optionParts = [];
                if (options.includeWhitespace) optionParts.push('whitespace');
                if (options.includePunctuation) optionParts.push('punctuation');
                if (options.includeCapitalization) optionParts.push('capitalization');
                if (options.ignoreLogograms) optionParts.push('ignoreLogograms');
                if (options.ignoreLigatures) optionParts.push('ignoreLigatures');
                if (options.ignoreArchaicLetters) optionParts.push('ignoreArchaicLetters');
                if (options.normalizeUvW) optionParts.push('normalizeUvW');

                filename = `${granularity}comparison_criticalapparatus${optionParts.length > 0 ? '_' + optionParts.join('_') : ''}.xml`;

                content = generateTEIXML(diffs, stats, comparisonSettings, dmpSettings);

            } else {
                alert('Unsupported export format.');
                return;
            }

            // ADD THIS CHECK
            if (!content) {
                alert('Error: No content generated for export. Please try again or check console for errors.');
                console.error('[exportDiffs] Content for export is empty or undefined. ExportFormat:', exportFormat);
                return;
            }

            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.warn('Error during export:', error);
            alert('An error occurred while exporting. Please try again.');
        }
    };

    const displayStatistics = (stats, granularity) => {
        if (DEBUG_MODE) console.log('[displayStatistics] Received stats:', JSON.stringify(stats, null, 2));
        if (DEBUG_MODE) console.log('[displayStatistics] Received granularity:', granularity);
        const currentProcessingOptions = window.currentComparisonSettings?.options || {}; // Use a distinct variable name
        if (DEBUG_MODE) console.log('[displayStatistics] Using options for display logic:', JSON.stringify(currentProcessingOptions, null, 2));

        const tbody = document.getElementById('statisticsTable');
        if (!tbody) return;

        tbody.innerHTML = '';

        // Helper functions for deriving coefficients if not directly in stats
        const getPosCountsForDisplay = (posDistribution) => {
            if (!posDistribution || Object.keys(posDistribution).length === 0) return { contentWords: 0, totalWords: 0 };
            const contentTags = ['Noun', 'Verb', 'Adjective', 'Adverb']; // POS_PRIORITY_TAGS might be too broad here
            let contentWords = 0;
            let totalWords = 0;
            Object.entries(posDistribution).forEach(([tag, count]) => {
                if (contentTags.includes(tag)) {
                    contentWords += count;
                }
                totalWords += count;
            });
            return { contentWords, totalWords };
        };

        const getTotalCharsInWordsForDisplay = (wordFreq) => {
            if (!wordFreq || Object.keys(wordFreq).length === 0) return 0;
            let totalChars = 0;
            Object.entries(wordFreq).forEach(([word, count]) => {
                totalChars += word.length * count;
            });
            return totalChars;
        };

        const getStopwordCountsForDisplay = (wordFreq, stopwordSet) => {
            if (!wordFreq || Object.keys(wordFreq).length === 0 || !stopwordSet) return { stopwordCount: 0 }; // totalWords will come from stats.totalText1/2
            let stopwordCount = 0;
            Object.entries(wordFreq).forEach(([word, count]) => {
                if (stopwordSet.has(word.toLowerCase())) {
                    stopwordCount += count;
                }
            });
            return { stopwordCount };
        };

        const formatCoefficient = (value) => (typeof value === 'number' && !isNaN(value)) ? value : 'N/A';

        const metrics = [];

        if (granularity === GRANULARITY_TYPES.CHARACTER) {
            metrics.push(
                {
                    name: 'Total Characters',
                    values: {
                        'Text 1': `${stats.totalText1} <small>(${formatCharacterCounts(stats.characterCountsText1)})</small>`,
                        'Text 2': `${stats.totalText2} <small>(${formatCharacterCounts(stats.characterCountsText2)})</small>`
                    },
                    explanation: `Total number of characters in each text after applying selected preprocessing options. The detailed breakdown shows counts for each character type. Calculated as: Length of processed text. T1: ${formatCoefficient(stats.totalText1)}, T2: ${formatCoefficient(stats.totalText2)}.`
                },
                {
                    name: 'Levenshtein Distance',
                    values: { 'Distance': `${stats.distance}` },
                    explanation: `The Levenshtein distance measures the minimum number of single-character edits (insertions, deletions, or substitutions) required to change one text into the other. Calculated on the processed texts. Formula: Min. Edits (Ins, Del, Sub) for Text1 → Text2. Value: ${formatCoefficient(stats.distance)}.`
                },
                {
                    name: 'Character Error Rate (CER)',
                    values: { 'CER': `${stats.CER}%` },
                    explanation: `Percentage of characters that were incorrectly predicted. Commonly used in evaluating OCR accuracy. Based on processed texts. Formula: (Levenshtein Distance / Total Characters in Text 1) × 100. ${stats.totalText1 === 0 ? '(Total chars T1 is 0)' : `E.g.: (${formatCoefficient(stats.distance)} / ${formatCoefficient(stats.totalText1)}) × 100.`}`
                },
                {
                    name: 'Normalized Edit Distance (NED)',
                    values: { 'NED': `${stats.NED}%` },
                    explanation: `Similar to CER, but normalized by the length of the longer text. Provides a symmetric measure of difference. Based on processed texts. Formula: (Levenshtein Distance / Length of Longer Text) × 100. ${Math.max(stats.totalText1, stats.totalText2) === 0 ? '(Max length is 0)' : `E.g.: (${formatCoefficient(stats.distance)} / ${formatCoefficient(Math.max(stats.totalText1, stats.totalText2))}) × 100.`}`
                },
                {
                    name: 'Capitalization Changes', // Renamed from "Character Case Changes"
                    values: {
                        'Total Case Changes': stats.characterCaseChanges.total,
                        'Uppercase → Lowercase': `${stats.characterCaseChanges.toLower} <button class="details-toggle-button" data-target="to-lower-details" aria-expanded="false" aria-controls="to-lower-details">Details</button><span id="to-lower-details" class="metric-details hidden" role="region"><small>(${formatCharacterCaseChanges(stats.characterCaseChanges.toLowerDetails)})</small></span>`,
                        'Lowercase → Uppercase': `${stats.characterCaseChanges.toUpper} <button class="details-toggle-button" data-target="to-upper-details" aria-expanded="false" aria-controls="to-upper-details">Details</button><span id="to-upper-details" class="metric-details hidden" role="region"><small>(${formatCharacterCaseChanges(stats.characterCaseChanges.toUpperDetails)})</small></span>`
                    },
                    explanation: 'Tracks direct character-level case changes (e.g., D → d, a → A) identified in substitutions. This metric is active if \'Include Capitalization\' is checked. Click Details for specific changes.'
                },
                {
                    name: 'Punctuation Analysis',
                    values: {
                        'Text 1': `${stats.totalPunctuationText1} <small>(${formatPunctuationBreakdown(stats.punctuationBreakdownText1)})</small>`,
                        'Text 2': `${stats.totalPunctuationText2} <small>(${formatPunctuationBreakdown(stats.punctuationBreakdownText2)})</small>`
                    },
                    explanation: 'Total count and breakdown of punctuation marks in each of the original texts.'
                }
            );
        } else if (granularity === GRANULARITY_TYPES.WORD) {
            const uniqueWordsT1 = Object.keys(stats.wordFrequencyText1 || {}).length;
            const uniqueWordsT2 = Object.keys(stats.wordFrequencyText2 || {}).length;

            const posCountsT1 = getPosCountsForDisplay(stats.posDistributionText1);
            const posCountsT2 = getPosCountsForDisplay(stats.posDistributionText2);

            const totalCharsInWordsT1 = getTotalCharsInWordsForDisplay(stats.wordFrequencyText1);
            const totalCharsInWordsT2 = getTotalCharsInWordsForDisplay(stats.wordFrequencyText2);

            const swCountsT1 = getStopwordCountsForDisplay(stats.wordFrequencyText1, stopwords); // 'stopwords' is global
            const swCountsT2 = getStopwordCountsForDisplay(stats.wordFrequencyText2, stopwords);

            let baseWordMetrics = [
                {
                    name: 'Total Words',
                    values: { 'Text 1': stats.totalText1, 'Text 2': stats.totalText2 },
                    explanation: `Total number of words in each text after applying selected preprocessing options (excluding whitespace tokens). Calculated as: Count of tokenized words from processed text. T1: ${formatCoefficient(stats.totalText1)}, T2: ${formatCoefficient(stats.totalText2)}.`
                },
                {
                    name: 'Word Error Rate (WER)',
                    values: { 'WER': `${stats.WER.toFixed(2)}% <small>(S: ${stats.substitutions} | I: ${stats.insertions} | D: ${stats.deletions})</small>` },
                    explanation: `Percentage of words that were incorrectly predicted. Details show raw counts of S:${formatCoefficient(stats.substitutions)}, I:${formatCoefficient(stats.insertions)}, D:${formatCoefficient(stats.deletions)}. Calculated on processed texts after tokenization. Formula: ((S + I + D) / Total Words in Text 1) × 100. ${stats.totalText1 === 0 ? '(Total words T1 is 0)' : `E.g.: ((${formatCoefficient(stats.substitutions)} + ${formatCoefficient(stats.insertions)} + ${formatCoefficient(stats.deletions)}) / ${formatCoefficient(stats.totalText1)}) × 100.`}`
                },
                {
                    name: 'Jaccard Similarity',
                    values: { 'Text 1': `${stats.JaccardSimilarity.toFixed(2)}%` },
                    explanation: `Measures similarity between unique word sets. Ignores word frequency.
Formula: (Intersection Size / Union Size) × 100.
${stats.jaccardUnionSize > 0 ? `E.g.: (${formatCoefficient(stats.jaccardIntersectionSize)} / ${formatCoefficient(stats.jaccardUnionSize)}) × 100.` : '(Union size is 0, cannot show example calculation.)'}
Intersection Size: Number of unique words common to both texts.
Union Size: Total number of unique words in Text 1 + Text 2 combined (duplicates counted once).`
                },
                {
                    name: 'Cosine Similarity',
                    values: { 'Text 1': `${stats.CosineSimilarity.toFixed(2)}%` },
                    explanation: `Measures similarity based on word frequencies (TF). Texts are treated as vectors. Higher values = more similar.
Formula: (Dot Product / (Magnitude1 × Magnitude2)) × 100.
${(stats.cosineMagnitude1 && stats.cosineMagnitude2) ? `E.g.: (${formatCoefficient(stats.cosineDotProduct)} / (${formatCoefficient(stats.cosineMagnitude1)} × ${formatCoefficient(stats.cosineMagnitude2)})) × 100.` : '(Magnitudes are zero or undefined, cannot show example calculation.)'}
Dot Product: Sum of (freq of word W in T1 × freq of word W in T2) for all unique words.
Magnitude: Sqrt of Sum of (freq of word W in Text)² for all unique words in that text.`
                },
                {
                    name: 'Type-Token Ratio (TTR)',
                    values: { 'Text 1': `${stats.TTRText1}%`, 'Text 2': `${stats.TTRText2}%` },
                    explanation: `Measures lexical diversity. A higher TTR suggests a more varied vocabulary. Formula: (Unique Words / Total Words) × 100. Text 1: ${stats.totalText1 === 0 ? '(Total words T1 is 0)' : `(${formatCoefficient(uniqueWordsT1)} / ${formatCoefficient(stats.totalText1)}) × 100`}. Text 2: ${stats.totalText2 === 0 ? '(Total words T2 is 0)' : `(${formatCoefficient(uniqueWordsT2)} / ${formatCoefficient(stats.totalText2)}) × 100`}.`
                },
                {
                    name: 'Vocabulary Overlap',
                    values: { 'Text 1': `${stats.vocabularyOverlap}%` },
                    explanation: 'Percentage of unique words common to both texts, relative to their average unique word count. Formula: (Count of Common Unique Words / ((Count of Unique Words in T1 + Count of Unique Words in T2) / 2)) × 100. Specific counts for common/unique words are not directly displayed here.'
                },
                {
                    name: 'Lexical Density',
                    values: { 'Text 1': `${stats.lexicalDensityText1}%`, 'Text 2': `${stats.lexicalDensityText2}%` },
                    explanation: `Proportion of content words (nouns, verbs, adjectives, adverbs) to total words. Requires POS tagging. Formula: (Content Words / Total Words from POS) × 100. Text 1: ${posCountsT1.totalWords === 0 ? '(Total POS words T1 is 0)' : `(${formatCoefficient(posCountsT1.contentWords)} / ${formatCoefficient(posCountsT1.totalWords)}) × 100`}. Text 2: ${posCountsT2.totalWords === 0 ? '(Total POS words T2 is 0)' : `(${formatCoefficient(posCountsT2.contentWords)} / ${formatCoefficient(posCountsT2.totalWords)}) × 100`}.`
                },
                {
                    name: 'Average Word Length',
                    values: {
                        'Text 1': `${stats.averageWordLengthText1} chars`,
                        'Text 2': `${stats.averageWordLengthText2} chars`
                    },
                    explanation: `Average length of words. Formula: (Total Chars in Words / Total Words). Text 1: ${stats.totalText1 === 0 ? '(Total words T1 is 0)' : `(${formatCoefficient(totalCharsInWordsT1)} / ${formatCoefficient(stats.totalText1)}) chars`}. Text 2: ${stats.totalText2 === 0 ? '(Total words T2 is 0)' : `(${formatCoefficient(totalCharsInWordsT2)} / ${formatCoefficient(stats.totalText2)}) chars`}.`
                },
                {
                    name: 'Stopword Analysis',
                    values: {
                        'Text 1': `${stats.stopwordAnalysisText1}%`,
                        'Text 2': `${stats.stopwordAnalysisText2}%`
                    },
                    explanation: `Percentage of common stopwords. Formula: (Stopwords / Total Words) × 100. Text 1: ${stats.totalText1 === 0 ? '(Total words T1 is 0)' : `(${formatCoefficient(swCountsT1.stopwordCount)} / ${formatCoefficient(stats.totalText1)}) × 100`}. Text 2: ${stats.totalText2 === 0 ? '(Total words T2 is 0)' : `(${formatCoefficient(swCountsT2.stopwordCount)} / ${formatCoefficient(stats.totalText2)}) × 100`}.`
                },
                {
                    name: 'Word Length Distribution',
                    values: {
                        'Text 1': `<small>${formatWordLengthDistribution(stats.wordLengthDistributionText1)}</small>`,
                        'Text 2': `<small>${formatWordLengthDistribution(stats.wordLengthDistributionText2)}</small>`
                    },
                    explanation: 'Frequency distribution of words of different lengths in each text, based on processed texts.'
                },
                {
                    name: 'Part of Speech Distribution',
                    values: {
                        'Text 1': `<small>${formatPOSDistribution(stats.posDistributionText1)}</small>`,
                        'Text 2': `<small>${formatPOSDistribution(stats.posDistributionText2)}</small>`
                    },
                    explanation: 'Distribution of different parts of speech (e.g., nouns, verbs, adjectives) in each text. Requires POS tagging.'
                },
                {
                    name: 'Named Entities',
                    values: (() => { // Use IIFE to structure the value generation
                        const getCount = (entityObj) => Object.values(entityObj || {}).reduce((a, b) => a + b, 0);
                        const summaryT1 = `P: ${getCount(stats.namedEntitiesText1?.people)} | Pl: ${getCount(stats.namedEntitiesText1?.places)} | O: ${getCount(stats.namedEntitiesText1?.organizations)}`;
                        const summaryT2 = `P: ${getCount(stats.namedEntitiesText2?.people)} | Pl: ${getCount(stats.namedEntitiesText2?.places)} | O: ${getCount(stats.namedEntitiesText2?.organizations)}`;
                        const detailsT1 = formatNamedEntities(stats.namedEntitiesText1);
                        const detailsT2 = formatNamedEntities(stats.namedEntitiesText2);
                        
                        return {
                            'Text 1': `${summaryT1} <button class="details-toggle-button" data-target="ne-t1-details" aria-expanded="false" aria-controls="ne-t1-details">Details</button><span id="ne-t1-details" class="metric-details hidden" role="region"><small>${detailsT1}</small></span>`,
                            'Text 2': `${summaryT2} <button class="details-toggle-button" data-target="ne-t2-details" aria-expanded="false" aria-controls="ne-t2-details">Details</button><span id="ne-t2-details" class="metric-details hidden" role="region"><small>${detailsT2}</small></span>`
                        };
                    })(),
                    explanation: 'Identified named entities (People, Places, Organizations) in each text. Shows total counts first; click Details for specific entities and their frequencies. Requires NER.'
                },
                {
                    name: 'Top 10 Words',
                    values: {
                        'Text 1': `<small>${formatWordFrequency(stats.wordFrequencyText1)}</small>`,
                        'Text 2': `<small>${formatWordFrequency(stats.wordFrequencyText2)}</small>`
                    },
                    explanation: 'Lists the ten most frequent words in each text along with their counts, from processed texts.'
                }
            ];
            metrics.push(...baseWordMetrics);
        }

        // --- Helper to Filter Tallies for Display ---
        const filterTally = (tally, keysToInclude) => {
            if (!tally) return {};
            return Object.fromEntries(
                Object.entries(tally).filter(([key]) => keysToInclude.has(key))
            );
        };
        // Modified filterChangeTally to directly check for monodirectional keys
        const filterChangeTally = (tally, monodirectionalKeysToInclude) => {
             if (!tally) return {};
             return Object.fromEntries(
                Object.entries(tally).filter(([key]) => monodirectionalKeysToInclude.has(key))
            );
        };

        // --- Add Variant Analysis Metrics (Grouped) ---
        if (stats && stats.variantAnalysis && stats.variantAnalysis.totalChanges) { // Add checks for stats and its properties
            const va = stats.variantAnalysis;

            // Ligature Analysis
            const ligatureChangeKeys = new Set();
            Object.keys(LIGATURE_MAP).forEach(form => {
                ligatureChangeKeys.add(`${form}→${LIGATURE_MAP[form]}`);
                ligatureChangeKeys.add(`${LIGATURE_MAP[form]}→${form}`);
            });
            const ligatureT1 = filterTally(va.text1Tallies, new Set(Object.keys(LIGATURE_MAP)));
            const ligatureT2 = filterTally(va.text2Tallies, new Set(Object.keys(LIGATURE_MAP)));
            const ligatureChanges = filterChangeTally(va.changeTallies, ligatureChangeKeys);
            metrics.push({
                name: 'Ligature Analysis',
                    values: {
                    'Text 1': `${Object.values(ligatureT1).reduce((a, b) => a + b, 0)} <small>(${formatTallyObject(ligatureT1)})</small>`,
                    'Text 2': `${Object.values(ligatureT2).reduce((a, b) => a + b, 0)} <small>(${formatTallyObject(ligatureT2)})</small>`,
                    'Changes': `${va.totalChanges.ligatures} <small>(${formatTallyObject(ligatureChanges)})</small>`
                },
                explanation: 'Analysis of ligature forms (e.g., æ, ﬁ) and their expansions (ae, fi).'
            });

            // Logogram Analysis
            const logogramChangeKeys = new Set();
            Object.keys(LOGOGRAM_MAP).forEach(form => {
                logogramChangeKeys.add(`${form}→${LOGOGRAM_MAP[form]}`);
                logogramChangeKeys.add(`${LOGOGRAM_MAP[form]}→${form}`);
            });
            const logogramT1 = filterTally(va.text1Tallies, new Set(Object.keys(LOGOGRAM_MAP)));
            const logogramT2 = filterTally(va.text2Tallies, new Set(Object.keys(LOGOGRAM_MAP)));
            const logogramChanges = filterChangeTally(va.changeTallies, logogramChangeKeys);
             metrics.push({
                name: 'Logogram Analysis',
                values: {
                    'Text 1': `${Object.values(logogramT1).reduce((a, b) => a + b, 0)} <small>(${formatTallyObject(logogramT1)})</small>`,
                    'Text 2': `${Object.values(logogramT2).reduce((a, b) => a + b, 0)} <small>(${formatTallyObject(logogramT2)})</small>`,
                    'Changes': `${va.totalChanges.logograms} <small>(${formatTallyObject(logogramChanges)})</small>`
                },
                explanation: 'Analysis of logograms (e.g., &) and their expansions (and).'
            });

            // Archaic Letter Analysis
            const archaicChangeKeys = new Set();
            Object.keys(ARCHAIC_LETTER_MAP).forEach(form => {
                archaicChangeKeys.add(`${form}→${ARCHAIC_LETTER_MAP[form]}`);
                archaicChangeKeys.add(`${ARCHAIC_LETTER_MAP[form]}→${form}`);
            });
            const archaicT1 = filterTally(va.text1Tallies, new Set(Object.keys(ARCHAIC_LETTER_MAP)));
            const archaicT2 = filterTally(va.text2Tallies, new Set(Object.keys(ARCHAIC_LETTER_MAP)));
            const archaicChanges = filterChangeTally(va.changeTallies, archaicChangeKeys);
            metrics.push({
                name: 'Archaic Letter Analysis',
                values: {
                    'Text 1': `${Object.values(archaicT1).reduce((a, b) => a + b, 0)} <small>(${formatTallyObject(archaicT1)})</small>`,
                    'Text 2': `${Object.values(archaicT2).reduce((a, b) => a + b, 0)} <small>(${formatTallyObject(archaicT2)})</small>`,
                    'Changes': `${va.totalChanges.archaic} <small>(${formatTallyObject(archaicChanges)})</small>`
                },
                explanation: 'Analysis of archaic letters (e.g., ſ, ꝛ) and their modern forms (s, r).'
            });

            // U/V Analysis (New)
            if (currentProcessingOptions.ignoreUV && va.totalChanges.uvSwaps > 0) {
                const uvChangeKeys = new Set(['u→v', 'v→u']);
                const uvChanges = filterChangeTally(va.changeTallies, uvChangeKeys);
                metrics.push({
                    name: 'U/V Variation Analysis',
                    values: {
                        'Changes': `${va.totalChanges.uvSwaps} <small>(${formatTallyObject(uvChanges)})</small>`
                    },
                    explanation: 'Analysis of u↔v substitutions (when ignored).'
                });
            }

            // I/J Analysis (New)
            if (currentProcessingOptions.ignoreIJ && va.totalChanges.ijSwaps > 0) {
                const ijChangeKeys = new Set(['i→j', 'j→i']);
                const ijChanges = filterChangeTally(va.changeTallies, ijChangeKeys);
                metrics.push({
                    name: 'I/J Variation Analysis',
                    values: {
                        'Changes': `${va.totalChanges.ijSwaps} <small>(${formatTallyObject(ijChanges)})</small>`
                    },
                    explanation: 'Analysis of i↔j substitutions (when ignored).'
                });
            }

            // UU/VV to W Analysis (New)
            if (currentProcessingOptions.normalizeUvW && va.totalChanges.uvwChanges > 0) {
                const uvwChangeKeys = new Set();
                Object.entries(UVW_NORMALIZATION_MAP).forEach(([form, expansion]) => {
                    // Add form -> expansion if it exists in tallies
                    if (va.changeTallies[`${form}→${expansion}`]) {
                        uvwChangeKeys.add(`${form}→${expansion}`);
                    }
                    // Add expansion -> form (reverse) if it exists in tallies
                    if (va.changeTallies[`${expansion}→${form}`]) {
                        uvwChangeKeys.add(`${expansion}→${form}`);
                    }
                });
                // The explicit checks for 'w→uu', 'w→UU', etc. are now covered by the loop above,
                // as long as va.changeTallies correctly contains these keys from calculateVariantAnalysis.

                const uvwChanges = filterChangeTally(va.changeTallies, uvwChangeKeys);
                metrics.push({
                    name: 'UU/VV ↔ W Analysis',
                    values: {
                        'Changes': `${va.totalChanges.uvwChanges} <small>(${formatTallyObject(uvwChanges)})</small>`
                    },
                    explanation: 'Analysis of uu/vv ↔ w normalizations (when enabled).'
                });
            }
        } else {
            console.warn('[displayStatistics] Variant analysis data is missing or incomplete. Skipping variant metrics display.');
        }

        // --- Add Bias-Aware Metrics if available and character granularity ---
        if (granularity === GRANULARITY_TYPES.CHARACTER && 
            typeof stats.sObsRaw === 'number' && // Make sure sObsRaw is a number for comparison
            stats.sBaseline !== undefined && stats.sBaseline !== 'N/A' && stats.sBaseline !== 'Error' &&
            stats.sCorr !== undefined && stats.sCorr !== 'N/A' && stats.sCorr !== 'Error' &&
            stats.sAdj !== undefined && stats.sAdj !== 'N/A' && stats.sAdj !== 'Error') {

            let inflationDeflationFlag = '';
            const sObsForComparison = parseFloat(stats.sObsRaw.toFixed(3)); // Use the sObs from stats
            const sCorrForComparison = parseFloat(stats.sCorr.toFixed(3));
            const sBaselineForComparison = parseFloat(stats.sBaseline.toFixed(3));

            if (sBaselineForComparison > 0 && sBaselineForComparison < 1) { // Only meaningful if sBaseline is not 0 or 1
                if (sCorrForComparison < sObsForComparison) {
                    inflationDeflationFlag = '<span class="bias-flag inflated">Inflated</span>';
                } else if (sCorrForComparison > sObsForComparison) {
                    inflationDeflationFlag = '<span class="bias-flag deflated">Deflated</span>';
                }
            }

            metrics.push(
                {
                    name: 'Observed Similarity (S<sub>obs</sub>)',
                    values: { 'S<sub>obs</sub>': `${sObsForComparison.toFixed(3)}` },
                    explanation: `The raw similarity score based on Levenshtein distance, without accounting for OCR error patterns. This is the standard similarity measure that may be artificially inflated/deflated by systematic OCR errors. Formula: 1 - (Levenshtein Distance / Max Length). Compare with S_corr and S_adj to understand OCR bias impact. Value: ${sObsForComparison.toFixed(3)}`
                },
                {
                    name: 'Baseline Agreement (S<sub>base</sub>)',
                    values: { 'S<sub>base</sub>': `${sBaselineForComparison.toFixed(3)}` },
                    explanation: `Expected similarity from OCR bias alone. Represents the similarity score expected if the same OCR system processed two completely different underlying texts, weighted by character frequencies. Formula: S_baseline = Σ_g f_g × S_g, where S_g = Σ_k C[g][k]² (probability that two OCR runs agree on character g). Values >0.98 indicate very poor OCR quality where bias correction becomes critical. Value: ${sBaselineForComparison.toFixed(3)}`
                },
                {
                    name: 'Corrected Similarity (S<sub>corr</sub>)',
                    values: { 'S<sub>corr</sub>': `${sCorrForComparison.toFixed(3)} ${inflationDeflationFlag}` },
                    explanation: `Baseline-normalized similarity that adjusts observed similarity by removing OCR bias. Formula: (S_obs - S_baseline) / (1 - S_baseline). Interpretation: 0 = no better than random OCR bias (texts likely unrelated), 1 = perfect similarity beyond OCR bias (texts likely identical), <0 = observed similarity worse than expected by chance. Flag indicates if S_obs appears inflated/deflated by OCR bias. Value: ${sCorrForComparison.toFixed(3)}`
                },
                {
                    name: 'Adjusted Similarity (S<sub>adj</sub>)',
                    values: { 'S<sub>adj</sub>': `${stats.sAdj.toFixed(3)}` }, // sAdj is already toFixed(3) from calculateStatistics
                    explanation: `Bayesian weighted similarity using probability-based character matching. For each character pair (x,y), calculates the probability that they represent the same true underlying character using likelihood ratios and the confusion matrix. Formula: S_adj = (1/N) × Σ_k w(x_k, y_k), where w(x,y) = P(SameTrue | obs x,y). Provides more nuanced results than binary character matching, especially valuable for poor-quality OCR. Value: ${stats.sAdj.toFixed(3)}`
                }
            );

            // Add Per-Glyph Error Rates if available
            if (stats.glyphErrorRates && stats.glyphErrorRates instanceof Map && stats.glyphErrorRates.size > 0) {
                const errorRatesArray = Array.from(stats.glyphErrorRates.entries());
                errorRatesArray.sort((a, b) => b[1] - a[1]); // Sort by error rate descending
                
                const errorRatesString = errorRatesArray.map(([glyph, errorRate]) => {
                    // Handle special HTML characters in glyphs if necessary, e.g., newline, space
                    let displayGlyph = escapeCharacters(glyph, ESCAPE_TYPES.HTML); 
                    if (glyph === '\n') displayGlyph = '\\n (newline)';
                    else if (glyph === ' ') displayGlyph = '&nbsp; (space)';
                    else if (glyph === '\t') displayGlyph = '\\t (tab)';
                    // Add more explicit representations if needed

                    return `'${displayGlyph}': ${(errorRate * 100).toFixed(1)}%`; // MODIFIED: Removed "Glyph "
                }).join(' | ');

                metrics.push({
                    name: 'Per-Glyph Error Rates',
                    values: { 'Rates': errorRatesString },
                    explanation: 'Estimated error rate for each glyph, derived from the confusion matrix (1 - P(observed_glyph | true_glyph)). Sorted by highest error rate. Indicates which characters are most likely to be misread by the OCR.'
                });
            } else if (stats.glyphErrorRates === 'Error') {
                metrics.push({
                    name: 'Per-Glyph Error Rates',
                    values: { 'Rates': 'Error calculating' },
                    explanation: 'An error occurred while calculating per-glyph error rates.'
                });
            } else if (stats.glyphErrorRates === 'N/A') {
                 metrics.push({
                    name: 'Per-Glyph Error Rates',
                    values: { 'Rates': 'N/A (CM data/tools missing)' },
                    explanation: 'Per-glyph error rates could not be calculated because confusion matrix data or necessary tool functions were missing.'
                });
            }
        }
        // --- End of Bias-Aware Metrics ---

        const fragment = document.createDocumentFragment();
        metrics.forEach(metric => {
            const row = document.createElement('tr');

            const nameCell = document.createElement('th');
            nameCell.scope = 'row';
            // Add title attribute directly to the cell for mouseover, remove the icon span
            if (metric.explanation) {
                nameCell.title = metric.explanation; // Set title attribute directly
            }
            nameCell.innerHTML = metric.name; // Just the name now
            row.appendChild(nameCell);

            const valueCell = document.createElement('td');
            const hasMultipleValues = typeof metric.values === 'object' && Object.keys(metric.values).length > 1;
            valueCell.innerHTML = hasMultipleValues
                ? Object.entries(metric.values)
                    .map(([label, value]) => `<strong>${label}:</strong> ${value}`)
                    .join('<br>')
                : Object.values(metric.values)[0] || 'N/A';
            row.appendChild(valueCell);

            fragment.appendChild(row);
        });

        tbody.appendChild(fragment);

        // Event listeners for details toggle buttons within statistics
        tbody.querySelectorAll('.details-toggle-button').forEach(button => {
            button.addEventListener('click', () => {
                const targetId = button.dataset.target;
                const detailsSpan = document.getElementById(targetId);
                if (detailsSpan) {
                    const isHidden = detailsSpan.classList.toggle('hidden');
                    button.textContent = isHidden ? 'Details' : 'Hide';
                    button.setAttribute('aria-expanded', isHidden ? 'false' : 'true');
                }
            });
        });

        tbody.parentElement.style.tableLayout = 'fixed';
    };

    const displayResults = (diffsToDisplay, statsToDisplay, granularity, options) => {
        console.log('[displayResults] Function called'); // DEBUG: Check if function is called
        if (DEBUG_MODE) console.log('[displayResults] Using pre-calculated diffs:', JSON.stringify(diffsToDisplay));
        if (DEBUG_MODE) console.log('[displayResults] Using pre-calculated stats:', JSON.stringify(statsToDisplay));
        if (DEBUG_MODE) console.log('[displayResults] Using granularity:', granularity);
        if (DEBUG_MODE) console.log('[displayResults] Using options:', JSON.stringify(options));

        displayDiffs(diffsToDisplay, granularity, options);
        displayStatistics(statsToDisplay, granularity);

        const toggleButton = document.getElementById('toggleApparatusHeight');
        console.log('[displayResults] toggleButton element (before class change):', toggleButton);
        if (toggleButton) {
            toggleButton.classList.remove('hidden'); // Make it visible by removing the .hidden class
            toggleButton.style.display = 'block';    // Explicitly set display to block as a fallback/ensure
            console.log('[displayResults] toggleButton classList after remove hidden:', toggleButton.classList);
            console.log('[displayResults] toggleButton.style.display set to block');
            // Reset to default collapsed state on new comparison
            const apparatusDiv = document.getElementById('visualRepresentation');
            if(apparatusDiv && apparatusDiv.classList.contains('expanded-apparatus')) {
                apparatusDiv.classList.remove('expanded-apparatus');
                toggleButton.textContent = 'Expand Apparatus';
                toggleButton.setAttribute('aria-expanded', 'false');
            }
        }
    };

    const updateFooterLastModified = () => {
        const lastModifiedElement = document.getElementById('lastModifiedDate');
        if (lastModifiedElement) {
            const lastModifiedDate = new Date(document.lastModified);
            lastModifiedElement.textContent = lastModifiedDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        }
    };

    // --- Event Handler Functions (Place this block before initializeEventListeners) ---

    const toggleVizMenuHandler = (event) => {
        // Critical: Re-fetch elements inside the handler if they might not exist when this function is defined
        // or ensure initializeEventListeners only runs after these elements are for sure in the DOM.
        // For safety, let's re-fetch, though in a DOMContentLoaded scenario, they should exist.
        const vizSettingsButton = document.getElementById('visualizationSettingsButton');
        const vizMenu = document.getElementById('visualizationMenu');
        if (vizMenu && vizSettingsButton) {
            event.stopPropagation(); // Prevent click from immediately closing menu via document listener
            const isExpanded = vizMenu.classList.toggle('hidden');
            vizSettingsButton.setAttribute('aria-expanded', !isExpanded);
        }
    };

    const updateThemePreferenceHandler = (newTheme) => {
        // Similar to above, re-fetch or ensure availability
        const vizSettingsButton = document.getElementById('visualizationSettingsButton');
        const vizMenu = document.getElementById('visualizationMenu');
        
        applyTheme(newTheme); // Assumes applyTheme is defined in the IIFE scope
        const currentSettings = JSON.parse(localStorage.getItem(VIS_SETTINGS_STORAGE_KEY) || JSON.stringify(DEFAULT_VIS_SETTINGS));
        currentSettings.theme = newTheme;
        saveVisualizationSettings(currentSettings); // Assumes saveVisualizationSettings is defined
        loadVisualizationSettings(); // Reload to attach/detach system listener correctly
        if (vizMenu) vizMenu.classList.add('hidden'); // Close menu
        if (vizSettingsButton) vizSettingsButton.setAttribute('aria-expanded', 'false');
    };

    const themeLightClickHandler = () => updateThemePreferenceHandler(THEME_TYPES.LIGHT);
    const themeDarkClickHandler = () => updateThemePreferenceHandler(THEME_TYPES.DARK);
    const themeSystemClickHandler = () => updateThemePreferenceHandler(THEME_TYPES.SYSTEM);

    const highContrastChangeHandler = () => {
        const highContrastToggleMenu = document.getElementById('highContrastToggleMenu');
        const highContrastLabel = document.getElementById('highContrastToggleMenuLabel');

        if (highContrastToggleMenu) {
            const isChecked = highContrastToggleMenu.checked;
            applyHighContrast(isChecked); // Assumes applyHighContrast is defined
            if (highContrastLabel) highContrastLabel.setAttribute('aria-checked', isChecked.toString());
            const currentSettings = JSON.parse(localStorage.getItem(VIS_SETTINGS_STORAGE_KEY) || JSON.stringify(DEFAULT_VIS_SETTINGS));
            currentSettings.highContrast = isChecked;
            saveVisualizationSettings(currentSettings); // Assumes saveVisualizationSettings is defined
        }
    };

    // Named handler for document click, to allow removeEventListener
    const documentClickHandlerForVizMenu = (event) => {
        const vizSettingsButton = document.getElementById('visualizationSettingsButton');
        const vizMenu = document.getElementById('visualizationMenu');
        if (vizMenu && !vizMenu.classList.contains('hidden') &&
            vizSettingsButton && !vizSettingsButton.contains(event.target) &&
            !vizMenu.contains(event.target)) {
            vizMenu.classList.add('hidden');
            vizSettingsButton.setAttribute('aria-expanded', 'false');
        }
    };

    const toggleApparatusHandler = () => {
        const toggleApparatusButton = document.getElementById('toggleApparatusHeight'); // Get button inside handler
        const apparatusDiv = document.getElementById('visualRepresentation');
        if (apparatusDiv && toggleApparatusButton) { // Check toggleApparatusButton existence
            apparatusDiv.classList.toggle('expanded-apparatus');
            const isExpanded = apparatusDiv.classList.contains('expanded-apparatus');
            toggleApparatusButton.textContent = isExpanded ? 'Collapse Apparatus' : 'Expand Apparatus';
            toggleApparatusButton.setAttribute('aria-expanded', isExpanded.toString());
        }
    };

    const handleLoadConfusionMatrix = () => {
        // Re-fetch elements here or ensure they are in scope

        const matrixText = document.getElementById('confusionMatrixDataText').value;
        const glyphsText = document.getElementById('confusionMatrixGlyphsText').value;
        let matrix, glyphs;

        try {
            matrix = JSON.parse(matrixText);
        } catch (e) {
            alert('Invalid matrix data in textarea. Please check JSON format.');
            console.error("Error parsing matrix data:", e);
            return;
        }

        try {
            glyphs = JSON.parse(glyphsText);
            if (!Array.isArray(glyphs) || !glyphs.every(g => typeof g === 'string')) {
                throw new Error('Glyphs list must be a JSON array of strings.');
            }
        } catch (e) {
            alert('Invalid glyphs list in textarea. Must be a JSON array of strings (e.g., ["a","b"," ","\\n"]).\\n' + e.message);
            console.error("Error parsing glyphs list:", e);
            return;
        }

        // Basic validation (copied from your existing internal handler)
        if (!Array.isArray(matrix)) {
            alert('Matrix data must be an array of arrays.');
            return;
        }
        if (matrix.length === 0 && glyphs.length > 0) {
                alert('If glyphs are provided, the matrix cannot be completely empty (0 rows). For an empty setup, clear both fields.');
                return;
        }
        if (matrix.length > 0 && matrix.length !== glyphs.length) {
            alert(`Error: Number of rows in matrix (${matrix.length}) must match number of glyphs (${glyphs.length}).`);
            return;
        }
        for (let i = 0; i < matrix.length; i++) {
            if (!Array.isArray(matrix[i])) {
                alert(`Error: Row ${i} in matrix is not an array.`);
                return;
            }
            if (matrix[i].length !== glyphs.length) {
                alert(`Error: Row ${i} in matrix (length ${matrix[i].length}) must have same number of columns as glyphs (${glyphs.length}).`);
                return;
            }
        }

        window.confusionMatrixData = matrix;
        window.confusionMatrixGlyphs = glyphs;
        alert('Confusion Matrix and Glyphs List loaded and validated. Bias-aware metrics will be used if character comparison is active and a CM is loaded.');
    };

    const handleGenerateAndPopulateCm = () => {
        const originalText1 = window.text1;
        const originalText2 = window.text2;

        if (originalText1 === undefined || originalText2 === undefined) {
            alert('Please perform a comparison first. The confusion matrix is derived from the two texts currently compared.');
            return;
        }

        const dmpDiffs = dmp.diff_main(String(originalText1), String(originalText2));
        dmp.diff_cleanupSemantic(dmpDiffs);

        if (DEBUG_MODE) console.log('[GenerateCM] DMP Diffs for CM generation:', JSON.stringify(dmpDiffs));

        const rawMatrix = _buildFullConfusionMatrixFromDmpDiffs(dmpDiffs, ERROR_ANALYSIS_DELETE_TOKEN, ERROR_ANALYSIS_INSERT_TOKEN);

        if (!rawMatrix || Object.keys(rawMatrix).length === 0) {
            alert('No character differences or similarities found to build the confusion matrix. This might happen if texts are identical or only contain operations not forming substitutions/insertions/deletions at character level, or if one text is empty.');
            document.getElementById('confusionMatrixDataText').value = '';
            document.getElementById('confusionMatrixGlyphsText').value = '';
            return;
        }

        const derivedGlyphs = deriveGlyphsListFromRawMatrix(rawMatrix, ERROR_ANALYSIS_DELETE_TOKEN, ERROR_ANALYSIS_INSERT_TOKEN);
        const matrixArray = convertRawMatrixToFullArray(rawMatrix, derivedGlyphs);

        if (DEBUG_MODE) {
            console.log('[GenerateCM] Raw Matrix (object form):', rawMatrix);
            console.log('[GenerateCM] Derived Glyphs (count):', derivedGlyphs.length, 'Derived Glyphs:', derivedGlyphs);
            console.log('[GenerateCM] Matrix Array (rows):', matrixArray.length, 'Matrix Array (cols of first row):', matrixArray[0] ? matrixArray[0].length : 'N/A (empty matrix)');
            if (matrixArray.length > 0 && derivedGlyphs.length > 0) {
                const sampleGlyphsToLog = derivedGlyphs.slice(0, Math.min(5, derivedGlyphs.length));
                sampleGlyphsToLog.forEach((glyph, idx) => {
                    console.log(`[GenerateCM] Diagonal for ${JSON.stringify(glyph)} (idx ${idx}): ${matrixArray[idx] ? matrixArray[idx][idx] : 'N/A'}`);
                });
            }
        }

        document.getElementById('confusionMatrixDataText').value = JSON.stringify(matrixArray, null, 2);
        document.getElementById('confusionMatrixGlyphsText').value = JSON.stringify(derivedGlyphs);

        alert("OCR Confusion Matrix data and glyph list generated and displayed in the input fields.\\nReview, then click 'Load Confusion Matrix' to use it for bias-aware comparisons, or copy/save the data manually.");
    };

    const handleSaveConfusionMatrix = () => {
        console.log('[DEBUG] handleSaveConfusionMatrix entered'); // ADD THIS LINE
        const matrixText = document.getElementById('confusionMatrixDataText').value;
        const glyphsText = document.getElementById('confusionMatrixGlyphsText').value;
        let matrix, glyphs;

        try {
            matrix = JSON.parse(matrixText);
        } catch (e) {
            alert('Invalid matrix data in textarea. Cannot save. Please check JSON format.');
            return;
        }

        try {
            glyphs = JSON.parse(glyphsText);
        } catch (e) {
            alert('Invalid glyphs list in textarea. Cannot save. Please check JSON array format (e.g., ["a","b","c"]).');
            return;
        }

        if (!Array.isArray(glyphs) || glyphs.length === 0) {
            alert('Glyph list must be a non-empty JSON array. Cannot save.');
            return;
        }
        if (glyphs.some(g => typeof g !== 'string')) {
            alert('All items in the glyphs list must be strings. Cannot save.');
            return;
        }

        if (!Array.isArray(matrix) || matrix.length === 0) {
            alert('Error: Confusion matrix data must be a non-empty JSON array of arrays. Cannot save.');
            return;
        }
        if (matrix.length !== glyphs.length) {
            alert(`Error: Number of rows in matrix (${matrix.length}) must match number of glyphs (${glyphs.length}). Cannot save.`);
            return;
        }
        let validMatrixStructure = true;
        matrix.forEach((row, rowIndex) => {
            if (!Array.isArray(row) || row.length !== glyphs.length) {
                alert(`Error: Row ${rowIndex + 1} in matrix (length ${row ? row.length : 'N/A'}) must be an array and have same number of columns as glyphs (${glyphs.length}). Cannot save.`);
                validMatrixStructure = false;
            }
        });
        if (!validMatrixStructure) return;

        const cmBundle = {
            comment: "RECON Confusion Matrix Data. Edit glyphs or matrix array with caution ensuring dimensions match.",
            glyphs: glyphs,
            matrix: matrix
        };

        const jsonString = JSON.stringify(cmBundle, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'recon_confusion_matrix.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('Confusion Matrix data saved as recon_confusion_matrix.json');
    };

    const handleLoadCmFromFileButtonClick = () => {
        console.log('[DEBUG] handleLoadCmFromFileButtonClick entered'); // ADD THIS LINE
        const cmFileInput = document.getElementById('cmFileInput');
        if (cmFileInput) cmFileInput.click(); // Ensure cmFileInput is fetched if not passed directly
    };

    const handleCmFileInputChange = (event) => {
        console.log('[DEBUG] handleCmFileInputChange entered, event:', event); // ADD THIS LINE
        // const granularitySelect = document.getElementById('granularity'); // Not needed for auto-check anymore
        // const biasMetricsEnabledCheckbox = document.getElementById('biasMetricsEnabled'); // Removed

        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parsedBundle = JSON.parse(e.target.result);
                    if (!parsedBundle || typeof parsedBundle !== 'object') {
                        throw new Error("File content is not a valid JSON object.");
                    }
                    if (!parsedBundle.matrix || !parsedBundle.glyphs) {
                        alert('Invalid CM file format. Expected an object with "matrix" and "glyphs" properties.');
                        return;
                    }
                    if (!Array.isArray(parsedBundle.glyphs) || !parsedBundle.glyphs.every(g => typeof g === 'string')) {
                        alert('Invalid glyphs list in file. Must be an array of strings.');
                        return;
                    }
                    if (!Array.isArray(parsedBundle.matrix)) {
                        alert('Matrix data from file must be an array of arrays.');
                        return;
                    }
                    if (parsedBundle.matrix.length === 0 && parsedBundle.glyphs.length > 0) {
                         alert('If glyphs are provided in the file, the matrix cannot be completely empty (0 rows).');
                         return;
                     }
                    if (parsedBundle.matrix.length > 0 && parsedBundle.matrix.length !== parsedBundle.glyphs.length) {
                        alert(`Error from file: Number of rows in matrix (${parsedBundle.matrix.length}) must match number of glyphs (${parsedBundle.glyphs.length}).`);
                        return;
                    }
                    for (let i = 0; i < parsedBundle.matrix.length; i++) {
                        if (!Array.isArray(parsedBundle.matrix[i])) {
                            alert(`Error from file: Row ${i} in matrix is not an array.`);
                            return;
                        }
                        if (parsedBundle.matrix[i].length !== parsedBundle.glyphs.length) {
                            alert(`Error from file: Row ${i} in matrix (length ${parsedBundle.matrix[i].length}) must have same number of columns as glyphs (${parsedBundle.glyphs.length}).`);
                            return;
                        }
                    }
                    document.getElementById('confusionMatrixDataText').value = JSON.stringify(parsedBundle.matrix, null, 2);
                    document.getElementById('confusionMatrixGlyphsText').value = JSON.stringify(parsedBundle.glyphs); 
                    
                    alert("Confusion Matrix loaded from file. Review the data in the textareas, then click 'Load Confusion Matrix' button above to apply it for comparisons.");

                } catch (error) {
                    alert('Error reading or parsing CM file: ' + error.message);
                    console.error("Error processing CM file:", error);
                } finally {
                    if (event && event.target) event.target.value = null; // Clear file input
                }
            };
            reader.readAsText(file);
        }
    };

    // Note: `saveSettingsHandler` and `resetSettingsHandler` can remain simple wrappers
    // if `saveSettings` and `resetSettings` are already defined at the top level.
    // e.g., const saveSettingsHandler = () => saveSettings();
    // Similar for `performComparisonHandler` and `exportDiffsHandler`.
    // For this example, I've included their full (or representative) logic.
    // Make sure functions like `applyTheme`, `saveVisualizationSettings`, `applyHighContrast`,
    // `_buildFullConfusionMatrixFromDmpDiffs`, `deriveGlyphsListFromRawMatrix`, `convertRawMatrixToFullArray`
    // are also defined at the IIFE top-level scope if these handlers call them.

    // --- End of Event Handler Functions ---

    const initializeEventListeners = () => {
        const compareButton = document.getElementById('compareButton');
        const exportButton = document.getElementById('exportButton');
        // Granularity select and CM tools container logic is now handled in DOMContentLoaded

        // New Visualization Menu Listeners
        const vizSettingsButton = document.getElementById('visualizationSettingsButton');
        const themeLightBtn = document.getElementById('themeLightButton');
        const themeDarkBtn = document.getElementById('themeDarkButton');
        const themeSystemBtn = document.getElementById('themeSystemButton');
        const highContrastToggleMenu = document.getElementById('highContrastToggleMenu');
        // const highContrastLabel = highContrastToggleMenu ? highContrastToggleMenu.parentElement : null; // Not used for adding listeners

        // Expand/Collapse Apparatus Button
        const toggleApparatusButton = document.getElementById('toggleApparatusHeight');

        // DMP Settings Panel Buttons
        const saveSettingsButton = document.getElementById('saveSettingsButton');
        const resetSettingsButton = document.getElementById('resetSettingsButton');

        // Confusion Matrix Loader Elements
        const loadConfusionMatrixButton = document.getElementById('loadConfusionMatrixButton');
        const generateAndPopulateCmButton = document.getElementById('generateAndPopulateCmButton'); 
        const saveConfusionMatrixButton = document.getElementById('saveConfusionMatrixButton'); 
        const loadCmFromFileButton = document.getElementById('loadCmFromFileButton'); 
        const cmFileInput = document.getElementById('cmFileInput'); 

        // Compare and Export buttons
        if (compareButton) {
            compareButton.removeEventListener('click', performComparison); 
            compareButton.addEventListener('click', performComparison);
        }
        if (exportButton) {
            exportButton.removeEventListener('click', exportDiffs); 
            exportButton.addEventListener('click', exportDiffs);
        }

        // Visualization Menu
        if (vizSettingsButton) {
            vizSettingsButton.removeEventListener('click', toggleVizMenuHandler);
            vizSettingsButton.addEventListener('click', toggleVizMenuHandler);
        }
        if (themeLightBtn) {
            themeLightBtn.removeEventListener('click', themeLightClickHandler);
            themeLightBtn.addEventListener('click', themeLightClickHandler);
        }
        if (themeDarkBtn) {
            themeDarkBtn.removeEventListener('click', themeDarkClickHandler);
            themeDarkBtn.addEventListener('click', themeDarkClickHandler);
        }
        if (themeSystemBtn) {
            themeSystemBtn.removeEventListener('click', themeSystemClickHandler);
            themeSystemBtn.addEventListener('click', themeSystemClickHandler);
        }
        if (highContrastToggleMenu) {
            highContrastToggleMenu.removeEventListener('change', highContrastChangeHandler);
            highContrastToggleMenu.addEventListener('change', highContrastChangeHandler);
        }

        // Document click for viz menu - IMPORTANT
        document.removeEventListener('click', documentClickHandlerForVizMenu); 
        document.addEventListener('click', documentClickHandlerForVizMenu);    

        // Settings panel buttons
        if (saveSettingsButton) {
            saveSettingsButton.removeEventListener('click', saveSettings); // Assuming saveSettings is top-level
            saveSettingsButton.addEventListener('click', saveSettings); 
        }
        if (resetSettingsButton) {
            resetSettingsButton.removeEventListener('click', resetSettings); // Assuming resetSettings is top-level
            resetSettingsButton.addEventListener('click', resetSettings);
        }

        // Apparatus Toggle
        if (toggleApparatusButton) { 
            toggleApparatusButton.removeEventListener('click', toggleApparatusHandler);
            toggleApparatusButton.addEventListener('click', toggleApparatusHandler);
        }
        
        // CM Buttons - ENSURE ALL ARE COVERED
        if (loadConfusionMatrixButton) {
            loadConfusionMatrixButton.removeEventListener('click', handleLoadConfusionMatrix);
            loadConfusionMatrixButton.addEventListener('click', handleLoadConfusionMatrix);
        }
        if (generateAndPopulateCmButton) {
            generateAndPopulateCmButton.removeEventListener('click', handleGenerateAndPopulateCm);
            generateAndPopulateCmButton.addEventListener('click', handleGenerateAndPopulateCm);
        }
        if (saveConfusionMatrixButton) { // ADDING/VERIFYING THIS BLOCK
            saveConfusionMatrixButton.removeEventListener('click', handleSaveConfusionMatrix);
            saveConfusionMatrixButton.addEventListener('click', handleSaveConfusionMatrix);
        }
        if (loadCmFromFileButton) { // ADDING/VERIFYING THIS BLOCK
            loadCmFromFileButton.removeEventListener('click', handleLoadCmFromFileButtonClick);
            loadCmFromFileButton.addEventListener('click', handleLoadCmFromFileButtonClick);
        }
        if (cmFileInput) { // ADDING/VERIFYING THIS BLOCK
            cmFileInput.removeEventListener('change', handleCmFileInputChange);
            cmFileInput.addEventListener('change', handleCmFileInputChange);
        }
    };

    const handleFileInput = (file, textarea) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            textarea.value = e.target.result;
            textarea.classList.add('file-loaded');
            setTimeout(() => textarea.classList.remove('file-loaded'), 500);
        };
        reader.readAsText(file);
    };

    const addFileUploadHandlers = (textarea) => {
        let isFileDialogOpen = false; // Flag to prevent multiple dialogs

        textarea.addEventListener('dragover', (e) => {
            e.preventDefault();
            textarea.classList.add('dragover');
        });
        textarea.addEventListener('dragleave', () => textarea.classList.remove('dragover'));
        textarea.addEventListener('drop', (e) => {
            e.preventDefault();
            textarea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) handleFileInput(file, textarea);
        });

        textarea.addEventListener('dblclick', () => {
            if (isFileDialogOpen) {
                return;
            }
            isFileDialogOpen = true;

            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.txt,.py'; // Or whatever types are appropriate
            fileInput.style.display = 'none';

            const handleDialogClose = () => {
                isFileDialogOpen = false;
                if (document.body.contains(fileInput)) {
                    document.body.removeChild(fileInput);
                }
                // The { once: true } option handles removing this listener automatically.
            };

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    handleFileInput(file, textarea);
                }
                // If 'change' fires, the dialog interaction is complete.
                // We should ensure the 'focus' listener (handleDialogClose) is removed
                // as it might not have fired or might fire too late.
                window.removeEventListener('focus', handleDialogClose);
                
                isFileDialogOpen = false; 
                if (document.body.contains(fileInput)) {
                    document.body.removeChild(fileInput);
                }
            });
            
            document.body.appendChild(fileInput);
            
            // Add the focus listener to the window *before* clicking the input.
            window.addEventListener('focus', handleDialogClose, { once: true });
            
            fileInput.click();
        });

        textarea.addEventListener('focus', () => {
            if (!textarea.value.trim()) {
                textarea.dataset.originalPlaceholder = textarea.placeholder;
                textarea.placeholder = 'Type or double-click to load file...';
            }
        });
        textarea.addEventListener('blur', () => {
            if (!textarea.value.trim()) textarea.placeholder = textarea.dataset.originalPlaceholder;
        });
    };

    const initializeTextAreaInteractions = () => {
        document.querySelectorAll('.text-input textarea').forEach(addFileUploadHandlers);
    };

    document.addEventListener('DOMContentLoaded', () => {
        // Correct order and calls for DOMContentLoaded:
        loadSettings(); // Load DMP settings from storage or use defaults
        loadVisualizationSettings(); // Load theme/contrast settings
        initializeEventListeners(); // Initialize event listeners for buttons, settings, CM loading, visualization toggles etc.
        initializeTextAreaInteractions(); // For double-click to upload
        updateFooterLastModified();

        // --- Granularity and CM Tools Visibility Setup ---
        const granularitySelect = document.getElementById('granularity');
        const cmToolsContainer = document.getElementById('cmToolsContainer'); 
        
        if (granularitySelect && cmToolsContainer) {
            const updateCmToolsVisibility = () => {
                if (granularitySelect.value === GRANULARITY_TYPES.CHARACTER) {
                    cmToolsContainer.style.display = ''; // Show the details container
                } else {
                    cmToolsContainer.style.display = 'none'; // Hide for word granularity
                    cmToolsContainer.open = false; // Ensure it's closed when hidden
                }
            };

            granularitySelect.addEventListener('change', updateCmToolsVisibility);
            updateCmToolsVisibility(); // Call once on load to set initial state
        } else {
            if (DEBUG_MODE) console.warn("[DOMContentLoaded] CM tools container or granularity select not found for visibility setup.");
        }
        // --- End Granularity and CM Tools Visibility Setup ---
        
    });

    // --- Settings Management Functions ---
    const updateSettingsUI = () => {
        const timeoutInput = document.getElementById('settingDiffTimeout');
        const editCostInput = document.getElementById('settingDiffEditCost');
        const thresholdInput = document.getElementById('settingMatchThreshold');
        const distanceInput = document.getElementById('settingMatchDistance');
        const patchThresholdInput = document.getElementById('settingPatchDeleteThreshold');
        const patchMarginInput = document.getElementById('settingPatchMargin');

        if (timeoutInput) timeoutInput.value = dmp.Diff_Timeout;
        if (editCostInput) editCostInput.value = dmp.Diff_EditCost;
        if (thresholdInput) thresholdInput.value = dmp.Match_Threshold;
        if (distanceInput) distanceInput.value = dmp.Match_Distance;
        if (patchThresholdInput) patchThresholdInput.value = dmp.Patch_DeleteThreshold;
        if (patchMarginInput) patchMarginInput.value = dmp.Patch_Margin;
    };

    const loadSettings = () => {
        let loadedSettings = {};
        try {
            const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
            if (stored) {
                loadedSettings = JSON.parse(stored);
            }
        } catch (e) {
            console.error("Error loading settings from localStorage:", e);
        }

        // Apply defaults for any missing settings
        const currentSettings = { ...DEFAULT_DMP_SETTINGS, ...loadedSettings };

        // Apply to dmp instance
        Object.assign(dmp, {
            Diff_Timeout: currentSettings.Diff_Timeout,
            Diff_EditCost: currentSettings.Diff_EditCost,
            Match_Threshold: currentSettings.Match_Threshold,
            Match_Distance: currentSettings.Match_Distance,
            Patch_DeleteThreshold: currentSettings.Patch_DeleteThreshold,
            Patch_Margin: currentSettings.Patch_Margin
        });

        if (DEBUG_MODE) console.log('Loaded settings:', { 
            Diff_Timeout: dmp.Diff_Timeout, Diff_EditCost: dmp.Diff_EditCost, 
            Match_Threshold: dmp.Match_Threshold, Match_Distance: dmp.Match_Distance, 
            Patch_DeleteThreshold: dmp.Patch_DeleteThreshold, Patch_Margin: dmp.Patch_Margin 
        });

        updateSettingsUI(); // Update UI to reflect loaded/default settings
    };

    const saveSettings = () => {
        try {
            const newSettings = {
                Diff_Timeout: parseInt(document.getElementById('settingDiffTimeout').value, 10) || 0,
                Diff_EditCost: parseInt(document.getElementById('settingDiffEditCost').value, 10) || DEFAULT_DMP_SETTINGS.Diff_EditCost,
                Match_Threshold: parseFloat(document.getElementById('settingMatchThreshold').value) || DEFAULT_DMP_SETTINGS.Match_Threshold,
                Match_Distance: parseInt(document.getElementById('settingMatchDistance').value, 10) || DEFAULT_DMP_SETTINGS.Match_Distance,
                Patch_DeleteThreshold: parseFloat(document.getElementById('settingPatchDeleteThreshold').value) || DEFAULT_DMP_SETTINGS.Patch_DeleteThreshold,
                Patch_Margin: parseInt(document.getElementById('settingPatchMargin').value, 10) || DEFAULT_DMP_SETTINGS.Patch_Margin
            };

            // Basic validation (ensure numbers, thresholds within range)
            if (isNaN(newSettings.Diff_Timeout) || newSettings.Diff_Timeout < 0) newSettings.Diff_Timeout = DEFAULT_DMP_SETTINGS.Diff_Timeout;
            if (isNaN(newSettings.Diff_EditCost) || newSettings.Diff_EditCost < 1) newSettings.Diff_EditCost = DEFAULT_DMP_SETTINGS.Diff_EditCost;
            if (isNaN(newSettings.Match_Threshold) || newSettings.Match_Threshold < 0 || newSettings.Match_Threshold > 1) newSettings.Match_Threshold = DEFAULT_DMP_SETTINGS.Match_Threshold;
            if (isNaN(newSettings.Match_Distance) || newSettings.Match_Distance < 0) newSettings.Match_Distance = DEFAULT_DMP_SETTINGS.Match_Distance;
            if (isNaN(newSettings.Patch_DeleteThreshold) || newSettings.Patch_DeleteThreshold < 0 || newSettings.Patch_DeleteThreshold > 1) newSettings.Patch_DeleteThreshold = DEFAULT_DMP_SETTINGS.Patch_DeleteThreshold;
            if (isNaN(newSettings.Patch_Margin) || newSettings.Patch_Margin < 0) newSettings.Patch_Margin = DEFAULT_DMP_SETTINGS.Patch_Margin;

            // Apply to dmp instance
            Object.assign(dmp, newSettings);

            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
            if (DEBUG_MODE) console.log('Saved settings:', newSettings);
            alert('Settings saved! Press Compare Texts to see effects.'); // Simple feedback
            updateSettingsUI(); // Re-sync UI in case validation changed values

        } catch (e) {
            console.error("Error saving settings:", e);
            alert('Error saving settings.');
        }
    };

    const resetSettings = () => {
        try {
            localStorage.removeItem(SETTINGS_STORAGE_KEY);
            Object.assign(dmp, DEFAULT_DMP_SETTINGS);
            updateSettingsUI();
            if (DEBUG_MODE) console.log('Reset settings to default:', DEFAULT_DMP_SETTINGS);
            alert('Settings reset to defaults! Press Compare Texts to see effects.');
        } catch (e) {
            console.error("Error resetting settings:", e);
            alert('Error resetting settings.');
        }
    };
    // --- End Settings Management ---

    // --- Visualization Settings Management ---
    let currentColorSchemeListener = null;

    const applyTheme = (themePreference) => {
        document.documentElement.classList.remove(THEME_TYPES.LIGHT + '-theme', THEME_TYPES.DARK + '-theme'); // Changed from document.body
        const highContrastCheckbox = document.getElementById('highContrastToggleMenu');
        // const highContrastLabel = highContrastCheckbox ? highContrastCheckbox.parentElement : null; // Original, now use new ID
        const highContrastLabel = document.getElementById('highContrastToggleMenuLabel');


        if (themePreference === THEME_TYPES.LIGHT) {
            document.documentElement.classList.add(THEME_TYPES.LIGHT + '-theme'); // Changed from document.body
        } else if (themePreference === THEME_TYPES.DARK) {
            document.documentElement.classList.add(THEME_TYPES.DARK + '-theme'); // Changed from document.body
        } else { // system
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.classList.add(THEME_TYPES.DARK + '-theme'); // Changed from document.body
            } else {
                document.documentElement.classList.add(THEME_TYPES.LIGHT + '-theme'); // Changed from document.body // Ensure light-theme for system light
            }
        }
        // Update aria-pressed for buttons if they exist and are part of the new menu
        const lightButton = document.getElementById('themeLightButton');
        const darkButton = document.getElementById('themeDarkButton');
        const systemButton = document.getElementById('themeSystemButton');
        if (lightButton) lightButton.setAttribute('aria-pressed', themePreference === THEME_TYPES.LIGHT);
        if (darkButton) darkButton.setAttribute('aria-pressed', themePreference === THEME_TYPES.DARK);
        if (systemButton) systemButton.setAttribute('aria-pressed', themePreference === THEME_TYPES.SYSTEM);

    };

    const applyHighContrast = (isHighContrast) => {
        const highContrastCheckbox = document.getElementById('highContrastToggleMenu');
        // const highContrastLabel = highContrastCheckbox ? highContrastCheckbox.parentElement : null; // Original, now use new ID
        const highContrastLabel = document.getElementById('highContrastToggleMenuLabel');


        if (isHighContrast) {
            document.documentElement.classList.add('high-contrast'); // Changed from document.body
            if (highContrastCheckbox) highContrastCheckbox.checked = true;
            if (highContrastLabel) highContrastLabel.setAttribute('aria-checked', 'true');
        } else {
            document.documentElement.classList.remove('high-contrast'); // Changed from document.body
            if (highContrastCheckbox) highContrastCheckbox.checked = false;
            if (highContrastLabel) highContrastLabel.setAttribute('aria-checked', 'false');
        }
    };
    
    const saveVisualizationSettings = (settings) => {
        try {
            localStorage.setItem(VIS_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        } catch (e) {
            console.error("Error saving visualization settings to localStorage:", e);
        }
    };

    const loadVisualizationSettings = () => {
        let loadedSettings = { ...DEFAULT_VIS_SETTINGS };
        try {
            const stored = localStorage.getItem(VIS_SETTINGS_STORAGE_KEY);
            if (stored) {
                loadedSettings = { ...DEFAULT_VIS_SETTINGS, ...JSON.parse(stored) };
            }
        } catch (e) {
            console.error("Error loading visualization settings from localStorage:", e);
            // Fallback to defaults already handled
        }

        applyTheme(loadedSettings.theme);
        applyHighContrast(loadedSettings.highContrast);

        // Clear existing listener before adding a new one
        if (currentColorSchemeListener && window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', currentColorSchemeListener);
        }

        if (loadedSettings.theme === THEME_TYPES.SYSTEM && window.matchMedia) {
            currentColorSchemeListener = (e) => {
                if (localStorage.getItem(VIS_SETTINGS_STORAGE_KEY) && JSON.parse(localStorage.getItem(VIS_SETTINGS_STORAGE_KEY)).theme === THEME_TYPES.SYSTEM) {
                     applyTheme(THEME_TYPES.SYSTEM); // Re-apply to pick up change
                }
            };
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', currentColorSchemeListener);
        }
        return loadedSettings;
    };


    // --- End Visualization Settings Management ---

    // --- Export Generation Functions ---
    const generateStandoffJSON = (originalText1, originalText2, stats, settings, dmpSettings) => {
        const text1String = String(originalText1 || '');
        const text2String = String(originalText2 || '');
        const charDiffs = dmp.diff_main(text1String, text2String);
        dmp.diff_cleanupSemantic(charDiffs);

        const variants = [];
        let currentIndexText1 = 0;
        let variantIdCounter = 0;
        const currentOptions = settings.options || {}; // Options from UI/comparison settings

        for (let i = 0; i < charDiffs.length; i++) {
            const opType = charDiffs[i][0];
            const text = charDiffs[i][1];
            let note = "";

            if (opType === -1) { // DELETION
                const delText = text;
                if (i + 1 < charDiffs.length && charDiffs[i+1][0] === 1) { // Potential substitution
                    const insText = charDiffs[i+1][1];
                    note = getNormalizationNoteForPair(delText, insText, currentOptions, normalizationMaps, settings);
                    variants.push({
                        id: `variant-${String(++variantIdCounter).padStart(3, '0')}`,
                        type: "substitution", // Represent as a single substitution event
                        start: currentIndexText1,
                        end: currentIndexText1 + delText.length,
                        text1_subsegment: delText,
                        text2_subsegment: insText,
                        note: note
                    });
                    currentIndexText1 += delText.length;
                    i++; // Increment i to skip the next part (insertion), as it's handled
                } else { // Standalone Deletion
                    note = getNormalizationNoteForPair(delText, "", currentOptions, normalizationMaps, settings);
                    variants.push({
                        id: `variant-${String(++variantIdCounter).padStart(3, '0')}`,
                        type: "deletion",
                        start: currentIndexText1,
                        end: currentIndexText1 + delText.length,
                        text1_subsegment: delText,
                        text2_subsegment: "",
                        note: note
                    });
                    currentIndexText1 += delText.length;
                }
            } else if (opType === 1) { // INSERTION (should only be standalone if not caught by DEL above)
                const insText = text;
                note = getNormalizationNoteForPair("", insText, currentOptions, normalizationMaps, settings);
                variants.push({
                    id: `variant-${String(++variantIdCounter).padStart(3, '0')}`,
                    type: "insertion",
                    start: currentIndexText1,
                    end: currentIndexText1, // Zero-length span in T1
                    text1_subsegment: "",
                    text2_subsegment: insText,
                    note: note
                });
            } else { // EQUAL
                currentIndexText1 += text.length;
            }
        }

        const meta = {
            timestamp: new Date().toISOString(),
            comparisonOptions: settings.options || {},
            dmpParameters: {
                Diff_Timeout: dmpSettings.Diff_Timeout,
                Diff_EditCost: dmpSettings.Diff_EditCost,
                Match_Threshold: dmpSettings.Match_Threshold,
                Match_Distance: dmpSettings.Match_Distance,
                Patch_DeleteThreshold: dmpSettings.Patch_DeleteThreshold,
                Patch_Margin: dmpSettings.Patch_Margin
            },
            statistics: stats, // Include the calculated stats as well
            variantAnalysis: stats.variantAnalysis // Add detailed variant analysis
        };

        // Add normalization summary to meta
        if (stats && stats.variantAnalysis && stats.variantAnalysis.totalChanges) {
            const va = stats.variantAnalysis;
            const totalNormalizedCount = Object.values(va.totalChanges).reduce((sum, val) => sum + (val || 0), 0);
            const normalizedTypes = Object.entries(va.changeTallies)
                                        .filter(([key, value]) => value > 0)
                                        .map(([key, value]) => key);
            meta.normalizationSummary = {
                normalizedChangesCount: totalNormalizedCount,
                normalizedTypes: normalizedTypes
            };
        }

        // Ensure new options are in meta explicitly if not already covered by settings.options
        if (settings.options && typeof settings.options.ignoreUV !== 'undefined') {
            meta.comparisonOptions.ignoreUV = settings.options.ignoreUV;
        }
        if (settings.options && typeof settings.options.ignoreIJ !== 'undefined') {
            meta.comparisonOptions.ignoreIJ = settings.options.ignoreIJ;
        }
        if (settings.options && typeof settings.options.normalizeUvW !== 'undefined') { // Add to standoff JSON meta
            meta.comparisonOptions.normalizeUvW = settings.options.normalizeUvW;
        }

        return { meta, variants };
    };

    const calculateVariantAnalysis = (originalText1, originalText2, options) => {
        // Store original DMP settings to restore later
        const originalMatchThreshold = dmp.Match_Threshold;

        try {
            // Set stricter DMP settings for a literal diff for variant analysis
            dmp.Match_Threshold = 0.0;

        const analysis = {
            text1Tallies: {},
            text2Tallies: {},
            changeTallies: {}, 
                totalChanges: { ligatures: 0, logograms: 0, archaic: 0, uvSwaps: 0, ijSwaps: 0, uvwChanges: 0 }
        };

        const tallyRawForms = (text, tallies) => {
                for (const form in ALL_VARIANT_FORMS) {
                    const regex = new RegExp(form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                const count = (text.match(regex) || []).length;
                if (count > 0) tallies[form] = count;
            }
        };
        tallyRawForms(originalText1, analysis.text1Tallies);
        tallyRawForms(originalText2, analysis.text2Tallies);

            // Analyze Changes using a literal Character Diff of original texts
        const charDiffs = dmp.diff_main(originalText1, originalText2);
            dmp.diff_cleanupSemantic(charDiffs); // Re-introduce semantic cleanup
            
            if (DEBUG_MODE) console.log('[calculateVariantAnalysis] Literal charDiffs AFTER semantic cleanup for variant counting:', JSON.stringify(charDiffs));

            for (let i = 0; i < charDiffs.length - 1; /* i is incremented below */) {
                const op1 = charDiffs[i];
                const op2 = charDiffs[i+1];
                let currentDelText = null;
                let currentInsText = null;
                let isSubstitutionPair = false;

                if (op1[0] === -1 && op2[0] === 1) { // DEL followed by INS
                    currentDelText = op1[1];
                    currentInsText = op2[1];
                    isSubstitutionPair = true;
                } else if (op1[0] === 1 && op2[0] === -1) { // INS followed by DEL
                    currentInsText = op1[1]; 
                    currentDelText = op2[1];
                    isSubstitutionPair = true;
                }

                if (isSubstitutionPair) {
                    let anySubstitutionFoundInPair = false; // Flag to see if any specific variant was tallied for this pair

                // Check Logograms
                    if (currentDelText.includes('&') && currentInsText.includes(LOGOGRAM_MAP['&'])) {
                        analysis.changeTallies['&→' + LOGOGRAM_MAP['&']] = (analysis.changeTallies['&→' + LOGOGRAM_MAP['&']] || 0) + 1;
                    anySubstitutionFoundInPair = true;
                }
                    if (currentDelText.includes(LOGOGRAM_MAP['&']) && currentInsText.includes('&')) {
                        analysis.changeTallies[LOGOGRAM_MAP['&'] + '→&'] = (analysis.changeTallies[LOGOGRAM_MAP['&'] + '→&'] || 0) + 1;
                    anySubstitutionFoundInPair = true;
                }

                // Check Ligatures
                    for (const [form, expansion] of Object.entries(LIGATURE_MAP)){
                        if (currentDelText.includes(form) && currentInsText.includes(expansion)){
                        analysis.changeTallies[`${form}→${expansion}`] = (analysis.changeTallies[`${form}→${expansion}`] || 0) + 1;
                        anySubstitutionFoundInPair = true;
                    }
                        if (currentDelText.includes(expansion) && currentInsText.includes(form)){
                        analysis.changeTallies[`${expansion}→${form}`] = (analysis.changeTallies[`${expansion}→${form}`] || 0) + 1;
                        anySubstitutionFoundInPair = true;
                    }
                }

                // Check Archaic (ſ ↔ s, ꝛ ↔ r)
                 if (options.ignoreArchaicLetters) {
                        for (const [form, expansion] of Object.entries(ARCHAIC_LETTER_MAP)){
                            if (currentDelText.includes(form) && currentInsText.includes(expansion)){
                            analysis.changeTallies[`${form}→${expansion}`] = (analysis.changeTallies[`${form}→${expansion}`] || 0) + 1;
                            anySubstitutionFoundInPair = true;
                        }
                            if (currentDelText.includes(expansion) && currentInsText.includes(form)){
                            analysis.changeTallies[`${expansion}→${form}`] = (analysis.changeTallies[`${expansion}→${form}`] || 0) + 1;
                            anySubstitutionFoundInPair = true;
                        }
                    }
                 }
               
                // Check u/v swaps
                if (options.ignoreUV) {
                        const delLower = currentDelText.toLowerCase();
                        const insLower = currentInsText.toLowerCase();
                    if (delLower.includes('u') && insLower.includes('v')) {
                        analysis.changeTallies['u→v'] = (analysis.changeTallies['u→v'] || 0) + 1;
                        anySubstitutionFoundInPair = true;
                    }
                    if (delLower.includes('v') && insLower.includes('u')) {
                        analysis.changeTallies['v→u'] = (analysis.changeTallies['v→u'] || 0) + 1;
                        anySubstitutionFoundInPair = true;
                    }
                }

                // Check i/j swaps
                if (options.ignoreIJ) {
                        const delLower = currentDelText.toLowerCase();
                        const insLower = currentInsText.toLowerCase();
                    if (delLower.includes('i') && insLower.includes('j')) {
                        analysis.changeTallies['i→j'] = (analysis.changeTallies['i→j'] || 0) + 1;
                        anySubstitutionFoundInPair = true;
                    }
                    if (delLower.includes('j') && insLower.includes('i')) {
                        analysis.changeTallies['j→i'] = (analysis.changeTallies['j→i'] || 0) + 1;
                        anySubstitutionFoundInPair = true;
                    }
                }

                // Check uu/vv to w (and reverse)
                if (options.normalizeUvW) {
                        for (const [form, expansion] of Object.entries(UVW_NORMALIZATION_MAP)) {
                            // Check form -> expansion (e.g., uu -> w)
                            if (currentDelText.includes(form) && currentInsText.includes(expansion)) {
                            analysis.changeTallies[`${form}→${expansion}`] = (analysis.changeTallies[`${form}→${expansion}`] || 0) + 1;
                            anySubstitutionFoundInPair = true;
                        }
                            // Check expansion -> form (e.g., w -> uu) symmetrically. Changed from 'else if' to 'if'.
                            if (currentDelText.includes(expansion) && currentInsText.includes(form)) {
                                analysis.changeTallies[`${expansion}→${form}`] = (analysis.changeTallies[`${expansion}→${form}`] || 0) + 1;
                         anySubstitutionFoundInPair = true;
                    }
                }
                    }
                    // The flag 'anySubstitutionFoundInPair' is set if any of the above specific variants were found.
                    // We advance by 2 because we've processed op1 and op2 as a potential pair.
                    i += 2; 
                } else {
                    // Not a DEL/INS or INS/DEL pair, so op1 was not part of such a pair with op2.
                    // Advance by 1 to consider op1 with the *next* element in the next iteration.
                    i += 1;
            }
        }

        // Calculate totalChanges by summing up from changeTallies
            // (This part remains the same)
            analysis.totalChanges.logograms = (analysis.changeTallies['&→' + LOGOGRAM_MAP['&']] || 0) + (analysis.changeTallies[LOGOGRAM_MAP['&'] + '→&'] || 0);
        
            Object.entries(LIGATURE_MAP).forEach(([form, expansion]) => {
            analysis.totalChanges.ligatures += (analysis.changeTallies[`${form}→${expansion}`] || 0);
            analysis.totalChanges.ligatures += (analysis.changeTallies[`${expansion}→${form}`] || 0);
        });

        if (options.ignoreArchaicLetters) {
                Object.entries(ARCHAIC_LETTER_MAP).forEach(([form, expansion]) => {
                analysis.totalChanges.archaic += (analysis.changeTallies[`${form}→${expansion}`] || 0);
                analysis.totalChanges.archaic += (analysis.changeTallies[`${expansion}→${form}`] || 0);
            });
        }

        if (options.ignoreUV) {
            analysis.totalChanges.uvSwaps = (analysis.changeTallies['u→v'] || 0) + (analysis.changeTallies['v→u'] || 0);
        }

        if (options.ignoreIJ) {
            analysis.totalChanges.ijSwaps = (analysis.changeTallies['i→j'] || 0) + (analysis.changeTallies['j→i'] || 0);
        }

        if (options.normalizeUvW) {
            let currentUvwChanges = 0;
                for (const [form, expansion] of Object.entries(UVW_NORMALIZATION_MAP)) {
                currentUvwChanges += (analysis.changeTallies[`${form}→${expansion}`] || 0);
                    currentUvwChanges += (analysis.changeTallies[`${expansion}→${form}`] || 0);
                }
            analysis.totalChanges.uvwChanges = currentUvwChanges;
        }

        return analysis;

        } finally {
            // Restore original DMP Match_Threshold
            dmp.Match_Threshold = originalMatchThreshold;
        }
    };

    const generateTEIXML = (resultDiffs, stats, settings, dmpSettings) => {
        if (DEBUG_MODE) console.log("[generateTEIXML] Received stats object:", JSON.stringify(stats, null, 2));

        const processTEISegment = (textSegment) => {
            if (textSegment === null || typeof textSegment === 'undefined') return '';
            let processed = escapeCharacters(textSegment, ESCAPE_TYPES.XML);
            processed = processed.replace(/\n/g, '<lb/>');
            // Spaces that were visualized as ␠ are actual spaces in resultDiffs,
            // escapeCharacters handles XML safety, and literal spaces within add/del are fine.
            // No special handling for ␠ needed here for TEI.
            return processed;
        };

        let inlineContent = '';
        resultDiffs.forEach(part => {
            const type = part[0];
            const text1 = part[1]; // Text from source 1 (or common text)
            const text2 = part.length > 2 ? part[2] : null; // Text from source 2 (for substitutions)

            // settings.granularity is used to determine which set of CHANGE_TYPES to use.
            if (settings.granularity === GRANULARITY_TYPES.CHARACTER) {
                switch (type) {
                    case CHANGE_TYPES.EQ_FINAL:
                        inlineContent += processTEISegment(text1);
                        break;
                    case CHANGE_TYPES.DEL_CHAR_FINAL:
                        inlineContent += `<del>${processTEISegment(text1)}</del>`;
                        break;
                    case CHANGE_TYPES.INS_CHAR_FINAL:
                        inlineContent += `<add>${processTEISegment(text1)}</add>`;
                        break;
                    case CHANGE_TYPES.SUB_CHAR:
                        inlineContent += `<app><lem>${processTEISegment(text1)}</lem><rdg>${processTEISegment(text2)}</rdg></app>`;
                        break;
                    default:
                        inlineContent += `<!-- Unknown char diff type: ${type} -->`;
                        break;
                }
            } else { // Word granularity (default or explicit)
            switch (type) {
                case CHANGE_TYPES.EQUAL:
                    inlineContent += processTEISegment(text1);
                    break;
                case CHANGE_TYPES.WORD_DELETION:
                    inlineContent += `<del>${processTEISegment(text1)}</del>`;
                    break;
                case CHANGE_TYPES.WORD_INSERTION:
                    inlineContent += `<add>${processTEISegment(text1)}</add>`;
                    break;
                case CHANGE_TYPES.WORD_SUBSTITUTION_FULL:
                    inlineContent += `<app><lem>${processTEISegment(text1)}</lem><rdg>${processTEISegment(text2)}</rdg></app>`;
                    break;
                default:
                        inlineContent += `<!-- Unknown word diff type: ${type} -->`;
                    break;
                }
            }
        });

        const granularity = settings.granularity || GRANULARITY_TYPES.WORD; // Default if undefined
        const options = settings.options || {};

        const va = stats.variantAnalysis || {};
        const totalChanges = va.totalChanges || {};
        const changeTallies = va.changeTallies || {};
        const t1Tallies = va.text1Tallies || {};
        const t2Tallies = va.text2Tallies || {};

        let normalizationNoteParts = [];
        if (options.ignoreLogograms) normalizationNoteParts.push("logograms (e.g., & → and)");
        if (options.ignoreLigatures) normalizationNoteParts.push("ligatures (e.g., æ → ae)");
        if (options.ignoreArchaicLetters) normalizationNoteParts.push("archaic letters (e.g., ſ → s)");
        if (options.normalizeUvW) normalizationNoteParts.push("u/v/w variants (e.g., vv → w, u → v)");
        else if (options.ignoreUV) normalizationNoteParts.push("u/v variants (u → v)"); // Only if normalizeUvW is not active
        if (options.ignoreIJ) normalizationNoteParts.push("i/j variants (j → i)");
        
        let normalizationSettingsNote = '';
        if (normalizationNoteParts.length > 0) {
            normalizationSettingsNote = ` Typographic distinctions including ${normalizationNoteParts.join(', ')} were normalized and not reported as differences.`;
        } else {
            normalizationSettingsNote = " No specific character normalizations were enabled for this comparison beyond selected include/exclude options.";
        }

        let normalizationSummaryNote = '';
        const totalNormalizedCount = Object.values(totalChanges).reduce((sum, val) => sum + (val || 0), 0);
        if (totalNormalizedCount > 0) {
            let summaryParts = [];
            if (totalChanges.logograms) summaryParts.push(`${totalChanges.logograms} logogram instances`);
            if (totalChanges.ligatures) summaryParts.push(`${totalChanges.ligatures} ligature instances`);
            if (totalChanges.archaic) summaryParts.push(`${totalChanges.archaic} archaic letter instances`);
            if (totalChanges.uvwChanges) summaryParts.push(`${totalChanges.uvwChanges} u/v/w instances`);
            else if (totalChanges.uvSwaps) summaryParts.push(`${totalChanges.uvSwaps} u/v swap instances`); // Only if uvwChanges is not counted
            if (totalChanges.ijSwaps) summaryParts.push(`${totalChanges.ijSwaps} i/j swap instances`);
            
            normalizationSummaryNote = ` A total of ${totalNormalizedCount} character-level variations related to ${summaryParts.join(', ')} were identified and normalized based on the comparison settings.`;
        }

        const variantAnalysisXML = `
            <variantAnalysis>
                <totalChanges>
                    <ligatures>${totalChanges.ligatures || 0}</ligatures>
                    <logograms>${totalChanges.logograms || 0}</logograms>
                    <archaic>${totalChanges.archaic || 0}</archaic>
                    <uvSwaps>${totalChanges.uvSwaps || 0}</uvSwaps>
                    <ijSwaps>${totalChanges.ijSwaps || 0}</ijSwaps>
                    <uvwChanges>${totalChanges.uvwChanges || 0}</uvwChanges>
                </totalChanges>
                <changeTallies>
                    ${Object.entries(changeTallies).map(([key, value]) => `<change type="${escapeCharacters(key,ESCAPE_TYPES.XML)}">${value}</change>`).join('\n                    ')}
                </changeTallies>
                 <text1Tallies>
                     ${Object.entries(t1Tallies).map(([key, value]) => `<form char="${escapeCharacters(key,ESCAPE_TYPES.XML)}">${value}</form>`).join('\n                     ')}
                 </text1Tallies>
                 <text2Tallies>
                     ${Object.entries(t2Tallies).map(([key, value]) => `<form char="${escapeCharacters(key,ESCAPE_TYPES.XML)}">${value}</form>`).join('\n                     ')}
                 </text2Tallies>
            </variantAnalysis>`;

        const metadataXML = `
    <reconMetadata>
        <comparisonOptions>
            <granularity>${escapeCharacters(granularity, ESCAPE_TYPES.XML)}</granularity>
            <includeWhitespace>${options.includeWhitespace === true}</includeWhitespace>
            <includePunctuation>${options.includePunctuation === true}</includePunctuation>
            <includeCapitalization>${options.includeCapitalization === true}</includeCapitalization>
            <ignoreLogograms>${options.ignoreLogograms === true}</ignoreLogograms>
            <ignoreLigatures>${options.ignoreLigatures === true}</ignoreLigatures>
            <ignoreArchaicLetters>${options.ignoreArchaicLetters === true}</ignoreArchaicLetters>
            <ignoreUV>${options.ignoreUV === true}</ignoreUV>
            <ignoreIJ>${options.ignoreIJ === true}</ignoreIJ>
            <normalizeUvW>${options.normalizeUvW === true}</normalizeUvW>
        </comparisonOptions>
        <notes>
            <note type="normalizationSettings">${escapeCharacters(normalizationSettingsNote.trim(), ESCAPE_TYPES.XML)}</note>
            ${normalizationSummaryNote ? `<note type="normalizationSummary">${escapeCharacters(normalizationSummaryNote.trim(), ESCAPE_TYPES.XML)}</note>` : ''}
        </notes>
        <dmpParameters>
             <Diff_Timeout>${dmpSettings.Diff_Timeout}</Diff_Timeout>
             <Diff_EditCost>${dmpSettings.Diff_EditCost}</Diff_EditCost>
             <Match_Threshold>${dmpSettings.Match_Threshold}</Match_Threshold>
             <Match_Distance>${dmpSettings.Match_Distance}</Match_Distance>
             <Patch_DeleteThreshold>${dmpSettings.Patch_DeleteThreshold}</Patch_DeleteThreshold>
             <Patch_Margin>${dmpSettings.Patch_Margin}</Patch_Margin>
        </dmpParameters>
        <statistics>
            ${Object.entries(stats)
                .filter(([key, value]) => typeof value !== 'object' && key !== 'variantAnalysis') // Exclude complex objects and variantAnalysis itself
                .map(([key, value]) => `<${key}>${escapeCharacters(String(value), ESCAPE_TYPES.XML)}</${key}>`) // Ensure value is string
                .join('\n            ')}
            ${variantAnalysisXML}
        </statistics>
    </reconMetadata>`;

        const textContentXML = `
    <text>
        <body>
            <p>${inlineContent}</p>
        </body>
    </text>`;

        const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<reconOutputTEI>
${metadataXML}
${textContentXML}
</reconOutputTEI>`;

        if (DEBUG_MODE) console.log("[generateTEIXML] Final XML string:", xmlString);
        return xmlString;
    };

    // --- End Export Generation Functions ---

    // --- Utility Functions ---
    const performComparison = () => {
        const startTime = performance.now();

        const text1 = document.getElementById('text1').value; 
        const text2 = document.getElementById('text2').value;

        const granularity = document.getElementById('granularity').value;
        const options = {
            includeWhitespace: document.getElementById('includeWhitespace').checked,
            includePunctuation: document.getElementById('includePunctuation').checked,
            includeCapitalization: document.getElementById('includeCapitalization').checked,
            ignoreLogograms: document.getElementById('ignoreLogograms').checked,
            ignoreLigatures: document.getElementById('ignoreLigatures').checked,
            ignoreArchaicLetters: document.getElementById('ignoreArchaicLetters').checked,
            ignoreUV: document.getElementById('ignoreUV').checked,
            ignoreIJ: document.getElementById('ignoreIJ').checked,
            normalizeUvW: document.getElementById('normalizeUvW').checked
        };

        // Ensure preprocessing knows the intended granularity
        options._granularity = granularity;

        if (!text1 && !text2) {
            const visualRepresentation = document.getElementById('visualRepresentation');
            visualRepresentation.innerHTML = '<p class="empty-state-message">Both input fields are empty. Please provide text to compare.</p>';
            document.getElementById('statisticsArea').innerHTML = '<p class="empty-state-message">Statistics will appear here once a comparison is made.</p>';
            return;
        }
        
        // Preprocessing for display diffs is now handled inside generateDiffs for character mode.
        // For word mode, generateDiffs also handles its preprocessing via tokenizeText.
        // const processedText1 = moduleApplyPreprocessing(text1, options, normalizationMaps, DEBUG_MODE); // REMOVED
        // const processedText2 = moduleApplyPreprocessing(text2, options, normalizationMaps, DEBUG_MODE); // REMOVED

        // Generate diffs for display using original text1 and text2.
        // generateDiffs will call applyPreprocessing internally as needed.
        const diffsForDisplay = generateDiffs(dmp, text1, text2, granularity, options, normalizationMaps, DEBUG_MODE);

        let diffsForStatsCalculation;

        if (granularity === GRANULARITY_TYPES.WORD) {
            const optionsForStats = { ...options, includeWhitespace: false };

            // Re-preprocess texts specifically for statistics, ensuring whitespace is handled as if not included for tokenization
            // These calls are specific for word stats and should remain.
            const processedText1ForStats = moduleApplyPreprocessing(text1, optionsForStats, normalizationMaps, DEBUG_MODE);
            const processedText2ForStats = moduleApplyPreprocessing(text2, optionsForStats, normalizationMaps, DEBUG_MODE);

            // Use the specifically processed texts for word stats diff calculation.
            diffsForStatsCalculation = generateDiffs(dmp, processedText1ForStats, processedText2ForStats, granularity, optionsForStats, normalizationMaps, DEBUG_MODE);
            if (DEBUG_MODE) console.log('[performComparison] Diffs for stats calculation (word mode):', JSON.stringify(diffsForStatsCalculation));
        } else {
            // For character granularity, or if not word mode for any reason, the diffs for display are the same as for stats
            diffsForStatsCalculation = diffsForDisplay;
            if (DEBUG_MODE) console.log('[performComparison] Diffs for stats calculation (non-word mode or default):', JSON.stringify(diffsForStatsCalculation));
        }
        
        // Calculate statistics using the appropriate diffs
        // The 'options' param here is still the original user options, as calculateStatistics
        // internally handles options for specific metrics (e.g., using wordOptionsNoWhitespace for TTR etc.)
        const stats = calculateStatistics(text1, text2, diffsForStatsCalculation, granularity, options);
        if (DEBUG_MODE) console.log('[performComparison] Statistics calculated:', JSON.stringify(stats));

        // Store results globally for export functions
        window.text1 = text1; // Store original text1
        window.text2 = text2; // Store original text2
        window.currentDiffs = diffsForDisplay;
        window.currentStats = stats;
        window.currentComparisonSettings = { granularity, options }; // Store granularity and options

        // Display results using diffsForDisplay and the calculated stats
        displayResults(diffsForDisplay, stats, granularity, options);
    };
    // --- End Utility Functions ---

    // --- Helper function for JSON variant notes ---
    const getNormalizationNoteForPair = (text1, text2, opt, currentNormalizationMaps, settingsForGranularity) => {
        // opt here is settings.options from generateStandoffJSON
        if (!opt || !currentNormalizationMaps) return "";

        const detectedChanges = [];

        // Check Ligatures
        if (opt.ignoreLigatures && currentNormalizationMaps.ligatureMap) {
            for (const [form, expansion] of Object.entries(currentNormalizationMaps.ligatureMap)) {
                if ((text1 === form && text2 === expansion)) {
                    detectedChanges.push(`${form} → ${expansion} (ligature)`);
                } else if ((text1 === expansion && text2 === form)) {
                    detectedChanges.push(`${expansion} → ${form} (ligature)`);
                }
            }
        }
        // Check Logograms
        if (opt.ignoreLogograms && currentNormalizationMaps.logogramMap) {
            for (const [form, expansion] of Object.entries(currentNormalizationMaps.logogramMap)) {
                if ((text1 === form && text2 === expansion)) {
                    detectedChanges.push(`${form} → ${expansion} (logogram)`);
                } else if ((text1 === expansion && text2 === form)) {
                    detectedChanges.push(`${expansion} → ${form} (logogram)`);
                }
            }
        }
        // Check Archaic Letters
        if (opt.ignoreArchaicLetters && currentNormalizationMaps.archaicLetterMap) {
            for (const [form, expansion] of Object.entries(currentNormalizationMaps.archaicLetterMap)) {
                if ((text1 === form && text2 === expansion)) {
                    detectedChanges.push(`${form} → ${expansion} (archaic letter)`);
                } else if ((text1 === expansion && text2 === form)) {
                    detectedChanges.push(`${expansion} → ${form} (archaic letter)`);
                }
            }
        }
        // Check U/V/W normalization
        if (opt.normalizeUvW && currentNormalizationMaps.uvwNormalizationMap) {
            for (const [form, expansion] of Object.entries(currentNormalizationMaps.uvwNormalizationMap)) {
                if ((text1 === form && text2 === expansion)) {
                    detectedChanges.push(`${form} → ${expansion} (u/v/w variant)`);
                } else if ((text1 === expansion && text2 === form)) {
                    detectedChanges.push(`${expansion} → ${form} (u/v/w variant)`);
                }
            }
        }
        // Check U/V Swaps (only if normalizeUvW is not active and inputs are single characters)
        // Ensure this check doesn't overlap if normalizeUvW already covered it.
        // normalizeUvW usually maps 'u' to 'v' as part of broader rules (like 'uw' -> 'vw'),
        // so this specific 'u' to 'v' single char swap might still be relevant if ignoreUV is true
        // and normalizeUvW didn't make an identical note.
        // To avoid duplicate notes if normalizeUvW implies a u/v swap that's also caught here,
        // we might need more complex logic or rely on distinctness of note strings.
        // For now, assume they generate different enough notes or that specific normalizeUvW maps are distinct from plain u/v.
        if (opt.ignoreUV && !opt.normalizeUvW && text1.length === 1 && text2.length === 1) {
            const t1Lower = text1.toLowerCase();
            const t2Lower = text2.toLowerCase();
            if (t1Lower === 'u' && t2Lower === 'v') {
                detectedChanges.push(`u → v (u/v swap)`);
            } else if (t1Lower === 'v' && t2Lower === 'u') {
                detectedChanges.push(`v → u (u/v swap)`);
            }
        }
        // Check I/J Swaps (only if inputs are single characters)
        if (opt.ignoreIJ && text1.length === 1 && text2.length === 1) {
            const t1Lower = text1.toLowerCase();
            const t2Lower = text2.toLowerCase();
            if (t1Lower === 'i' && t2Lower === 'j') {
                detectedChanges.push(`i → j (i/j swap)`);
            } else if (t1Lower === 'j' && t2Lower === 'i') {
                detectedChanges.push(`j → i (i/j swap)`);
            }
        }
        
        // Whitespace note for character granularity
        const granularityForNote = settingsForGranularity.granularity || GRANULARITY_TYPES.WORD; 
        if (!opt.includeWhitespace && granularityForNote === GRANULARITY_TYPES.CHARACTER) {
            if (text1.match(/^\\s+$/) && text2.length === 0) {
                detectedChanges.push("Whitespace removed (character view)");
            } else if (text2.match(/^\\s+$/) && text1.length === 0) {
                detectedChanges.push("Whitespace added (character view)");
            }
        }

        if (detectedChanges.length === 0) {
            return "";
        } else if (detectedChanges.length === 1) {
            return `Normalization: ${detectedChanges[0]}`;
        } else {
            // Remove duplicate descriptions before joining, in case some rules are broad
            const uniqueChanges = [...new Set(detectedChanges)];
            return `Compound Normalization: ${uniqueChanges.join('; ')}`;
        }
    };

    // --- Helper functions for OCR CM Generation (Phase 1) ---
    function deriveGlyphsListFromRawMatrix(rawMatrix, deleteToken, insertToken) {
        const glyphSet = new Set();
        if (!rawMatrix) return [];

        Object.keys(rawMatrix).forEach(trueChar => {
            glyphSet.add(trueChar);
            if (rawMatrix[trueChar]) {
                Object.keys(rawMatrix[trueChar]).forEach(observedChar => {
                    glyphSet.add(observedChar);
                });
            }
        });

        // Ensure special tokens are in the set if they were used, even if not explicitly in matrix keys
        // (buildConfusionMatrixFromVariants uses them as keys directly)
        // No, buildConfusionMatrixFromVariants uses them as values for true chars or keys for insertToken.
        // So if they are part of the matrix, they will be added above.

        const glyphsArray = Array.from(glyphSet);
        
        // Custom sort: alphanumeric, but [DEL] and [INS] tokens at the very end.
        glyphsArray.sort((a, b) => {
            const isADel = a === deleteToken;
            const isBDel = b === deleteToken;
            const isAIns = a === insertToken;
            const isBIns = b === insertToken;

            if (isADel && !isBDel) return 1; // a ([DEL]) comes after b
            if (!isADel && isBDel) return -1; // b ([DEL]) comes after a
            if (isAIns && !isBIns) return 1; // a ([INS]) comes after b
            if (!isAIns && isBIns) return -1; // b ([INS]) comes after a
            
            if ((isADel && isBIns)) return -1; // [DEL] before [INS]
            if ((isAIns && isBDel)) return 1;  // [INS] after [DEL]

            return a.localeCompare(b);
        });

        return glyphsArray;
    }

    function convertRawMatrixToFullArray(rawMatrix, glyphsList) {
        if (!rawMatrix || !glyphsList || glyphsList.length === 0) return [];

        const numGlyphs = glyphsList.length;
        const fullMatrix = Array(numGlyphs).fill(null).map(() => Array(numGlyphs).fill(0));
        const glyphIndexMap = new Map(glyphsList.map((g, i) => [g, i]));

        for (const trueChar in rawMatrix) {
            if (glyphIndexMap.has(trueChar)) {
                const rowIndex = glyphIndexMap.get(trueChar);
                const observedMap = rawMatrix[trueChar];
                for (const observedChar in observedMap) {
                    if (glyphIndexMap.has(observedChar)) {
                        const colIndex = glyphIndexMap.get(observedChar);
                        fullMatrix[rowIndex][colIndex] = observedMap[observedChar];
                    }
                }
            }
        }
        return fullMatrix;
    }
    // --- End Helper functions for OCR CM Generation ---

    // NEW FUNCTION to build a complete confusion matrix from DMP diffs
    function _buildFullConfusionMatrixFromDmpDiffs(dmpDiffs, errDelToken, errInsToken) {
        const rawMatrix = {}; // Format: {'true_char': {'observed_char': count}}

        if (!dmpDiffs) return rawMatrix;

        for (let i = 0; i < dmpDiffs.length; i++) {
            const op = dmpDiffs[i][0];
            const text = dmpDiffs[i][1];

            if (op === 0) { // DIFF_EQUAL
                for (const char of text) {
                    if (!rawMatrix[char]) rawMatrix[char] = {};
                    rawMatrix[char][char] = (rawMatrix[char][char] || 0) + 1;
                }
            } else if (op === -1) { // DIFF_DELETE
                const delText = text;
                if (i + 1 < dmpDiffs.length && dmpDiffs[i+1][0] === 1) { // Substitution
                    const insText = dmpDiffs[i+1][1];
                    const lenDel = delText.length;
                    const lenIns = insText.length;
                    const minLen = Math.min(lenDel, lenIns);

                    for (let j = 0; j < minLen; j++) {
                        const trueChar = delText[j];
                        const obsChar = insText[j];
                        if (!rawMatrix[trueChar]) rawMatrix[trueChar] = {};
                        rawMatrix[trueChar][obsChar] = (rawMatrix[trueChar][obsChar] || 0) + 1;
                    }
                    // If deletion is longer than insertion part of substitution
                    if (lenDel > minLen) {
                        for (let j = minLen; j < lenDel; j++) {
                            const trueChar = delText[j];
                            if (!rawMatrix[trueChar]) rawMatrix[trueChar] = {};
                            rawMatrix[trueChar][errDelToken] = (rawMatrix[trueChar][errDelToken] || 0) + 1;
                        }
                    }
                    // If insertion is longer than deletion part of substitution
                    else if (lenIns > minLen) {
                        for (let j = minLen; j < lenIns; j++) {
                            const obsChar = insText[j];
                            if (!rawMatrix[errInsToken]) rawMatrix[errInsToken] = {};
                            rawMatrix[errInsToken][obsChar] = (rawMatrix[errInsToken][obsChar] || 0) + 1;
                        }
                    }
                    i++; // Consume the insertion part of the substitution
                } else { // Pure Deletion
                    for (const char of delText) {
                        if (!rawMatrix[char]) rawMatrix[char] = {};
                        rawMatrix[char][errDelToken] = (rawMatrix[char][errDelToken] || 0) + 1;
                    }
                }
            } else if (op === 1) { // DIFF_INSERT (should only be pure if not consumed by substitution logic)
                for (const char of text) {
                    if (!rawMatrix[errInsToken]) rawMatrix[errInsToken] = {};
                    rawMatrix[errInsToken][char] = (rawMatrix[errInsToken][char] || 0) + 1;
                }
            }
        }
        return rawMatrix;
    }

    // The original DOMContentLoaded listener is higher up, around line 2350.
    // This second one is redundant and should be removed.
})();