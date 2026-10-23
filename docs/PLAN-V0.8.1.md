# Plan de la v0.8.1 — paroles de toutes les sources, karaoké façon Apple Music Sing, corrections

Avant la v0.9 : régler les paroles (plus de sources, choix de la source, synchro réglable), refaire le karaoké comme
Apple Music Sing, reprendre ce que font les meilleurs projets (AMLL, Lyricify, lyrics-plus de Spicetify) et TikTok,
et corriger les défauts vus sous Windows. Chaque case est cochée quand l'étape est intégrée et vérifiée.

## Ce qu'on reprend, et d'où

| Source | Ce qu'ils font | Pour Vitrine |
|---|---|---|
| **Apple Music Sing** (iOS 16.2, Apple TV) | Curseur de voix (baisse la voix sans l'enlever), paroles qui suivent le rythme de la voix, chœurs affichés à part, **vue duo** (chaque chanteur d'un côté), l'iPhone comme micro sur l'Apple TV | Version instrumentale officielle (le son de Spotify ne peut pas être modifié), paroles mot par mot, chœurs, **duo à gauche / à droite**, **le micro du PC avec écho et réverbération** |
| **AMLL** (Apple Music-like Lyrics, GitHub) et sa base **AMLL TTML DB** (CC0) | Le rendu d'Apple Music refait en libre : lignes qui glissent avec un ressort décalé (effet de vague), mots tenus qui grossissent et brillent, base communautaire de paroles mot à mot indexées par identifiant Spotify | **Source « mot à mot »** par identifiant Spotify, **mouvement en vague**, **mots tenus qui brillent** |
| **lyrics-plus** (Spicetify) et **Lyricify** | Plusieurs sources de paroles au choix (LRCLIB, NetEase, Musixmatch…), décalage réglable, paroles du bureau | **Plusieurs sources** (AMLL, LRCLIB, NetEase, lyrics.ovh), **choix de la source**, **décalage ± par titre**, cache sur le disque |
| **Thèmes Spicetify** (Hazy, Glowify, Lucid, Bloom) et la vue « À l'écoute » de Spotify | La pochette floutée en fond de toute l'appli, des panneaux en verre posés dessus, une colonne de droite avec la pochette, les paroles en direct dans une carte teintée, l'artiste | **Ambiance pochette**, **panneau « À l'écoute »** avec ce que Vitrine sait en plus (vos écoutes, vos moments, la suite) |
| **Spicy Lyrics**, **Beautiful Lyrics** (Spicetify) | Plein écran des paroles : pochette, barre et titre à gauche, paroles à droite ; en vertical, pochette en haut ; fond qui mélange les couleurs de la pochette | **Écran des paroles en deux colonnes**, empilé sur un écran vertical |
| **TikTok** | Les « lyric edits » : clips verticaux avec les paroles qui s'animent, le son ajouté dans TikTok | **Clip de paroles** vertical (vidéo sans le son, à poster avec le son de TikTok) |

Musixmatch n'est pas repris : sa seule voie sans clé payante consiste à se faire passer pour son appli de bureau,
comme pour le lecteur web de Spotify (refusé au même titre).

## Étape 1 — Corrections vues sous Windows

- [x] Les boutons du haut à droite passaient sous les boutons de la fenêtre (réduire, agrandir, fermer) : espace réservé
      sur toutes les vues plein écran (paroles, Rétro Vitrine, versions)
- [x] Le mot suivant montrait un fin trait blanc avant d'être chanté (dégradé coupé net) : couleur pleine avant et après

## Étape 2 — Le deuxième écran (vertical) et le rendu des thèmes Spicetify

- [x] En-tête qui se resserre sur une fenêtre étroite (icônes seules, la recherche garde sa place)
- [x] Panneau « À l'écoute » à droite : la pochette et le titre, les paroles en direct dans une carte aux couleurs de la
      pochette, la suite, vos écoutes de ce titre, vos moments, l'artiste ; ouvert d'office sur un écran vertical
- [x] Ambiance : la pochette en cours, floutée, en fond de toute l'appli, et des panneaux en verre (réglable)
- [x] Écran des paroles façon Apple Music et Spicy Lyrics : pochette, titre et barre à gauche, paroles à droite ; sur un
      écran vertical, la pochette en haut et les paroles dessous

## Étape 3 — Les paroles de toutes les sources

- [ ] AMLL TTML DB (mot à mot, duo, chœurs) par identifiant Spotify, LRCLIB, NetEase (synchronisées), lyrics.ovh (texte)
- [ ] La meilleure d'abord : mot à mot > synchronisées > texte ; crédits « 作词 / 作曲 » retirés
- [ ] Choix de la source dans l'écran des paroles, retenu par titre ; « Ce ne sont pas les bonnes paroles »
- [ ] Décalage réglable (± 0,25 s) retenu par titre
- [ ] Cache sur le disque (moins de demandes, paroles disponibles hors ligne)
- [ ] Paroles non synchronisées qui défilent avec la chanson

## Étape 4 — Le karaoké façon Apple Music Sing

- [ ] Lignes qui glissent avec un ressort décalé (la vague d'Apple Music)
- [ ] Mots tenus qui grossissent et brillent
- [ ] Vue duo : le deuxième chanteur à droite (TTML), ou « chacun son tour » quand on chante à deux
- [ ] Curseur « Voix » façon Apple : version originale ou instrumentale officielle, au même instant
- [ ] Le micro du PC : votre voix avec écho ou réverbération (salle, studio, stade), niveau affiché

## Étape 5 — TikTok

- [ ] Clip de paroles vertical (1080 × 1920, 15 s, sans le son) à poster sur TikTok ou en story

## Étape 6 — Livraison

- [ ] Tests, captures, README, ROADMAP ; version 0.8.1, installateur, paquet
