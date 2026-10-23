# Plan de la v0.9 et de la v1.0 — la liste cochée

Ce qui restait dans la feuille de route ([ROADMAP.md](../ROADMAP.md), sprint 10 et phase 3) et dans les listes
d'inspiration ([Apple Music](INSPIRATION-APPLE-MUSIC.md), [TikTok et projets voisins](INSPIRATION-TIKTOK-PROJETS.md)).
Chaque case est cochée quand l'étape est intégrée et vérifiée (tests automatiques, captures sur données fictives :
le compte Spotify de test reste ménagé).

Règle commune, inchangée : **aucune demande régulière de plus à Spotify** ; ce qui demande Spotify a un budget
(nombre de demandes, rythme) et un cache.

## v0.8.2 — Correctifs demandés

- [x] Feats : chaque artiste de son côté (en-têtes de Genius alignés sur les paroles synchronisées), son nom quand la
      voix change, les voix ensemble au centre, les couplets d'un posse cut en alternance
- [x] Animations fluides : la lumière des mots peinte à chaque image, sans React ; fonds floutés une seule fois
      (plus de flou recalculé à chaque image) ; vague limitée aux lignes visibles, chacune sur son calque
- [x] Fond qui s'arrêtait à 90 % de la largeur

## v0.9 — Le lecteur, les paroles, la découverte, les connexions

### Le lecteur
- [x] A2 La pochette de la barre grandit jusqu'au lecteur plein écran (et y retourne)
- [x] H2 La barre du bas se replie en défilant vers le bas, revient en remontant
- [x] H3 Thème « Verre » (Liquid Glass) : tout en verre sur la pochette floutée, reflets sur les bords
- [x] Mode salon (Spicetify Full Screen, mode TV) : plein écran « à 3 mètres », photo de l'artiste, horloge,
      ligne des paroles, la suite ; pilotable au clavier ou à la télécommande

### Les paroles
- [x] B7 Traduction des paroles sous chaque ligne (MyMemory sans clé, ou DeepL avec votre clé), gardée sur le disque

### La découverte et la bibliothèque
- [x] I6 Sorties de vos artistes : les nouveautés de vos artistes du moment, avec un budget de demandes
- [x] C8 Import de playlists : un fichier (CSV d'Exportify, TuneMyMusic, liste « Artiste - Titre ») devient une
      playlist Spotify, au rythme permis
- [x] D5 Crédits d'un titre (MusicBrainz par ISRC) : paroliers, compositeurs, producteurs
- [x] E1 File infinie : quand la playlist ou l'album finit, la musique continue dans le même esprit

### Les connexions et le partage
- [x] P7 Last.fm : vos écoutes envoyées (« scrobble ») avec votre clé
- [x] Rétro Vitrine en vidéo verticale (en plus des images)

### La qualité
- [ ] Intégration continue : vérification des types, tests, construction, et un essai de bout en bout de la page
      (données fictives) à chaque envoi sur GitHub

## v1.0 — Prête pour tout le monde

- [ ] Version anglaise (choix de la langue, automatique selon le système)
- [ ] Accessibilité : clavier partout (contour visible, aller au contenu), « ? » liste les raccourcis, titres
      annoncés aux lecteurs d'écran, contrastes vérifiés
- [ ] Raccourcis personnalisables
- [ ] Rapport d'erreur sur consentement : les erreurs gardées sur l'ordinateur, copiées ou envoyées en ticket par vous
- [ ] Accueil du premier lancement (ce que fait Vitrine, en trois écrans)
- [ ] Version Linux (AppImage)
- [ ] Mesures mémoire et processeur de la v1.0
- [ ] Dossier « quota étendu » Spotify prêt à envoyer, et la liste de diffusion (signature, notarisation)
- [ ] Version 1.0.0 : tests, captures, README, ROADMAP, installateurs, paquet
