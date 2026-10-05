# Image de fond de la page de connexion

Collage façon « photos collées au mur » de gamers africains, en noir et blanc pour
s'accorder au site. À générer sur fal.ai, puis à déposer dans `public/connexion/collage.webp`.

## Réglages conseillés

- **Modèle** : FLUX 1.1 [pro] ultra, Imagen 4 ou Seedream (les plus fiables sur les visages et les mains)
- **Format** : 9:16 vertical, 1080 × 1920 minimum (idéalement 1440 × 2560)
- **Nombre** : en générer 4 et garder la meilleure ; regarder de près les mains et les téléphones
- **Après** : convertir en WebP qualité 75 (≈ 200 Ko). La page est la première vue sur un réseau mobile.

## Prompt

```
Black and white photography. Vertical 9:16 editorial photo collage: eight candid photographs
pasted on a dark wall like a scrapbook, in a loose grid of four rows and two columns, each
print with a thin white border, slightly rotated at different angles between -4 and 4 degrees,
some edges overlapping, small pieces of masking tape on a few corners.

Every photo shows young Black African gamers aged 16 to 28, each in a different pose and moment:
a young man in a football jersey holding a smartphone sideways with both thumbs, deeply focused;
a young woman with long braids wearing over-ear headphones, laughing at her phone;
three friends squeezed on a wooden bench around one phone, fists raised, celebrating a win;
a close-up of hands holding a smartphone in landscape mode;
a teenager sitting on a parked motorbike in a busy street, playing on his phone;
a young woman in a hoodie in a small cybercafé holding a game controller, smiling at the camera;
two brothers on a living-room sofa with game controllers, one shouting with excitement;
a young man with a gaming headset on a rooftop at night above the lights of a West African city.

Everyday settings from Abidjan, Dakar, Douala and Lagos: painted concrete walls, plastic chairs,
wax-print fabrics, motorbikes, market stalls. Documentary street photography, 35mm film,
high-contrast monochrome, deep blacks, soft natural light, rich detail in dark skin tones,
visible film grain. The whole image is dark and moody, and the bottom third fades into
pure black so white text can sit on top.
```

## Prompt négatif (si l'outil le propose)

```
color, text, letters, logos, watermark, signature, neon, glow, halo, lens flare, cartoon,
illustration, 3D render, plastic skin, deformed hands, extra fingers, distorted faces,
duplicated faces, blurry faces, washed-out grey, low contrast, stock photo, white background
```

## Si le résultat ne va pas

- **Visages déformés** : passer à six photos (trois rangées de deux) ; moins de visages, chacun plus net.
- **Trop lumineux ou trop gris** : ajouter « low-key lighting, deep shadows, high contrast » au début du prompt.
- **Image trop « pub »** : ajouter « unposed, candid moments, imperfect framing ».
- **Du texte apparaît sur les écrans** : ajouter « phone screens show only abstract blurred colors ».
