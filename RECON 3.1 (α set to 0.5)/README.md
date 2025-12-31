# RECON (Reading Contrasting) tool

## Overview

RECON is a fully client-side tool designed for meticulous text comparison and the analysis of informational variation between textual information objects. Initially developed for studying early modern reprints, its versatile capabilities make it suitable for any texts where detailed orthographic, typographic, and broader content variations are of interest. It leverages the power of `diff-match-patch` to capture differences at both character and word levels, providing a framework for measuring informational drift and transformation.

RECON provides a comprehensive suite of features for textual analysis and information tracking:

*   **Dual Granularity Comparison:** Analyze texts at the **character level** (for precise error detection, like OCR mistakes) or **word level** (for broader content changes).
*   **Rich Variant Analysis:** Automatically identifies and tallies various textual phenomena, including:
    *   Ligatures (e.g., "æ" vs. "ae")
    *   Logograms (e.g., "&" vs. "and")
    *   Archaic letter forms (e.g., "ſ" vs. "s")
    *   U/V and I/J character variations
    *   Normalization of "uu"/"vv" to "w" (and vice-versa)
*   **Interactive Visualization:** Presents comparison results with clear inline HTML markup, highlighting deletions, insertions, and substitutions.
*   **Multiple Export Formats:**
    *   **Standoff JSON:** A detailed, machine-readable manifest of all variants with their types and offsets.
    *   **XML:** A TEI-inspired XML representation of the comparison, suitable for digital humanities workflows.
*   **Comprehensive Statistics:** Calculates a wide array of metrics:
    *   Character Error Rate (CER) & Word Error Rate (WER)
    *   Levenshtein Distance & Normalized Edit Distance
    *   Jaccard Similarity & Cosine Similarity
    *   Type-Token Ratio (TTR) & Lexical Density
    *   Punctuation, capitalization, and character counts
    *   Word length and word frequency distributions
    *   Part-of-Speech (POS) tagging and Named Entity Recognition (NER) distributions (requires internet access for the Compromise.js library).
*   **Configurable & Persistent Settings:**
    *   Fine-tune comparison behavior (e.g., include/ignore whitespace, punctuation, capitalization, specific normalizations).
    *   Adjust underlying `diff-match-patch` parameters.
    *   Save preferred settings to browser `localStorage` for future sessions, with an option to reset to defaults.
*   **Modern & Maintainable:** The codebase features a modular design using ES6 modules, enhancing clarity, maintainability, and extensibility.

RECON is intended as a research tool to facilitate in-depth textual scholarship and the quantitative analysis of textual change.

## Setup and Usage

## Setup and Usage

### For End-Users

RECON is designed for ease of use. For the most methodologically sound results, especially with historical or OCR-derived texts, we recommend preparing your files first.

1.  **(Recommended) Prepare Your Texts:** Before comparison, it is recommended to normalize your input files using the included **RECON-Prep** utility, located in the `/recon-prep/` sub-directory. This tool standardizes various Unicode whitespace characters that can be artifacts of digitization, ensuring that RECON's analysis focuses on substantive textual differences. Open `recon-prep/normalizer.html` to use this utility.
2.  **Download/Obtain Files:** Ensure you have all the project files, particularly `recon.html` and the `dist` directory.
3.  **Open RECON in Browser:** Simply open the main `recon.html` file in a modern web browser (e.g., Chrome, Firefox, Safari, Edge).
4.  **Enable JavaScript:** JavaScript must be enabled in your browser (it is by default in most browsers).
5.  **Internet Connection (for full NLP features):** For Part-of-Speech (POS) tagging and Named Entity Recognition (NER) statistics, an active internet connection is needed on first load to fetch the `Compromise.js` natural language processing library from its content delivery network (CDN). If offline, these specific metrics will be unavailable, but core comparison features should still function.

### For Developers & Contributors

If you wish to modify the RECON codebase or build it from its source files:

1.  **Prerequisites:**
    *   Node.js, an open-source, cross-platform Javascript runtime environment installed on your system (https://nodejs.org/en/download/). Node.js includes the node package manager (npm).
2.  **Clone the Repository:**
    ```bash
    git clone your-repository-url-here
    cd recon
    ```
    (Replace `your-repository-url-here` with the actual URL of the Git repository if applicable.)
3.  **Install Dependencies:**
    ```bash
    npm install
    ```
    This will download development dependencies, primarily `esbuild` for bundling.
4.  **Build the Project:**
    ```bash
    npm run build
    ```
    This command bundles `script.js` and its associated modules from the `modules/` directory into a single file: `dist/recon.bundle.js`. The `recon.html` file is configured to load this bundle.
5.  **Development Watch Mode:**
    ```bash
    npm run dev
    ```
    This command will watch for changes in `script.js` and its modules, automatically rebuilding the bundle whenever a file is saved. This is useful for live-reloading in the browser during development.

--- 

## Functionalities Detailed

RECON offers a range of functionalities to enable nuanced text comparison and the analysis of how textual information transforms between versions.

### 1. Comparison Options

The core of RECON's flexibility lies in its configurable comparison options, allowing users to tailor the analysis to their specific textual materials, research questions, and how they define significant informational variation.

*   **Granularity:**
    *   **Character-level:** Compares texts character by character. This mode is highly precise and ideal for identifying minor variations, such as typographical errors, OCR inaccuracies, or subtle spelling differences.
    *   **Word-level:** Compares texts word by word (token by token). This mode is generally better for understanding larger content changes, additions, or deletions, while being less sensitive to minor intra-word variations if those are not the focus.

*   **Inclusion Toggles:** These checkboxes control what elements are considered significant for the comparison:
    *   **Include Whitespace:** When checked, differences in spacing (spaces, tabs, newlines) will be highlighted as changes. When unchecked, variations solely due to whitespace are ignored (e.g., "hello world" vs. "hello  world" would be treated as identical if this is unchecked and no other differences exist). Note that this toggle treats all whitespace characters equally; it does not normalize different *types* of whitespace (e.g., a non-breaking space vs. a standard space). For that functionality, please use the RECON-Prep utility before comparing.
    *   **Include Punctuation:** When checked, differences in punctuation marks (e.g., commas, periods, hyphens) are treated as significant changes. When unchecked, these differences are ignored.
    *   **Include Capitalization:** When checked, case differences (e.g., "Text" vs. "text") are highlighted as changes. When unchecked, capitalization is ignored, and "Text" and "text" would be treated as the same word.

*   **Normalization & Variant Handling:** These options control how specific, often historically significant, textual variants are treated during preprocessing and analysis:
    *   **Ignore Logograms:** When checked, common logograms (e.g., "&") and their expansions (e.g., "and") are normalized to a common form *before* comparison, meaning differences between them will not be flagged as changes. The specific mappings are defined in `constants.js`.
    *   **Ignore Ligatures:** When checked, typographical ligatures (e.g., "æ", "fi") and their constituent letters (e.g., "ae", "f i") are normalized, so variations between them are not treated as differences. Mappings are in `constants.js`.
    *   **Ignore Archaic Letters:** When checked, common archaic letter forms (e.g., long "ſ" vs. "s", "ꝛ" vs. "r") are normalized, preventing these known historical variations from being flagged as changes. Mappings are in `constants.js`.
    *   **Ignore u/v Variations:** When checked, 'u' and 'v' (and their uppercase counterparts) are treated as equivalent (changing all 'v's to 'u's). This is useful for texts where these letters were used interchangeably. 
    *   **Ignore i/j Variations:** When checked, 'i' and 'j' (and their uppercase counterparts) are treated as equivalent (changing all 'j's to 'i's). Similar to u/v, this handles texts with interchangeable i/j usage.
    *   **Normalize uu/vv to w:** When checked, instances of "uu" or "vv" (and their uppercase/lowercase combinations) are normalized to "w" (and "W", respectively), and the reverse is tracked in the metrics as well. This helps in comparing texts where this common early modern scribal or print convention occurs.

The choices made for these options directly affect the diff output (the recorded transformations), the calculated statistics (the measures of variation), and the content of the exported files. Current settings are displayed in the "Comparison Settings" panel and also embedded in the metadata of exported files.

### 2. Interactive Visualization

RECON displays the differences—the identified informational variations—between the two input texts directly in the browser, using color-coding and distinct styling to highlight changes:

*   **Inline Highlighting:**
    *   **Deletions:** Text segments present in Text 1 but not in Text 2 are typically shown with a specific background color (e.g., red or pink) and/or strikethrough.
    *   **Insertions:** Text segments present in Text 2 but not in Text 1 are shown with a different background color (e.g., green or light blue).
    *   **Substitutions:** When a segment in Text 1 is replaced by a different segment in Text 2, both the deleted part (from Text 1) and the inserted part (from Text 2) are shown adjacent to each other, grouped visually.
    *   **Unchanged Text:** Segments that are identical in both texts (after applying selected comparison options) are displayed normally, without special highlighting.
*   **Whitespace Visualization:** Special characters (e.g., "␠" for space, "↵" for newline) are used within highlighted (deleted/inserted/substituted) segments to make whitespace changes explicit and visible. Being a tool focused on early modern print, no considerations for paragraphing (¶) are made—newlines being more discrete.
*   **Themes & Contrast:** Users can choose between light, dark, and system-default themes, as well as toggle a high-contrast mode for improved accessibility and readability. These settings are accessible via the visualization settings menu (high brightness/cog icon).
*   **Expandable Apparatus:** The visual diff display area (the "apparatus") can be expanded or collapsed by the user to show more or less of the compared texts at once, which is useful for very long texts.

### 3. Export Formats

RECON allows users to export the comparison results and associated metadata in two standard formats. These exports serve as durable records of the detected informational variations and transformations, facilitating further analysis, archiving, or integration into other workflows:

*   **Standoff JSON (`recon_standoff.json`):**
    *   **Structure:** This format provides a machine-readable JSON object. It includes a `meta` section containing all comparison settings (granularity, include/ignore options defining the lens of analysis, DMP parameters), a timestamp, and a comprehensive `statistics` block (mirroring what's shown in the UI, including detailed variant analysis tallies). The core of the file is a `variants` array, where each object represents a detected difference (an elementary unit of information transformation, such as an insertion or deletion) with its start/end character offsets relative to Text 1, the differing text segments from Text 1 and Text 2, and a type identifier.
    *   **Purpose:** Ideal for computational analysis, data mining, or as an input for other tools that can process structured diff data. The standoff nature (offsets referring to original texts) makes it robust for tracking changes across textual versions.

*   **(Quasi-TEI) XML (`<granularity>comparison_criticalapparatus_<options>.xml`):**
    *   **Structure:** This format provides an XML file that uses common [Text Encoding Initiative (TEI)](https://tei-c.org/) elements to represent the critical apparatus, making it suitable for many digital humanities projects and scholarly editions. The output features a custom root element (`<reconOutputTEI>`) containing:
        *   A `<reconMetadata>` section with detailed `comparisonOptions`, `dmpParameters`, and a `statistics` block (including `variantAnalysis`), documenting the analysis parameters.
        *   A `<text>` body where the comparison is represented using TEI elements for textual variations:
            *   `<del>` for deletions.
            *   `<add>` for insertions.
            *   `<app><lem>...</lem><rdg>...</rdg></app>` for substitutions (lemma and reading).
            *   `<lb/>` for line breaks.
        *   Note: While it employs TEI elements for the apparatus, it does not include a formal TEI namespace or a standard `<teiHeader>`.
    *   **Purpose:** Useful for scholarly editing, creating digital critical apparatuses that document textual fluidity, or integrating with TEI-based research environments (potentially with minor adjustments for strict TEI conformance). The filename dynamically reflects the granularity and key options used for the comparison, aiding in managing different analytical perspectives.

### 4. Statistical Metrics

RECON calculates and displays a wide range of statistical metrics to quantify the differences, similarities, and overall informational drift between the two texts. These metrics provide quantitative insights into the nature and extent of textual variation. The availability of certain metrics depends on the selected granularity (character or word) and whether the Compromise.js library is loaded (for NLP-dependent stats).

**Common Metrics (Character & Word Granularities):**

*   **Variant Analysis Tallies:** (Displayed under Ligature, Logogram, Archaic Letter, U/V, I/J, UU/VV↔W Analysis sections)
    *   Counts of specific variant forms (e.g., "æ", "&", "ſ") in each input text, reflecting raw material for potential information transformation.
    *   Counts of transformations between these forms (e.g., "æ → ae", "& → and) detected in the comparison, quantifying specific types of editorial or transmissional change. The logogram set includes some early modern specific logograms (e.g., "ꝑ → per") in an attempt to provides more granular insights into such transformations in early modern texts.

**Character-Level Specific Metrics:**

*   **Total Characters:** Total number of characters in each text (after preprocessing), with a detailed breakdown by character type (letters, numbers, whitespace, punctuation, symbols).
*   **Levenshtein Distance:** The minimum number of single-character edits (insertions, deletions, or substitutions) required to change one processed text into the other.
*   **Character Error Rate (CER):** (Levenshtein Distance / Total Characters in Text 1) * 100. A common metric for quantifying character-level divergence, often used for OCR accuracy assessment.
*   **Normalized Edit Distance (NED):** (Levenshtein Distance / Length of Longer Processed Text) * 100. A symmetric measure of character-level difference, normalized for text length.
*   **Capitalization Changes:** Tracks capitalized words removed from Text 1, added to Text 2, or unchanged between the original texts, with details of specific words.
*   **Punctuation Analysis:** Total count and breakdown of each punctuation mark in the original texts.
*   **Per-Glyph Error Rates:** (requires a confusion matrix): reports the estimated error probability for each character (1 − reliability), useful for spotting systematically fragile glyphs.

**Word-Level Specific Metrics:**

*   **Total Words:** Total number of words (tokens) in each text after preprocessing and tokenization (excluding whitespace tokens if "Include Whitespace" is off).
*   **Word Error Rate (WER):** ((Substitutions + Insertions + Deletions) / Total Words in Text 1) * 100. Shows raw S/I/D counts, offering a basic measure of word-level informational divergence.
*   **Jaccard Similarity:** Measures similarity between the word sets (vocabularies) of the two processed texts (Intersection / Union). Ignores word frequency, focusing on shared lexical items as an indicator of informational overlap.
*   **Cosine Similarity:** Measures similarity based on word frequencies (TF) in processed texts, reflecting the similarity in the prominence of informational terms.
*   **Type-Token Ratio (TTR):** (Number of Unique Words / Total Number of Words) for each processed text. Measures lexical diversity.
*   **Vocabulary Overlap:** Percentage of unique words common to both processed texts, relative to the average number of unique words.
*   **Lexical Density:** (Content Words / Total Words) for each original text. Proportion of nouns, verbs, adjectives, adverbs. (Requires NLP - Compromise.js).
*   **Average Word Length:** Average character length of words in each processed text.
*   **Stopword Analysis:** Percentage of words in each processed text that are common stopwords.
*   **Word Length Distribution:** Frequency distribution of words of different lengths for each processed text.
*   **Part of Speech (POS) Distribution:** Distribution of POS tags (noun, verb, etc.) in each original text. (Requires NLP - Compromise.js).
*   **Named Entities (NER):** Counts and lists of identified People, Places, and Organizations in each original text. (Requires NLP - Compromise.js).
*   **Top 10 Words:** The ten most frequent words and their counts for each processed text.

Each metric in the UI includes a tooltip explaining its calculation and significance in terms of textual or informational difference.

### 5. OCR Bias-Aware Metrics

RECON includes advanced bias-aware metrics specifically designed to address OCR bias. When comparing texts that have been processed through OCR, standard similarity metrics can be highly misleading due to systematic errors that create artificial similarities between texts.

#### The OCR Bias Problem

**The Core Issue:** OCR systems, like the specialized Transkribus OCR model I trained for comparison of Hero and Leander reprints (MHaLm) exhibit predictable error patterns. For example, they might frequently misread the letter "I" as lowercase "l" because these characters look similar in historical typefaces. When comparing two different editions of the same text:

1. Both OCR runs might make the same mistakes (both read "ISLAND" as "lSLAND")
2. Standard similarity tools see this as a "match" and report high similarity
3. This similarity is artificial—due to shared OCR errors, not actual textual similarity
4. Researchers can draw false conclusions about textual relationships

**What's Needed:** Statistical methods to distinguish between:
- **True textual similarities** (the original texts were actually similar)
- **False similarities** caused by consistent OCR error patterns

#### Confusion Matrix Foundation

Both bias-aware approaches adopted in RECON rely on documenting the model's Normal Error Profile (NEP), a term used in this project to describe its characteristic and predictable error patterns. This profile is captured quantitatively using a **confusion matrix** `C` where:
- `C[i][j] = P(OCR outputs character j | true character was i)`
- Built by running the OCR system on ground-truth (GT) test data
- Captures the OCR's specific error patterns

**How to Generate a Confusion Matrix:**
1. Use RECON to compare ground truth text against its OCR output
2. Set granularity to "Character" level
3. Enable the "Include Whitespace", "Include Punctuation", and "Include Capitalization" options
4. Click "Generate Confusion Matrix" in the results panel
5. Download the resulting matrix file for use in future comparisons

#### Method 1: Baseline-Normalized Similarity (S_corr)

**Concept:** Calculate what similarity score we'd expect from pure OCR bias, then adjust the observed score.

**Mathematical Formula:**

**Per-glyph agreement probability:**
```
S_g = Σ_k C[g][k]²
```
This is the probability that two independent OCR runs agree on character `g`, including both:
- Correct readings: `C[g][g]²` 
- Shared errors: `C[g][k]²` for `k≠g`

**Baseline similarity:**
```
S_baseline = Σ_g f_g × S_g
```
Where `f_g` is the frequency of character `g` in the texts being compared. This represents the similarity we'd expect even if the original texts were completely different.

**Corrected similarity:**
```
S_corr = (S_obs - S_baseline) / (1 - S_baseline)
```
Where `S_obs` is RECON's raw similarity score.

**Interpretation:**
- **S_corr = 0:** No better than random OCR bias (texts appear unrelated)
- **S_corr = 1:** Perfect similarity beyond OCR bias (texts are likely identical)
- **S_corr < 0:** Observed similarity is worse than expected by chance (indicates actual differences)

**Summary of Method 1:** This metric answers: "After accounting for the fact that OCR makes predictable mistakes, how similar are these texts really?" It's like adjusting a test score by subtracting the points you'd get just by guessing.

#### Method 2: Bayesian Weighted Similarity (S_adj)

**Concept:** For each character pair in the comparison, calculate the probability that the underlying true characters were the same, then average these probabilities.

**Mathematical Formula:**

**For each observed character pair (x,y), calculate the probability weight:**
```
w(x,y) = P(SameTrue | obs x,y)
```

This is computed using Bayesian reasoning with likelihood ratios:
```
LR(x,y) = P(obs x,y | SameTrue) / P(obs x,y | DiffTrue)
w(x,y) = LR(x,y) / (1 + LR(x,y))
```

Where:
```
P(obs x,y | SameTrue) = Σ_i π(i) × C[i→x] × C[i→y]
P(obs x,y | DiffTrue) = [Σ_i π(i) × C[i→x]] × [Σ_j π(j) × C[j→y]] - Σ_k π(k)² × C[k→x] × C[k→y]
```

And `π(i)` is the prior frequency of true character `i`.

**Weighted similarity:**
```
S_adj = (1/N) × Σ_k w(x_k, y_k)
```

Instead of counting character matches as simply 0 or 1, each aligned pair `(x_k, y_k)` contributes its probability `w(x_k, y_k)` of representing the same true character.

**Interpretation:**
- **S_adj = 0:** Characters at each position are very unlikely to share the same true underlying character
- **S_adj = 1:** Characters at each position are very likely to share the same true underlying character
- **Values between 0-1:** Average probability that aligned characters represent the same true characters

**Implementation Notes:**
- In the current version, the prior α is fixed at 0.5 (equal odds). Appendix II of the RECON chapter provides the fully generalized formula with an arbitrary α.
- RECON re‑estimates 𝜋 empirically from the two texts under comparison (via computeGlyphFrequencies). 𝐶 remains fixed from its training corpus.

**Summary of Method 2:** This metric asks for each character pair: "Given what we know about how the OCR which generated the CM makes mistakes, what's the probability these two characters came from the same original character?" It then averages these probabilities across the entire text.

#### When Bias-Aware Metrics Are Available

The bias-aware metrics (S_corr and S_adj) are automatically calculated when **all** of the following conditions are met:

1. **Character-level granularity** is selected
2. A **confusion matrix** has been loaded into RECON
3. The confusion matrix is compatible with the characters in your texts
4. All required bias‑aware calculation functions are available (specifically: toProbMatrix, computeGlyphFrequencies, calculateGlyphReliabilities, calculatePerGlyphBaselineAgreements, calculateOverallBaselineAgreement, calculateScorr, precomputeWeightTable, and computeWeightedSimilarity).

#### Practical Usage Guidelines

**For Researchers:**
- **Use S_corr** when you want to know if observed similarity exceeds what OCR bias alone would produce
- **Use S_adj** when you want a more nuanced, probability-weighted similarity measure
- **Compare both metrics** with standard similarity (S_obs) to understand the impact of OCR bias

**Typical Result Patterns:**
- **High-quality OCR (S_baseline < 0.95):** All metrics tend to agree
- **OCR with highly predictable error patterns (S_baseline > 0.98):** S_corr becomes more conservative, S_adj provides more nuanced results
- **Unrelated texts with poor OCR:** S_obs may be high, but S_corr approaches 0 and S_adj is lower
- **Related texts with poor OCR:** S_corr and S_adj help reveal true similarity masked by OCR noise

**Quality Indicators:**
- **S_baseline values:** Lower values (< 0.95) indicate higher-quality OCR with less systematic bias
- **S_baseline > 0.98:** Indicates OCR with highly predictable error patterns where bias correction becomes critical
- **Large gaps between S_obs and S_corr/S_adj:** Suggests significant OCR bias affecting standard metrics

### 6. Configurable Settings & Persistence

RECON provides several ways for users to customize the tool's behavior and appearance, and it remembers these preferences.

*   **Comparison Algorithm (DMP) Settings:**
    *   Found under the "Diff Settings" panel near the main comparison controls, these options allow advanced users to fine-tune how RECON detects differences between texts using the diff-match-patch (DMP) algorithm.
    *   While the default values work well in most cases, adjusting these settings can help tailor comparisons for different kinds of texts (e.g., dense verse, prose, OCR output, etc.). Here's what each setting does in more everyday terms:
        *   `Diff Timeout`: Sets a time limit (in seconds) for how long the system should spend trying to find the best differences between two texts. If set to 0, there's no time limit, which might improve accuracy but can slow things down for large or complex comparisons.
        *   `Diff Edit Cost`: Controls how "expensive" an edit (like an insertion or deletion) is. A higher number makes the algorithm more reluctant to split up or rewrite text—it favors larger chunks that match closely, rather than breaking things into lots of small changes.
        *   `Match Threshold`: This is like a fuzziness setting: it tells the algorithm how picky to be when trying to line up similar text. A value of 0.0 means it only accepts near-perfect matches; a value closer to 1.0 means it'll settle for looser matches, which might help when texts are very different but still related.
        *   `Match Distance`: Tells the algorithm how far ahead or behind in the text to look when trying to find a match. A small number keeps it focused locally (good for short, clean comparisons), while a bigger number makes it more flexible, especially when chunks of text have moved around.
        *   `Patch Delete Threshold`: Determines how much of a change needs to be a deletion before it's treated as one in the final patch (i.e., a record of changes). This mostly affects how the output looks when chunks are missing in one version compared to the other.
        *   `Patch Margin`: Defines how much surrounding context to include when generating a patch. Think of it like giving a few extra words of "padding" on either side of a change to help anchor it clearly in place.
    *   These settings can impact performance and the quality of diff results, thereby influencing the perceived nature of textual or informational transformation for specific types of texts.
    *   Changes can be saved to the browser's `localStorage` and will be loaded automatically in future sessions. A "Reset to Defaults" button restores the original DMP settings.

*   **Visualization Settings:**
    *   Accessed via the visualization settings menu (cog icon in the header).
    *   **Theme Customization:** Users can select:
        *   `Light Theme`
        *   `Dark Theme`
        *   `System Theme` (automatically adapts to the operating system's light/dark mode preference).
    *   **High Contrast Mode:** A toggle to switch to a high-contrast version of the current theme, improving readability for users with visual impairments.
    *   These preferences are also saved to `localStorage` and persist across sessions.

The persistence of these settings ensures that users can maintain their preferred working environment without needing to reconfigure the tool each time they use it.

---

## File Structure

The RECON project is organized into the following key files and directories:

*   **`recon.html`**: The main HTML file that structures the user interface. This is the file you open in a web browser to run the application.
*   **`styles.css`**: Contains all the CSS rules for styling the application's appearance, including themes and diff highlighting.
*   **`script.js`**: (Source file) The primary JavaScript entry point that orchestrates UI interactions, data processing, statistical calculations, and integrates the various ES6 modules. It is the source for the bundled application code.
*   **`constants.js`**: Defines shared constants used throughout the application, such as normalization maps (ligatures, logograms), granularities, export types, etc. It is loaded by `recon.html` and also imported by modules.
*   **`fastest-levenshtein.js`**: An external library providing a fast Levenshtein distance calculation, used for CER and NED metrics. Loaded by `recon.html`.
*   **`stopwords.js`**: Contains a predefined set of stopwords used for the stopword analysis metric. Loaded by `recon.html`.

*   **`modules/`**: This directory contains JavaScript ES6 modules that encapsulate specific functionalities, promoting code organization and reusability:
    *   **`diffEngine.js`**: Handles the core diffing logic, including text preprocessing, tokenization, and interfacing with the `diff-match-patch` library to generate comparison data.
    *   **`utility.js`**: Contains various helper and utility functions used across the application (e.g., text escaping, formatting functions for statistics).

*   **`src/`**: This directory contains specialized ES6 modules for bias-aware OCR metrics:
    *   **`confusion.js`**: Handles confusion matrix processing, converting count matrices to probability matrices and managing character-to-index mappings.
    *   **`baseline.js`**: Implements baseline-normalized similarity calculations, including per-glyph agreement probabilities and overall baseline agreement computation.
    *   **`weights.js`**: Handles Bayesian weight calculations for the weighted similarity metric, computing likelihood ratios and posterior probabilities.
    *   **`similarity.js`**: Contains the main similarity calculation functions for both bias-aware methods (S_corr and S_adj).

*   **`dist/`**: This directory contains the bundled JavaScript file:
    *   **`recon.bundle.js`**: The bundled and minified version of `script.js` and its imported ES6 modules from the `modules/` directory, created by `esbuild`. This is the script actually loaded by `recon.html` for execution in the browser.
*   **`recon-prep/`**: Contains the **RECON-Prep** utility, a small companion tool for normalizing whitespace in source texts before analysis. See the `README.md` file within this directory for more information.
*   **`README.md`**: This file – providing an overview, setup instructions, and documentation for the project.
*   **`package.json`**: Node.js package file. Defines project metadata, scripts (for building and development), and development dependencies (like `esbuild`).
*   **`package-lock.json`**: Records the exact versions of dependencies, ensuring reproducible builds.
*   **`node_modules/`**: Directory where npm installs project dependencies (e.g., `esbuild`). This directory is typically not included in version control if other users are expected to run `npm install`.

This structure separates the user interface (`recon.html`, `styles.css`), core logic (`script.js`, `modules/`), bundled output (`dist/`), and project/dependency management (`package.json`, `node_modules/`).

---

## User Interface Guide

The RECON interface is designed to be straightforward. Here's a breakdown of its main components:

1.  **Header Bar:**
    *   **Title:** "RECON"
    *   **Visualization Settings (Cog Icon):** Opens a dropdown menu to control:
        *   **Theme:** Light, Dark, System.
        *   **High Contrast Mode:** Toggles high contrast for the selected theme.
    *   **DMP Settings (Gear Icon):** Opens a modal dialog to adjust the `diff-match-patch` algorithm parameters. Allows saving custom settings or resetting to defaults.

2.  **Input Area:**
    *   **Text 1 & Text 2 Panels:** Two large textarea fields side-by-side for pasting or typing the texts you want to compare.
        *   **File Input:** You can double-click within a textarea or drag-and-drop a `.txt` file onto it to load text from a file.
    *   **"Compare Texts" Button:** Initiates the comparison process using the current texts and selected options.

3.  **Controls Panel:** Located below the input areas, this section contains all the options to configure the comparison:
    *   **Comparison Group:**
        *   **Granularity Dropdown:** Select "Character" or "Word" level comparison.
    *   **Include Group:** Checkboxes for:
        *   `Whitespace`
        *   `Punctuation`
        *   `Capitalization`
    *   **Normalization & Variant Handling Group:** Checkboxes for:
        *   `Ignore Logograms`
        *   `Ignore Ligatures`
        *   `Ignore Archaic Letters`
        *   `Ignore u/v Variations`
        *   `Ignore i/j Variations`
        *   `Normalize uu/vv to w`
    *   **"Export Results" Button:** Becomes active after a comparison. Allows you to download the results.
        *   **Export Format Radio Buttons:** Choose between "Standoff JSON" and "TEI XML".

4.  **Results Area:** Displayed below the controls panel after a comparison is run.
    *   **Visual Representation (Apparatus):**
        *   Shows the two texts in synthesis, with differences highlighted (deletions, insertions, substitutions).
        *   **"Expand/Collapse Apparatus" Button:** Toggles the height of this display area, useful for long texts.
    *   **Confusion Matrix Panel:** (Appears when character-level comparison is used)
        *   **"Generate Confusion Matrix" Button:** Creates a confusion matrix from the current comparison (typically used when comparing ground truth against OCR output).
        *   **"Load Confusion Matrix" Button:** Allows you to upload a previously saved confusion matrix file for bias-aware analysis.
        *   **Matrix Status Display:** Shows whether a confusion matrix is loaded and compatible with your texts.
    *   **Statistics Table:** A table listing all the calculated metrics for the current comparison. When a confusion matrix is loaded and character-level granularity is used, this includes bias-aware metrics (S_baseline, S_corr, S_adj). Each metric name has a tooltip explaining its meaning. Some metrics offer a "Details" button to show more granular information (e.g., specific capitalized words, named entities).

5.  **Footer:**
    *   Contains a "Last Modified Date" for the application page itself.
    *   May include links or other informational text.

**General Workflow:**

1.  Enter your two texts into the "Text 1" and "Text 2" input areas.
2.  Select your desired "Granularity," "Include," and "Normalization" options from the Controls Panel.
3.  (Optional) Adjust advanced DMP parameters or visualization settings if needed.
4.  Click the "Compare Texts" button.
5.  Review the highlighted differences in the "Visual Representation" area and the figures in the "Statistics Table."
6.  If desired, click "Export Results," choose a format, and the file will be downloaded.

**For OCR Bias-Aware Analysis:**

1.  **First, create a confusion matrix:** Compare ground truth text against its OCR output using character-level granularity with whitespace, punctuation, and capitalization included.
2.  Click "Generate Confusion Matrix" and download the resulting matrix file.
3.  **For subsequent analyses:** Load your saved confusion matrix using "Load Confusion Matrix" before comparing OCR texts.
4.  **Compare your OCR texts** using character-level granularity - bias-aware metrics (S_baseline, S_corr, S_adj) will automatically appear.
5.  **Interpret results:** Compare S_obs with S_corr and S_adj to understand the true similarity beyond OCR bias.

---

## License

This project is licensed under the **ISC License**. This is a permissive free software (open source) license.

ISC License

Copyright (c) 2023-2025 Jonathan David Pinkerton

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

RECON aims to be an open-source tool for the research community. It also incorporates functionalities from other open-source libraries, including:

*   **diff-match-patch:** (Typically Apache License 2.0) - Used for the core text differencing algorithm.
*   **fastest-levenshtein:** (Typically MIT License) - Used for Levenshtein distance calculations.
*   **Compromise.js:** (Typically MIT License) - Used for Natural Language Processing features (POS tagging, NER).

Users should also be aware of the licenses of these and any other third-party components.

---

## Modifying and Extending RECON

RECON's modular ES6 architecture is designed to make it adaptable for users who wish to modify or extend its functionality for their specific research needs, particularly in tracking and analyzing different facets of informational variation.

*   **Core Logic:** The main application logic resides in `script.js` (the entry point for the bundle `dist/recon.bundle.js`). This file orchestrates UI interactions, data processing, statistical calculations, and integrates functionality from the various ES6 modules.
*   **Specialized Modules:**
    *   `modules/diffEngine.js`: Contains the core logic for text preprocessing, tokenization, and interfacing with the `diff-match-patch` library to generate comparison data fundamental to identifying informational changes.
    *   `modules/utility.js`: Provides various helper functions used across the application, aiding in tasks like data formatting and presentation.
*   **Adding New Metrics:** New statistical calculations can be added to `script.js` or encapsulated in new modules. These would typically involve defining how a new type of informational variation is quantified. The results would then need to be integrated into the `displayStatistics` function (or equivalent UI rendering logic) in `script.js`.
*   **Customizing Normalizations:** The normalization maps in `constants.js` can be expanded or altered to support additional textual variants or to refine how specific types of information (e.g., orthographic, semantic) are regularized before comparison.

This project encourages users to adapt it to their own research purposes, leveraging its framework for diverse analyses of textual transformation.

This project was developed by Jonathan David Pinkerton (Université de Lille, University of Kent), with significant coding assistance from various AI models, including OpenAI's ChatGPT series, Anthropic's Claude series, and Google's Gemini series, often facilitated via the CursorAI text editor.

---

## Known Issues & Limitations

While RECON is continually refined, users should be aware of the following known issues, limitations, and areas for future consideration. These points aim to provide a transparent understanding of the tool's current capabilities and scope.

*   **Performance with Extremely Large Texts:** While optimized for typical research text lengths (e.g., articles, chapters, play-length works), comparing very large documents (e.g., entire lengthy books) directly in the browser might still encounter performance degradation or browser slowdowns. The underlying `diff-match-patch` library is efficient, but browser JavaScript execution and DOM manipulation for extensive diffs have inherent limits.
*   **NLP Dependency on Internet:** As noted, Part-of-Speech (POS) tagging and Named Entity Recognition (NER) currently rely on the `Compromise.js` library loaded from a CDN. These advanced NLP-derived statistical features will not be available if the user is offline or if the CDN is inaccessible. Core comparison and other statistical features remain unaffected.
*   **Modern NLP Assumptions in Historical Texts:**
    *   **POS/NER Limitations:** Part-of-Speech tagging and Named Entity Recognition (NER) use the `Compromise.js` library, which is trained on modern English. It may fail to recognize archaic grammatical structures, Latinized names, or obsolete word forms common in early modern texts.
    *   **Stopword and Frequency Bias:** The built-in stopword list **has been expanded to include a significant set of common Early Modern English function words (e.g., *thou*, *hath*, *dost*, *'tis*)**, which helps mitigate some modern usage bias. However, word frequency, similarity metrics (Jaccard, Cosine), and vocabulary overlap can still be influenced by the remaining modern tokenization logic and any unhandled period-specific vocabulary.
    *   **Capitalization Interpretation:** RECON treats capitalization differences as meaningful when enabled. This may misrepresent stylistic or non-semantic capitalization typical of early modern print conventions.
    *   **Recommendations for Historical Material:**
        *   Enable normalization options (ligatures, archaic letters, u/v and i/j variants, and ensure 'Ignore Logograms' is active to benefit from an expanded list of recognized period-specific abbreviations like ꝑ for 'per' or ⁊ for 'et') when working with early modern texts. Use caution when interpreting NLP-derived statistics unless working from editorially normalized or modernized editions. The enhanced stopword list and logogram recognition aim to improve preprocessing for such historical material, though are admittedly imperfect to the task.
*   **Diff Algorithm Sensitivities & Alignments:**
    *   The `diff-match-patch` algorithm is powerful but, like all diff algorithms, can occasionally produce alignments for complex textual variations (especially with overlapping changes or high levels of normalization) that might seem counter-intuitive to human interpretation. The resulting diff is always computationally 'correct' by the algorithm's logic but may not be the only or most semantically meaningful representation of change.
    *   **Word-Level Specifics:**
        *   When comparing texts at the word-level, especially with capitalization tracking enabled, the tool may occasionally produce alignments that don't perfectly match intuitive expectations, particularly if there are many minor typographic differences. Consider disabling capitalization tracking or reviewing results carefully in such cases.
        *   Word-level comparison attempts to align tokens precisely; minor typographic differences (beyond capitalization, if ignored) between words can sometimes lead to minor misalignments or segmentations that seem less than ideal.
    *   **Character-Level Specifics:** Character-level comparison identifies every single character edit. While highly precise, this level of detail might be overwhelming or less informative for analyses focused on broader content changes in very long texts.
    *   Adjusting DMP settings (e.g., `Match Threshold`, `Diff Edit Cost`) can influence results and may require experimentation to optimize for specific analytical goals concerning informational variance.
*   **Whitespace Handling in Word Granularity:** When "Include Whitespace" is enabled in word granularity, sequences of whitespace characters (including newlines) are treated as distinct tokens. This is by design for meticulous analysis but can sometimes lead to a high number of whitespace-only diffs if texts vary significantly in their formatting but not substantive content.
*   **Variant Analysis Specificity:** The current variant analysis primarily identifies direct, predefined substitutions (e.g., "formA" in Text 1 vs. "formB" in Text 2). It may not capture all nuanced contextual variants or combined transformations without more complex pattern matching or expanded definitions in `constants.js`.
*   **XML Export Focus:** The TEI-inspired XML export provides a robust, common critical apparatus structure. For highly specialized TEI projects or advanced encoding requirements, further customization or post-processing of the exported XML might be necessary to align with specific schemas or scholarly objectives.
*   **Browser Compatibility:** RECON is designed for modern web browsers. While efforts are made for broad compatibility, minor rendering inconsistencies or issues could theoretically arise in older or less common browser versions. Testing is primarily focused on recent versions of major browsers like Edge (Chromium), Chrome, and Firefox.
*   **Critical Apparatus Display:** The critical apparatus display is designed to be responsive, meaning its textual content automatically adjusts to the width of the browser window. This ensures the apparatus is viewable on various screen sizes. However, a key consideration is that on smaller displays, particularly with a whitespace-enabled comparison, the limited horizontal space can cause lines of text to fragment. This fragmentation may reduce overall clarity and make the apparatus less intuitive to read and interpret. Adjusting the browser's display settings may ameliorate some of these issues on smaller displays.

Feedback, bug reports, and contributions towards addressing these limitations, enhancing features, or identifying new areas for improvement are welcome, though hopefully this readme serves as foundation enough from which one might iterate on the project directly. It is in your digital hands now.