# Vitrine vue par Apple Music

Ce qu'Apple Music fait de mieux en design et en fonctions, et ce que Vitrine peut en reprendre **avec l'API
officielle de Spotify** : comment, avec quoi, ce que ça apporte et coûte, les pièges, le rendu visuel.

**Suivi** : ce qui est intégré est coché dans [PLAN-V0.8.md](PLAN-V0.8.md) (v0.8.0 : la liste « v0.8 » et une
bonne partie de la liste « v0.9 » ci-dessous) ; la suite est dans [INSPIRATION-TIKTOK-PROJETS.md](INSPIRATION-TIKTOK-PROJETS.md).

**Légende** : ✅ faisable · 🟡 faisable en partie ou à une condition · ❌ impossible avec Spotify · ✔︎ déjà dans
Vitrine. **Effort** (comme dans ROADMAP.md) : S ≤ 1 jour, M quelques jours, L une à deux semaines.

**Sources** (recherches du 23 octobre 2026) : les annonces d'iOS 26 (WWDC 2025 : AutoMix, traduction et prononciation
des paroles, épingles, pochettes animées sur l'écran verrouillé, import de playlists ; iOS 26.1 : mini-lecteur qu'on
balaie) et d'iOS 27 (WWDC 2026, sorti en septembre : pages d'artiste refaites, AutoMix qui suit tempo et tonalité, plus
de langues de traduction, lecteur plus rapide), l'appli Musique sur Mac et Apple Music sur Windows. Liens en fin de
document.

---

## 1. Ce qui fait « Apple Music »

| Principe | Ce qu'on voit | Ce que ça veut dire pour Vitrine |
|---|---|---|
| **La pochette d'abord** | Pochette immense, très peu d'interface autour ; ses couleurs teintent le fond du lecteur et les pages d'album | Vitrine tire déjà l'accent de la pochette : aller plus loin (fonds, pages) |
| **Des ressorts, pas des fondus** | La pochette recule à la pause et revient avec un petit rebond ; le mini-lecteur grandit jusqu'au plein écran | Une seule définition de ressort, utilisée partout où quelque chose s'ouvre |
| **Grands titres** | « Bibliothèque » en très grand et gras, qui se replie dans la barre quand on fait défiler | Même logique sur les pages de Vitrine |
| **Verre (Liquid Glass, iOS 26)** | Barres translucides qui déforment ce qui passe dessous ; la barre du bas rétrécit quand on descend | Le thème « Verre » déjà prévu, avec retenue (coût graphique) |
| **Les paroles comme spectacle** | Mots qui s'allument un à un, chœurs plus petits, points pendant les silences, traduction et prononciation | Prolonge le karaoké de v0.7.0 |
| **Une bibliothèque rangée** | Épingles, « Ajoutés récemment », tri, playlists intelligentes (Mac), nombre de lectures | L'historique local de Vitrine rend possible ce que Spotify ne fait pas |
| **La retenue** | Un seul accent (rouge-rose), beaucoup d'espace, séparateurs à peine visibles | Garder le rouge de Vitrine, sans copier l'identité d'Apple |

---

## 2. La liste

Pour chaque idée : **chez Apple**, **comment chez Vitrine (avec quoi)**, **pour / contre**, **pièges**, **visuel**.

### A. L'écran « À l'écoute » (lecteur plein écran)

**A1. La pochette qui respire avec la lecture** — ✅ S
- *Chez Apple* : en pause, la pochette recule (environ 80 %) et son ombre s'efface ; à la reprise, elle revient avec un
  petit rebond.
- *Comment* : dans `FullPlayer.tsx` (la pochette est déjà un `motion.div`), `animate={{ scale: paused ? 0.82 : 1 }}`
  avec un ressort framer-motion (`stiffness 260, damping 22`) ; ombre colorée tirée de la pochette, qui baisse en pause.
- *Pour / contre* : retour visuel immédiat, signature d'Apple, aucun coût mémoire. Rien contre.
- *Pièges* : la pause d'un autre appareil arrive avec retard : animer sur l'état reçu, pas sur le clic, sinon la
  pochette rebondit deux fois. Mode léger : changement instantané.
- *Visuel* : 0,45 s au plus, aucune oscillation visible.

**A2. Le mini-lecteur qui s'ouvre en grand** — ✅ M
- *Chez Apple* : la petite pochette de la barre du bas grandit et devient celle du plein écran ; le reste arrive en
  fondu.
- *Comment* : `layoutId="pochette-en-cours"` de framer-motion sur la pochette de `NowPlayingBar` et de `FullPlayer`,
  dans un même `LayoutGroup`.
- *Pour / contre* : la transition la plus « Apple » ; on comprend d'où vient l'écran. Demande de réorganiser les deux
  composants (même arbre React, pas de portail).
- *Pièges* : un `overflow: hidden` sur un parent coupe l'animation ; un changement de titre pendant l'animation :
  clé par titre ; coupé en mode léger.
- *Visuel* : 0,4 à 0,5 s, ressort sans rebond, coins qui passent de 8 à 14 px.

**A3. Un fond vivant aux couleurs de la pochette** — ✅ S
- *Chez Apple* : dégradé fluide qui bouge lentement derrière le lecteur.
- *Comment* : reprendre `aurora()` et les trois taches lentes de l'écran karaoké (`LyricsStage.tsx`) dans le lecteur
  plein écran.
- *Pour / contre* : cohérent avec les paroles, déjà écrit. Le flou sollicite la carte graphique (quelques % sur un
  portable).
- *Pièges* : couper en mode léger (classe `fx-blur`, déjà gérée) ; voile noir de 30 % pour que le texte reste lisible
  sur une pochette claire.
- *Visuel* : mouvements de 24 à 36 s, jamais plus vifs.

**A4. Une barre de progression qui grossit et s'étire** — ✅ S
- *Chez Apple* : la barre fine s'épaissit quand on la saisit et s'étire comme un élastique aux extrémités ; un clic sur
  la durée affiche le temps restant (`-1:23`).
- *Comment* : hauteur 4 → 10 px au survol et pendant le glisser, étirement au-delà des bords (`dragElastic` de
  framer-motion) ; bascule durée ↔ temps restant mémorisée. Même chose pour le volume.
- *Pièges* : **un seul** déplacement envoyé à Spotify, au relâchement, pas un par pixel (Spotify compte les demandes,
  cf. v0.7.1).

**A5. Le titre trop long qui défile** — ✅ S
- *Chez Apple* : défilement lent, pause de 2 s au début, bords en fondu.
- *Comment* : défiler seulement si le texte déborde (`scrollWidth > clientWidth`), `translateX` en CSS, masque en
  dégradé.
- *Pièges* : arrêt au survol ; en mode léger, points de suspension.

**A6. Balayer le mini-lecteur pour changer de titre** (iOS 26.1) — ✅ S
- *Comment* : sur PC, défilement horizontal du pavé tactile ou glisser à la souris sur la barre du bas ; seuil de 60 px
  et 700 ms d'attente entre deux gestes, comme dans Flow.
- *Pièges* : ne pas se déclencher quand on fait glisser la barre de progression ; les défilements horizontaux
  accidentels.
- *Visuel* : la pochette glisse, la suivante arrive (le geste de Flow).

**A7. Les pochettes animées** — ❌, remplacées par un ✅ S
- *Chez Apple* : vidéos de pochette, en plein écran sur l'écran verrouillé depuis iOS 26.
- *Chez Spotify* : ses vidéos (« Canvas ») ne sont pas dans l'API officielle.
- *Remplacement* : effet « Ken Burns » (zoom de 1 à 1,08 et léger glissement sur 30 s), avec la classe
  `animate-slow-pan` qui existe déjà.
- *Piège* : ne pas aller chercher les Canvas par des adresses privées de Spotify (hors API officielle, compte en
  risque).

**A8. Badges Lossless, Dolby Atmos, Audio spatial** — ❌
- L'API ne dit pas la qualité du son, et le son protégé ne s'analyse pas. Pas de faux badge.

### B. Les paroles

**B1. Des points pendant les silences** — ✅ S
- *Chez Apple* : pendant l'intro et les passages instrumentaux, trois points qui se remplissent et respirent jusqu'à
  la ligne suivante.
- *Comment* : quand plus de 5 s séparent deux lignes (ou avant la première), afficher une ligne « • • • » dont les
  points se remplissent avec le temps, avec une légère pulsation.
- *Pour / contre* : on sait que ça va reprendre ; très reconnaissable. Rien contre.
- *Piège* : LRCLIB met parfois une ligne vide pour ces silences : la traiter comme des points (aujourd'hui « ♪ »).

**B2. Mot par mot** — ✅ S (estimé) / 🟡 (exact)
- *Chez Apple* : chaque mot s'allume quand il est chanté et se soulève un peu ; les notes tenues brillent davantage.
- *Comment* : LRCLIB ne donne presque jamais le temps de chaque mot. On l'estime : le temps de la ligne réparti entre
  les mots selon leur longueur ; chaque mot se remplit et monte de 2 px quand il est atteint. Si le fichier contient
  les temps par mot (format « LRC enrichi »), on les utilise.
- *Pour / contre* : très proche d'Apple. L'estimation se trompe sur les lignes chantées en accéléré.
- *Piège* : n'animer que la ligne en cours (une chanson compte des centaines de mots).

**B3. Chœurs plus petits** — ✅ S
- *Chez Apple* : les chœurs (entre parenthèses) passent sous la ligne, plus petits et plus pâles.
- *Comment* : sortir les `( … )` du texte et les afficher dessous, à 60 % de la taille, opacité 0,6.
- *Piège* : ne pas toucher aux parenthèses qui ne sont pas des chœurs, comme « (feat. X) » ou « (Remix) ».

**B4. Duos à gauche et à droite** — 🟡 S
- *Chez Apple* : le deuxième chanteur est aligné à droite.
- LRCLIB ne dit pas qui chante ; faisable seulement quand le fichier le marque (« v1: », « Nom: »), ce qui est rare.
  À garder pour plus tard.

**B5. Flou selon la distance** — ✅ S
- *Chez Apple* : la ligne chantée est nette ; les autres sont d'autant plus floues et petites qu'elles en sont loin.
- *Comment* : flou de 0,6 px par ligne d'écart (4 au plus) et taille réduite de 2 % par ligne. Aujourd'hui, seules les
  2 lignes passées sont floues.
- *Piège* : le flou coûte : seulement sur les lignes visibles ; mode léger : transparence seule.

**B6. Défiler librement, puis revenir à la ligne** — ✅ S
- *Chez Apple* : si on fait défiler les paroles à la main, le suivi s'arrête 3 s, ou jusqu'au clic sur « revenir ».
- *Comment* : dans `LyricsStage.tsx`, suspendre le recentrage automatique après une molette ou un clic.
- *Piège corrigé au passage* : aujourd'hui l'écran ramène de force à la ligne en cours, impossible de relire plus haut.

**B7. Traduction des paroles** (iOS 26) — 🟡 M
- *Chez Apple* : la traduction sous chaque ligne.
- *Comment* : un service de traduction avec la clé de l'utilisateur. Recommandé : **DeepL API Free** (500 000
  caractères gratuits par mois) ; à défaut **MyMemory** (gratuit sans clé, environ 5 000 caractères par jour). Toute la
  chanson en un seul appel, résultat gardé sur le disque pour chaque titre, affiché sous la ligne en plus petit.
- *Pour / contre* : précieux pour la K-pop, l'espagnol, l'arabe, le japonais. Une clé à créer ; dépend d'un service
  extérieur.
- *Pièges* : l'API de traduction intégrée de Chrome n'existe pas dans Electron ; l'adresse non officielle de Google
  Traduction est interdite par ses conditions ; les paroles sont protégées : on affiche la traduction, on ne la partage
  pas ; prévenir dans les Réglages que le texte part chez le traducteur.

**B8. Prononciation (romanisation)** (iOS 26) — ✅ / 🟡 M
- *Chez Apple* : la prononciation en lettres latines sous le coréen, le japonais, le chinois, le cyrillique…
- *Comment* :
  - coréen : conversion par règles (romanisation officielle), sans dictionnaire ✅ ;
  - japonais en kana : bibliothèque `wanakana` (20 Ko) ✅ ; les kanji demandent un dictionnaire (`kuroshiro` +
    `kuromoji`, environ 17 Mo) 🟡 ;
  - chinois en pinyin : `pinyin-pro` (environ 300 Ko) ✅ ;
  - cyrillique, grec, arabe : tables de translittération ✅.
- *Pièges* : mémoire : ne charger le dictionnaire japonais que si une chanson japonaise s'affiche, puis le libérer ; la
  prononciation coréenne par règles est approximative : l'écrire.

**B9. Partager des lignes en image** — ✔︎ (story), amélioration S
- *Chez Apple* : choisir 1 à 4 lignes, carte aux couleurs de la pochette.
- *Comment* : la story existe ; ajouter le choix de plusieurs lignes depuis l'écran karaoké et « Copier l'image »
  (presse-papiers d'Electron).

**B10. Chanter (« Sing », voix baissée)** — ❌
- Le son protégé ne peut pas être traité.

### C. La bibliothèque

**C1. Les épingles** (iOS 26) — ✅ S
- *Chez Apple* : jusqu'à 6 playlists, albums ou artistes épinglés en haut de la bibliothèque, plus un widget.
- *Comment* :
  - « Épingler » dans le clic droit ; la liste reste sur ce PC (aucun appel à Spotify) ;
  - une rangée de grandes vignettes en haut de Bibliothèque et de l'Accueil ;
  - l'équivalent du widget sur PC : **la liste de raccourcis Windows** (clic droit sur l'icône dans la barre des tâches,
    `app.setJumpList`) et le menu de la zone de notification ; un clic lance la playlist.
- *Pièges* : un raccourci Windows relance Vitrine avec un argument : passer par l'instance unique (déjà en place) et
  n'accepter que des adresses `spotify:` ; retirer l'épingle d'une playlist supprimée.

**C2. « Ajoutés récemment »** — ✅ S
- *Comment* : Spotify donne la date d'ajout des albums et des titres likés (`added_at`), pas celle des playlists ;
  rangée en tête de Bibliothèque.

**C3. Trier et choisir l'affichage** — ✅ S
- *Comment* : tri par titre, artiste, date d'ajout ou « écouté récemment » (historique local) ; grille ou liste ;
  choix mémorisé.

**C4. Colonnes « Lectures » et « Dernière écoute »** (iTunes, Musique sur Mac) — ✅ M
- *Comment* : l'historique de Vitrine (tout le compte) a ces chiffres ; deux colonnes triables dans Titres likés et
  les playlists.
- *Pour / contre* : Spotify ne le fait pas ; donne vie à l'historique. Les chiffres ne couvrent que la période connue
  de Vitrine (installation et import).
- *Pièges* : le dire au survol ; calcul dans le processus principal, comme les résumés actuels, pour ne pas alourdir
  la page.

**C5. Playlists intelligentes** (Musique sur Mac) — ✅ M
- *Chez Apple* : des playlists à règles (« écoutés plus de 10 fois », « ajoutés ce mois-ci », « jamais écoutés »).
- *Comment* : un petit éditeur de règles (lectures, dernière écoute, date d'ajout, artiste, année, durée) appliqué à
  l'historique et aux titres likés ; Vitrine crée une vraie playlist Spotify et la met à jour au plus une fois par
  jour. Modèles prêts : « Pépites oubliées » (likés, pas écoutés depuis 6 mois), « En boucle ce mois-ci », « Jamais
  écoutés ».
- *Pièges* : chaque mise à jour coûte des demandes : comparer avant d'écrire, 100 titres par demande ; marquer « gérée
  par Vitrine » dans la description et ne jamais écraser une playlist modifiée à la main.

**C6. Dossiers de playlists** (iOS 26) — ❌
- Spotify ne donne pas les dossiers aux applis. Des dossiers propres à Vitrine seraient invisibles partout ailleurs :
  à éviter (les épingles suffisent).

**C7. Pochettes générées pour vos playlists** — 🟡 S
- *Comment* : dégradé et titre en Clash Display dessinés dans un canvas, envoyés à Spotify (JPEG de 256 Ko au plus).
- *Piège* : demande une autorisation Spotify de plus (`ugc-image-upload`), donc une reconnexion ; ne le proposer que
  pour les playlists créées par Vitrine.

**C8. Importer des playlists d'autres services** (iOS 26 importe depuis Spotify ; ici, l'inverse) — ✅ M
- *Comment* :
  - **Deezer** : son API publique, sans clé, donne la playlist et le code ISRC de chaque titre, puis la recherche
    Spotify `isrc:` le retrouve exactement ;
  - **Apple Music ou iTunes** : la playlist exportée en fichier (Fichier › Bibliothèque › Exporter la playlist, .txt
    ou .xml), puis recherche par titre et artiste ;
  - **TuneMyMusic ou Soundiiz** : leurs exports CSV ;
  - avant de créer la playlist, un écran de vérification : trouvés, douteux, introuvables.
- *Pièges* : 500 titres, c'est 500 recherches : 4 à la fois, pause de Spotify respectée (v0.7.1), barre de progression ;
  YouTube Music demande une clé et les liens Apple Music un compte développeur (99 $ par an) : fichiers seulement.

### D. Pages d'album, d'artiste, recherche

**D1. Une page d'album façon Apple** — ✅ S
- *Chez Apple* : fond teinté par la pochette ; en pied de page « Sortie le 12 mars 2024 · 14 titres, 48 min ·
  ℗ 2024 Label » ; rangée « Plus de cet artiste ».
- *Comment* :
  - date, nombre de titres et mentions ©/℗ viennent de `/albums/{id}`, ouvert ; le label est à vérifier (Spotify a
    retiré des champs en 2026) ;
  - « Plus de… » vient de `/artists/{id}/albums`, ouvert, 10 par page ;
  - le fond vient de la couleur de pochette déjà calculée.
- *Piège* : Spotify ne donne aucun texte de présentation ; Wikipédia est possible mais se trompe d'homonyme.

**D2. Une page d'artiste façon iOS 27** — ✅ M
- *Chez Apple* : grand bouton « lecture aléatoire », nom de l'artiste mis en scène (avec sa propre police pour
  certaines stars), bannière de la dernière sortie, sections Albums / Singles et EP / Apparitions.
- *Comment* :
  - le nom en Clash Display géant sur la photo ;
  - un bouton « Lecture aléatoire » : titres de l'artiste par la recherche (déjà en place), puis mélange parfait ;
  - « Dernière sortie » : la plus récente des sorties ;
  - sections séparées par `include_groups` (album, single, appears_on).
- *Pièges* :
  - pas de polices d'artiste (droits) : une mise en page forte suffit ;
  - 10 sorties par demande en mode développement : charger chaque section quand elle apparaît, pas tout d'un coup ;
  - Spotify ne donne aucune biographie.

**D3. La recherche** — ✅ S
- *Chez Apple* : recherches récentes ; choix « Dans votre bibliothèque » ou « Apple Music » ; grand meilleur résultat.
- *Comment* :
  - les 10 dernières recherches, effaçables ;
  - un onglet « Dans ma bibliothèque » qui cherche sans réseau dans les titres likés, playlists et albums déjà
    chargés ;
  - attendre 300 ms après la dernière touche avant d'interroger Spotify.
- *Piège* : la recherche Spotify s'arrête à 10 résultats en mode développement : « Afficher plus » par pages.

**D4. Catégories en tuiles colorées** — ❌ / 🟡
- Les playlists éditoriales de Spotify sont fermées aux nouvelles applis ; sans elles, les catégories n'ont pas
  d'intérêt.

**D5. Crédits d'un titre (auteurs, compositeurs, producteurs)** — 🟡 M
- *Comment* : le code ISRC du titre, puis MusicBrainz (gratuit, sans clé) pour les auteurs, compositeurs et
  producteurs.
- *Pièges* : une demande par seconde au plus et un nom d'appli obligatoire dans chaque demande ; couverture inégale
  (bonne pour les gros titres, faible pour le rap récent), donc afficher « Crédits non disponibles » sans gêne ;
  garder les réponses sur le disque.

### E. Lecture et file d'attente

**E1. Une file « À suivre » complète** — ✅ M / 🟡
- *Chez Apple* : l'historique au-dessus, « À suivre » ensuite, ∞ « Lecture automatique » à la fin ; glisser pour
  réordonner.
- *Comment* :
  - l'historique : les derniers titres de l'historique local ;
  - « À suivre » : la file de Spotify (déjà affichée) ;
  - ∞ : quand la file se vide, ajouter des titres façon Flow (les recommandations de Spotify sont fermées).
- *Limites* : l'API ne permet ni de réordonner ni de retirer un titre de la file ❌. « Lire ensuite » revient à « ajouter
  à la file », car Spotify place déjà les ajouts avant la suite de l'album.
- *Piège* : ne pas promettre le glisser-déposer.

**E2. AutoMix, fondu enchaîné** (iOS 26 et 27) — 🟡 M
- *Chez Apple* : enchaînement façon DJ (tempo, tonalité, étirement du son).
- *Chez Vitrine* : le vrai mélange est impossible ❌. Il faudrait deux flux en même temps, or le son est protégé, et
  Spotify ne donne plus le tempo ni la tonalité depuis 2024.
- *Faisable* : un fondu de sortie et d'entrée (le volume du lecteur baisse sur les 4 dernières secondes et remonte sur
  les 2 premières).
- *Pièges* : seulement quand la musique joue sur ce PC ; ne pas l'appeler « AutoMix ».

**E3. Minuteur de sommeil** — ✔︎, amélioration S
- Ajouter un fondu de 30 s avant la pause, comme le minuteur d'iOS.

**E4. Les raccourcis de Musique sur Mac** — ✅ S
- Ctrl+L : aller au titre en cours (ouvre l'album, fait défiler jusqu'au titre) ; Ctrl+F : recherche (garder aussi
  Ctrl+K) ; Ctrl+↑ / ↓ : volume.

**E5. Égaliseur, Sound Check (volume égalisé), Audio spatial** — ❌
- Le son passe par le lecteur protégé de Spotify : aucun accès.

### F. Bilan et partage

**F1. Un bilan chaque mois, avec des étapes** — ✅ M (lié à « Rétro Vitrine »)
- *Chez Apple* : Replay chaque mois (titres, artistes, albums, minutes) et des étapes (« 1 000 minutes de X ») à
  partager.
- *Comment* : tout vient de l'historique local ; une notification discrète quand une étape est franchie (une par jour
  au plus) ; « Rétro Vitrine » mensuel en plus de l'annuel.
- *Pièges* : chiffres partiels si Vitrine est rarement ouverte (le dire) ; ne pas reprendre le nom « Replay » (marque
  d'Apple).

**F2. La playlist « Mon année »** — ✅ S
- Les 100 titres de l'année (historique local, sinon les favoris long terme de Spotify), mise à jour chaque semaine.

### G. L'appli de bureau (Musique sur Mac, Apple Music sur Windows)

**G1. Le mini-lecteur compact** — ✅ M
- *Chez Apple* : Fenêtre › Mini-lecteur : un carré avec la pochette, les commandes au survol, les paroles en option,
  toujours au premier plan.
- *Comment* : **réduire la même fenêtre** (340 × 340, sans barre, toujours au premier plan) plutôt qu'en ouvrir une
  seconde : aucun Mo de plus, alors qu'une fenêtre en plus coûte 60 à 80 Mo.
- *Pièges* : retenir la position de chaque mode ; double-clic ou Échap pour revenir ; ne pas libérer la page (v0.7.0)
  tant que le mini-lecteur est visible.

**G2. Commandes depuis le système** — ✔︎
- Zone de notification, boutons de la barre des tâches, touches multimédia : déjà en place.

**G3. « Demander à Siri », ici « Demander à Vitrine »** (iOS 27) — 🟡 L
- *Comment* : une IA (avec la clé de l'utilisateur) qui transforme « mets-moi du rap calme des années 2000 » en
  recherches Spotify.
- *Pièges* : coût, confidentialité, réponses inventées. Plus tard, et seulement si vous le voulez.

### H. Design

**H1. Les grands titres qui se replient** — ✅ S
- *Comment* : un `IntersectionObserver` sur le titre de la page ; quand il sort de l'écran, le nom apparaît en petit
  dans l'en-tête (fondu de 0,2 s).

**H2. La barre du bas qui rétrécit au défilement** (iOS 26) — ✅ M
- *Comment* : en descendant, la barre de lecture devient une capsule flottante (pochette, lecture / pause) ; elle
  revient en remontant. Uniquement par `transform`, pour que la page ne saute pas.
- *Pièges* : ne pas cacher les commandes pendant qu'on vise la barre de progression ; réglage pour la désactiver.

**H3. Le verre (Liquid Glass)** — ✅ / 🟡 M (le thème « Verre » déjà prévu)
- *Comment* : flou et saturation d'arrière-plan, liseré clair en haut, et pour la déformation un filtre SVG
  (`feDisplacementMap`) appliqué en `backdrop-filter`, ce que Chromium permet.
- *Pièges* : coûteux pour la carte graphique : seulement 2 ou 3 surfaces (en-tête, barre du bas, menus), coupé en mode
  léger ; lisibilité sur pochette claire.

**H4. Des ressorts partout** — ✅ S
- *Comment* : une seule définition (`type: "spring", bounce: 0.15, duration: 0.45`) pour tout ce qui s'ouvre
  (lecteur, menus, panneaux) ; la courbe Mystic reste pour les pages.
- *Piège* : un rebond trop visible fait « jouet » : rebond de 0,2 au plus.

**H5. Typographie, couleur, icônes : ce qu'on peut prendre** — 🟡
- **Interdit** : SF Pro et SF Symbols. Leur licence les réserve aux plateformes Apple, donc pas sous Windows.
- **Équivalents libres** : Inter (licence libre, très proche de SF Pro) pour le texte ; Lucide (déjà utilisé) pour
  les icônes.
- **À ne pas copier** : le rouge-rose d'Apple Music (`#fa2d48`) et la note de musique sur dégradé, qui sont l'identité
  d'Apple. Vitrine garde son rouge et [Vitrine].
- **À prendre** : la retenue. Un seul accent, beaucoup d'espace, coins de pochette de 8 à 12 px, séparateurs de
  1 px à 8 % de blanc.

---

## 3. Impossible avec Spotify

| Chez Apple Music | Pourquoi | À la place |
|---|---|---|
| AutoMix (vrai mélange) | Un seul flux à la fois, son protégé, tempo et tonalité fermés depuis 2024 | Fondu de sortie / d'entrée (E2) |
| Sing (voix baissée), égaliseur, Sound Check, Audio spatial | Le son protégé ne peut pas être traité | — |
| Badges Lossless / Dolby Atmos | L'API ne dit pas la qualité | — |
| Pochettes animées | Les « Canvas » de Spotify sont hors API | Ken Burns (A7) |
| Dossiers de playlists | L'API ne les donne pas | Épingles (C1) |
| Réordonner ou retirer un titre de la file | L'API n'a pas cette commande | — |
| Stations, « Découverte » | Recommandations fermées depuis 2024 | Flow |
| Classements, playlists éditoriales, catégories | Fermés aux nouvelles applis | Top 10 personnel ; « Tendances Vitrine » (prévu) |
| Radio en direct, clips | Pas chez Spotify | — |
| SharePlay | Jam n'est pas dans l'API | « Écouter ensemble » (salons, prévu) |
| Biographies, notes éditoriales | L'API n'en donne pas | Wikipédia en option (risque d'homonyme) |

---

## 4. Pièges généraux

- **Les demandes à Spotify sont comptées.** L'incident « Too many requests » (corrigé en v0.7.1) montre que le quota du
  mode développement est bas. Toute nouvelle idée passe par le régulateur de v0.7.1 (4 à la fois, lectures partagées,
  pause respectée) et préfère les données déjà là : historique local, pages déjà chargées.
- **Les marques.** Ne pas reprendre « Replay », « AutoMix », « Sing », le logo, les polices ni le rose d'Apple.
- **La mémoire.** Dictionnaires (japonais) et fenêtres supplémentaires coûtent des Mo : toujours à la demande, toujours
  coupés en mode léger.
- **L'accessibilité.** Flous et rebonds suivent « Réduire les animations » de Windows (déjà le cas via le mode léger
  automatique).

---

## 5. Ordre proposé

| Version | Contenu | Pourquoi |
|---|---|---|
| **v0.8** (avec Rétro Vitrine) | A1 pochette qui respire, A3 fond vivant, A4 barre élastique et temps restant, A5 titre qui défile, B1 points des silences, B3 chœurs, B5 flou par distance, B6 défilement libre, C1 épingles et raccourcis Windows, C2 ajoutés récemment, C3 tri, D3 recherche, E3 fondu du minuteur, H1 grands titres, H4 ressorts | Une quinzaine de petits morceaux (S), presque aucun appel de plus à Spotify : l'effet Apple tout de suite |
| **v0.9** | A2 mini-lecteur qui grandit, A6 balayer, B2 mot par mot, B8 prononciation (coréen, kana, pinyin), C4 lectures et dernière écoute, C5 playlists intelligentes, D1 page d'album, D2 page d'artiste, F1 bilan mensuel, F2 « Mon année », G1 mini-lecteur compact, H2 barre qui rétrécit | Les gros morceaux visibles, appuyés sur l'historique local |
| **v1.0 et après** | B7 traduction (clé DeepL), C7 pochettes générées, C8 import Deezer / Apple Music, D5 crédits, E1 file ∞, E2 fondu enchaîné, H3 verre, G3 « Demander à Vitrine » | Dépendent d'un service extérieur, d'une autorisation de plus ou coûtent plus cher |

---

### Liens

- iOS 26 : [PhoneArena](https://www.phonearena.com/news/apple-music-updates-automix-lyrics-translation-more-new-features_id171166),
  [TechRadar](https://www.techradar.com/audio/apple-music/apple-music-is-getting-automix-and-music-pins-plus-lyrics-translation-pronunciation-and-your-iphone-can-become-a-mic-in-sing-on-tvos),
  [MacRumors (épingles)](https://www.macrumors.com/2025/06/09/apple-music-pins-ios-26),
  [9to5Mac](https://9to5mac.com/2025/09/24/heres-everything-new-for-apple-music-in-ios-26/),
  [Apple, toutes les nouveautés d'iOS 26 (PDF)](https://www.apple.com/os/pdf/All_New_Features_iOS_26_Sept_2025.pdf),
  [AppleMagazine (balayer le mini-lecteur, 26.1)](https://applemagazine.com/swipe-gesture-in-apple-music-miniplayer-ios-26/)
- iOS 27 : [9to5Mac](https://9to5mac.com/2026/06/10/ios-27-heres-all-the-new-apple-music-features/),
  [BGR](https://bgr.com/2195614/new-apple-music-features-coming-ios-27/),
  [iGeeksBlog](https://www.igeeksblog.com/ios-27-apple-music-features/),
  [Digital Music News](https://www.digitalmusicnews.com/2026/06/09/apple-music-gets-a-huge-update-in-ios-27-with-siri-ai/),
  [iPhoneSoft](https://iphonesoft.fr/2026/06/09/ios-27-nouveautes-apple-music)
