import { CHANGE_TYPES, punctuationRegex, GRANULARITY_TYPES, INPUT_FORMAT_TYPES } from '../constants.js';

// Note: dmp instance, and normalization maps (logogramMap, etc.) will be passed into relevant functions.

const applyPreprocessing = (text, options, normalizationMaps, debugMode) => {
    let processedText = text;

    const { logogramMap, ligatureMap, archaicLetterMap, uvwNormalizationMap } = normalizationMaps;

    if (options.ignoreLogograms && logogramMap) {
        for (const [logogram, expansion] of Object.entries(logogramMap)) {
            processedText = processedText.replace(new RegExp(logogram.replace(/[.*+?^${}()|[\\\]]/g, '\\$&'), 'g'), expansion);
        }
    }
    if (options.ignoreLigatures && ligatureMap) {
        for (const [ligature, expansion] of Object.entries(ligatureMap)) {
            processedText = processedText.replace(new RegExp(ligature.replace(/[.*+?^${}()|[\\\]]/g, '\\$&'), 'g'), expansion);
        }
    }
    if (options.ignoreArchaicLetters && archaicLetterMap) {
        for (const [archaic, modern] of Object.entries(archaicLetterMap)) {
            processedText = processedText.replace(new RegExp(archaic.replace(/[.*+?^${}()|[\\\]]/g, '\\$&'), 'g'), modern);
        }
    }

    // Handle uu/vv to w normalization - Use normalizeUvW from script.js options
    if (options.normalizeUvW && uvwNormalizationMap) {
        for (const [variant, normalized] of Object.entries(uvwNormalizationMap)) {
            processedText = processedText.replace(new RegExp(variant.replace(/[.*+?^${}()|[\\\]]/g, '\\$&'), 'g'), normalized);
        }
    }

    // Handle u/v normalization based on its specific toggle
    if (options.ignoreUV) {
        processedText = processedText.replace(/u/g, 'v');
        processedText = processedText.replace(/U/g, 'V');
    }

    // Handle i/j normalization based on its specific toggle
    if (options.ignoreIJ) {
        processedText = processedText.replace(/j/g, 'i');
        processedText = processedText.replace(/J/g, 'I');
    }

    // Use !options.includeCapitalization for case handling
    if (!options.includeCapitalization) {
        processedText = processedText.toLowerCase();
    }
    // Use !options.includePunctuation for punctuation handling
    if (!options.includePunctuation) {
        processedText = processedText.replace(punctuationRegex, '');
    }

    // Whitespace normalization logic - needs to be conditional based on includeWhitespace for word diffs
    // Only remove all whitespace if granularity is CHARACTER and includeWhitespace is false
    if (options.normalizeWhitespace) { // This option is separate from includeWhitespace for tokenization purposes
        processedText = processedText.replace(/\s+/g, ' ').trim();
    } else if (options.includeWhitespace) {
        // If including whitespace for tokenization, just remove CR like the old script did in this scenario.
        processedText = processedText.replace(/\r/g, ''); 
    } else if (options._granularity === GRANULARITY_TYPES.CHARACTER) {
        // Only remove all whitespace in character mode with whitespace off
        processedText = processedText.replace(/\s+/g, '');
    }

    return processedText;
};

const tokenizeText = (text, granularity, options, normalizationMaps, debugMode) => {
    const processedText = applyPreprocessing(text, options, normalizationMaps, debugMode);
    if (granularity === GRANULARITY_TYPES.WORD) {
        let tokens;
        if (options.includeWhitespace) {
            // Capture newlines as separate tokens, sequences of other whitespace, and non-whitespace words
            tokens = processedText.match(/\n|\S+|\s+/g) || [];
        } else {
            // When not including whitespace, split by any whitespace and filter out empty strings
            tokens = processedText.split(/\s+/).filter(token => token.length > 0);
        }
        return tokens;
    } else if (granularity === GRANULARITY_TYPES.CHARACTER) {
        const chars = processedText.split('');
        return chars;
    }
    return [processedText]; // Fallback for unknown granularity
};

const refineDiffs = (inputDiffs, inputFormat, granularity, changeTypes, debugMode) => {
    let normalizedDiffs = [];
    if (inputFormat === INPUT_FORMAT_TYPES.DMP) {
        inputDiffs.forEach(([op, text]) => {
            if (op === 0) normalizedDiffs.push([changeTypes.EQ_FINAL, text]); // Use specific EQ_FINAL for DMP direct output
            else if (op === -1) normalizedDiffs.push([changeTypes.DEL_CHAR_FINAL, text]);
            else if (op === 1) normalizedDiffs.push([changeTypes.INS_CHAR_FINAL, text]);
        });
    } else {
        normalizedDiffs = [...inputDiffs]; // Assume it's already in [type, text1, text2?] format
    }

    const result = [];
    let i = 0;
    while (i < normalizedDiffs.length) {
        const currentOp = normalizedDiffs[i][0];
        const currentText = normalizedDiffs[i][1];

        if (granularity === GRANULARITY_TYPES.WORD) {
            if (currentOp === changeTypes.WORD_DELETION_INPUT && i + 1 < normalizedDiffs.length && normalizedDiffs[i+1][0] === changeTypes.WORD_INSERTION_INPUT) {
                result.push([changeTypes.WORD_SUBSTITUTION_FULL, currentText, normalizedDiffs[i+1][1]]);
                i += 2;
            } else if (currentOp === changeTypes.WORD_DELETION_INPUT) {
                result.push([changeTypes.WORD_DELETION, currentText]);
                i++;
            } else if (currentOp === changeTypes.WORD_INSERTION_INPUT) {
                result.push([changeTypes.WORD_INSERTION, currentText]);
                i++;
            } else if (currentOp === changeTypes.EQUAL_INPUT) {
                result.push([changeTypes.EQUAL, currentText]);
                i++;
            } else {
                result.push(normalizedDiffs[i]); // Pass through if already in final format
                i++;
            }
        } else if (granularity === GRANULARITY_TYPES.CHARACTER) {
             // For characters, DMP output is DEL_CHAR_FINAL, INS_CHAR_FINAL, EQ_FINAL
            if (currentOp === changeTypes.DEL_CHAR_FINAL && i + 1 < normalizedDiffs.length && normalizedDiffs[i+1][0] === changeTypes.INS_CHAR_FINAL) {
                result.push([changeTypes.SUB_CHAR, currentText, normalizedDiffs[i+1][1]]);
                i += 2;
            } else {
                result.push(normalizedDiffs[i]); // This will be [DEL_CHAR_FINAL, text], [INS_CHAR_FINAL, text], or [EQ_FINAL, text]
                i++;
            }
        }
    }
    return result;
};

const generateNormalizedDiff = (dmp, text1, text2, options, normalizationMaps, debugMode) => {
    if (debugMode) console.log('[generateNormalizedDiff] Text1:', JSON.stringify(text1));
    if (debugMode) console.log('[generateNormalizedDiff] Text2:', JSON.stringify(text2));
    if (debugMode) console.log('[generateNormalizedDiff] Options:', JSON.stringify(options));

    // Preprocessing is effectively done by tokenizeText, which calls applyPreprocessing.
    const tokens1 = tokenizeText(text1, GRANULARITY_TYPES.WORD, options, normalizationMaps, debugMode);
    const tokens2 = tokenizeText(text2, GRANULARITY_TYPES.WORD, options, normalizationMaps, debugMode);
    if (debugMode) console.log('[generateNormalizedDiff] tokens1:', JSON.stringify(tokens1));
    if (debugMode) console.log('[generateNormalizedDiff] tokens2:', JSON.stringify(tokens2));

    // --- Start diff_linesToChars_ logic ---
    const NEWLINE_PLACEHOLDER = '%%RECON_NEWLINE_TOKEN%%'; // Unique placeholder

    const textToChars1 = tokens1.map(t => t === '\n' ? NEWLINE_PLACEHOLDER : t).join('\n');
    const textToChars2 = tokens2.map(t => t === '\n' ? NEWLINE_PLACEHOLDER : t).join('\n');

    const tokenData = dmp.diff_linesToChars_(textToChars1, textToChars2);
    const chars1 = tokenData.chars1;
    const chars2 = tokenData.chars2;
    const lineArray = tokenData.lineArray; // This maps chars back to words

    if (debugMode) {
        console.log('[generateNormalizedDiff] textToChars1 (for linesToChars):', JSON.stringify(textToChars1));
        console.log('[generateNormalizedDiff] textToChars2 (for linesToChars):', JSON.stringify(textToChars2));
        console.log('[generateNormalizedDiff] chars1 (linesToChars output):', JSON.stringify(chars1));
        console.log('[generateNormalizedDiff] chars2 (linesToChars output):', JSON.stringify(chars2));
        console.log('[generateNormalizedDiff] lineArray (linesToChars output):', JSON.stringify(lineArray));
    }

    const dmpDiffsRaw = dmp.diff_main(chars1, chars2, false); // Diff the character-encoded strings
    // Consider applying cleanupSemantic AFTER converting back to words if issues persist, or on the char diffs if appropriate.
    // dmp.diff_cleanupSemantic(dmpDiffsRaw); // Let's test without it first for linesToChars

    // Convert diffs from char codes back to words
    const dmpDiffsNormalized = [];
    dmpDiffsRaw.forEach(([op, textOfChars]) => {
        for (let i = 0; i < textOfChars.length; i++) {
            const charCode = textOfChars.charCodeAt(i);
            const tokenFromLineArray = lineArray[charCode];

            if (typeof tokenFromLineArray === 'undefined') {
                if (debugMode) console.warn(`[generateNormalizedDiff] Undefined word for charCode ${charCode}. Skipping.`);
                continue;
            }
            // Skip the conventional empty string at lineArray[0] that diff_linesToChars_ might add.
            if (tokenFromLineArray === '' && charCode === 0 && lineArray.length > 0 && lineArray[0] === '') {
                if (debugMode) console.log('[generateNormalizedDiff] Skipping conventional empty string at lineArray[0]');
                continue;
            }

            let finalTokenToPush;
            if (tokenFromLineArray === NEWLINE_PLACEHOLDER) {
                finalTokenToPush = '\n';
            } else {
                // Remove trailing newline that dmp.diff_linesToChars_ might add to non-placeholder lines
                finalTokenToPush = tokenFromLineArray ? tokenFromLineArray.replace(/\n$/, '') : tokenFromLineArray;
            }

            if (op === 0) dmpDiffsNormalized.push([CHANGE_TYPES.EQUAL_INPUT, finalTokenToPush]);
            else if (op === -1) dmpDiffsNormalized.push([CHANGE_TYPES.WORD_DELETION_INPUT, finalTokenToPush]);
            else if (op === 1) dmpDiffsNormalized.push([CHANGE_TYPES.WORD_INSERTION_INPUT, finalTokenToPush]);
        }
    });
    if (debugMode) console.log('[generateNormalizedDiff] dmpDiffsNormalized (from linesToChars_ back to words):', JSON.stringify(dmpDiffsNormalized));
    // --- End diff_linesToChars_ logic ---

    const wordChangeTypes = {
        WORD_DELETION_INPUT: CHANGE_TYPES.WORD_DELETION_INPUT,
        WORD_INSERTION_INPUT: CHANGE_TYPES.WORD_INSERTION_INPUT,
        EQUAL_INPUT: CHANGE_TYPES.EQUAL_INPUT,
        WORD_DELETION: CHANGE_TYPES.WORD_DELETION,
        WORD_INSERTION: CHANGE_TYPES.WORD_INSERTION,
        WORD_SUBSTITUTION_FULL: CHANGE_TYPES.WORD_SUBSTITUTION_FULL,
        EQUAL: CHANGE_TYPES.EQUAL
    };

    const resultDiffs = refineDiffs(dmpDiffsNormalized, INPUT_FORMAT_TYPES.CUSTOM, GRANULARITY_TYPES.WORD, wordChangeTypes, debugMode);
    // Post-refine cleanup can be an option too, e.g., dmp.diff_cleanupSemantic on the resultDiffs if they were converted to DMP format.
    if (debugMode) console.log('[generateNormalizedDiff] resultDiffs (after refineDiffs):', JSON.stringify(resultDiffs));
    return resultDiffs;
};

// Helper function, not exported
const removePureWhitespaceTokens = (diffs, granularity, options) => {
    if (granularity === GRANULARITY_TYPES.WORD && !options.includeWhitespace) {
        return diffs.map(diff => {
            const [type, text, insertedText] = diff;
            const cleanedText = text ? text.trim() : '';
            const cleanedInsertedText = insertedText ? insertedText.trim() : '';
            if (
                (type === CHANGE_TYPES.WORD_DELETION ||
                 type === CHANGE_TYPES.WORD_INSERTION ||
                 type === CHANGE_TYPES.WORD_SUBSTITUTION_FULL)
                && cleanedText === '' && cleanedInsertedText === ''
            ) {
                return null; // Indicate removal
            }
            return diff; // Keep the original diff
        }).filter(diff => diff !== null); // Filter out the nulls
    }
    return diffs; // Return original diffs if not word granularity or if including whitespace
};

export const generateDiffs = (dmp, text1, text2, granularity, options, normalizationMaps, debugMode) => {
    let diffs;
    try {
        if (granularity === GRANULARITY_TYPES.WORD) {
            diffs = generateNormalizedDiff(dmp, text1, text2, options, normalizationMaps, debugMode);
        } else if (granularity === GRANULARITY_TYPES.CHARACTER) {
            const processedText1 = applyPreprocessing(text1, options, normalizationMaps, debugMode);
            const processedText2 = applyPreprocessing(text2, options, normalizationMaps, debugMode);

            const charDiffsRaw = dmp.diff_main(processedText1, processedText2, false);
            dmp.diff_cleanupSemantic(charDiffsRaw);

            // Define the change types specific to character diffs
            const charChangeTypes = {
                EQ_FINAL: CHANGE_TYPES.EQ_FINAL,
                DEL_CHAR_FINAL: CHANGE_TYPES.DEL_CHAR_FINAL,
                INS_CHAR_FINAL: CHANGE_TYPES.INS_CHAR_FINAL,
                SUB_CHAR: CHANGE_TYPES.SUB_CHAR
            };
            // Assign the result of refineDiffs to the `diffs` variable
            diffs = refineDiffs(charDiffsRaw, INPUT_FORMAT_TYPES.DMP, granularity, charChangeTypes, debugMode);
        }
        diffs = removePureWhitespaceTokens(diffs, granularity, options);
        return diffs;
    } catch (error) {
        console.error("[generateDiffs] Error during diff generation:", error);
        return []; 
    }
};

export { applyPreprocessing, tokenizeText }; // Export specific functions needed by other modules 