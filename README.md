# Site vitrine d'Autonova Group

Site statique (HTML, CSS, JavaScript, sans étape de compilation) qui présente le garage et relie son formulaire « Être recontacté » à l'appli My Autonova. BACKLOG 53, EPIC-15 (F-15.8).

Dépôt indépendant de l'appli (dépôt `Mon-Garage-Auto`) : le seul lien est l'adresse de l'API et l'identifiant du garage, dans `assets/config.js`. Côté appli, voir BACKLOG 53 et l'épopée EPIC-15 du dépôt `Mon-Garage-Auto`.

## Pages

| Fichier | Page |
|---|---|
| `index.html` | Accueil |
| `garage.html` | Le garage (histoire, équipe, atelier) |
| `prestations.html` | Prestations et tarifs |
| `recrutement.html` | Postes ouverts et candidature |
| `contact.html` | Coordonnées et formulaire (onglets client et candidat ; `contact.html#candidature` ouvre l'onglet candidat) |
| `mentions-legales.html`, `confidentialite.html` | Pages légales (projets à faire valider par Autonova) |

Mises en page : ordinateur (1 100 px et plus), tablette (700 à 1 099 px), téléphone (moins de 700 px), toutes dans `assets/styles.css`.

## Mettre à jour les contenus

- **Coordonnées** (téléphone, WhatsApp, e-mail, adresse, lien du plan) : uniquement dans `assets/config.js`. Un champ vide s'affiche « [à compléter] ».
- **Textes** : directement dans les pages ; tout ce qui reste à fournir est entre crochets.
- **Photos** : remplacer chaque bloc `<div class="photo …" data-label="[Photo : …]">` par une image, par exemple `<img src="assets/photos/atelier.jpg" alt="L'atelier" class="ratio-43" style="width: 100%; object-fit: cover; border-radius: 6px">`. Photos de 1 600 px de large au plus, en JPEG compressé.
- **Mise en ligne définitive** : retirer le bandeau « Site en préparation » (`draft-banner`) et la balise `<meta name="robots" content="noindex">` de chaque page.

## Formulaire

Envoyé en JSON à `POST <apiUrl>/api/public/garages/<garageSlug>/requests` (catalogue de l'API du dépôt `Mon-Garage-Auto`, `docs/specifications/technique/03-catalogue-api.md`, route 148). La demande arrive dans l'appli, écran « Demandes du site ». Le champ caché `website` piège les robots ; il ne doit pas être retiré. Exige le backend en v0.81.0 ou plus.

## Essayer en local

```bash
python3 -m http.server 8088
```

puis ouvrir http://localhost:8088. Le formulaire écrit alors dans l'appli de production (`apiUrl` de `config.js`).

## Hébergement sur Render

Site statique Render, dans le projet « Sites des garages » (séparé de l'appli) : *New* › *Static Site* › ce dépôt, branche `main` ; *Root Directory* vide ; *Build Command* vide ; *Publish Directory* `.`. Gratuit, aucune variable d'environnement.
