// Regexes and Constants that rarely change
export const punctuationRegex = /[\.,\/#!?$%\\^&\*;:{}=\-_`~()'\"\[\]<>|\\¡¿†‡…–—]/g;

export const CHANGE_TYPES = {
    EQUAL: 0, 
    DELETION: -1, 
    INSERTION: 1, 
    SUBSTITUTION: 2, 
    WORD_DELETION: 3,
    WORD_INSERTION: 4,
    WORD_SUBSTITUTION_FULL: 5, // Both del and ins part of a word sub
    SUB_WORD: 6, // A sub-token within a larger word-level substitution
    DEL_WORD_FINAL: 7, // Final deletion part of a word operation
    INS_WORD_FINAL: 8, // Final insertion part of a word operation
    EQ_FINAL: 9,       // Final equal part of an operation
    DEL_CHAR_FINAL: 10, // Final deletion part of a char operation
    INS_CHAR_FINAL: 11, // Final insertion part of a char operation
    SUB_CHAR: 12, // Character substitution (del + ins character)
    // For refineDiffs input mapping
    WORD_DELETION_INPUT: 101,
    WORD_INSERTION_INPUT: 102,
    DELETION_INPUT: 103,
    INSERTION_INPUT: 104,
    EQUAL_INPUT: 105
};

export const GRANULARITY_TYPES = {
    WORD: 'word',
    CHARACTER: 'character'
};

export const INPUT_FORMAT_TYPES = {
    DMP: 'dmp',
    CUSTOM: 'custom'
};

export const THEME_TYPES = {
    LIGHT: 'light',
    DARK: 'dark',
    SYSTEM: 'system'
};

export const EXPORT_FORMAT_TYPES = {
    JSON: 'json',
    XML: 'xml',
};

export const ESCAPE_TYPES = {
    HTML: 'html',
    XML: 'xml'
};

export const NAMED_ENTITY_TYPES = {
    PEOPLE: 'people',
    PLACES: 'places',
    ORGANIZATIONS: 'organizations'
};

export const POS_PRIORITY_TAGS = [
    'Noun', 'SingularNoun', 'PluralNoun',
    'Verb', 'GerundVerb', 'PastTenseVerb', 'PastParticipleVerb',
    'Adjective', 'Adverb',
    'Conjunction', 'Preposition', 'Determiner',
    'Pronoun', 'PossessivePronoun',
    'Value', 'Date', 'Acronym', 'Abbreviation', 'Expression'
];

export const UNKNOWN_POS_TAG = 'Unknown';

// --- Normalization Maps ---
export const LOGOGRAM_MAP = {
    '&': 'and',
    // Early Modern Print Abbreviations & Symbols
    '\u204A': 'et',    // TIRONIAN SIGN ET (⁊) - Represents Latin 'et'
    '\uA751': 'per',   // LATIN SMALL LETTER P WITH STROKE THROUGH DESCENDER (ꝑ)
    '\uA753': 'pro',   // LATIN SMALL LETTER P WITH FLOURISH (ꝓ) - Common for 'pro'
    '\uA757': 'que',   // LATIN SMALL LETTER Q WITH STROKE THROUGH DESCENDER (ꝗ)
    '\uA76F': 'con',   // LATIN SMALL LETTER CON (ꝯ) – Often appears as a '9' shape
    // Optional uppercase variants for consideration if found in texts:
    // (Ensure expansion to 'PER' or 'per' etc. matches desired normalization strategy)
    // '\uA750': 'PER',  // LATIN CAPITAL LETTER P WITH STROKE THROUGH DESCENDER (Ꝑ)
    // '\uA752': 'PRO',  // LATIN CAPITAL LETTER P WITH FLOURISH (Ꝓ)
    // '\uA756': 'QUE',  // LATIN CAPITAL LETTER Q WITH STROKE THROUGH DESCENDER (Ꝗ)
    // '\uA76E': 'CON',  // LATIN CAPITAL LETTER CON (Ꝯ)
    // Superscript abbreviations are more complex due to encoding variations.
    // Kept for future consideration if a consistent representation is identified in input texts.
    // 'yͤ': 'the',   // y with superscript e (e.g., y + U+0364 COMBINING LATIN SMALL LETTER E)
    // 'yͭ': 'that',  // y with superscript t (e.g., y + U+036D COMBINING LATIN SMALL LETTER T)
    // 'wͨ': 'which'  // w with superscript c (e.g., w + U+0368 COMBINING LATIN SMALL LETTER C)
};

export const LIGATURE_MAP = {
    '\u00C6': 'AE', // Æ
    '\u00E6': 'ae', // æ
    '\u0152': 'OE', // Œ
    '\u0153': 'oe', // œ
    '\u0132': 'IJ', // Ĳ
    '\u0133': 'ij', // ĳ
    '\uFB00': 'ff', // ﬀ
    '\uFB01': 'fi', // ﬁ
    '\uFB02': 'fl', // ﬂ
    '\uFB03': 'ffi', // ﬃ
    '\uFB04': 'ffl', // ﬄ
    '\uFB05': 'st', // ﬅ (long s + t)
    '\uFB06': 'st'  // ﬆ (s + t)
};

export const ARCHAIC_LETTER_MAP = {
    '\u017F': 's', // ſ (long s)
    '\uA75B': 'r'  // ꝛ (r rotunda)
};

export const UVW_NORMALIZATION_MAP = {
    'uu': 'w',
    'UU': 'W',
    'Uu': 'W',
    'uU': 'W',
    'vv': 'w',
    'VV': 'W',
    'Vv': 'W',
    'vV': 'W'
};

// Combine all special chars/ligatures for tallying
export const ALL_VARIANT_FORMS = {
    ...LOGOGRAM_MAP,
    ...LIGATURE_MAP,
    ...ARCHAIC_LETTER_MAP,
    ...UVW_NORMALIZATION_MAP
};
// --- End Normalization Maps ---
