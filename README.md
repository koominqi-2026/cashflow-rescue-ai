# Cashflow Rescue AI

Smart restocking & cashflow decision tool for students who are involved in small businesses.

**Live demo**: https://9fc8c8cbcaea4902be8013a2a33526c4.sg.agentos-app.run/

## What it does

Cashflow Rescue AI helps small bakery owners answer one question every morning:
**"What should I buy today without breaking my cash safety net?"**

The user types a plain-language prompt describing their cash, bills, sales and stock.
The system detects values, fills the forms, runs the forecast, and recommends a
clear decision: **Buy full plan**, **Buy critical only**, or **Hold all buying**.

## Key features

- **Natural-language prompt** → auto-fills cash, expenses, stock, and sales inputs
- **Cash dashboard** with spendable cash, reserved bills, restock cost, and net position
- **Stock & sales forecast** with auto-calculated demand from product recipes x sales rate
- **Two stock input modes**: monthly physical count or CSV import from stock system
- **Today's sales**: manual entry or POS CSV import
- **Editable demand** values — override auto-calculated numbers per ingredient
- **Full-screen report** viewable in-browser (print-friendly) with profit/loss coloring
- **Styled Excel export** with borders, Times New Roman, color-coded margins and urgency
- **Collapsible sections** for a clean, focused workflow
- All data stays in the browser (localStorage) — no server, no database

## Tech stack

- React 18 (via CDN, no build step)
- htm tagged templates for JSX-like syntax
- SheetJS (xlsx-js-style) for formatted Excel export
- Pure static site — `index.html` + `app.js`

## File structure

```
cashflow-rescue-ai/
  index.html    # HTML entry + all CSS styling
  app.js        # Complete React application
  README.md     # This file
```

## How to run

Open `index.html` in any modern browser. No installation or build required.

## Built for

Dormathon 2026 — Track 2: WorkBuddy / Agentic Solutions
