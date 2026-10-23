# Vitrine vue par TikTok, les projets voisins, et l'égaliseur / karaoké

Suite de [INSPIRATION-APPLE-MUSIC.md](INSPIRATION-APPLE-MUSIC.md), même format : pour chaque idée **ce qu'on voit
ailleurs**, **comment chez Vitrine (avec quoi)**, **pour / contre**, **pièges**, **visuel**, **décision**. Le suivi de ce
qui est fait est dans [PLAN-V0.8.md](PLAN-V0.8.md) (cases cochées au fur et à mesure).

**Légende** : ✅ faisable · 🟡 en partie ou à une condition · ❌ impossible avec Spotify · ✔︎ déjà dans Vitrine.
**Effort** : S ≤ 1 jour, M quelques jours, L une à deux semaines.

**Sources** (recherches du 23 octobre 2026) : tendances musicales de TikTok (versions accélérées, outils de partage de
stats), Receiptify, Instafest, Icebergify, Obscurify, Airbuds, RetroPod / Rewound, daylist de Spotify, extensions
Spicetify (Beautiful Lyrics, Loopy Loop, Bookmark, Upcoming Song), la politique développeur de Spotify, Equalizer APO.
Liens en fin de document.

**Une règle à garder en tête** : la politique développeur de Spotify interdit de « enchaîner, mixer, remixer ou
superposer » un titre Spotify avec un autre son, et l'appli n'a de toute façon pas accès au son (il est chiffré, DRM).
Tout ce qui touche au son lui-même passe donc par Windows, ou par des versions officielles publiées sur Spotify.

---

## 1. TikTok : ce qui y circule autour de la musique

Ce qui revient sans cesse sur TikTok : les **versions accélérées** (« sped up », #spedupsounds : 14,8 milliards de vues ;
les labels publient désormais des versions officielles), le **refrain** qu'on écoute en boucle, et les **images de
stats** qu'on partage : reçu (Receiptify), affiche de festival (Instafest), iceberg (Icebergify), score d'originalité
(Obscurify), « daylist » de Spotify, résumé de la semaine (Airbuds), et la nostalgie de l'**iPod** (RetroPod, des
millions de vues avant d'être retiré de l'App Store).

**T1. Le reçu de vos écoutes** (Receiptify) — ✅ S
- *Ailleurs* : vos 10 titres préférés imprimés comme un ticket de caisse, avec des durées pour prix et un total.
- *Comment* : une image 1080 × 1920 dessinée dans un canvas, comme la story et le récap : police mono, en-tête
  « VITRINE — REÇU N° … », date, lignes « 01 TITRE — ARTISTE 3:24 », total des minutes, code-barres décoratif. Données :
  vos tops (`/me/top/tracks`, déjà chargés par Stats) ou l'historique local pour « ce mois-ci ».
- *Pour / contre* : le format le plus partagé sur TikTok, zéro appel de plus. Rien contre.
- *Pièges* : titres longs : couper proprement ; polices chargées avant de dessiner (même piège que le récap).
- *Visuel* : papier crème `#f4f1ea`, encre noire, bord dentelé en bas, léger grain.

**T2. L'affiche de festival** (Instafest) — ✅ S
- *Ailleurs* : vos artistes en tête d'affiche d'un festival de 3 jours.
- *Comment* : canvas 1080 × 1350 ; trois jours, tête d'affiche en très grand (Clash Display), les suivants de plus en
  plus petits, séparés par des points ; nom du festival tiré de votre prénom (« AMINE FEST 2026 ») ; fond en dégradé
  des couleurs de la pochette de votre artiste n° 1.
- *Pièges* : Spotify ne donne plus les genres : pas de « scène rap / scène électro » ; noms trop longs : réduire la taille
  ligne par ligne.

**T3. Votre iceberg** (Icebergify) — ✅ S, version Vitrine
- *Ailleurs* : vos artistes rangés du plus connu (au-dessus de l'eau) au plus confidentiel (au fond).
- *Comment* : Spotify ne donne plus la popularité des artistes aux applis en développement. Vitrine fait un iceberg
  **de vos propres habitudes** : au-dessus de l'eau, les artistes que vous écoutez le plus ; au fond, ceux que vous
  n'avez écoutés qu'une ou deux fois (historique local). « Vos pépites enfouies ».
- *Pièges* : avec peu d'historique, l'iceberg est maigre : il faut au moins 20 artistes, sinon expliquer pourquoi.
- *Visuel* : iceberg dessiné en vectoriel, 5 niveaux, eau qui s'assombrit vers le bas.

**T4. Votre aura musicale** — ✅ S (idée maison, dans l'esprit des « palettes Spotify » virales)
- *Comment* : la couleur dominante des pochettes de vos 20 titres préférés (déjà calculée par `palette.ts`), mélangée en
  un dégradé « aura » flou, avec les 5 couleurs principales en pastilles et un mot qui la décrit (« Nuit électrique »,
  « Soleil couchant »…) selon la teinte et la luminosité moyennes.
- *Pièges* : calculer les couleurs sur les miniatures de 64 px (rapide) ; un mot par grande famille de teintes.

**T5. Les versions d'un titre** (accélérée, ralentie, acoustique, instrumentale, live, remix) — ✅ M
- *Ailleurs* : sur TikTok, la version accélérée d'un titre fait souvent mieux que l'original ; les artistes publient leurs
  versions officielles « sped up » et « slowed + reverb ».
- *Comment* : un bouton « Versions » dans le lecteur et le clic droit : Vitrine cherche sur Spotify `titre artiste` +
  « sped up », « slowed », « acoustic », « instrumental », « live », « remix », garde les résultats du **même artiste** dont
  le titre contient le mot-clé, et les range par type. Un clic les joue.
- *Pour / contre* : la tendance TikTok, avec les versions **officielles** (aucun traitement du son, donc permis). Coûte
  quelques recherches : une seule recherche groupée par titre, mise en cache.
- *Pièges* : la recherche Spotify est limitée à 10 résultats en mode développement : on fait 2 recherches au plus
  (« titre artiste sped up slowed » et « titre artiste instrumental acoustic ») ; respect de la pause Spotify (v0.7.2).
- *Visuel* : pastilles par type (⚡ accélérée, 🌙 ralentie, 🎸 acoustique, 🎤 instrumentale…), durée comparée à
  l'original (« −38 s »).

**T6. Le refrain en boucle** — ✅ S (déjà au programme, + Loopy Loop de Spicetify)
- *Comment* : une boucle A–B : on marque le début et la fin (ou « refrain » = 20 s autour du moment repéré par Flow), et
  Vitrine revient au début à chaque fin de boucle.
- *Pièges* : chaque retour en arrière est une commande ; seulement quand la musique joue sur ce PC (le lecteur local
  n'appelle pas l'API) ; sur un autre appareil, ce serait une demande à Spotify par tour : désactivé.
- *Visuel* : la zone A–B surlignée sur la barre de progression, petites poignées.

**T7. « Ce moment » (la daylist de Spotify, en local)** — ✅ S
- *Ailleurs* : la daylist change de nom et de contenu au fil de la journée (« lundi matin indie chill ») ; elle est devenue
  virale en 2024.
- *Comment* : à partir de l'historique local, les titres que **vous** écoutez le plus à ce jour de la semaine et à
  cette heure-ci (± 2 h) ; un nom « Mardi soir · Damso, Tiakola et plus » ; un bouton pour la lancer.
- *Pièges* : Spotify ne donne plus les genres : le nom se fait avec les artistes ; peu d'historique → repli sur vos
  titres les plus écoutés.

**T8. Le bilan de la semaine** (Airbuds, « un petit Wrapped dans la poche ») — ✅ S
- *Comment* : chaque lundi, une notification Windows : « Votre semaine : 6 h 12 d'écoute, artiste n° 1 : X, titre n° 1 :
  Y » ; un clic ouvre les Stats. Données : historique local, aucun appel à Spotify.
- *Pièges* : une seule fois par semaine, désactivable ; rien si la semaine est vide.

**T9. Le mode iPod** (RetroPod, Rewound) — ✅ M
- *Ailleurs* : transformer le téléphone en iPod Classic avec la molette ; viral sur TikTok, retiré de l'App Store pour
  des questions de marque.
- *Comment* : un mode plein écran « Vitrine Classic » : écran façon années 2000 (menu bleu, police système, barre de
  progression à losange) et une **molette** dessinée en SVG : tourner (souris qui glisse ou molette de la souris) fait
  défiler le menu, le bouton central valide, MENU revient, ⏮ ⏭ ⏯ sur la roue. Menus : À l'écoute, Playlists, Titres
  likés (premiers titres), Lecture aléatoire.
- *Pour / contre* : très partageable, ludique. Ce n'est qu'une interface de plus (aucun appel en plus).
- *Pièges* : ne pas utiliser le nom « iPod », ni le logo d'Apple (Rewound a été retiré pour ça) : « Vitrine Classic » ;
  le défilement de la roue : un cran tous les 24° pour que ça ne parte pas trop vite.
- *Visuel* : boîtier blanc ou noir, écran 320 × 240 agrandi, clic sonore… sans son (le son de l'appli n'est pas le nôtre) :
  un léger « tic » visuel.

**T10. Le mode vinyle** — ✅ S
- *Comment* : dans le lecteur plein écran, la pochette devient un disque qui tourne (33 tours/min) quand ça joue et
  s'arrête doucement en pause, avec la pochette au centre et des sillons en dégradé conique ; un bras de lecture qui se
  pose.
- *Pièges* : rotation par CSS (`animation-play-state`), pas par JavaScript ; mode léger : disque fixe.

**T11. Le score d'originalité** (Obscurify) — ❌
- Il faudrait la popularité des artistes, que Spotify ne donne plus aux applis en développement depuis 2026. Remplacé
  par l'iceberg de vos propres habitudes (T3).

---

## 2. Les projets voisins

**P1. Beautiful Lyrics (Spicetify)** : paroles plein écran, fond dynamique, romanisation — ✔︎ en partie (karaoké
v0.7.0) ; la romanisation et le mot par mot sont dans la liste Apple (B2, B8).

**P2. Loopy Loop (Spicetify)** : boucle A–B — c'est T6.

**P3. Bookmark (Spicetify) et commentaires horodatés de SoundCloud : les « Moments »** — ✅ S
- *Comment* : un bouton « Moment » (ou Ctrl+M) enregistre le titre, l'instant et une note facultative (« le drop à
  1:42 ») ; une page Moments les liste ; un clic relance le titre à cet instant ; pendant l'écoute, la note s'affiche
  quand on passe l'instant.
- *Pièges* : stockés sur ce PC (fichier JSON du processus principal) : rien n'est envoyé ; relancer « à cet instant »
  demande un démarrage à une position (`position_ms`), déjà géré par Vitrine.

**P4. Upcoming Song (Spicetify)** : « Ensuite » — ✅ S
- *Comment* : 10 s avant la fin d'un titre, une petite carte « Ensuite : X — Y » glisse au-dessus de la barre ; données :
  la file de Spotify, lue une seule fois à ce moment-là.
- *Pièges* : une demande par titre au plus ; rien si la file est vide.

**P5. YouTube Music, « Accès rapide »** — ✅ S
- *Comment* : en tête de l'Accueil, une grille de 8 vignettes : vos playlists et albums les plus écoutés **selon
  l'historique local**, un clic les lance.

**P6. Airbuds** : ce que vos amis écoutent — ❌ pour l'instant
- Il faudrait un serveur pour relier les comptes ; reporté avec « Écouter ensemble ».

**P7. Cider, Last.fm** : scrobbling — 🟡 M, reporté
- Demande une clé et une connexion Last.fm ; prévu après 0.8.

**P8. Receiptify, Instafest, Icebergify** — T1, T2, T3.

**P9. La daylist de Spotify** — T7.

### Suite (v0.8.1) : ce que les thèmes et extensions Spicetify font de beau

Vu sur un deuxième écran vertical, Spotify avec Spicetify est plus beau que Vitrine. Ce qu'on reprend, sans copier ce qui
ne sert qu'à Spotify (boutique, podcasts, livres audio) — détail et cases cochées dans [PLAN-V0.8.1.md](PLAN-V0.8.1.md) :

| Projet | Ce qu'il fait | Repris dans Vitrine |
|---|---|---|
| **Hazy**, **Glowify** (thèmes) | La pochette en cours, floutée, en fond de toute l'appli ; panneaux translucides posés dessus | ✅ Ambiance de la pochette (réglable, masquée en mode léger) |
| **Lucid**, **Bloom**, **Comfy** (thèmes) | Verre dépoli façon Fluent, coins arrondis, palettes (Catppuccin, Rosé Pine…) | 🟡 le verre existait (`glass`) ; palettes à choisir : v0.9 |
| Vue **« À l'écoute »** de Spotify, sous ces thèmes | Colonne de droite : grande pochette et titre, carte de paroles en direct teintée, artiste, crédits, concerts | ✅ panneau « À l'écoute », avec ce que seul Vitrine sait : vos écoutes du titre et vos moments |
| **Spicy Lyrics**, **Beautiful Lyrics** | Plein écran : pochette, barre et titre à gauche, paroles à droite ; fond dynamique ; chœurs ; duos | ✅ écran des paroles en deux colonnes, empilé en vertical, pochettes qui tournent en fond |
| **lyrics-plus** | Plusieurs sources de paroles, décalage réglable | ✅ AMLL, LRCLIB, NetEase, lyrics.ovh ; source et synchro par titre |
| **AMLL** (Apple Music-like Lyrics) | Base libre de paroles mot à mot (TTML), vague des lignes, mots tenus qui brillent | ✅ source « mot à mot » et le même rendu |
| **Full Screen** (daksh2k) | Mode TV : photo de l'artiste en fond, la suite, le volume | ⬜ mode salon, v0.9 |
| **Cat Jam** (le chat qui hoche la tête au tempo) | Suit le tempo de Spotify | ❌ l'analyse audio est fermée aux nouvelles applis |

---

## 3. L'égaliseur intégré et le karaoké « sans la voix »

### Pourquoi on ne peut pas toucher au son dans l'appli

- Le son de Spotify arrive **chiffré** (DRM Widevine) et n'est déchiffré que dans le lecteur protégé du navigateur. Une
  page n'a pas le droit de le lire : l'API audio du navigateur renvoie du **silence** pour un média protégé. Pas
  d'égaliseur ni d'extraction de voix possible dans Vitrine même.
- La politique développeur de Spotify interdit en plus de « mixer ou remixer » ses titres et, selon les échanges sur
  son forum, d'y appliquer des effets (égaliseur, vitesse, hauteur). Le conseil donné : faire l'égalisation **à la
  sortie audio de l'appareil**.
- Capturer le son de Windows pour le retraiter serait techniquement possible (capture « loopback » d'un processus),
  mais ce serait retraiter un flux protégé : contraire aux règles de Spotify, et lourd (programme natif à écrire).
  **Non retenu.**

**K1. Égaliseur à la sortie de Windows (Equalizer APO)** — ✅ M
- *Ailleurs* : Equalizer APO est l'égaliseur gratuit et libre le plus utilisé sous Windows ; il agit sur la sortie son
  du PC, pour toutes les applis.
- *Comment* : dans Réglages › Égaliseur, 10 bandes (31 Hz à 16 kHz, ±12 dB) et des préréglages (Plat, Basses,
  Basses+, Voix, Aigus, Soirée, Casque, Nuit). Vitrine écrit un petit fichier de réglages au format d'Equalizer APO
  (`Preamp` pour éviter la saturation + `GraphicEQ`) dans un dossier lisible par le service audio de Windows, et ajoute
  une seule ligne `Include` dans la configuration d'Equalizer APO (ou la donne à copier si Windows refuse l'écriture).
  Equalizer APO recharge le fichier tout seul à chaque changement.
- *Pour / contre* : un vrai égaliseur, permis (il agit sur la sortie de Windows, pas sur Spotify), instantané. Il faut
  installer Equalizer APO une fois (gratuit) ; il s'applique à tout le son du PC, pas seulement à la musique ;
  Windows seulement.
- *Pièges* : le dossier de configuration d'Equalizer APO est dans « Program Files » (droits d'administrateur) : écrire le
  fichier ailleurs, dans un dossier que le service audio peut lire (`C:\Users\Public\Documents\Vitrine`) ; ajouter un
  préampli négatif égal au plus fort gain pour éviter la saturation ; ne jamais ajouter la ligne `Include` deux fois ;
  « Désactiver » remet tout à plat sans supprimer la ligne.
- *Visuel* : courbe lissée qui relie les 10 curseurs verticaux, dégradé de l'accent sous la courbe, préréglages en
  pastilles.

**K2. Karaoké « sans la voix » avec les versions instrumentales officielles** — ✅ M
- *Idée* : beaucoup de titres ont une **version instrumentale officielle** sur Spotify (même master, sans la voix), et
  des labels de karaoké publient des versions « karaoke » des tubes. Jouer cette version est permis : c'est un titre
  Spotify comme un autre.
- *Comment* : bouton « Karaoké » dans l'écran des paroles : Vitrine cherche la version instrumentale (« titre artiste
  instrumental », puis « titre karaoke »), choisit la meilleure (même artiste, mot-clé dans le titre, durée la plus
  proche de l'original), la lance **au même moment de la chanson**, et garde les **paroles synchronisées de l'original**.
  Si les durées diffèrent de plus de 2 s (version d'un label de karaoké), les temps des paroles sont étirés en
  proportion et l'écran l'indique (« synchro approximative »). Un clic sur « Voix » revient à l'original au même
  instant.
- *Pour / contre* : un vrai karaoké sans la voix, dans les règles. Tous les titres n'ont pas de version instrumentale :
  dans ce cas, l'écran le dit et propose la version karaoké d'un label s'il y en a une.
- *Pièges* : recherche limitée à 10 résultats : bien construire la requête ; ne pas prendre une reprise d'un autre
  artiste pour l'instrumentale officielle (préférer le même artiste) ; mettre le choix en cache pour ne pas chercher à
  chaque fois.

**K3. Retirer la voix d'un titre en direct** — ❌
- Son protégé inaccessible et remixage interdit par Spotify. Remplacé par K2.

**K4. Égaliseur dans Vitrine même** — ❌
- Même raison. Remplacé par K1.

---

## 4. Idées maison (innovations)

**I1. L'intro au lancement** — ✅ S : le logo [Vitrine] se dessine (crochets qui s'ouvrent, barres d'égaliseur qui
montent) pendant 1,2 s au démarrage, pendant que les données arrivent ; sautée en mode léger et au démarrage caché.

**I2. Rétro Vitrine** (Wrapped, au programme de la v0.8) — ✅ M : votre mois ou votre année en diapositives plein écran
(minutes, artiste n° 1, top 5 titres, heure préférée, jour record, aura, iceberg), avance automatique façon story,
image finale à partager. Données : historique local + tops Spotify.

**I3. Les étapes** — ✅ S : une notification quand vous franchissez une étape (« 100e écoute de X », « 1 000 minutes
ce mois-ci ») ; une par jour au plus.

**I4. Playlists intelligentes en un clic** (Apple C5) — ✅ M : « Pépites oubliées », « En boucle ce mois-ci », « Jamais
écoutés », créées sur Spotify à la demande.

**I5. « Mon année » en playlist** (Apple F2) — ✅ S.

**I6. Calendrier des sorties de vos artistes** (au programme) — 🟡 reporté : une demande par artiste ; après l'incident
de limite, à faire avec un budget strict (10 artistes par jour, en cache).

---

## 5. Décisions

- **Dans la v0.8.0** : T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, P3, P4, P5, K1, K2, I1, I2, I3, I4, I5, plus la liste
  « v0.8 » et une bonne partie de la liste « v0.9 » d'Apple Music (voir PLAN-V0.8.md).
- **Impossible** : T11 (popularité fermée), K3 et K4 (son protégé, règles de Spotify), P6 (serveur).
- **Reporté** : P7 Last.fm (clé), I6 calendrier (budget de demandes).

### Liens

- Versions accélérées sur TikTok : [NBC News](https://www.nbcnews.com/pop-culture/viral/tiktok-sped-up-fast-songs-sounds-rcna79256),
  [whynow](https://whynow.co.uk/read/tiktok-sped-up-songs)
- Outils de stats partagés : [RouteNote](https://routenote.com/blog/still-waiting-for-spotify-wrapped-check-out-these-music-analysis-sites-instead/),
  [Icebergify (SlashGear)](https://www.slashgear.com/1823846/spotify-iceberg-explanation/),
  [Receiptify (The Scotsman)](https://www.scotsman.com/lifestyle/tech/spotify-receiptify-how-to-create-a-spotify-receipt-based-on-your-favourite-songs-3749546)
- Airbuds : [TechCrunch](https://techcrunch.com/2025/09/17/airbuds-is-the-music-social-network-apple-and-spotify-wish-they-had-built/)
- RetroPod / Rewound : [9to5Mac](https://9to5mac.com/2023/01/13/retro-pod-ipod-app-store-download/),
  [iMore](https://www.imore.com/rewound-app-turned-your-iphone-ipod-classic-gets-pulled-app-store)
- Daylist : [Axios](https://www.axios.com/2024/09/04/spotify-daylist-feature-globally-viral)
- Spicetify : [Beautiful Lyrics](https://gittrend.io/repo/surfbryce/beautiful-lyrics),
  [extensions populaires](https://nerdschalk.com/our-10-favorite-spicetify-extensions-to-customize-the-spotify-desktop-app/)
- Règles de Spotify sur le mixage et les effets : [politique développeur](https://developer.spotify.com/policy/),
  [forum Spotify](https://community.spotify.com/t5/Spotify-for-Developers/Question-regarding-no-mixing-policy/td-p/5282821)
- Equalizer APO : [site](https://equalizerapo.sourceforge.io/),
  [référence de configuration](https://sourceforge.net/p/equalizerapo/wiki/Configuration%20reference/)
