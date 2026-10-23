# Vitrine vue par Movix et Mystic Saba

Ce document se met à la place de l'auteur de [mysticsaba.com](https://mysticsaba.com), de [movix.dog](https://movix.dog)
et de [MovixOpenSource](https://github.com/movixstream/MovixOpenSource) : ce qu'il ferait sur Vitrine, comment, avec
quels outils, ce que chaque idée apporte et coûte, et les erreurs à éviter. Les points marqués **✅ v0.7.0** sont
réalisés dans cette version ; les autres sont dans la feuille de route (ROADMAP.md).

**Sources, consultées le 22 octobre 2026** : les deux sites (captures à 1440 px, lecture des styles calculés), le
dépôt MovixOpenSource (commit `9a7e784`, dossiers `src/pages`, `src/components`, `src/utils`, `brand/`), et les
captures du lecteur **Musix** (prototype de mysticsaba.com) que vous avez partagées.

---

## 1. Ce qu'on observe

### mysticsaba.com — le studio

| Élément | Constat | Détail technique relevé |
|---|---|---|
| Typographie | Titres géants en Clash Display, corps en Satoshi, libellés en JetBrains Mono majuscules espacées | `--font-display: "Clash Display"`, `--font-mono: "JetBrains Mono"` |
| Couleurs | Noir chaud `#0a0908`, crème `#ede8dd`, ambre `#f2a33c` → rouge `#ff3d2e` en dégradé sur les mots forts | variables `--bg`, `--cream`, `--amber`, `--red` |
| Mots en italique ambre | « Projects, past **&** present », « Full-stack, full ***volume*** » | un mot par titre, jamais plus |
| Libellés numérotés | « 01 / WORK », « 02 / NEXT », « 03 / STACK » | mono, ambre, en tête de chaque section |
| Mouvement | Une seule courbe pour tout : `cubic-bezier(.22, 1, .36, 1)`, 0,22 à 0,6 s | animations nommées `grain 9s`, `drift 24s`, `dock-in 0.8s`, `track-in 0.55s`, `eq 0.9s` |
| Fond | Grain animé sur toute la page, champ de points 3D en vague dans le hero | le champ s'anime avec la musique dans Musix |
| Repères | Barre de progression de lecture de la page sous l'en-tête, bandeau défilant des technologies | |
| Logo | « ○ mysticsaba® » : un anneau ambre, le nom en mono minuscule, ® en exposant | favicon : carré arrondi noir, anneau ambre |
| **Musix** (vos captures) | Dock flottant en bas à droite : bouton lecture ambre, titre en défilement, mini-onde de progression, bouton micro (paroles), chevron qui ouvre un panneau : pochette, titre en Clash Display, artiste en mono, **3 lignes de paroles** (précédente, en cours en gras, suivante) avec badge « CC » et lien « PAROLES ↗ », progression en forme d'onde, file numérotée « 01 · 02 » avec la ligne en cours en ambre et un égaliseur animé | Paroles plein écran : texte géant aligné à gauche, **la ligne en cours se remplit au fil du chant**, lignes passées floues, fond « aurore » tiré des couleurs de la pochette, commandes centrées en bas |

### movix.dog — la plateforme

| Élément | Constat | Détail technique relevé |
|---|---|---|
| Logo | **[Movix]** : le nom en blanc entre crochets rouges ; l'icône (`brand/movix.svg`) dessine des crochets percés comme une pellicule | déclinaisons `movix-rond`, `movix-horizontal`, `movix-inverse` ; même famille : Loadix, groupe « [ix] » |
| Hero | Grand bandeau arrondi, logo du film à la place du titre, pastilles (FILM, 2026, ★ 7,4), bouton verre « Plus d'infos », **pilule de commandes** : points (l'actif s'allonge), barre de progression rouge du défilement, bouton pause | Embla Carousel |
| Rangées | Titre en majuscules grasses avec **un trait rouge court dessous** et une icône ; affiches avec pastille de type (FILM / SÉRIE / SAGA) | `ContentRow`, `CarouselTitle` |
| **Top 10** | « Today's Trends » : **chiffres géants détourés en rouge** qui chevauchent les affiches | `Top10Page` |
| Événement | « Halloween Special » avec compte à rebours (« 9 days to Halloween ») et filtres d'ambiance (Mild chills / Goosebumps / Terror) | `HalloweenAtmosphere`, `Snow` |
| Performance | **Mode léger** automatique (mouvement réduit demandé, TV, ≤ 2 cœurs, ≤ 2 Go de mémoire) avec réglages séparés : animations de fond, animations de chargement, défilement automatique, flous, transitions | `LightModeContext`, `utils/animationPreferences.ts` |
| Chargement | Les rangées se chargent **une par une** quand le navigateur est libre (`requestIdleCallback`), squelettes en attendant ; barre de progression fine en haut pendant le chargement d'une page | `LazySection`, `sectionLoadScheduler`, `RouteProgressBar` |
| Fonctions | Wrapped (bilan annuel animé : compteurs, podium, « ères »), **Roulette** (tirage au sort avec confettis), Top 10, calendrier des sorties, CineGraph (graphe des acteurs), profils, WatchParty, **écran de veille** (affiches en mouvement après inactivité), listes partagées, anti-spoiler | `WrappedPage`, `RoulettePage`, `ScreenSaver`… |
| Mouvement | framer-motion partout (`AnimatePresence` dans 98 fichiers), surtout 0,2–0,3 s, ressorts `stiffness 400, damping 17` sur les boutons | |

---

## 2. La liste : ce qu'il ferait sur Vitrine

Chaque point : **quoi**, **comment / avec quoi**, **avantages**, **inconvénients**, **pièges**, **visuel**, **décision**.

### A. Identité

**A1. Le logo « [Vitrine] » de la famille [ix]**
- *Comment* : un SVG dessiné à la main, comme `brand/movix.svg` : crochets rouges, et à l'intérieur trois barres
  d'égaliseur (la musique) au lieu des perforations de pellicule. Wordmark « [Vitrine] » dans l'en-tête. Le script
  `scripts/make-icon.mjs` en tire l'icône d'appli (PNG 1024, ICO Windows) et les icônes de la zone de notification.
- *Avantages* : reconnaissable, cohérent avec Movix / Loadix, lisible en petit.
- *Inconvénients* : on quitte le point rouge actuel ; il faut refaire toutes les tailles d'icône.
- *Pièges* : l'icône de la zone de notification fait 16 px : trois barres, pas plus ; sur macOS elle doit rester
  monochrome (« template »). Ne pas reprendre le nom ni le dessin exact de Movix : même style, autre marque.
- *Visuel* : crochets `#dc2626` épais, barres blanches de hauteurs 60 / 100 / 40 %, fond noir.
- *Décision* : **✅ v0.7.0** (icône d'appli, icônes de la zone de notification, logo de l'en-tête)

**A2. Une intro au lancement** (comme `IntroAnimation` de Movix)
- *Comment* : framer-motion + SVG : les barres de l'égaliseur montent, les crochets se referment autour, 0,9 s.
- *Avantages* : la marque au premier regard.
- *Inconvénients* : retarde l'appli si elle bloque.
- *Pièges* : ne jamais bloquer (elle joue pendant que les données arrivent) ; une fois par jour au plus ; coupée en
  mode léger et si le système demande moins d'animations.
- *Décision* : ⬜ plus tard (le gain est d'image, pas d'usage).

### B. Visuels et mouvement

**B1. Une seule courbe de mouvement** — `cubic-bezier(.22, 1, .36, 1)` (Mystic) pour toutes les transitions,
0,2 à 0,6 s. *Avantage* : tout bouge « pareil », c'est ce qui fait le côté soigné. *Piège* : pas de ressort mou sur
les éléments de lecture (ils doivent répondre tout de suite). **✅ v0.7.0** (transitions de page).

**B2. Transitions entre les pages** — `AnimatePresence` de framer-motion autour de la vue : fondu + 12 px de
glissement. *Avantages* : continuité. *Inconvénients* : une page qui sort et une qui entre coexistent un instant
(mémoire). *Pièges* : garder la sortie très courte (0,15 s) ; coupé en mode léger. **✅ v0.7.0**

**B3. Le grain animé** (Mystic, `grain 9s`) — une petite tuile de bruit en SVG inline, répétée, animée par
`transform` en pas (`steps`). *Avantages* : la texture « film » de mysticsaba. *Inconvénients* : un calque plein
écran de plus. *Pièges* : animer `transform` seulement (jamais `background-position`, qui repeint tout) ; opacité ≤ 4 % ;
coupé en mode léger. **✅ v0.7.0** (thème Mystic)

**B4. Titres de section numérotés** — « 01 / ÉCOUTÉS RÉCEMMENT » en mono ambre au-dessus du titre (Mystic) et le
trait rouge court dessous (Movix). *Avantage* : rythme, lecture rapide. *Piège* : pas plus de 6 sections numérotées
par page. **✅ v0.7.0**

**B5. Top 10 aux chiffres géants** (Movix « Today's Trends ») — vos 10 titres des 4 dernières semaines, chaque
pochette précédée d'un chiffre géant détouré (`-webkit-text-stroke`) qui la chevauche. *Avantages* : la rangée la plus
« Netflix » de Movix, données déjà disponibles (`/me/top/tracks`). *Pièges* : le chiffre 10 est deux fois plus large :
prévoir sa place ; contraste du contour sur une pochette claire. **✅ v0.7.0**

**B6. Pilule de commandes du bandeau** (Movix) — points (l'actif s'allonge), barre de progression du défilement
automatique, bouton pause. *Avantages* : on comprend que ça défile et on peut l'arrêter. *Piège* : la barre doit
repartir de zéro à chaque changement, y compris manuel. **✅ v0.7.0**

**B7. Barre de lecture de la page** (Mystic) — un trait ambre sous l'en-tête qui suit le défilement des longues
pages. Bon marché, mais utile surtout sur une playlist de 200 titres. ⬜ plus tard.

**B8. Champ de points en vague qui réagit à la musique** (Musix) — un canvas 2D (pas Three.js : 600 Ko de moins)
de 2 000 points, 30 images/s, en fond du plein écran. *Inconvénient majeur* : la musique de Spotify est protégée (DRM) :
impossible d'en lire le son pour l'analyser, et Spotify a fermé l'analyse audio aux applis. *Piège* : ne pas faire
croire que la vague « écoute » la musique si elle ne fait que pulser au hasard. ⬜ à étudier (pulsation au rythme des
lignes de paroles, annoncée comme telle).

**B9. Curseur personnalisé** (l'anneau de mysticsaba) — **à ne pas faire** dans une appli de bureau : il traîne
derrière la souris, gêne la précision et l'accessibilité.

**B10. Défilement à inertie** (Movix `SmoothScroll`, bibliothèque Lenis) — joli sur un site, mais dans une appli il
donne une impression de retard et coûte du JavaScript à chaque image. **À ne pas faire.**

### C. Le lecteur, façon Musix

**C1. Paroles plein écran « karaoké »** — vue dédiée : texte géant aligné à gauche (Clash Display / Archivo Black),
la ligne en cours **se remplit de gauche à droite** pendant sa durée, les lignes passées s'estompent et se floutent,
fond « aurore » : 3 taches floues aux couleurs de la pochette qui dérivent lentement ; commandes centrées en bas.
- *Comment* : LRCLIB donne l'heure de chaque ligne ; le remplissage est un dégradé (`background-clip: text`) dont la
  position suit `position / durée de la ligne`. Quand LRCLIB fournit l'heure de chaque mot (LRC « enrichi »), on
  remplit mot par mot.
- *Avantages* : l'écran signature de Musix, et le cœur de « l'esprit Vitrine ».
- *Inconvénients* : sans heure par mot, le remplissage est une estimation (régulier sur la ligne).
- *Pièges* : décalage : avancer de 0,25 s (la voix arrive avant la note) ; ne pas flouter plus de 3 lignes (coût GPU) ;
  textes longs : passer sur deux lignes, jamais réduire la police en direct.
- **✅ v0.7.0**

**C2. Carte « 3 lignes de paroles »** (panneau Musix) — précédente, en cours (grasse), suivante, badge « CC », lien
« PAROLES ↗ » qui ouvre C1. Dans le mini-lecteur et le lecteur plein écran. *Avantage* : les paroles sans quitter ce
qu'on fait. **✅ v0.7.0** (mini-lecteur)

**C3. Dock flottant** (Musix) — la barre de lecture devient une pilule en bas à droite qui s'ouvre en panneau.
*Avantages* : plus d'espace pour le contenu. *Inconvénients* : moins d'informations visibles d'un coup ; gros
changement d'habitudes. *Piège* : le panneau ouvert ne doit jamais cacher le bouton qui le ferme. ⬜ v0.8 (en option du
thème Mystic).

**C4. Progression « onde »** — une silhouette d'onde sous la barre de progression. Sans accès au son (DRM), l'onde
serait inventée : **décorative et annoncée comme telle**, ou rien. ⬜ à étudier.

### D. Fonctions de movix.dog

**D1. Roulette** (`RoulettePage`) — « Je ne sais pas quoi écouter » : une roue tourne parmi vos playlists et albums,
s'arrête avec des confettis (bibliothèque `canvas-confetti`, chargée seulement à l'usage), et lance la lecture.
*Avantages* : ludique, résout un vrai problème. *Pièges* : roue de 2 s maximum ; un bouton « Relancer » ; respecter le
mode léger (pas de confettis). **✅ v0.7.0**

**D2. Écran de veille** (`ScreenSaver`) — après 2 minutes sans souris ni clavier, lecteur plein écran ou paroles
ouvertes : la pochette en très grand qui dérive lentement, le titre, l'heure. *Avantages* : Vitrine devient un écran
d'ambiance (soirée, bureau). *Pièges* : jamais pendant qu'on lit autre chose ; se réveiller au premier mouvement ;
coupé en mode léger ; empêcher la mise en veille d'Electron seulement si demandé. **✅ v0.7.0**

**D3. Wrapped → « Rétro Vitrine »** (`WrappedPage`) — votre année en diapositives animées : minutes (compteur qui
monte), podium des artistes, titres, « ères » (l'artiste de chaque mois), heure préférée, série record, chacune
partageable en story. Les données existent depuis la v0.6 (historique de tout le compte + import). ⬜ v0.8 (L).

**D4. Calendrier des sorties** (`CalendarPage`) — les sorties récentes de vos artistes sur une frise. ⬜ v0.8.

**D5. CineGraph → « Constellation »** — un graphe de vos artistes reliés par leurs featurings (tirés de votre
historique). ⬜ plus tard.

**D6. Profils** (Netflix) — plusieurs comptes Spotify sur le même PC. ⬜ plus tard.

**D7. WatchParty → « Écouter ensemble »** — déjà dans la feuille de route (L, petit serveur).

**D8. Ambiances de saison** (`HalloweenAtmosphere`, `Snow`) — neige en décembre, citrouilles fin octobre, en fond
léger, coupées en mode léger. ⬜ plus tard (fun, pas prioritaire).

---

## 3. Alléger la mémoire

### Ce qu'on a mesuré (avant, profil de test, Linux)

| Situation | Vitrine (Electron) | Lecteur Edge | Total |
|---|---|---|---|
| Accueil | 878 Mo (page 336, GPU 153, utilitaires 215, principal 175) | — | 878 Mo |
| Lecteur plein écran | 1 032 Mo (page 454) | — | 1 032 Mo |
| Accueil, lecture via Edge | 782 Mo | **1 829 Mo, 17 processus** | **2,6 Go** |
| Fenêtre cachée dans la zone de notification | 683 Mo | 1 289 Mo | 2,0 Go |

Le lecteur Edge pèse plus que tout le reste. Viennent ensuite les images décodées (pochettes 300 et 640 px dans les
listes, fonds flous à partir d'images en 640 px) et les calques de flou.

### Après (v0.7.0, même mesure)

| Situation | Avant | Après | Écart |
|---|---|---|---|
| Accueil | 531 Mo | 485 Mo | −9 % |
| Statistiques | 579 Mo | 504 Mo | −13 % |
| Lecteur plein écran | 738 Mo | 547 Mo (471 Mo en mode léger) | −26 % (−36 %) |
| Accueil, lecture via Edge | 1 161 Mo | 950 Mo | −18 % |
| Cachée dans la zone de notification depuis plus d'une minute, lecture via Edge | 1 161 Mo | **711 Mo** | **−39 %** |

Mesures en PSS (la mémoire partagée comptée une seule fois, répartie entre les processus : ce que le Gestionnaire
des tâches de Windows appelle « mémoire »), sur Linux avec Microsoft Edge, profil de test, compte Premium réel. Les
toutes premières mesures (878 Mo, 2,6 Go…) additionnaient la mémoire partagée de chaque processus et surestimaient tout.
Sur Windows, les valeurs absolues diffèrent ; les écarts restent indicatifs. Le son a été revérifié après chaque
option d'Edge.

**Ce qui a donné le plus** : libérer la page quand Vitrine est cachée (~170 Mo côté Vitrine, et la page d'Edge se
détend aussi), les fonds flous en 64 px et une seule diapositive animée dans le bandeau (plein écran −190 Mo), les
cartes en 300 px au lieu de 640. Edge allégé ne rend qu'environ 70 Mo : son processus principal (~180 Mo) est
incompressible.

**Pas fait** : les rangées chargées une à une (`LazySection`) : les pochettes ne se chargent déjà qu'en approchant de
l'écran (`loading="lazy"`), le gain restant serait faible pour une complexité réelle.

### Ce qu'il ferait (Movix le fait déjà pour son site)

| Action | Comment | Gain attendu | Inconvénient / piège |
|---|---|---|---|
| **Edge allégé** | Lancer Edge sans extensions, sans synchronisation, sans services Edge (achats, barre latérale, traduction), sans GPU (le son n'en a pas besoin), avec un seul processus de rendu pour le lecteur et sa page Spotify, et un tas JavaScript plafonné | le plus gros | **Ne pas** couper la mise à jour des composants : c'est elle qui installe le module DRM Widevine dans un profil neuf ; tester le son après chaque option |
| **Vignettes 64 px dans les listes** | Une 3ᵉ taille d'image (`thumb`) pour les miniatures de 40 px | des dizaines de Mo sur une playlist de 200 titres | aucune |
| **Fonds flous en petite image** | Les fonds floutés à 80 px n'ont pas besoin d'une image en 640 px : 64 px suffit | des dizaines de Mo, et moins de travail GPU | aucun (on ne voit pas la différence sous un tel flou) |
| **Mode léger** (Movix) | Automatique si le système demande moins d'animations ou si le PC a ≤ 2 cœurs / ≤ 4 Go ; réglages : animations de fond, flous, transitions, défilement automatique du bandeau | mémoire GPU et processeur | l'appli est moins spectaculaire : le proposer, ne pas l'imposer |
| **Libérer la page quand Vitrine est cachée** | Après 1 minute dans la zone de notification, si la musique ne joue pas dans Vitrine même (lecture via Edge ou un autre appareil), la page est fermée ; le processus principal garde la zone de notification (commandes, titre en cours) et la synchro de l'historique ; la page revient au clic | ~300 Mo | 1 à 2 s pour réafficher ; ne pas le faire si la lecture passe par le lecteur intégré (le son s'arrêterait) |
| **Rangées chargées une à une** (`LazySection` de Movix) | Les rangées hors de l'écran ne sont rendues qu'à l'approche | mémoire et démarrage | squelettes à la bonne hauteur pour éviter les sauts |

---

## 4. Ce qu'il ne ferait pas

- Un curseur personnalisé (B9) et le défilement à inertie (B10) : jolis sur un site, gênants dans une appli.
- Une onde ou un visualiseur « qui écoute la musique » alors que le son protégé est illisible (B8, C4).
- Des publicités ou des fenêtres surgissantes (Movix en a pour financer ses serveurs : Vitrine n'en a pas besoin).
- Des animations sur les commandes de lecture : elles doivent répondre instantanément.

---

## 5. Ordre de réalisation

1. **v0.7.0 — fait, vérifié sur votre compte (6/6)** — mémoire (Edge allégé, vignettes, fonds flous légers, mode
   léger, page libérée quand cachée), logo [Vitrine], titres numérotés, Top 10, pilule du bandeau, transitions de
   page, grain, paroles karaoké plein écran, carte 3 lignes, Roulette, écran de veille.
2. **v0.8.0** — Rétro Vitrine (Wrapped), dock flottant Musix (option du thème Mystic), calendrier des sorties, intro.
3. **Ensuite** — Constellation, profils, écouter ensemble, ambiances de saison.
