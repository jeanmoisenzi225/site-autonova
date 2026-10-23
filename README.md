# Site vitrine d'Autonova Group

Site statique qui présente le garage. Ses contenus (textes, photos, tarifs, postes, actualités, avis) se modifient dans l'appli My Autonova, écran **« Mon site internet »** (administrateur), puis « Publier ». Le design est ici.

Dépôt indépendant de l'appli (dépôt `Mon-Garage-Auto`) : le seul lien est l'adresse de l'API et l'identifiant du garage, dans `assets/config.js`. Côté appli, voir BACKLOG 53 et 54 et l'épopée EPIC-15 du dépôt `Mon-Garage-Auto`.

## Comment ça marche

1. L'administrateur publie depuis l'appli.
2. L'appli relance la construction du site (lien de mise à jour enregistré dans « Mon site internet » › « Photos et réglages »).
3. `build.mjs` lit la version publiée (`GET /api/public/garages/<slug>/site`), télécharge les photos, remplit les modèles de `src/` et écrit le site dans `dist/`.

Tant que rien n'est publié, le site est construit avec `content.example.json`, avec le bandeau « Site en préparation » et la non-indexation par les moteurs de recherche. Si l'appli est injoignable pendant la construction, celle-ci échoue et le site en ligne reste inchangé.

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/*.html` | Modèles des pages (Accueil, Le garage, Prestations et tarifs, Recrutement, Contact, Mentions légales, Politique de confidentialité) |
| `src/parts/` | Morceaux communs : en-tête, menu, pied de page, bloc des avis |
| `assets/` | Styles (ordinateur, tablette, téléphone), script (menu, horaires, formulaires), logo, polices, `config.js` |
| `build.mjs` | Construction (Node 20 ou plus, sans dépendance) |
| `content.example.json` | Contenus d'exemple |

Syntaxe des modèles (type Mustache) : `{{champ}}` texte échappé ; `{{#liste}}…{{/liste}}` répétition ou condition ; `{{^champ}}…{{/champ}}` si vide ; `{{> partie}}` morceau de `src/parts/`. Une rubrique laissée vide dans l'appli n'apparaît pas.

## Essayer en local

```bash
node build.mjs --exemple          # contenus d'exemple, sans réseau
node build.mjs                    # contenus publiés dans l'appli
cd dist && python3 -m http.server 8088
```

Le formulaire « Être recontacté » écrit dans l'appli de production (`apiUrl` de `config.js`).

## Hébergement

Site statique, projet « Sites des garages » : branche `main` ; *Root Directory* vide ; *Build Command* `node build.mjs` ; *Publish Directory* `dist`. Le lien de mise à jour (*Deploy Hook* du site) est à enregistrer dans l'appli, « Mon site internet » › « Photos et réglages ».
