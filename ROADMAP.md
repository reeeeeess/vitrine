# Vitrine PC — objectifs, fonctionnalités et feuille de route

Vitrine PC est un lecteur Spotify de bureau pour **Windows et macOS**. Il reprend l'idée de
Vitrine (Spotify « en verre » sur iOS) et le style visuel de Movix / mysticsaba (fond noir, accent
rouge, grand bandeau défilant, rangées de cartes). Il est construit **uniquement sur les interfaces
officielles de Spotify** (Web API et Web Playback SDK), sans modifier l'application Spotify.

---

## 1. Objectifs

| # | Objectif | Indicateur de réussite |
|---|---|---|
| O1 | **Conformité** : rien qui contourne Spotify (pas de blocage de pub, pas de faux Premium, pas de lecture pirate) | 100 % des appels passent par l'API officielle ; aucune interception du client Spotify |
| O2 | **Expérience premium** : une interface plus belle et plus immersive que le client officiel | Retours utilisateurs ; écran « paroles plein écran » utilisé dans > 50 % des sessions |
| O3 | **Légèreté** : démarrer vite et consommer peu | Démarrage < 2 s ; < 300 Mo de RAM en lecture |
| O4 | **Multi-plateforme** : un seul code pour Windows et macOS | Installateur `.exe` et `.dmg` générés automatiquement à chaque version |
| O5 | **Sécurité** : jetons protégés, application cloisonnée | Jeton de rafraîchissement chiffré par le trousseau du système ; page isolée de Node |
| O6 | **Fiabilité** : fonctionne même sans lecture locale | Repli automatique en « télécommande » d'un autre appareil Spotify |

---

## 2. Fonctionnalités

Légende : ✅ fait et testé sur compte réel · 🧪 fait, vérifié sur données fictives (à valider sur compte réel) · 🟡 en cours · ⬜ prévu

### Compte et sécurité
- ✅ Connexion Spotify officielle (OAuth PKCE, sans secret client) via le navigateur du système
- ✅ Jeton de rafraîchissement chiffré (Trousseau macOS / DPAPI Windows), jamais exposé à l'interface
- ✅ Client ID fourni par l'utilisateur ou intégré à la compilation
- ✅ Déconnexion, et reconnexion automatique si Spotify révoque la session

### Lecture
- ✅ Lecture sur l'ordinateur (Web Playback SDK, appareil « Vitrine (cet ordinateur) ») — Premium requis
- ✅ Mode télécommande : piloter le téléphone, une enceinte ou l'appli officielle (Spotify Connect)
- ✅ Lecture / pause, précédent / suivant, avance, aléatoire, répétition
- ✅ Volume : appliqué sur l'ordinateur et transmis à Spotify Connect (vérifié : 27 % demandé, 27 % côté Spotify)
- ✅ Choix et transfert de l'appareil de lecture
- 🧪 Si Spotify refuse la lecture sur l'ordinateur (erreurs en série), le lecteur intégré se retire et Vitrine passe
  d'elle-même en mode télécommande, au lieu de sauter les titres un par un ; le refus est retenu pour cette version
  (réessai automatique à la version suivante, bouton « Réessayer » dans Réglages)
- ✅ **Lecture sur l'ordinateur sans castlabs** : si Spotify refuse le lecteur intégré, Vitrine fait tourner le lecteur
  officiel de Spotify dans Microsoft Edge (présent sur tout Windows) ou Google Chrome, hors de l'écran ; leur DRM est
  reconnu par Spotify. L'appareil reste « Vitrine (cet ordinateur) ». Vitrine lui envoie directement ses commandes et
  affiche son état réel (l'API de Spotify fige la position de ce type d'appareil). Vérifié avec votre compte sous
  Chrome (11/11, deux fois) puis sous Microsoft Edge avec le son enregistré et mesuré (11/11), et **confirmé à
  l'oreille sur votre PC Windows** (v0.4.1)
- 🧪 En dernier recours (ni Edge ni Chrome), Vitrine lance l'appli Spotify officielle réduite en arrière-plan et y
  envoie la lecture
- 🧪 File d'attente visible (« En cours » / « À suivre ») et « Ajouter à la file » sur chaque titre
- 🧪 Touches multimédia du clavier et contrôles système (Media Session : barre des tâches Windows, Centre de contrôle macOS)
- ⬜ Réorganiser la file (l'API officielle ne le permet pas aujourd'hui)
- ✅ **Corbeille** *(v0.6.0, d'après Trashbin de Spicetify)* : un titre ou un artiste mis à la corbeille est sauté dès
  qu'il passe, d'où que vienne la lecture ; restauration dans Réglages. Vérifié : artiste mis à la corbeille pendant
  son titre → sauté aussitôt
- ✅ **Mélange parfait** *(v0.6.0, d'après Shuffle+ de Spicetify)* : un vrai tirage au sort sur toute la liste (l'aléatoire
  de Spotify revient souvent aux mêmes titres) ; vérifié sur une playlist de 174 titres

### Découverte et bibliothèque
- ✅ Accueil façon plateforme de streaming : grand bandeau défilant + rangées horizontales
- ✅ Écoutés récemment, vos playlists, vos albums, vos artistes favoris
- 🧪 Titres likés : page dédiée (pochette cœur, lecture, aléatoire), en tête de la Bibliothèque et de l'accueil
- ✅ Recherche (titres, albums, playlists, artistes)
- ✅ Pages playlist et album avec liste des titres et lecture en un clic
- ✅ Pages artiste (titres populaires, albums et singles), artistes cliquables partout. Spotify a fermé aux applis en
  mode développement les « titres populaires » d'un artiste, ses genres et son nombre d'abonnés : depuis la v0.5.0,
  Vitrine retrouve ses titres les plus connus par la recherche (8 titres pour EsDeeKid sur votre compte)
- 🧪 Ajouter / retirer un titre des titres likés (cœur dans la barre et le plein écran)
- 🧪 Créer une playlist (Bibliothèque ou fenêtre d'ajout) et y ajouter des titres (« + » sur chaque titre, bouton dans le
  lecteur plein écran) ; demande deux autorisations Spotify de plus : une session ouverte avant la v0.2 doit se reconnecter

### Flow — la découverte façon TikTok *(v0.5.0, vérifié sur votre compte : 12/12)*
- ✅ Un titre par écran, en plein écran vertical ; molette, flèches, J/K ou glissé pour passer au suivant
- ✅ Démarrage au refrain (estimé à un tiers du titre, jamais dans les 30 dernières secondes), désactivable
- ✅ Le fil : nouveautés et dernières sorties de vos artistes, titres « autour » d'eux (featurings, collaborations),
  pépites oubliées de vos titres likés ; jamais deux fois la même chanson, les titres déjà vus passent après
- ✅ Double-clic = j'aime (cœur animé) ; barre d'actions : J'aime, Playlist, À suivre, Artiste, Story, Pas pour moi
- ✅ Sous-titres : la ligne de paroles du moment sous la pochette, comme les légendes d'une vidéo
- ✅ « Pas pour moi » écarte le titre pour toujours ; le fil se recharge seul avant la fin
- ✅ Le lecteur de la barre et Flow restent synchronisés (le titre suivant fait défiler le fil)
- ✅ Flow à partir d'un titre (clic droit) : le fil part de ce titre et de ses artistes *(v0.6.0)*
- 🧪 **Flow qui apprend** *(v0.6.0)* : un j'aime, une écoute complète, un saut en moins de 8 s ou « Pas pour moi » font
  monter ou baisser l'artiste ; les artistes aimés dans Flow deviennent des points de départ, les écartés disparaissent
- 🧪 Option « Mes ♥ dans Trouvé dans Flow » : chaque titre aimé dans Flow va aussi dans une playlist créée pour l'occasion

### Interface façon Movix / Mystic Saba *(v0.7.0 — étude détaillée : docs/INSPIRATION-MOVIX-MYSTIC.md)*
- ✅ Logo **[Vitrine]** de la famille [ix] (Movix, Loadix) : crochets rouges autour d'un égaliseur ; icône d'appli,
  icônes de la zone de notification et logo de l'en-tête
- ✅ Titres de section numérotés (« 01 / ÉCOUTE », mysticsaba.com) avec le trait d'accent de Movix
- ✅ **Top 10 du mois** aux chiffres géants détourés (« Today's Trends » de Movix) ; vérifié avec vos 10 titres
- ✅ Bandeau : pilule de commandes avec progression du défilement et bouton pause (Movix)
- ✅ Transitions entre les pages sur la courbe unique de mysticsaba.com (`cubic-bezier(.22, 1, .36, 1)`)
- ✅ Grain animé du thème Mystic
- ✅ **Paroles karaoké plein écran** (Musix) : texte géant, la ligne en cours se remplit au fil du chant, lignes passées
  floutées, fond « aurore » aux couleurs de la pochette ; vérifié avec de vraies paroles (54 lignes)
- ✅ Carte « 3 lignes de paroles » avec badge CC et lien « PAROLES ↗ » dans le mini-lecteur (Musix)
- ✅ **Roulette** (Movix) : une roue choisit parmi vos playlists et albums, confettis, « Lancer la lecture »
- 🧪 **Écran de veille** (Movix) : après 2 minutes sans bouger, lecteur ou paroles ouverts, la pochette en grand
  dérive avec l'heure et la ligne chantée

### Performance *(v0.7.0)*
- ✅ **Mode léger** (Movix) : automatique sur un PC modeste (≤ 2 cœurs, ≤ 4 Go) ou si Windows demande moins
  d'animations ; réglages séparés : fonds animés, flous, transitions, défilement du bandeau
- ✅ **Libérer la mémoire quand Vitrine est cachée** : après 1 minute dans la zone de notification, la page se ferme ;
  la musique, la zone de notification, les raccourcis et Discord continuent (le processus principal répond) ; la page
  revient au clic. Vérifié : « suivant » envoyé pendant que la page était fermée, puis page revenue sur le bon titre
- ✅ Lecteur Edge allégé (sans extensions, synchronisation, services Edge, GPU, processus en trop) ; son revérifié
- ✅ Vignettes 64 px dans les listes, fonds flous en 64 px, cartes en 300 px, une seule diapositive animée à la fois
- Résultat mesuré : lecteur plein écran −26 % (−36 % en mode léger), lecture via Edge −18 %, Vitrine cachée −39 %

### Clic droit sur un titre *(v0.6.0, comme dans Spotify)*
- ✅ Partout où un titre apparaît : playlists, albums, titres likés, recherche, artiste, Stats, file d'attente, barre
  de lecture, lecteur plein écran, Flow ; au clavier aussi (touche Menu ou Maj+F10), flèches pour choisir
- ✅ Lire · Ajouter à la file d'attente · **Lancer un Flow à partir de ce titre** (la « radio » que Spotify ne donne
  plus aux applis) · Ajouter à une playlist · Ajouter aux / retirer des titres likés · Retirer de cette playlist (si
  elle est à vous) · Aller à l'artiste (chacun) · Aller à l'album · Copier le lien · Copier « titre — artiste » ·
  Créer une story · Ouvrir dans l'appli Spotify · Ne plus me le proposer dans Flow · Corbeille (titre ou artiste)
- Vérifié sur votre compte : menu, copie du lien, aller à l'album, Flow lancé depuis « Anarchie » (SCH) ;
  🧪 « Retirer de cette playlist » et « Ajouter à la file » non déclenchés (ils modifient votre compte)

### Immersion (l'esprit Vitrine)
- ✅ Lecteur plein écran avec pochette géante et fond coloré tiré de la pochette
- ✅ Paroles synchronisées (LRCLIB, base ouverte), défilement automatique, clic pour aller au passage
- ✅ Cartes qui prennent la couleur de leur pochette au survol
- ✅ Fond animé (pochette floutée en mouvement lent) dans le bandeau et le lecteur plein écran
- 🧪 Mini-lecteur : la fenêtre se réduit en vignette 340 × 440 toujours au premier plan, dans le coin de l'écran,
  et revient à sa taille d'origine (mécanique de fenêtre vérifiée dans la vraie appli Electron)
- ✅ **Paroles sur le bureau** *(v0.6.0, d'après Liner)* : la ligne chantée, en grand, par-dessus toutes les applis
  (même en plein écran), sans gêner la souris ; bouton dans la barre de lecture ou Ctrl+Alt+K. Vérifié sur votre
  compte (les lignes défilent avec la chanson) ; transparence à confirmer sous Windows
- ⬜ Paroles traduites
- 🧪 Deux thèmes au choix (bouton dans l'en-tête et sur l'écran de connexion) :
  « Movix » (noir, rouge, Inter / Archivo Black) et « Mystic » d'après mysticsaba.com
  (noir chaud, crème, dégradé ambre → rouge, Clash Display / Satoshi / JetBrains Mono, boutons pilule)

### Statistiques
- ✅ Top titres et top artistes sur 4 semaines, 6 mois, depuis toujours
- ✅ **Toute votre écoute** *(v0.6.0, inspiré de Swiftify et stats.fm)* : les écoutes de **tous vos appareils**
  (téléphone, enceintes, autres ordinateurs) relues chez Spotify toutes les 15 minutes, même Vitrine réduite dans la
  zone de notification, plus celles de Vitrine (au titre près) ; sans doublon entre les deux. Vérifié sur votre compte :
  49 écoutes récupérées au premier lancement. Gardé sur le PC, jamais envoyé
- ✅ Temps d'écoute, écoutes, jours d'écoute, série en cours, **calendrier de l'année** (un carré par jour, façon
  GitHub), carte « quand vous écoutez » (jour × heure), vos titres et artistes, dernières écoutes (avec leur
  provenance) ; 7 jours / 30 jours / 1 an / tout ; « Tous mes appareils » ou « Cet ordinateur »
- 🧪 **Importer tout l'historique** : l'« historique de streaming étendu » que Spotify envoie sur demande (ZIP ou JSON),
  depuis la création du compte ; musique d'au moins 30 s seulement, sans podcast ni doublon. Vérifié sur votre compte
  avec un fichier au format de Spotify (120 écoutes ajoutées, 0 au 2e import) ; reste à l'essayer avec votre vrai export
- ✅ Export CSV de l'historique (Excel, Google Sheets), effacement, désactivation dans Réglages
- ✅ **Story** 1080 × 1920 du titre en cours (pochette, titre, artistes, ligne de paroles du moment) depuis Flow et le
  lecteur plein écran, à publier sur TikTok, Instagram ou Snapchat ; vérifiée en réel (« Get It Together »)
- 🧪 Récap partageable : image 1080 × 1350 (top 5 titres, top 3 artistes) aux couleurs et polices du thème,
  depuis la page Stats, pour les 3 périodes

### Intégrations
- 🧪 Discord Rich Presence « Écoute » (titre, artiste, pochette, progression), désactivé par défaut, dans Réglages ;
  vérifié dans la vraie appli contre un Discord simulé
- 🧪 Mises à jour automatiques sous Windows depuis les Releases GitHub (téléchargement en arrière-plan, bouton
  « Installer » dans l'en-tête) ; macOS exige une signature Apple, prévue plus tard
- 🧪 Page Réglages : thème, état du lecteur, Discord, mises à jour, compte, à propos
- ✅ Raccourcis clavier globaux, actifs depuis n'importe quelle appli : Ctrl+Alt+Espace (lecture/pause), Ctrl+Alt+→/←,
  Ctrl+Alt+L (liker), Ctrl+Alt+F (Flow), Ctrl+Alt+K (paroles sur le bureau) ; désactivables, et Vitrine signale ceux
  qu'une autre appli occupe
- ✅ Commandes en ligne (comme Swiftify) : `Vitrine.exe --next`, `--previous`, `--play-pause`, `--like`, `--flow`, `--lyrics`,
  transmises à la fenêtre déjà ouverte ; utilisables dans un raccourci Windows ou un Stream Deck
- ⬜ Langues : français (par défaut), anglais

---

## 3. Feuille de route

### Phase 0 — Cadrage *(fait)*
- Analyse de Vitrine, Swiftify et Liner ; choix d'une base 100 % officielle
- Choix de la pile : Electron (version castlabs avec DRM Widevine), React, Vite, TypeScript,
  Tailwind CSS, framer-motion, lucide-react, Embla — la même pile front que Movix

### Phase 1 — MVP v0.1 *(faite — testée sur un vrai compte Premium : 26/27)*
- Connexion sécurisée, lecture locale + télécommande, accueil, recherche, bibliothèque,
  playlists/albums, lecteur plein écran avec paroles, statistiques
- Construction automatique Windows + macOS par GitHub Actions (installateur Windows déjà fabriqué et
  vérifié hors GitHub : 109 Mo, 104 fichiers, sans dépendance superflue ; guide : docs/GITHUB.md)
- **Critère de sortie** : un utilisateur Premium installe l'appli, se connecte et écoute une playlist
  avec paroles en moins de 3 minutes
- Écoute réelle sur un PC Windows : **confirmée** (v0.4.1, lecture via Edge)

### Phase 2 — Bêta v0.2 *(en cours)*
- **Sprint 1 (fait)** : file d'attente, touches multimédia et contrôles système, pages artiste, titres likés
  — vérifiés sur données fictives, à valider sur compte réel avec le volume
- **Sprint 2 (fait)** : thème « Mystic » (mysticsaba.com) en option, mini-lecteur
- **Sprint 3 (fait, v0.2.0)** : mises à jour automatiques, Réglages, Discord, playlists, repli automatique en
  télécommande quand la lecture est refusée
- **Sprint 4 (fait, v0.3.0)** : titres likés, ouverture automatique de Spotify en arrière-plan, refus DRM retenu,
  récap partageable
- **Sprint 5 (fait, v0.4.0)** : lecture via Edge/Chrome, zone de notification, boutons de la barre des tâches,
  notifications, démarrage avec la session, minuteur de sommeil, accent tiré de la pochette
- **v0.4.1 (fait, publiée sur GitHub)** : lecture via Edge/Chrome réellement pilotable — barre de progression,
  pause et avance exactes ; confirmée à l'oreille sur votre PC Windows
- **Sprint 6 (fait, v0.5.0)** : Flow (découverte façon TikTok), story à partager, historique d'écoute local et
  stats « Sur cet ordinateur », raccourcis globaux, commandes en ligne, titres populaires d'artiste rétablis
- **Bloquant côté castlabs** : la création du compte EVS a échoué (« LimitExceededException » : quota d'e-mails du jour
  de castlabs atteint) ; à relancer le lendemain
- **Sprint 7 (fait, v0.6.0)** : historique de **tout le compte** (tous les appareils) et import de l'export Spotify,
  calendrier de l'année, **clic droit** sur les titres, Flow à partir d'un titre, Flow qui apprend, « Trouvé dans
  Flow », paroles sur le bureau, corbeille, mélange parfait
- **Sprint 8 (fait, v0.7.0)** : étude Movix / Mystic Saba (docs/INSPIRATION-MOVIX-MYSTIC.md), mémoire allégée (mode
  léger, page libérée quand cachée, Edge allégé, images à la bonne taille), logo [Vitrine], Top 10, titres numérotés,
  transitions, grain, paroles karaoké, carte 3 lignes, roulette, écran de veille
- **v0.7.1 (correctif)** : « Too many requests » vu sous Windows dans la Bibliothèque. Causes : Vitrine ne pouvait pas
  lire le délai demandé par Spotify (en-tête Retry-After masqué aux pages) et réessayait au bout d'une seconde, pendant
  que l'état du lecteur était redemandé toutes les 2,5 s. Correctif : délai lu et respecté par toute l'appli (plus
  aucune demande pendant la pause, reprise automatique des pages, message en français avec l'heure de reprise), 4
  demandes à la fois au plus, lectures identiques partagées pendant 1 min, état du lecteur demandé toutes les 15 s
  quand ce PC joue (il le dit lui-même), 5 s quand un autre appareil joue, 8 s à l'arrêt ; étude Apple Music
  (docs/INSPIRATION-APPLE-MUSIC.md)
- **v0.7.2 (correctif)** : Spotify a imposé une pause de 18 h (« 1100 min »), comme d'autres développeurs l'ont
  signalé en 2026 (13 à 19 h). La pause est désormais tenue **partie par partie** (playlists, albums, tops…), car
  Spotify peut bloquer une partie et laisser répondre les autres ; elle est gardée après un redémarrage (sinon chaque
  relance redemandait et risquait de la prolonger) ; une page bloquée montre sa dernière version connue ; la
  Bibliothèque et les Stats chargent chaque partie séparément ; un compteur ⏳ dans l'en-tête donne le détail ;
  l'historique du compte et la télécommande du processus principal respectent aussi la pause
- **Sprint 9 (fait, v0.8.0)** : trois listes (Apple Music, TikTok et projets voisins, égaliseur et karaoké) puis
  43 étapes intégrées et cochées dans docs/PLAN-V0.8.md : paroles mot par mot, silences, chœurs, prononciation ;
  pochette qui respire, fond vivant, vinyle, boucle A–B, « Ensuite », balayer la barre, temps restant ; épingles (et
  liste de raccourcis Windows), accès rapide, « Ce moment », tri, colonnes Lectures et Dernière écoute, pages d'album
  et d'artiste, recherche dans la bibliothèque, grands titres repliés ; Rétro Vitrine, reçu, affiche de festival,
  iceberg, aura, playlists intelligentes, bilan de la semaine et étapes ; autres versions d'un titre et karaoké sans la
  voix (version instrumentale officielle) ; égaliseur par Equalizer APO ; Vitrine Classic, Moments, intro, raccourcis
- **v0.8.1 (fait)** : docs/PLAN-V0.8.1.md, 19 cases cochées. Corrigés : boutons du haut à droite sous ceux de la fenêtre
  (paroles, Rétro Vitrine, versions), trait blanc sur le mot suivant. **Deuxième écran** : en-tête qui se resserre,
  panneau « À l'écoute » (ouvert d'office sur un écran vertical ou très large), ambiance de la pochette floutée
  (thèmes Hazy et Glowify de Spicetify), écran des paroles en deux colonnes ou empilé. **Paroles de quatre sources**
  (AMLL TTML DB mot à mot avec duos et chœurs, LRCLIB, NetEase, lyrics.ovh), choix de la source et décalage par titre,
  cache disque. **Karaoké façon Apple Music Sing** : vague des lignes, mots tenus qui brillent, duo à droite, curseur
  Voix, micro avec réverbération ou écho, Duo chacun son tour. **Clip TikTok** des paroles (15 s, vertical)
- **v0.8.2 (fait)** : chaque artiste d'un feat de son côté (en-têtes de Genius alignés sur les paroles
  synchronisées), paroles fluides (lumière des mots peinte à chaque image, fonds floutés une seule fois)
- **Sprint 10 (fait, v0.9.0)** : docs/PLAN-V0.9-V1.0.md. Pochette qui grandit jusqu'au plein écran, barre qui se
  replie, thème « Verre » (Liquid Glass), mode salon, traduction des paroles (MyMemory ou DeepL), sorties de vos
  artistes (budget de demandes), import de playlists, crédits (MusicBrainz), file infinie, Last.fm, Rétro Vitrine en
  vidéo, essai de bout en bout de la page dans la CI
- Signature DRM « VMP » castlabs (requise pour une lecture fiable en production)
- Signature de code Windows et notarisation Apple (supprime les alertes de sécurité à l'installation)
- Bêta fermée (≤ 25 utilisateurs, limite du mode développement Spotify)

### Phase 3 — Version 1.0 *(faite, v1.0.0 — docs/PLAN-V0.9-V1.0.md)*
- **Version anglaise** : choix de la langue (automatique selon le système), 630 textes et une centaine de phrases
  composées, titres et paroles jamais traduits, dates et nombres à l'anglaise, menus du système aussi
- **Accessibilité** : clavier partout (contour visible, « Aller au contenu »), titre annoncé aux lecteurs d'écran,
  contrastes WCAG AA vérifiés par un audit automatique (axe) à chaque envoi
- **Raccourcis personnalisables** (« ? ») et **rapport d'erreur sur consentement**, **accueil du premier lancement**
- **Version Linux** (AppImage, mise à jour automatique, lancement au démarrage)
- **Compatibilité avec les règles Spotify de 2026** (applis en mode développement : bibliothèque générique,
  playlists des autres, quota épuisé)
- **Mesures** mémoire et processeur : docs/MESURES-V1.0.md
- **Dossier « quota étendu »** prêt (docs/SPOTIFY-QUOTA-ETENDU.md) : depuis mai 2025, Spotify le réserve aux
  organisations établies ; Vitrine reste en mode développement (5 personnes par application Spotify, chacun peut
  créer la sienne). Liste de diffusion (signatures, notarisation) : docs/LIVRAISON.md

### Phase 4 — Au-delà
- Signature de code Windows et notarisation Apple dès que les comptes existent ; signature VMP castlabs
- Mesures sur un vrai PC Windows avec carte graphique ; viser moins de 300 Mo fenêtre ouverte
- Marketplace de thèmes, autres langues (le dictionnaire `en.json` se recopie)

### Vision élargie — ce que Vitrine peut devenir

Classées par thème ; **effort** : S (≤ 1 jour), M (quelques jours), L (une à deux semaines), XL (plus).
Tout reste dans le cadre de l'API officielle de Spotify (les recommandations, les « audio features » et les
aperçus de 30 s ne sont plus ouverts aux nouvelles applis depuis fin 2024 : rien ici n'en dépend).

| Thème | Fonctionnalité | Effort | Statut |
|---|---|---|---|
| **Bureau** | Icône dans la zone de notification avec commandes, fermeture « dans la barre » | S | 🧪 v0.4.0 |
| | Boutons précédent / lecture / suivant dans l'aperçu de la barre des tâches Windows | S | 🧪 v0.4.0 |
| | Notifications natives au changement de titre (pochette, titre, artiste) | S | 🧪 v0.4.0 |
| | Lancer Vitrine au démarrage de Windows, directement dans la barre | S | 🧪 v0.4.0 |
| | Minuteur de sommeil (15 à 60 min, ou fin du titre) | S | 🧪 v0.4.0 |
| | Raccourcis clavier globaux (hors des touches multimédia) et commandes en ligne | S | ✅ v0.5.0 |
| | Choisir ses propres combinaisons de touches | S | ⬜ |
| **Personnalisation** | Couleur d'accent tirée de la pochette en cours, en direct | S | 🧪 v0.4.0 |
| | Éditeur de thème (couleurs, polices, rayons) et thèmes partageables | M | ⬜ |
| | Fond animé « particules » façon mysticsaba.com dans le lecteur plein écran | M | ⬜ |
| **Paroles** | Partager une ligne de paroles en image (story aux couleurs de la pochette) | S | ✅ v0.5.0 |
| | Mode karaoké mot par mot quand LRCLIB fournit l'horodatage par mot | M | ⬜ |
| | Traduction des paroles (service de traduction au choix de l'utilisateur) | M | ⬜ |
| **Découverte** | « Mix Vitrine » maison sans API de recommandation : c'est Flow | M | ✅ v0.5.0 |
| | Historique d'écoute local illimité (Spotify n'en donne que 50) et minutes écoutées | M | ✅ v0.5.0 |
| | Récap animé (vidéo au format story) en plus de l'image | M | ⬜ |
| **Social** | Écoute à plusieurs entre utilisateurs de Vitrine, synchronisée (petit serveur de salons) | L | ⬜ |
| | Scrobbling Last.fm (clé personnelle) | S | ⬜ |
| **Qualité** | Tests de bout en bout automatiques sur compte de test, à chaque version | M | 🟡 scripts prêts, à intégrer à la CI |
| | Rapports de plantage anonymes, sur consentement | S | ⬜ |
| | Accessibilité (navigation clavier complète, contrastes AA, lecteur d'écran) | M | ⬜ |
| | Langues : anglais, espagnol, arabe | M | ⬜ |
| **Diffusion** | Signature de code Windows (Azure Trusted Signing) : plus d'alerte SmartScreen | S + coût | ⬜ |
| | Notarisation Apple (compte développeur 99 $/an) + mises à jour automatiques macOS | S + coût | ⬜ |
| | Version Linux (AppImage) | S | ⬜ |
| | Demande de quota étendu Spotify (au-delà de 25 utilisateurs) | démarches | ⬜ |

### Inspirations — ce que les autres projets font, et ce que Vitrine en reprend

Repris de l'analyse de Swiftify, Liner (tryliner), Movix, Vitrine iOS et des usages de TikTok. Toujours dans le cadre de
l'API officielle : pas de blocage de publicité ni de faux Premium (exclus dès le départ).

| Source | Ce qu'ils font | Pour Vitrine | Effort | Statut |
|---|---|---|---|---|
| **TikTok** | Fil vertical « Pour toi », un contenu par écran | **Flow** | M | ✅ v0.5.0 |
| | Double-tap pour aimer, légendes sur la vidéo | Double-clic = j'aime, paroles en sous-titres | S | ✅ v0.5.0 |
| | Partage en story | Story 1080 × 1920 avec la ligne de paroles | S | ✅ v0.5.0 |
| | « Pas intéressé » | « Pas pour moi » | S | ✅ v0.5.0 |
| | Le fil apprend de chaque geste | Pondérer les sources de Flow selon vos j'aime, sauts rapides et « pas pour moi » (calcul local) | M | 🧪 v0.6.0 |
| | Favoris / « sons » enregistrés | Playlist automatique « Trouvé dans Flow » remplie par vos j'aime dans Flow | S | 🧪 v0.6.0 |
| | Extrait en boucle | Mode « refrain en boucle » : 20 s répétées pour se décider | S | ⬜ |
| | Tendances | « Tendances Vitrine » : les titres les plus likés dans Flow par les utilisateurs (petit serveur, anonyme) | L | ⬜ |
| **Swiftify** | Stats locales, « cet ordinateur » | Historique local, carte jour × heure, export CSV | M | ✅ v0.5.0 |
| | Calendrier d'une année, classement par écoutes ou par temps | Calendrier annuel façon GitHub | S | ✅ v0.6.0 |
| | Stats de tout le compte (stats.fm) | Écoutes de tous vos appareils relues chez Spotify + import de l'export Spotify complet | M | ✅ v0.6.0 |
| | Ligne de commande pour les raccourcis | `--next`, `--play-pause`, `--like`, `--flow` | S | ✅ v0.5.0 |
| | Visualiseurs audio | Visualiseur à partir de la sortie son du PC (capture système, Windows) | M | ⬜ à étudier |
| **Liner** | Paroles en surimpression sur le bureau | Fenêtre transparente, toujours au premier plan, la ligne en cours par-dessus tout | M | ✅ v0.6.0 |
| | Fond animé WebGL (kawarp) | Fond « liquide » animé aux couleurs de la pochette dans le plein écran et Flow | M | ⬜ |
| | Touch Bar, raccourcis | Touch Bar des MacBook (commandes, pochette) | S | ⬜ |
| **Movix** | Mode léger automatique et par effet | Mode léger + page libérée quand cachée | M | ✅ v0.7.0 |
| | Top 10 aux chiffres géants, titres soulignés, pilule du bandeau | Top 10 du mois, titres numérotés, bouton pause | S | ✅ v0.7.0 |
| | Roulette, écran de veille | Roulette de vos playlists, écran de veille du lecteur | S | ✅ v0.7.0 |
| | Wrapped (bilan animé) | « Rétro Vitrine » | L | ⬜ v0.8 |
| | Calendrier des sorties, CineGraph | Calendrier de vos artistes, « Constellation » des featurings | M | ⬜ |
| **mysticsaba.com / Musix** | Logo « ○ mysticsaba® », famille [ix] | Logo [Vitrine] | S | ✅ v0.7.0 |
| | Paroles plein écran qui se remplissent, fond aurore | Paroles karaoké | M | ✅ v0.7.0 |
| | Panneau du lecteur : 3 lignes de paroles, CC, « PAROLES ↗ » | Carte 3 lignes du mini-lecteur | S | ✅ v0.7.0 |
| | Grain, une seule courbe de mouvement, libellés « 01 / … » | Grain du thème Mystic, transitions, titres numérotés | S | ✅ v0.7.0 |
| | Dock flottant qui s'ouvre en panneau | Dock Musix en option du thème Mystic | M | ⬜ v0.8 |
| | Champ de points qui suit la musique | À étudier : le son protégé ne peut pas être analysé | M | ⬜ |
| **Movix** | WatchParty (regarder ensemble, synchronisé) | « Écouter ensemble » : salons où chacun entend le même titre au même moment, sur son Premium | L | ⬜ |
| | Profils, appli TV | Mode salon (interface « 10 pieds » plein écran, pilotable au clavier ou à la télécommande) | M | ⬜ |
| | PreMid (présence Discord) | Discord Rich Presence | S | 🧪 v0.2 |
| **Vitrine iOS** | Liquid Glass | Thème « Verre » : panneaux translucides, flou d'arrière-plan | S | ⬜ v0.7 |
| | Live Activity sur l'écran verrouillé | Mini-lecteur toujours visible ; widget de bureau | S | 🧪 v0.2 / ⬜ |
| **Spotify (bureau)** | Menu clic droit sur un titre | Le même menu, plus Flow, story, corbeille | S | ✅ v0.6.0 |
| | Radio d'un titre | « Lancer un Flow à partir de ce titre » (la radio n'est plus ouverte aux applis) | S | ✅ v0.6.0 |
| **Spicetify** | Trashbin (corbeille de titres et d'artistes) | Corbeille : sautés partout, restaurables | S | ✅ v0.6.0 |
| | Shuffle+ (vrai aléatoire) | Mélange parfait sur toute la liste | S | ✅ v0.6.0 |
| | Marketplace de thèmes | Thèmes partageables (fichier de couleurs et polices) | M | ⬜ |
| **Deezer** | Flow, le mix sans fin | Le nom et l'esprit de Flow | — | ✅ v0.5.0 |
| **Apple Music / Spotify Wrapped** | Replay, Wrapped | « Rétro Vitrine » : votre année en story animée, quand vous voulez, depuis votre historique complet ; bilan mensuel et étapes | M | ✅ v0.8.0 |
| **Apple Music** *(étude : docs/INSPIRATION-APPLE-MUSIC.md)* | Lecteur : pochette qui recule à la pause, fond vivant, barre élastique, temps restant | Les mêmes gestes dans le lecteur plein écran | S | ✅ v0.8.0 |
| | Paroles : points pendant les silences, chœurs plus petits, flou selon la distance, défilement libre | Prolonge le karaoké de v0.7.0 | S | ✅ v0.8.0 |
| | Épingles (iOS 26), ajoutés récemment, tri | Épingles + liste de raccourcis Windows (clic droit sur l'icône) | S | ✅ v0.8.0 |
| | Mot par mot, prononciation (coréen, japonais en kana, cyrillique, grec) | Temps par mot estimé (ou celui du fichier), romanisation locale sans dictionnaire | M | ✅ v0.8.0 |
| | Mini-lecteur qui grandit en plein écran, chinois et kanji | Élément partagé framer-motion ; dictionnaire chargé à la demande | M | ✅ v0.9.0 (pochette) / ⬜ (kanji) |
| | Playlists intelligentes, nombre de lectures (Musique sur Mac) | Colonnes Lectures et Dernière écoute ; Pépites oubliées, En boucle, Jamais écoutés, Mon année, créées sur Spotify | M | ✅ v0.8.0 |
| | Pages d'artiste d'iOS 27 (grand bouton aléatoire, dernière sortie, sections) | Même structure, nom en Clash Display géant | M | ✅ v0.8.0 |
| | Traduction des paroles, import de playlists, crédits | Clé DeepL de l'utilisateur ; Deezer par ISRC et fichiers exportés ; MusicBrainz | M | ✅ v0.9.0 |
| | AutoMix, Sing, égaliseur intégré, dossiers, pochettes animées, Lossless | Impossible avec Spotify (son protégé, API muette, règles sur le mixage) ; égaliseur par Equalizer APO et karaoké par versions instrumentales à la place | — | ❌ / ✅ v0.8.0 |
| **TikTok** *(étude : docs/INSPIRATION-TIKTOK-PROJETS.md)* | Versions accélérées et ralenties | « Autres versions » officielles d'un titre | M | ✅ v0.8.0 |
| | Receiptify, Instafest, Icebergify, palettes | Reçu, affiche de festival, iceberg de vos artistes, aura musicale | S | ✅ v0.8.0 |
| | Le refrain en boucle | Boucle A–B et « refrain en boucle » | S | ✅ v0.8.0 |
| | RetroPod (l'iPod sur téléphone) | Vitrine Classic, avec molette | M | ✅ v0.8.0 |
| | Daylist, Airbuds (bilan de la semaine) | « Ce moment », notification du lundi, étapes | S | ✅ v0.8.0 |
| **Spicetify** | Loopy Loop, Bookmark, Upcoming Song, Beautiful Lyrics | Boucle A–B, Moments, « Ensuite », paroles mot par mot et prononciation | S | ✅ v0.8.0 |
| | Thèmes Hazy, Glowify (pochette floutée en fond), vue « À l'écoute » de Spotify | Ambiance de la pochette, panneau « À l'écoute » avec vos écoutes et vos moments | M | ✅ v0.8.1 |
| | Spicy Lyrics, Beautiful Lyrics (plein écran, fond dynamique) | Écran des paroles en deux colonnes, empilé en vertical, pochette qui tourne en fond | M | ✅ v0.8.1 |
| | lyrics-plus (plusieurs sources, décalage) | AMLL, LRCLIB, NetEase, lyrics.ovh ; source et synchro choisies par titre | M | ✅ v0.8.1 |
| | Full Screen (mode TV avec la photo de l'artiste) | Mode salon plein écran | M | ✅ v0.9.0 |
| **AMLL** (Apple Music-like Lyrics) | Base TTML mot à mot (CC0), vague des lignes, mots tenus qui brillent, duos | Source « mot à mot » par identifiant Spotify ou NetEase, et le même rendu | M | ✅ v0.8.1 |
| **Apple Music Sing** | Curseur de voix, duo, iPhone comme micro | Curseur Voix (version instrumentale officielle), micro du PC avec effets, Duo chacun son tour | M | ✅ v0.8.1 |
| **TikTok** | « Lyric edits » (clips de paroles) | Clip TikTok : 15 s de paroles en vidéo verticale, le son ajouté dans TikTok | S | ✅ v0.8.1 |
| **Equalizer APO** | Égaliseur de Windows, libre | Égaliseur 10 bandes de Vitrine, écrit pour Equalizer APO | M | ✅ v0.8.0 |
| **SoundCloud** | Commentaires horodatés | Notes perso à un moment d'un titre, affichées pendant l'écoute | S | ⬜ v0.7 |
| **Last.fm** | Scrobbling | Envoyer vos écoutes à Last.fm (clé personnelle) | S | ⬜ v0.7 |
| **Shazam** | Reconnaître un titre autour de soi | Écouter par le micro et ouvrir le titre dans Vitrine (service de reconnaissance payant) | M | ⬜ à étudier |
| **Discord** | Écouter ensemble | Inviter un ami à suivre votre écoute en direct (chacun sur son Premium) | L | ⬜ |

---

## 4. Journal des tests sur compte réel

**23 octobre 2026 — v0.8.0, sur données fictives (le compte Spotify est en pause « Too many requests » jusqu'au
lendemain : aucun test sur le compte réel pour ne pas prolonger la pause)**

| Domaine | Résultat |
|---|---|
| Tests unitaires (paroles, prononciation, boucle, balayage, épingles, tri, historique, cartes, versions, karaoké, égaliseur, molette, moments) | ✅ 158 / 158 |
| Page réelle dans Chromium avec une fausse API Spotify : paroles coréennes mot par mot, silences, défilement libre | ✅ |
| Lecteur : vinyle, boucle A–B (une seule commande au lecteur local), « Ensuite » sans demande à Spotify, balayage souris et pavé | ✅ |
| Épingles par clic droit, bibliothèque triée en liste, titres likés par écoutes, album (©, « Plus de »), artiste, recherche locale | ✅ |
| Rétro Vitrine (7 diapositives + image), reçu, affiche, iceberg, aura, playlist intelligente créée (1 création + 1 ajout) | ✅ |
| Versions d'un titre et karaoké : instrumentale officielle choisie, même instant, retour à la voix | ✅ |
| Égaliseur (préréglages, courbe, fichier écrit une fois le curseur relâché), Vitrine Classic (molette : un quart de tour = 3 crans), Moments, Ctrl+L | ✅ |
| Appli Electron réelle : ponts égaliseur, épingles, moments, historique | ✅ |
| **À vérifier sous Windows** : Equalizer APO (écriture du fichier et de la ligne Include), liste de raccourcis de la barre des tâches, notifications du bilan | ⏳ |
| **À vérifier sur le compte réel** quand la pause sera finie : versions et karaoké sur de vrais titres | ⏳ |

**22 octobre 2026 — compte Premium, appli Electron réelle (castlabs, Widevine prêt), 27 tests automatiques**

| Domaine | Résultat |
|---|---|
| Connexion PKCE, profil Premium, renouvellement du jeton, déconnexion | ✅ |
| Accueil (73 cartes, 4 rangées), recherche, album, bibliothèque (30 playlists, 3 albums), playlist (174 titres), stats (3 périodes) | ✅ |
| Appareil « Vitrine (cet ordinateur) » dans Spotify Connect, lecture locale (la position avance) | ✅ |
| Pause, reprise (espace), suivant, précédent, avance, aléatoire, répétition | ✅ |
| Plein écran + paroles synchronisées (56 lignes), clic sur une ligne, menu des appareils | ✅ |
| Volume | ❌ → corrigé (synchronisation Spotify Connect), à revérifier |

**Défauts trouvés et corrigés pendant le test**

| Défaut | Gravité | Correctif |
|---|---|---|
| Connexion et paroles impossibles derrière un proxy (le `fetch` de Node ignore le proxy) | Bloquant en entreprise | Requêtes du processus principal via `net.fetch` d'Electron (proxy du système) |
| « Lecture » envoyait la musique sur un autre appareil simplement actif (un autre PC en pause) | Majeur | Lecture sur cet ordinateur dès que son lecteur est prêt ; un appareil choisi dans le menu reste prioritaire |
| Volume de l'ordinateur non transmis à Spotify Connect | Mineur | Volume aussi envoyé par l'API officielle |

**22 octobre 2026 — premiers retours sur un vrai PC Windows (installateur GitHub Actions)**

| Retour | Cause | État |
|---|---|---|
| Pochettes floues | Vignettes 64 px de Spotify agrandies à 168 px | Corrigé : 300 px pour les cartes et listes, 640 px pour les grands lecteurs |
| Après une avance dans le titre, plus de son mais la barre avance | Très probablement la licence DRM refusée hors de la partie non chiffrée du titre (Widevine non signé VMP) | À confirmer : signature castlabs EVS à ajouter (secrets GitHub) ; les erreurs du lecteur s'affichent désormais |
| Message « Spotify refuse la lecture sur cet ordinateur » (repli v0.2) | Pas de signature VMP ; l'inscription castlabs EVS a échoué (quota d'e-mails de castlabs) | Contourné en v0.3.0 : la lecture passe par l'appli Spotify officielle, ouverte en arrière-plan si besoin (parcours vérifié par simulation : refus mémorisé, Spotify lancé une fois, lecture envoyée à l'appareil du PC). Correctif définitif : compte EVS à créer, puis build signé |
| Message « Unexpected token … is not valid JSON » | Les commandes de lecture de Spotify répondent désormais par un identifiant en texte brut | Corrigé : réponse non JSON acceptée (la commande avait réussi) |
| Un titre joue 1 s puis passe au suivant | Même cause : le lecteur Spotify saute le titre après l'erreur DRM | Confirmé par la capture des erreurs (« Playback error » sur chaque titre) ; en attente de la signature EVS. En attendant, la v0.2 bascule seule en mode télécommande |

**22 octobre 2026, soir — lecture via Google Chrome, compte Premium, appli Electron réelle (v0.4.1)**

Situation reproduite : lecteur intégré refusé par Spotify (le cas de votre PC Windows), lecture via le navigateur.

| Test | Résultat |
|---|---|
| Lecteur intégré non relancé (refus mémorisé), lecteur Chrome prêt, appareil visible dans Spotify Connect | ✅ |
| Lecture d'une playlist : la barre de Vitrine avance au même rythme que le lecteur (écart ≤ 0,5 s) | ✅ |
| Avance à 60 % : le lecteur y va (106 s pour 104 s visés) et la barre repart | ✅ |
| Pause : la musique s'arrête, la barre se fige ; reprise au même endroit | ✅ |
| Titre suivant : affiché, et il tient ; volume 27 % ; pause finale ; fermeture de Chrome | ✅ |

**Même test sous Microsoft Edge 156, avec le son enregistré** (sortie audio virtuelle, niveau RMS sur 3 s ; 0 = silence)

| Moment | Niveau sonore | Résultat |
|---|---|---|
| Lecture d'une playlist | 2 913 | ✅ son présent, barre exacte (écart 0,1 s) |
| Après une avance à 60 % (le cas « plus de son après une avance » sous Windows) | 8 232 | ✅ |
| Pendant la pause | 0 | ✅ silence |
| Après la reprise, au même endroit | 8 635 | ✅ |
| Titre suivant | 1 801 | ✅ |
| Volume abaissé à 27 % | 1 796 → 1 094 | ✅ le son baisse |

**Défauts trouvés et corrigés**

| Défaut | Cause | Correctif |
|---|---|---|
| Barre figée à 0:00 et bouton lecture/pause faux en lecture via navigateur | L'API de Spotify renvoie, pour ce type d'appareil, la position et la pause du début du titre | Le lecteur du navigateur transmet son propre état à Vitrine, qui l'affiche |
| Pause et avance sans effet (le titre suivant, lui, marchait) | Chrome met au ralenti sa fenêtre placée hors de l'écran | Commandes envoyées directement au lecteur, et Chrome/Edge lancés sans mise au ralenti des fenêtres cachées |

**22 octobre 2026, nuit — v0.5.0 sur votre compte, appli Electron réelle, lecture via Microsoft Edge (12/12)**

| Test | Résultat |
|---|---|
| Flow se charge avec vos données | ✅ « Nouveauté · EsDeeKid », « À découvrir · Drake », « Dernière sortie · Luidji »… |
| Le premier titre démarre seul, au refrain, avec du son | ✅ « Néons rouges - Live » à 39 s, niveau sonore 2 900 |
| Flèche bas : le titre suivant du fil joue | ✅ « Get It Together » à 75 s, niveau 8 659 |
| Historique : l'écoute est notée après 30 s | ✅ |
| Story 1080 × 1920 avec la ligne de paroles du moment | ✅ |
| « Pas pour moi » : la carte disparaît, la suivante joue | ✅ |
| Page artiste : « Populaires » rempli malgré la fermeture de l'API | ✅ 8 titres |
| Raccourcis globaux (vraies frappes clavier) et commandes en ligne (`--flow`, `--next`, `--play-pause`, `--previous`, `--like`) | ✅ profil de test séparé |

**22 octobre 2026, nuit — v0.6.0 sur votre compte (profil de test séparé), lecture via Microsoft Edge (13/13)**

| Test | Résultat |
|---|---|
| Écoutes de tous vos appareils récupérées seules au lancement | ✅ 49 écoutes (« Je la connais », « RockWave »…) |
| Stats « Toute votre écoute » avec calendrier de l'année | ✅ |
| Import d'un export au format Spotify (ZIP) | ✅ 120 écoutes, podcast et écoute de 5 s écartés, 0 au 2e import |
| Clic droit : menu complet, copie du lien, aller à l'album | ✅ |
| Flow lancé depuis un titre (« Anarchie », SCH), qui joue | ✅ à 106 s (refrain) |
| Paroles sur le bureau qui suivent la chanson ; Ctrl+Alt+K les referme | ✅ |
| Mélange parfait sur une playlist de 174 titres, sans l'aléatoire de Spotify | ✅ |
| Corbeille : artiste mis à la corbeille pendant son titre → sauté aussitôt ; restauration | ✅ |

**23 octobre 2026 — v0.7.0 sur votre compte (profil de test séparé), lecture via Microsoft Edge allégé (6/6)**

| Test | Résultat |
|---|---|
| Accueil : logo [Vitrine], titres numérotés, Top 10 de vos 4 semaines | ✅ Omens, 488, Mystery Girl… |
| Edge allégé : la lecture a du son | ✅ niveau sonore 11 033 |
| Paroles karaoké avec de vraies paroles | ✅ 54 lignes (« Omens ») |
| Roulette | ✅ « REV Mixes » tiré |
| Vitrine cachée 1 min : la page se ferme, la musique continue, `--next` passe au titre suivant | ✅ « Omens » → « 488 », avec du son |
| La page revient au clic, sur le bon titre | ✅ |

**23 octobre 2026 — v0.8.1 : sources de paroles interrogées en vrai depuis l'appli Electron (sans compte Spotify)**

| Test | Résultat |
|---|---|
| « Fille à Papa » (Vacra) : LRCLIB et NetEase | ✅ 63 et 47 lignes synchronisées, crédits « 作词 / 作曲 » retirés ; 3,1 s la première fois, 1 ms ensuite (cache) |
| « APT. » (ROSÉ, Bruno Mars) par identifiant Spotify : AMLL TTML DB | ✅ 80 lignes mot à mot, 7 lignes du deuxième chanteur à droite, 6 chœurs chronométrés |
| NetEase désactivé dans les Réglages | ✅ seule LRCLIB répond |
| Titre inconnu partout (lyrics.ovh compris) | ✅ « Pas de paroles », rien d'inventé |
| Cache disque | ✅ un fichier par titre (72 Ko pour trois titres) |
| Micro (Chromium, faux micro) : ouverture, effet « Stade », vumètre | ✅ jusqu'à 5 barres sur le bip du faux micro |
| Clip TikTok enregistré | ✅ 15,0 s, 1080 × 1920, 30 images/s (WebM ou MP4 selon l'ordinateur) |

Non testé ici, faute de Windows et pendant la pause Spotify : le micro et la sortie son réels sous Windows, le panneau
« À l'écoute » sur votre écran vertical avec vos vraies données, et le format MP4 en H.264 (Chromium de test sans
codec H.264 : il produit du WebM).

Mesures de mémoire avant / après : voir la section Performance ci-dessus et docs/INSPIRATION-MOVIX-MYSTIC.md.
**Défaut trouvé et corrigé** : fermer la page faisait quitter toute l'appli (dernière fenêtre fermée) ; le processus
principal prend maintenant le relais avant.

**Défauts trouvés et corrigés** : la page des paroles sur le bureau gardait un fond noir (transparence rétablie) ; la
corbeille n'agissait qu'au titre suivant (elle agit maintenant dès l'ajout).

**Défaut trouvé et corrigé** : l'API renvoie parfois 0:00 un instant pour le lecteur du navigateur ; l'historique y voyait
une nouvelle écoute et repartait de zéro. Seule une vraie relecture (après la fin du titre) compte désormais comme une
nouvelle écoute.

**Points d'accès Spotify vérifiés le 22 octobre 2026** (mode développement) : ouverts — vos tops, titres likés, playlists,
sorties d'un artiste (10 par page), albums, recherche (10 résultats par page) ; **fermés** — titres populaires d'un artiste,
artistes similaires, recommandations, nouveautés globales, lectures par lot (`?ids=`), caractéristiques audio, et les
champs genres / popularité / abonnés des artistes.

---

## 5. Risques et points d'attention

| Risque | Impact | Parade |
|---|---|---|
| Spotify limite les applis en mode développement : 5 utilisateurs par appli, propriétaire Premium, points d'accès réduits pour les applis créées depuis le 11 février 2026, quota par compte développeur (juillet 2026) | Diffusion bloquée au-delà d'un cercle proche ; le quota étendu est réservé aux organisations établies depuis mai 2025 | Chacun peut créer sa propre application (guidé dans l'écran de connexion) ; Vitrine 1.0 suit les nouvelles règles avec repli sur les anciens points d'accès ; dossier prêt (docs/SPOTIFY-QUOTA-ETENDU.md) |
| La lecture locale exige Premium + Widevine | Utilisateurs gratuits sans son sur PC | Mode télécommande automatique ; message clair |
| Widevine non signé VMP refusé par Spotify en production | Lecture locale en échec (symptômes observés sous Windows : saut au titre suivant, son coupé après une avance) | Compte castlabs EVS + signature VMP dans la chaîne de build (déjà prévue) |
| Historique de tout le compte : Spotify ne montre aux applis que les 50 dernières écoutes | Vitrine fermée longtemps : les écoutes au-delà de 50 manquent | Lancement avec la session dans la zone de notification (réglage existant) ; import de l'export Spotify complet pour combler |
| Évolution de l'API Spotify (points d'accès retirés) | Écrans vides | Appels défensifs, replis (`/items` → `/tracks`, titres d'artiste par la recherche), Flow bâti uniquement sur des points d'accès ouverts, vérification en réel à chaque version, suivi du changelog Spotify |
| Limite de requêtes Spotify (« Too many requests », plus basse en mode développement, comptée sur 30 s pour toute l'appli) | Pages vides, commandes refusées ; la pause peut durer des heures si l'appli insiste | v0.7.1 : délai Retry-After respecté partout, sondage adaptatif, lectures partagées ; v0.7.2 : pause par partie de l'API, gardée après redémarrage, dernière version connue affichée. Spotify peut imposer 13 à 19 h : rien d'autre à faire qu'attendre (créer un autre Client ID n'est plus possible : un seul par développeur depuis février 2026). Les tests sur compte réel partagent ce quota : les espacer |
| Égaliseur : la configuration d'Equalizer APO est sous Program Files (droits d'administrateur) | La ligne Include ne s'écrit pas toute seule | Vitrine l'affiche avec un bouton « Copier » et ouvre l'éditeur d'Equalizer APO ; une seule fois |
| Karaoké : tous les titres n'ont pas de version instrumentale officielle | Pas de karaoké sans la voix pour ces titres | Repli sur la version d'un label de karaoké (synchro approximative, signalée) ; sinon un message clair |
| Lecture déclenchée sur un autre appareil de l'utilisateur | Musique qui démarre ailleurs (vécu en test) | Règle de choix de l'appareil corrigée et testée ; le test automatique s'arrête si la lecture n'est pas sur Vitrine |
| Licence des polices Clash Display et Satoshi (Fontshare, ITF Free Font License) | Diffusion du thème Mystic | Polices chargées depuis les serveurs Fontshare, pas intégrées ; vérifier la licence avant diffusion, repli automatique sur Archivo Black / Inter |
| NetEase n'est pas une API officielle (son moteur de recherche public) | Peut changer ou bloquer sans prévenir | Source désactivable, jamais seule : LRCLIB, AMLL et lyrics.ovh restent ; aucune donnée de compte envoyée, seulement le titre et l'artiste |
| AMLL TTML DB est servie par GitHub (raw.githubusercontent.com) | Indisponible si GitHub bloque ou change d'adresse | Une seule demande par titre, gardée sur le disque ; les autres sources prennent le relais |
| Micro du karaoké avec des enceintes | Larsen | Conseil du casque dans le panneau ; micro coupé en quittant les paroles ; volume réglable |
| Usage commercial | Les conditions développeur Spotify encadrent la monétisation | Validation juridique avant toute diffusion payante |
