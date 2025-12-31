# RECON-Prep: A Whitespace Normalization Utility

## 1. Overview

RECON-Prep is a simple, client-side utility designed as a companion to the RECON (Reading Contrasting) tool. Its sole function is to perform a specific, methodologically-defined whitespace normalization on text files.

This tool was developed as part of the "Marlowe's Playbooks" dissertation project to address a key data preparation requirement: ensuring that comparisons of early modern texts are not skewed by variances in digital whitespace encoding, which are considered artifacts of OCR and digitization rather than features of the original print syntax.

## 2. Functionality

The script takes one or more text files as input and performs the following single, non-destructive operation:

* **Whitespace Standardization:** It replaces a curated set of Unicode whitespace characters with the standard ASCII space character (`U+0020`). This includes non-breaking spaces (`U+00A0`), em spaces (`U+2003`), and other common variants.
* **Line Break Preservation:** Standard line breaks (`\n`, `\r`) are explicitly preserved to maintain the text's original lineation.

The tool outputs new, "clean" text files for download, which serve as the consistent input for analysis in the main RECON tool.

## 3. How to Use

1.  Open the `normalizer.html` file in any modern web browser.
2.  Click the "Choose Files" button and select the raw text files you wish to process.
3.  Click the "Normalize Whitespace" button.
4.  Download links for the cleaned versions of your files will appear in the "Results" area.