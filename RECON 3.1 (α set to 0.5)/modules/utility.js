import { ESCAPE_TYPES, punctuationRegex, NAMED_ENTITY_TYPES } from '../constants.js';

// Utility Functions

export const escapeCharacters = (text, type = ESCAPE_TYPES.XML) => {
    const replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    if (type === ESCAPE_TYPES.XML || type === ESCAPE_TYPES.HTML) {
        return text.replace(/[&<>\\"']/g, match => replacements[match]);
    }
    return text;
};

export const tokenizeWordsForMetrics = (text) => {
    return text
        .split(/\s+/)
        .map(w => w.trim())
        .filter(w => w.length > 0);
};

export const isNlpAvailable = () => typeof nlp !== 'undefined';

export const memoize = (fn) => {
    const cache = new Map();
    return (...args) => {
        const key = JSON.stringify(args);
        if (cache.has(key)) return cache.get(key);
        const result = fn(...args);
        cache.set(key, result);
        return result;
    };
};

export const tallyEntities = (array) => {
    const freq = {};
    for (const e of array) {
        const entity = e.trim();
        freq[entity] = (freq[entity] || 0) + 1;
    }
    return freq;
};

export const countCapitalizations = (text) => {
    const capitalLetters = text.match(/[A-Z]/g);
    return capitalLetters ? capitalLetters.length : 0;
};

export const countCharacters = (text) => {
    return text.split('').reduce((acc, char) => {
        acc[char] = (acc[char] || 0) + 1;
        return acc;
    }, {});
};

export const formatCharacterCounts = (charCounts) => {
    return Object.entries(charCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([char, count]) => `${escapeCharacters(char, ESCAPE_TYPES.HTML)} = ${count}`)
        .join(' | ');
};

export const formatCapitalizationTally = (capsObj) => {
    if (!capsObj || Object.keys(capsObj).length === 0) return 'N/A';
    const sortedCaps = Object.entries(capsObj)
        .sort((a, b) => b[1] - a[1]);
    return sortedCaps.map(([char, count]) => `${escapeCharacters(char, ESCAPE_TYPES.HTML)} = ${count}`).join(' | ');
};

export const countPunctuation = (text) => {
    const punctuationMarks = text.match(punctuationRegex);
    const totalPunctuation = punctuationMarks ? punctuationMarks.length : 0;
    const punctuationBreakdown = punctuationMarks
        ? punctuationMarks.reduce((acc, mark) => {
              acc[mark] = (acc[mark] || 0) + 1;
              return acc;
          }, {})
        : {};
    return { total: totalPunctuation, breakdown: punctuationBreakdown };
};

export const formatPunctuationBreakdown = (punctuationBreakdown) => {
    return Object.entries(punctuationBreakdown)
        .sort((a, b) => b[1] - a[1])
        .map(([mark, count]) => `${escapeCharacters(mark, ESCAPE_TYPES.HTML)} = ${count}`)
        .join(' | ');
};

export const formatPOSDistribution = (posObj) => {
    if (!posObj || Object.keys(posObj).length === 0) return 'No POS data available';
    return Object.entries(posObj)
        .filter(([_, count]) => count > 0)
        .map(([tag, count]) => `${tag}: ${count}`)
        .join(' | ');
};

export const formatWordLengthDistribution = (distribution) => !distribution ? 'N/A' : Object.entries(distribution)
    .map(([length, count]) => `Length ${length}: ${count}`)
    .join(' | ');

export const formatNamedEntities = (entities) => {
    if (!entities || typeof entities !== 'object') return 'N/A';

    const formatEntityGroup = (freqObj, label) => {
        const entries = Object.entries(freqObj);
        if (entries.length === 0) return `${label}: None`;
        return `${label}: ` + entries
            .sort((a, b) => b[1] - a[1])
            .map(([entity, count]) => `${entity} (${count}×)`)
            .join(', ');
    };

    return [
        formatEntityGroup(entities[NAMED_ENTITY_TYPES.PEOPLE], NAMED_ENTITY_TYPES.PEOPLE.charAt(0).toUpperCase() + NAMED_ENTITY_TYPES.PEOPLE.slice(1)),
        formatEntityGroup(entities[NAMED_ENTITY_TYPES.PLACES], NAMED_ENTITY_TYPES.PLACES.charAt(0).toUpperCase() + NAMED_ENTITY_TYPES.PLACES.slice(1)),
        formatEntityGroup(entities[NAMED_ENTITY_TYPES.ORGANIZATIONS], NAMED_ENTITY_TYPES.ORGANIZATIONS.charAt(0).toUpperCase() + NAMED_ENTITY_TYPES.ORGANIZATIONS.slice(1))
    ].join(' | ');
};

export const formatTallyObject = (tally) => {
    if (!tally || Object.keys(tally).length === 0) return 'None';
    return Object.entries(tally)
        .map(([key, value]) => `${escapeCharacters(key, ESCAPE_TYPES.HTML)}: ${value}`)
        .sort()
        .join(' | ');
};

export const formatWordFrequency = (freqObj) => {
    if (!freqObj) return 'N/A';
    return Object.entries(freqObj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, count]) => `${escapeCharacters(word, ESCAPE_TYPES.HTML)}: ${count}`)
        .join(' | ');
};

export const formatCharacterCaseChanges = (detailsObject) => {
    if (!detailsObject || typeof detailsObject !== 'object' || Object.keys(detailsObject).length === 0) return 'None';

    const parts = Object.entries(detailsObject)
        .map(([change, count]) => `${escapeCharacters(change, ESCAPE_TYPES.HTML)}: ${count}`)
        .sort(); // Sort for consistent display
    return parts.join(' | ');
};

export const visualizeWhitespace = (textForIntraLineOnly, isChangedSegment = false) => {
    if (!textForIntraLineOnly) return '';
    let processed = textForIntraLineOnly;

    if (isChangedSegment) {
        processed = processed.replace(/ /g, '␠');        // Space (using ␠) - ONLY if changed
    }
    // Always visualize these other special whitespace characters if they appear
    processed = processed
        .replace(/\t/g, '⇥')       // Tab (using rightwards arrow to bar)
        .replace(/\r/g, '')        // Carriage return (remove)
        .replace(/\f/g, '↡')       // Form feed
        .replace(/\v/g, '↕');      // Vertical tab
    
    return processed;
}; 