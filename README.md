# Site vitrine d'Autonova Group

Site statique qui présente le garage. Ses contenus (textes, photos, tarifs, postes, actualités, avis) se modifient dans l'appli My Autonova, écran **« Mon site internet »** (administrateur), puis « Publier ». Le design est ici.

Dépôt indépendant de l'appli (dépôt `Mon-Garage-Auto`) : le seul lien est l'adresse de l'API et l'identifiant du garage, dans `assets/config.js`. Côté appli, voir BACKLOG 53 et 54 et l'épopée EPIC-15 du dépôt `Mon-Garage-Auto`.

## Comment ça marche

1. L'administrateur publie depuis l'appli.
2. L'appli relance la construction du site (lien de mise à jour enregistré dans « Mon site internet » › « Photos et réglages »).
3. `build.mjs` lit la version publiée (`GET /api/public/garages/<slug>/site`), télécharge les photos, remplit les modèles de `src/` et écrit le site dans `dist/`.

**Règle de fusion (décision du 2026-10-23)** : `content.example.json` contient les textes du site, qui servent de base. Ce qui est publié depuis l'appli ne remplace que les champs remplis ; un texte vide, une photo absente ou une liste vide dans l'appli laissent le contenu du site tel quel. Une liste remplie dans l'appli (équipe, prestations, postes, actualités, photos) remplace la liste entière du site.

**Rubriques masquées** : l'interrupteur « Afficher sur le site » de l'appli retire une rubrique du site (champ `hidden` du contenu, voir `show` dans `build.mjs`).

**Mesure d'audience** (BACKLOG 55) : `assets/site.js` envoie à l'appli chaque page vue et les clics utiles (appeler, WhatsApp, itinéraire, e-mail, espace client, formulaires), sans cookie ni stockage dans le navigateur, et rien si le visiteur a activé « Do Not Track » ou « Global Privacy Control ». Les chiffres se lisent dans l'appli, « Mon site internet » › Audience. Les liens partagés peuvent porter `?utm_source=…&utm_campaign=…` (l'appli fabrique ces liens).

**Notre histoire** (2026-10-29) : page `histoire.html` (récit, grandes étapes, fondateur), contenu `history` modifiable dans l'appli (« Mon site internet » › « Notre histoire », appli v0.86.0) ; rubriques masquables `historyTimeline` et `historyFounder`. Sans photo du récit, la page reprend celle de « Notre histoire » de la page « Le garage ».

**Contenus en ligne** : la construction écrit aussi `dist/contenus.json` (les textes réellement affichés), que l'appli lit pour son aperçu.

La non-indexation par les moteurs de recherche reste tant qu'un texte entre crochets (« [Prénom Nom] ») reste à compléter (le bandeau « Site en préparation » a été retiré le 2026-10-29). Si l'appli est injoignable pendant la construction, celle-ci échoue et le site en ligne reste inchangé.

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/*.html` | Modèles des pages (Accueil, Le garage, Notre histoire, Prestations et tarifs, Recrutement, Contact, Mentions légales, Politique de confidentialité) |
| `src/parts/` | Morceaux communs : en-tête, menu, pied de page, bloc des avis |
| `assets/` | Styles (ordinateur, tablette, téléphone), script (menu, horaires, formulaires), logo, polices, `config.js` |
| `build.mjs` | Construction (Node 20 ou plus, sans dépendance) |
| `content.example.json` | Contenus d'exemple |

Syntaxe des modèles (type Mustache) : `{{champ}}` texte échappé ; `{{#liste}}…{{/liste}}` répétition ou condition ; `{{^champ}}…{{/champ}}` si vide ; `{{> partie}}` morceau de `src/parts/`. Un champ laissé vide dans l'appli garde le texte du site.

## Essayer en local

```bash
node build.mjs --exemple          # contenus d'exemple, sans réseau
node build.mjs                    # contenus publiés dans l'appli
cd dist && python3 -m http.server 8088
```

Le formulaire « Être recontacté » écrit dans l'appli de production (`apiUrl` de `config.js`).

## Hébergement

Site statique, projet « Sites des garages » : branche `main` ; *Root Directory* vide ; *Build Command* `node build.mjs` ; *Publish Directory* `dist`. Le lien de mise à jour (*Deploy Hook* du site) est à enregistrer dans l'appli, « Mon site internet » › « Photos et réglages ».
