# Plan de la v0.8.0 — la liste cochée

Tout ce qui entre dans la v0.8.0, tiré des deux listes :
[INSPIRATION-APPLE-MUSIC.md](INSPIRATION-APPLE-MUSIC.md) (codes A à H) et
[INSPIRATION-TIKTOK-PROJETS.md](INSPIRATION-TIKTOK-PROJETS.md) (codes T, P, K, I). Chaque case est cochée quand l'étape
est intégrée au code et vérifiée (tests automatiques, et capture sur données fictives : le compte Spotify est en pause
jusqu'à la fin de la limite).

Règle commune : **aucune idée n'ajoute de demandes régulières à Spotify** ; tout ce qui peut venir de l'historique local
ou des données déjà chargées en vient.

## Étape 1 — Paroles

- [x] B1 Points pendant les silences (intro et passages instrumentaux)
- [x] B2 Mot par mot (temps estimé par mot, vrai temps si le fichier le donne)
- [x] B3 Chœurs entre parenthèses plus petits, sous la ligne
- [x] B5 Flou et taille selon la distance à la ligne chantée
- [x] B6 Défiler librement, retour automatique après 3 s ou au clic
- [x] B8 Prononciation en lettres latines (coréen, japonais en kana, russe et autres cyrilliques, grec)

## Étape 2 — Le lecteur

- [x] A1 La pochette recule à la pause, revient avec un petit rebond
- [x] A3 Fond vivant aux couleurs de la pochette (aurore du karaoké)
- [x] A4 Barre de progression qui s'épaissit, un seul déplacement au relâchement, temps restant au clic
- [x] A5 Titre trop long qui défile
- [x] A6 Balayer la barre du bas (pavé tactile ou souris) pour changer de titre
- [x] A7 Pochette qui glisse lentement (Ken Burns)
- [x] T10 Mode vinyle (disque qui tourne, bras de lecture)
- [x] T6 Boucle A–B et « refrain en boucle »
- [x] P4 « Ensuite » : le titre suivant annoncé 10 s avant la fin
- [x] E3 Minuteur de sommeil : fondu de 30 s avant la pause
- [x] H4 Une seule définition de ressort pour ce qui s'ouvre

## Étape 3 — Bibliothèque, pages, recherche

- [x] C1 Épingles (clic droit), rangée en tête de Bibliothèque et d'Accueil, liste de raccourcis Windows, menu de la zone
      de notification
- [x] C2 « Ajoutés récemment »
- [x] C3 Tri de la bibliothèque, grille ou liste
- [x] C4 Colonnes « Lectures » et « Dernière écoute » dans Titres likés (historique local)
- [x] D1 Page d'album : pied de page (sortie, titres, durée, ©/℗) et « Plus de cet artiste »
- [x] D2 Page d'artiste : grand bouton aléatoire, dernière sortie, Albums / Singles et EP / Apparitions
- [x] D3 Recherche : recherches récentes, « Dans ma bibliothèque »
- [x] H1 Grands titres qui se replient dans l'en-tête
- [x] P5 « Accès rapide » en tête de l'Accueil (le plus écouté selon l'historique)

## Étape 4 — Bilans et partage

- [x] I2 Rétro Vitrine : le mois ou l'année en diapositives plein écran, image finale à partager
- [x] T1 Le reçu de vos écoutes
- [x] T2 L'affiche de festival
- [x] T3 Votre iceberg (vos pépites enfouies)
- [x] T4 Votre aura musicale
- [x] T7 « Ce moment » (daylist locale)
- [x] T8 Le bilan de la semaine (notification du lundi)
- [x] I3 Les étapes (100e écoute, 1 000 minutes…)
- [x] I4 Playlists intelligentes en un clic (Pépites oubliées, En boucle ce mois-ci, Jamais écoutés)
- [x] I5 « Mon année » en playlist

## Étape 5 — Versions et karaoké sans la voix

- [x] T5 Les versions d'un titre (accélérée, ralentie, acoustique, instrumentale, live, remix)
- [x] K2 Karaoké « sans la voix » : version instrumentale officielle, au même instant, paroles de l'original

## Étape 6 — Égaliseur

- [x] K1 Égaliseur 10 bandes et préréglages, appliqué à la sortie de Windows par Equalizer APO

## Étape 7 — Idées maison

- [x] T9 Mode « Vitrine Classic » (façon iPod, molette)
- [x] P3 Les Moments (marque-pages horodatés avec note)
- [x] I1 Intro au lancement
- [x] E4 Raccourcis : Ctrl+L (titre en cours), Ctrl+F (recherche), Ctrl+↑/↓ (volume), Ctrl+M (moment)

## Étape 8 — Livraison

- [ ] Tests automatiques, captures sur données fictives, ROADMAP et README à jour
- [ ] Version 0.8.0, installateur Windows, paquet git

---

## Hors de la v0.8.0, et pourquoi

| Idée | Pourquoi | Quand |
|---|---|---|
| Égaliseur et retrait de la voix **dans** Vitrine (K3, K4) | Son chiffré inaccessible, remixage interdit par Spotify | Jamais : remplacés par K1 et K2 |
| AutoMix, fondu enchaîné (E2) | « Enchaîner ou superposer » des titres est interdit par Spotify | Jamais |
| Score d'originalité (T11) | Popularité fermée aux applis en développement | Jamais : remplacé par T3 |
| Duos à gauche / à droite (B4) | LRCLIB ne dit pas qui chante | Si la donnée apparaît |
| Traduction des paroles (B7) | Clé DeepL à créer par l'utilisateur | v0.9 |
| Mini-lecteur qui grandit en plein écran (A2), barre qui rétrécit (H2), thème Verre (H3) | Refonte de la barre et du lecteur, à faire d'un bloc | v0.9 |
| Playlists de pochettes générées (C7) | Autorisation Spotify de plus, donc reconnexion | v0.9 |
| Import de playlists (C8), crédits (D5), calendrier des sorties (I6), file ∞ (E1) | Beaucoup de demandes à Spotify : à faire après la pause, avec un budget | v0.9 |
| Last.fm (P7) | Clé et connexion Last.fm | v0.9 |
| « Ce que vos amis écoutent » (P6), écouter ensemble | Demande un serveur | v1.x |
| Dossiers de playlists (C6), pochettes animées (A7 vidéo), Lossless (A8) | Spotify ne les donne pas | Jamais |
