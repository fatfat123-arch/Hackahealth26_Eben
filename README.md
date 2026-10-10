# HackaHealth 2026 - Eben-Hezer Communication Passport

This repository combines the Communication Friend web application with the
CartoonGAN media-processing pipeline developed for the Eben-Hezer challenge.

## Web application

Build a website called "Passeport de communication".
## Context
This is a communication passport for people with communication disorders, from mild to severe, including non-verbal people. Each person carries a QR code. When someone (a caregiver, a shop assistant, a stranger) scans it, they land on that person's passport page and learn how to communicate with them.
For now, build ONLY the public page that people see after scanning the QR code. No login, no editing interface, no QR code generation yet. Use realistic placeholder data for one fictional person, stored in a single data object/file so it can later be replaced by a database.
Design this as a desktop website first. Then make it fully responsive so it adapts cleanly to tablet and mobile screens.
## Page structure (top to bottom)
1. Title
At the top of the page, the title "Passeport de communication".
2. Profile section
Two columns on desktop:
- Left: a photo of the person.
- Right:
  - "À propos de moi": a short description of the person.
  - "Comment utiliser cette page": a short text explaining the purpose of the page and how the visitor can use it to communicate with the person.
  - Basic information, shown as a simple label/value list:
    - Nom
    - Date de naissance
    - Téléphone (clickable tel: link)
    - Adresse
    - Dernière mise à jour
On mobile, the two columns stack vertically, photo first.
3. Accordion sections
Four collapsible sections (dropdowns), all closed by default, in this order. Each can be opened and closed independently.
a) "Mon dictionnaire"
The person's own vocabulary: the signs, gestures and sounds they use and what each one means. Display as a grid of cards (4 per row on desktop, 2 per row on mobile). Each card contains one media item and, under it, a title saying what that sign or sound means (e.g. "J'ai soif", "Oui", "Je suis fatigué"). The media can be any of: image, GIF, short video, or audio clip. Videos and audio must have visible play controls and must not autoplay with sound. Include placeholder cards covering each media type.
b) "Mes centres d'intérêt"
The person's hobbies and favourite subjects. Simple bullet list for now.
c) "Mes peurs / Ce que je n'aime pas"
Things that frighten or upset the person. Simple bullet list for now.
d) "Autres informations"
Any additional information. Simple bullet list or free text.
## Design
- Colors: use only #004d95 (blue), #f1aa00 (yellow/orange) and #ffffff (white). Blue for the title, headings and accordion headers; yellow as an accent (underlines, icons, active states); white background. Body text in a dark neutral for readability.
- Layout: content centered in a fixed-width container (around 1100px max) on desktop, full width with side padding on mobile.
- Style reference: https://www.eben-hezer.ch/accueil-eben-hezer-lausanne.html. Aim for the same feel: a sober, institutional Swiss foundation website. Clean, calm, trustworthy.
- It must NOT look AI-generated. That means: no gradients, no glassmorphism, no glowing or heavy shadows, no emojis, no decorative illustrations or blobs, no oversized hero section, no pill-shaped everything, no animations other than the accordion opening and closing. Flat colors, simple borders, modest corner radius, a plain sans-serif font, generous spacing.
- Accessibility matters for this audience: large readable text (minimum 16px), strong contrast, large clickable areas, keyboard-accessible accordions, alt text on all images.
## Language
All visible text on the page must be in French, including placeholder content. No English anywhere in the interface.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/908660b0-d7f5-4cc8-8334-b6ca452abb04).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Cartooniser

The image and video processing pipeline is stored in `Cartooniser/`. See
`Cartooniser/USAGE.txt` for setup and usage instructions.

Dictionary videos can optionally be cartoonized during upload. The protected
`/api/cartoonise` endpoint invokes the Python pipeline and returns a silent MP4.
Production requires the packages in `Cartooniser/requirements.txt` and supports:

```text
CARTOONISER_PYTHON=/absolute/path/to/python
CARTOONISER_MAX_BYTES=104857600
CARTOONISER_TIMEOUT_MS=900000
```
