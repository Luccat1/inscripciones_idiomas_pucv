---
phase: quick
plan: 260806-hxc
type: execute
wave: 1
depends_on: []
files_modified:
  - src/Config.gs
autonomous: true
requirements: []
must_haves:
  truths:
    - "CONFIG.idiomas includes 'Japonés' in alphabetical order"
    - "CONFIG.niveles includes 'B1+' between 'B1.2' and 'B2.1'"
    - "CONFIG.horariosPorIdioma has a 'Francés' entry with two schedule options"
    - "CONFIG.horariosPorIdioma 'Italiano' has two options (MJ_1730 + VS_1730) without the '- Único horario' suffix"
    - "CONFIG.horariosPorIdioma has a 'Japonés' entry with a single schedule (MJ_1730_UNICO)"
    - "The comment about Francés falling through to _default is removed/updated"
  artifacts:
    - path: src/Config.gs
      provides: Updated CONFIG matching the 2do Semestre 2026 form
      contains: "'Japonés'"
  key_links:
    - from: src/Config.gs
      to: src/Core.gs
      via: "parsearHorarios() matches schedule labels case-insensitively"
      pattern: "horariosPorIdioma"
---

<objective>
Align CONFIG in src/Config.gs with the actual Google Form options for 2do Semestre 2026.

Purpose: parsearHorarios() matches schedule labels from the form response sheet against the catalog in CONFIG.horariosPorIdioma. Any mismatch silently drops that registration from counts. The current catalog reflects 1er Semestre 2026 and will miscount registrations from the new form.
Output: src/Config.gs with idiomas, niveles, and horariosPorIdioma reflecting the 2026-2 form exactly.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/Config.gs

<interfaces>
<!-- parsearHorarios() in src/Core.gs normalizes both the candidate label and the
     catalog label via normalizarTexto() (lowercase, whitespace-collapsed, accent-
     stripped) before comparing. The form response text and CONFIG.label must match
     after that normalization — exact case, accents, and punctuation differences are
     tolerated, but different words are not. -->

<!-- _default entry is used for any idioma not explicitly listed in
     horariosPorIdioma. With Francés getting its own entry, _default becomes a
     true fallback for unexpected languages only. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update CONFIG to match 2do Semestre 2026 form catalog</name>
  <files>src/Config.gs</files>
  <action>
Apply these targeted changes to the CONFIG object in src/Config.gs:

1. **semestre** — Change the value from '1er Semestre 2026' to '2do Semestre 2026'.

2. **CONFIG.idiomas** — Add 'Japonés' to keep the array sorted alphabetically:
   ```
   idiomas: ['Alemán', 'Francés', 'Inglés', 'Italiano', 'Japonés'],
   ```

3. **CONFIG.niveles** — Insert 'B1+' between 'B1.2' and 'B2.1':
   ```
   niveles: [
     'A1.1', 'A1.2', 'A2.1', 'A2.2',
     'B1.1', 'B1.2', 'B1+', 'B2.1', 'B2.2',
     'C1.1', 'C1.2'
   ],
   ```

4. **CONFIG.horariosPorIdioma** — Apply three changes:

   a. Add a 'Francés' entry (new, before '_default'). The labels must match the form text exactly as given (normalizarTexto will lowercase and strip accents for comparison, so match the words):
   ```js
   'Francés': [
     { id: 'LM_1730', label: 'Lunes y miércoles (17:30 - 19:30)' },
     { id: 'MJ_1730', label: 'Martes y jueves (17:30 - 19:30)' }
   ],
   ```

   b. Fix 'Italiano' — replace the single-entry array with two entries. The old label had '- Único horario disponible este semestre'; the new form does not. Use the plain label for MJ_1730, and add VS_1730:
   ```js
   'Italiano': [
     { id: 'MJ_1730', label: 'Martes y jueves (17:30 - 19:30)' },
     { id: 'VS_1730', label: 'Viernes (17:30 - 19:30) y sábado (10:00 - 12:00)' }
   ],
   ```

   c. Add 'Japonés' entry (after Italiano, before '_default'). The form text is "Martes y jueves (17:30 - 19:30) - Único horario disponible este semestre" — keep the id MJ_1730_UNICO to signal it is the only option, and copy the label verbatim so parsearHorarios() matches it:
   ```js
   'Japonés': [
     { id: 'MJ_1730_UNICO', label: 'Martes y jueves (17:30 - 19:30) - Único horario disponible este semestre' }
   ],
   ```

5. **Update the block comment above horariosPorIdioma** — remove the sentence "Francés no tiene entrada propia (sin datos reales aún) y cae en '_default'; revisar cuando lleguen las primeras respuestas." Replace with a note that all five active languages now have explicit entries and '_default' is a fallback for unexpected/future languages:
   ```
   // Verified against form options for 2do Semestre 2026 (2026-08). All five
   // active idiomas have explicit entries; '_default' is a fallback for
   // unexpected or future languages only.
   ```
   Keep the rest of the comment block (explaining case-insensitive match, etc.) intact.

Preserve all other CONFIG fields, the module.exports shim at the bottom, and the 2-space indentation style. Use single quotes throughout.
  </action>
  <verify>
    <automated>node -e "const {CONFIG} = require('./src/Config.gs'); const ok = (b, msg) => { if (!b) throw new Error('FAIL: ' + msg); }; ok(CONFIG.idiomas.includes('Japonés'), 'idiomas includes Japonés'); ok(CONFIG.niveles.includes('B1+'), 'niveles includes B1+'); const bi = CONFIG.niveles.indexOf('B1+'); ok(CONFIG.niveles[bi-1]==='B1.2' &amp;&amp; CONFIG.niveles[bi+1]==='B2.1', 'B1+ between B1.2 and B2.1'); ok(CONFIG.horariosPorIdioma['Francés'] &amp;&amp; CONFIG.horariosPorIdioma['Francés'].length===2, 'Francés has 2 schedules'); ok(CONFIG.horariosPorIdioma['Italiano'].length===2, 'Italiano has 2 schedules'); ok(!CONFIG.horariosPorIdioma['Italiano'].some(h=>h.label.includes('Único')), 'Italiano label has no Único'); ok(CONFIG.horariosPorIdioma['Japonés'] &amp;&amp; CONFIG.horariosPorIdioma['Japonés'].length===1, 'Japonés has 1 schedule'); ok(CONFIG.horariosPorIdioma['Japonés'][0].id==='MJ_1730_UNICO', 'Japonés id is MJ_1730_UNICO'); console.log('All assertions passed.');"</automated>
  </verify>
  <done>
    - CONFIG.idiomas = ['Alemán', 'Francés', 'Inglés', 'Italiano', 'Japonés']
    - CONFIG.niveles contains 'B1+' at position between 'B1.2' and 'B2.1'
    - CONFIG.horariosPorIdioma['Francés'] has two entries: LM_1730 and MJ_1730
    - CONFIG.horariosPorIdioma['Italiano'] has two entries: MJ_1730 (plain label) and VS_1730; no "Único" text in labels
    - CONFIG.horariosPorIdioma['Japonés'] has one entry with id MJ_1730_UNICO and label matching the form text
    - The inline comment no longer says Francés falls to _default
    - CONFIG.semestre reads '2do Semestre 2026'
    - node verification command exits 0 with "All assertions passed."
  </done>
</task>

</tasks>

<verification>
Run the automated verify command from Task 1. It exercises every catalog change via Node's require() of Config.gs using the existing module.exports shim (added in Phase 01).

No GAS-runtime services are touched by Config.gs, so Node can load and assert it directly.
</verification>

<success_criteria>
- src/Config.gs reflects the exact 2do Semestre 2026 form catalog
- The verify command prints "All assertions passed." with exit code 0
- No other CONFIG fields were altered
</success_criteria>

<output>
No SUMMARY file needed for quick tasks. After completion, confirm the verify command passes and the file is saved ready for copy-paste into the Apps Script editor.
</output>
