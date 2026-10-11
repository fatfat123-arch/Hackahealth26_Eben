The card download overlays `badges-reference.pdf`, an unmodified copy of
`Badges_Eben-Hezer_selection_A4.pdf` supplied by the user (SHA-256
`e9bcaeb0f9c30109a666bac95adcc3124d70004880255c4393df4f785860536c`).
The identical runtime copy is `src/assets/badges-reference.pdf`. Vite bundles it
through a `?url&inline` import in the lazily loaded card module; no documentation
path, separate PDF resource route or filesystem access is needed at runtime.

`src/lib/passport-card-pdf.ts` removes the five placeholder text objects from
the B2/C1/C4 form streams and overlays the two names, two vector QR codes and,
when available, the center-cropped portrait. Missing portraits retain the
original neutral icon. C3/D6 and every static illustration, logo, border and
label remain in the source page. Measurements are in PDF points; the source
badge outlines already have the required physical dimensions. Only the
rounded source page box is corrected to exact A4, without scaling its content.
Replacing the reference PDF requires remeasuring the dynamic zones and
updating the guarded placeholder signatures.

The source PDF embeds a subset of Grandstander ExtraBold that lacks letters
needed for other names. `src/assets/fonts/Grandstander-ExtraBold.ttf` is the
complete weight-800 static instance of the matching
[Google Fonts Grandstander](https://github.com/google/fonts/tree/main/ofl/grandstander)
variable font, instantiated with fontTools. Its SIL OFL license is included in
`src/assets/fonts/OFL-Grandstander.txt`. Other embedded template fonts are unchanged.
