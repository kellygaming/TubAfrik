# Image de fond de la page de connexion

Collage façon « photos collées au mur » de gamers africains. À générer sur fal.ai,
puis à déposer dans `public/connexion/collage.webp`.

## Réglages conseillés

- **Modèle** : FLUX 1.1 [pro] ultra, Imagen 4 ou Seedream (les plus fiables sur les visages et les mains)
- **Format** : 9:16 vertical, 1080 × 1920 minimum (idéalement 1440 × 2560)
- **Nombre** : en générer 4 et garder la meilleure ; regarder de près les mains et les téléphones
- **Après** : convertir en WebP qualité 75 (≈ 200 Ko). La page est la première vue sur un réseau mobile.

## Prompt

```
Vertical 9:16 editorial photo collage, eight candid photographs pasted on a dark wall like a
scrapbook, arranged in a loose grid of four rows and two columns, each print with a thin
off-white border, slightly rotated at different angles between -4 and 4 degrees, some edges
overlapping, small pieces of beige masking tape on a few corners.

Every photo shows young Black African gamers, aged 16 to 28, in a different pose and moment:
1. a young man in a football jersey holding a smartphone sideways with both thumbs, deeply
   focused, playing a mobile battle royale;
2. a young woman with long braids wearing over-ear headphones, laughing at her phone;
3. three friends squeezed on a wooden bench around one phone, fists raised, celebrating a win;
4. close-up of hands holding a smartphone in landscape mode, the screen shows a blurred
   colorful game scene;
5. a teenager sitting on a parked motorbike in a busy street at golden hour, playing on his phone;
6. a young woman in a hoodie at a small cybercafé, holding a game controller, smiling at the camera;
7. two brothers on a living-room sofa with game controllers, one shouting with excitement;
8. a young man with a gaming headset on a rooftop at dusk, the lights of a West African city below.

Authentic everyday settings from Abidjan, Dakar, Douala and Lagos: painted concrete walls,
plastic chairs, wax-print fabrics, corrugated metal, motorbikes, market stalls.
Documentary street photography, shot on 35mm film, natural warm light from dusk to night,
rich deep skin tones beautifully and evenly lit, subtle film grain, slightly desaturated,
warm earthy palette of terracotta, ochre, deep brown and black with small touches of orange.
The whole image is fairly dark and moody, and the bottom third fades into deep shadow so text
can be placed over it.
```

## Prompt négatif (si le modèle l'accepte)

```
text, letters, captions, logos, brand names, watermark, signature, neon lights, glowing halo,
backlight glow, rim light, lens flare, light leaks, cartoon, illustration, 3D render,
plastic skin, deformed hands, extra fingers, distorted faces, duplicated faces, blurry faces,
oversaturated colors, studio stock photo, white background
```

## Si le résultat ne va pas

- **Visages déformés** : passer à six photos (trois rangées de deux) ; moins de visages, chacun plus net.
- **Trop lumineux** : ajouter « low-key lighting, deep shadows » au début du prompt.
- **Image trop « pub »** : ajouter « unposed, candid moments, imperfect framing ».
- **Du texte apparaît sur les écrans** : ajouter « phone screens show only abstract blurred colors ».
