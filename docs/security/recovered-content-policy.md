# Recovered-content policy

Recovered bytes are hostile until validation and threat classification complete. The app never executes them, never embeds active HTML/PDF/Office content, never invokes an operating-system default application, and never opens an export destination automatically. Raster and text previews run with byte, pixel, line, and time bounds. Executables, scripts, active documents, archives that fail safety limits, and threat-rule matches remain blocked. Exporting potentially unsafe artifacts requires explicit acknowledgement and records the decision and output hash.
