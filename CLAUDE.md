# Math-contents — notes for Claude

This repo is a public GitHub Pages site (https://natthaphat-math.github.io/Math-contents/)
with many independent pages and games. The section below applies only to the flashcards app.

## Flashcards (flashcards.html, flashcards/, card-editor.html)

Students use `flashcards.html`. Every card lives in `flashcards/cards.js`, which the teacher
edits by hand (GitHub web editor) or through `card-editor.html`. Students' saved progress is
tied to each card's id, so published ids must never change.

### Making cards from a PDF or a unit ("ทำการ์ดจากไฟล์นี้")

1. Read the rules at the top of `flashcards/cards.js` and follow them exactly. The cards are
   plain text inside a JavaScript comment: LaTeX uses single backslashes, and the only text
   that may never appear is `*` directly followed by `/`.
2. **Never edit `flashcards/cards.js`.** Write a new draft file instead:
   `flashcards/drafts/YYYY-MM-DD-<short-ascii-slug>.js`, one per request. Never overwrite or
   edit another draft file.
3. Draft layout (first two lines and last line exactly like this):
   ```
   // ไฟล์ร่างการ์ดจาก Claude — ตรวจและเลือกใช้ใน card-editor.html (ไม่แสดงในแอปจนกว่าจะนำเข้า cards.js)
   window.CARD_SOURCE = function () {/*
   // จาก: <PDF file name or unit>
   // วันที่: YYYY-MM-DD

   # บท: <unit name>
   # ระดับ: ps | jh | sh | uni
   # สัญลักษณ์: <1–4 characters, optional>

   # หัวข้อ: <topic name>

   == <id>
   ถาม: …
   ตอบ: …

   */};
   ```
4. Units and topics: to add to a unit that already exists in `cards.js`, use its exact
   `# บท:` name and level (the editor merges by name). Otherwise use the book's unit title.
   Group cards with `# หัวข้อ:` following the book's sections.
5. Ids: lowercase `a-z`, `0-9` and `-`, unique across `cards.js` and every file in
   `flashcards/drafts/`. Reuse the unit's existing id prefix (look at its cards in `cards.js`).
6. Content: Thai, in the style of the existing cards; one definition / formula / property /
   short skill per card; question on `ถาม:`, answer on `ตอบ:`; keep both short; bold key
   words with `**…**`. Only add TikZ (`รูปถาม:` / `รูปตอบ:`) when a picture really helps.
   Check every formula against the PDF.
7. Run `node flashcards/check-cards.mjs` and fix every ✗ it reports (warnings: judge).
8. Commit only the new draft file and push to `main`. Drafts are not shown to students.
   **Never commit the PDF**: the repo is public.
9. Tell the teacher how many cards were drafted per unit/topic, anything you were unsure about,
   and to review them at https://natthaphat-math.github.io/Math-contents/card-editor.html
   (tab "ร่างจาก Claude"), then export and paste the new `cards.js`.

### Changing the app itself

The app's code is developed in the teacher's `Claude-Code-projects` repo
(`projects/math-flashcards/`) and copied here. Ask the teacher before changing
`flashcards.html`, `card-editor.html` or anything in `flashcards/` other than drafts.
