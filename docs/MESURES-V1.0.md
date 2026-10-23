# Mesures mémoire et processeur — Vitrine 1.0

Mesuré le 23 octobre 2026 sur la version emballée pour Linux (`release/linux-unpacked/vitrine`, Electron castlabs
43.7.7), fenêtre 1440 × 900, avec les mêmes données fictives que les captures (Spotify simulé : aucune demande au
vrai Spotify, aucun compte utilisé).

## Méthode

- **Mémoire** : la PSS de chaque processus d'Electron (`/proc/<pid>/smaps_rollup`). La mémoire partagée y est
  comptée une seule fois, répartie entre les processus qui la partagent : c'est ce que Vitrine coûte vraiment à
  l'ordinateur.
- **Processeur** : `app.getAppMetrics()` d'Electron, somme de tous les processus, moyenne sur 10 secondes après
  3 secondes de repos.
- Script : `v10-measure.mjs` (dans l'espace de travail de la session), même scénario à chaque fois.

**À savoir avant de lire les chiffres** : la machine de mesure n'a pas de carte graphique. Chromium y dessine tout
au processeur (SwiftShader). Le processus « GPU » et le processeur sont donc **plus chargés qu'un PC ordinaire**, où
les flous et les animations passent par la carte graphique. Les chiffres servent à comparer les écrans et les
réglages entre eux, pas à promettre une consommation exacte chez vous.

## Résultats

| Écran | Mémoire (PSS) | Processeur | Détail (Mo) |
|---|---|---|---|
| Accueil | 512 Mo | 32 % | Browser 109, GPU 122, Utility 28, Page 253 |
| Stats | 487 Mo | 3 % | Browser 110, GPU 108, Utility 28, Page 241 |
| Paroles plein écran (karaoké mot à mot) | 540 Mo | 30 % | Browser 104, GPU 131, Utility 28, Page 276 |
| Paroles plein écran, **mode léger** | 503 Mo | 10 % | Browser 107, GPU 113, Utility 28, Page 255 |
| Fenêtre cachée (zone de notification) | 392 Mo | 2 % | Browser 106, GPU 112, Utility 28, Page 145 |
| Cachée depuis une minute (page libérée) | **248 Mo** | **0 %** | Browser 122, GPU 95, Utility 31 |

### Ce qui coûte, sur l'accueil

Chaque effet coupé à son tour (Réglages › Performance), accueil affiché :

| Accueil | Processeur |
|---|---|
| Tous les effets | 31 % |
| Sans fonds animés | 21 % |
| Sans défilement du bandeau | 21 % |
| **Sans effets de flou** | **16 %** |

Le flou (verre dépoli, `backdrop-filter`) est le plus cher sans carte graphique ; c'est pourquoi le **mode léger**
s'active seul sur un PC modeste (2 cœurs, 4 Go) ou quand Windows demande moins d'animations.

### Fuites de mémoire

Six tours complets de l'appli (Flow, Bibliothèque, Stats, Réglages, Accueil, paroles plein écran), ramasse-miettes
forcé entre chaque mesure :

| Moment | Tas JavaScript | Éléments de la page |
|---|---|---|
| Départ | 4,9 Mo | 986 |
| Après 2 tours | 7,7 Mo | 1 055 |
| Après 4 tours | 8,0 Mo | 1 055 |
| Après 6 tours | 8,1 Mo | 1 057 |

Le tas se stabilise après la mise en cache des premières pages : **pas de fuite**. (Entre deux rechargements de la
page, la mémoire monte un temps, le temps que le ramasse-miettes passe ; ce n'est pas une fuite.)

## Par rapport à l'objectif

La feuille de route visait **moins de 300 Mo en lecture** (objectif O3). Fenêtre ouverte, Vitrine 1.0 en prend
environ **490 à 540 Mo** sur cette machine sans carte graphique, dont plus de 100 Mo pour le seul dessin logiciel.
L'objectif est tenu **fenêtre cachée** (248 Mo, la musique continue), pas fenêtre ouverte. Pistes pour la suite :
images de fond plus petites, pages non visitées libérées plus tôt, mesure sur un vrai PC Windows avec carte
graphique (le chiffre qui compte pour la plupart des gens).
