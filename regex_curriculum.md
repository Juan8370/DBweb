# Regex for Data Analysts: A Goal-Oriented Mastery Path

Welcome to the **Regex for Data Analysts** curriculum. This course is designed to take you from knowing nothing about regular expressions to being able to parse, validate, and clean complex datasets with ease.

Each lesson is structured around a clear **Goal**, the **Mechanism** (how it works), and the **Result** (what you will achieve).

---

## 🗺️ Course Roadmap

| Lesson | Focus | Goal |
| :--- | :--- | :--- |
| **1** | **Foundations** | Internalize what regex is and why it's the "Swiss Army Knife" of data. |
| **2** | **Escaping** | Learn to treat special symbols as literal text. |
| **3** | **String Matching** | Master exact string searches for specific keywords. |
| **4** | **Wildcards/Ranges** | Understand how to match categories of characters (digits, spaces). |
| **5** | **Anchors** | Pinpoint exact locations in a string (start/end). |
| **6** | **Quantifiers (Basic)** | Handle repetitive data like repeated letters or sequences. |
| **7** | **Quantifiers (Advanced)** | Specify exact counts for ultra-precise matching (dates, IDs). |
| **8** | **Groups** | Isolate and extract specific data points from a string. |
| **9** | **Character Classes** | Build customized "dictionaries" of allowed characters. |
| **10** | **Capstone** | Combine everything to solve a real-world multi-part data problem. |

---

## 📖 Lesson Details

### Lesson 1: Introduction to Regular Expression
- **Goal**: Understand the role of Regex in modern data analysis.
- **Mechanism**: Defining "patterns" that act as search-and-replace rules for engines.
- **Output**: You will be able to distinguish between fixed strings and patterns, and identify five high-impact use cases in your daily workflow.

### Lesson 2: Meta-Characters - Part 1 (The Basics)
- **Goal**: Escape special meta-characters to search for them as literal text.
- **Mechanism**: Using the backslash `\` to neutralize characters like `. $ *`.
- **Output**: You will successfully match prices (like `$10.00`) where the `$` and `.` would otherwise trigger special regex behaviors.

### Lesson 3: Example - Matching a Literal String
- **Goal**: Perform case-sensitive and case-insensitive searches for exact matches.
- **Mechanism**: Writing plain text strings as the regex pattern.
- **Output**: You will be able to filter a log file for specific error codes or product names.

### Lesson 4: Meta-Characters - Part 2 (Ranges and Wildcards)
- **Goal**: Learn to match generic categories of information.
- **Mechanism**: Using the dot `.` (any char), `\d` (digits), `\s` (whitespace), and `\w` (word characters).
- **Output**: You will build a pattern that matches a generic 10-digit phone number or a serial number format.

### Lesson 5: Meta-Characters - Part 3 (Anchors)
- **Goal**: Enforce positional constraints on your searches.
- **Mechanism**: The caret `^` (start of line) and the dollar sign `$` (end of line).
- **Output**: You will be able to validate that a string Is ONLY a digit (not just *contains* a digit) and ensure data is properly formatted from the start of the cell to the end.

### Lesson 6: Matching One or More Characters
- **Goal**: Handle data of variable length.
- **Mechanism**: The plus `+` (1 or more) and asterisk `*` (0 or more).
- **Output**: You will capture entire blocks of text or sequences of digits regardless of how many characters they contain.

### Lesson 7: Meta-Characters - Part 4 (Precise Quantifiers)
- **Goal**: Narrow down matches to exact repetitions.
- **Mechanism**: The curly braces `{n,m}` and the optional quantifier `?`.
- **Output**: You will create high-precision filters for complex structures like birth years (4 digits) or postal codes (specified range).

### Lesson 8: Groups and Capture
- **Goal**: Group patterns together for extraction or repetition.
- **Mechanism**: Parentheses `()`.
- **Output**: You will successfully group an area code and a local number into two separate "capture groups" for easy data cleaning and extraction.

### Lesson 9: Character Classes (Custom Groups)
- **Goal**: Define your own set of valid characters for a specific position.
- **Mechanism**: Brackets `[]`.
- **Output**: You will create a pattern that matches only uppercase vowels or specific hexadecimal range (`[a-f0-9]`).

### Lesson 10: Summary and Conclusion
- **Goal**: Consolidate and test your skills.
- **Mechanism**: Reviewing the "Master Checklist" and taking the final challenge.
- **Output**: You will build a complete regex for a complex string (e.g., a timestamped log entry with a severity level and a message) and know where to find advanced documentation.

---

## 🛠️ Recommended Tools
To practice this curriculum, we recommend using:
1. **Regex101**: For real-time feedback and explanation of matches.
2. **Visual Query Studio Terminal**: To test patterns against your actual database tables.

---
*Created for the Data Analyst Mastery Series.*
