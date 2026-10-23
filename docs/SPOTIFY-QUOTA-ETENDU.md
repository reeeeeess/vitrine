# Dossier « quota étendu » Spotify — prêt à envoyer

Vitrine utilise l'API Web officielle de Spotify et son lecteur web (Web Playback SDK). Une application Spotify est
d'abord en **mode développement** ; pour l'ouvrir à tout le monde, il faut demander le **quota étendu** (« extended
quota mode ») depuis le tableau de bord développeur. Ce dossier rassemble tout ce que Spotify demande, et dit
honnêtement où en est Vitrine.

## 1. Les règles en vigueur (vérifiées le 23 octobre 2026)

| Date | Changement | Source |
|---|---|---|
| 15 mai 2025 | Le quota étendu est réservé aux services « établis, à grande échelle et à fort impact » | [Spotify, 15 avril 2025](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access) |
| 11 février 2026 | Nouvelles applis en mode développement : propriétaire **Premium**, **5 utilisateurs** au plus, moins de points d'accès | [Spotify, 6 février 2026](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security) |
| 9 mars 2026 | Premium et 5 utilisateurs appliqués aux applis existantes ; **les restrictions de points d'accès reportées pour elles** | même page, mise à jour du 9 mars |
| 23 juillet 2026 | 25 applis par développeur, quota **compté par compte développeur**, réponse 429 `"reason": "QUOTA_EXCEEDED"` | [Spotify, 23 juillet 2026](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates) |

Plusieurs sources tierces indiquent que la demande de quota étendu n'est plus acceptée que de la part
**d'organisations** (entreprise enregistrée, service en activité) avec **au moins 250 000 utilisateurs actifs par
mois**. Ce seuil ne figure pas en toutes lettres dans les pages de Spotify consultées : **à vérifier sur le
formulaire au moment de l'envoi.**

### Conséquence pour Vitrine

- **Aujourd'hui, Vitrine ne remplit pas ces critères** (projet personnel, pas encore d'utilisateurs). Le dossier
  est prêt pour le jour où ce sera le cas, porté par une structure (société ou association).
- **En attendant, Vitrine fonctionne en mode développement**, de deux façons :
  1. **Chacun sa propre application Spotify** (gratuit, 5 minutes) : l'écran de connexion de Vitrine guide pas à pas
     (Client ID, adresse de retour, « Web API » et « Web Playback SDK »). Le propriétaire doit avoir Premium.
  2. **Une application partagée** jusqu'à 5 personnes, ajoutées par son propriétaire dans « User Management ».
- **Vitrine 1.0 est compatible avec les applis créées après le 11 février 2026** : bibliothèque générique
  (`/me/library`), contenu des playlists par `/items`, plus de lecture groupée (`/tracks?ids`, `/artists?ids`), plus
  de « top tracks » d'artiste, recherche par 10, champs disparus (`popularity`, `followers`, `product`…) tolérés,
  playlists des autres jouées en entier quand Spotify en cache le contenu, quota épuisé (`QUOTA_EXCEEDED`) jamais
  redemandé en boucle. Les applis plus anciennes gardent les anciens points d'accès, que Vitrine utilise en secours.

## 2. Ce que Vitrine demande à Spotify

### Autorisations (scopes) et pourquoi

| Scope | Pourquoi |
|---|---|
| `streaming`, `user-read-email`, `user-read-private` | Lire la musique sur l'ordinateur avec le Web Playback SDK (Premium) |
| `user-read-playback-state`, `user-modify-playback-state`, `user-read-currently-playing` | Afficher et piloter la lecture, ici ou sur un autre appareil Spotify Connect |
| `user-read-recently-played`, `user-top-read` | Accueil (« Écoutés récemment »), statistiques, Flow |
| `playlist-read-private`, `playlist-read-collaborative` | La bibliothèque de la personne |
| `playlist-modify-public`, `playlist-modify-private` | Ajouter à une playlist, en créer une (Flow, import, playlists intelligentes) |
| `user-library-read`, `user-library-modify` | Titres likés : les lire, liker, retirer |

### Points d'accès utilisés

Lecture : `/me/player` (état, play, pause, next, previous, seek, volume, shuffle, repeat, queue, devices,
recently-played). Bibliothèque : `/me`, `/me/playlists`, `/me/albums`, `/me/tracks` (liste), `/me/library`,
`/me/library/contains`, `/me/top/tracks`, `/me/top/artists`. Contenus : `/playlists/{id}`, `/playlists/{id}/items`,
`/albums/{id}`, `/artists/{id}`, `/artists/{id}/albums`, `/tracks/{id}` (ISRC pour les crédits), `/search`.

### Rythme

- 4 demandes en parallèle au plus, lectures gardées 60 s, questions identiques partagées.
- Une pause demandée par Spotify (429 + `Retry-After`) est respectée partie par partie, et gardée d'un lancement à
  l'autre ; un quota épuisé laisse Spotify tranquille plusieurs minutes.
- État de lecture : toutes les 1 à 8 s selon ce qui joue, rien quand la fenêtre est libérée.

## 3. Conformité aux règles de Spotify

| Règle (Developer Terms, Developer Policy, Design Guidelines) | Dans Vitrine |
|---|---|
| Pas de téléchargement ni d'enregistrement du son de Spotify | Aucun. Le clip TikTok et la vidéo Rétro sont **sans le son** (le son s'ajoute dans TikTok) |
| Pas d'entraînement d'IA sur les contenus Spotify | Aucun usage de ce genre |
| Lecture uniquement par le Web Playback SDK ou Spotify Connect | Oui ; sans Premium, Vitrine pilote les autres appareils |
| Attribution et marque Spotify | « données Spotify » sur les images partagées, liens « Ouvrir dans l'appli Spotify » ; pas de logo Spotify détourné |
| Données personnelles | Rien ne quitte l'ordinateur sauf vers Spotify et les services choisis par la personne (Last.fm, Discord, DeepL/MyMemory). Historique, moments, réglages : sur le PC. Session chiffrée par le trousseau du système |
| Pas de vente ni de publicité | Gratuit, sans publicité, sans compte Vitrine |
| Paroles | Sources tierces (AMLL, LRCLIB, NetEase, lyrics.ovh), pas de paroles de Spotify |

## 4. Texte du formulaire (en anglais, à coller)

**App name** : Vitrine

**App description** :
> Vitrine is a free desktop player for Spotify Premium listeners (Windows, macOS, Linux). It plays through the
> official Web Playback SDK or controls the listener's Spotify Connect devices, and adds what the official app does
> not: word-by-word lyrics (from third-party lyrics databases, never Spotify's), a full-screen "living room" mode,
> personal listening statistics computed on the user's own computer, a discovery feed built from the user's top
> artists and saved tracks, and accessibility features (screen-reader announcements, customizable keyboard
> shortcuts, English and French interface). No audio is ever downloaded, recorded or redistributed; no Spotify
> content is used to train AI models; there are no ads and no user accounts outside Spotify.

**Why do you need extended quota mode?**
> Development mode allows five authorized users per app, and Vitrine is meant for the public. Each user signs in
> with their own Spotify account through Authorization Code with PKCE; the app only reads that user's library and
> controls that user's playback.

**Scopes** : la liste du §2 et sa justification.

**Data** :
> Tokens are stored encrypted with the operating system's keychain. Listening history and preferences stay on the
> user's computer. Nothing is sent to a Vitrine server: there is none.

**Captures à joindre** (dans `docs/screenshots/`) : connexion Spotify, accueil, lecteur plein écran, paroles,
bibliothèque, réglages (montrant la déconnexion), et la version anglaise.

**Vidéo de démonstration** (souvent demandée) : 2 minutes — connexion, lecture, paroles, Flow, déconnexion.

## 5. Avant d'envoyer

- [ ] Une structure (société ou association) porte la demande, avec un site et une politique de confidentialité
      publiés (le §3 sert de base)
- [ ] Nombre d'utilisateurs actifs mensuels connu et au niveau demandé par Spotify à ce moment-là
- [ ] Application Spotify au nom de la structure, adresse de retour `http://127.0.0.1:8898/callback`
- [ ] Captures et vidéo à jour, en anglais
- [ ] Relire les [Developer Terms](https://developer.spotify.com/terms) et la
      [Developer Policy](https://developer.spotify.com/policy) du jour : elles changent souvent
