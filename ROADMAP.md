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
- 🟡 Volume : appliqué sur l'ordinateur ; synchronisation avec Spotify Connect corrigée, à revérifier
- ✅ Choix et transfert de l'appareil de lecture
- 🧪 File d'attente visible (« En cours » / « À suivre ») et « Ajouter à la file » sur chaque titre
- 🧪 Touches multimédia du clavier et contrôles système (Media Session : barre des tâches Windows, Centre de contrôle macOS)
- ⬜ Réorganiser la file (l'API officielle ne le permet pas aujourd'hui)

### Découverte et bibliothèque
- ✅ Accueil façon plateforme de streaming : grand bandeau défilant + rangées horizontales
- ✅ Écoutés récemment, vos playlists, vos albums, vos artistes favoris
- ✅ Recherche (titres, albums, playlists, artistes)
- ✅ Pages playlist et album avec liste des titres et lecture en un clic
- 🧪 Pages artiste (abonnés, genres, titres populaires, albums et singles), artistes cliquables partout
- 🧪 Ajouter / retirer un titre des titres likés (cœur dans la barre et le plein écran)
- ⬜ Créer et modifier des playlists

### Immersion (l'esprit Vitrine)
- ✅ Lecteur plein écran avec pochette géante et fond coloré tiré de la pochette
- ✅ Paroles synchronisées (LRCLIB, base ouverte), défilement automatique, clic pour aller au passage
- ✅ Cartes qui prennent la couleur de leur pochette au survol
- ✅ Fond animé (pochette floutée en mouvement lent) dans le bandeau et le lecteur plein écran
- 🧪 Mini-lecteur : la fenêtre se réduit en vignette 340 × 440 toujours au premier plan, dans le coin de l'écran,
  et revient à sa taille d'origine (mécanique de fenêtre vérifiée dans la vraie appli Electron)
- ⬜ Paroles traduites
- 🧪 Deux thèmes au choix (bouton dans l'en-tête et sur l'écran de connexion) :
  « Movix » (noir, rouge, Inter / Archivo Black) et « Mystic » d'après mysticsaba.com
  (noir chaud, crème, dégradé ambre → rouge, Clash Display / Satoshi / JetBrains Mono, boutons pilule)

### Statistiques
- ✅ Top titres et top artistes sur 4 semaines, 6 mois, depuis toujours
- ⬜ Récapitulatif mensuel partageable (image)

### Intégrations
- ⬜ Discord Rich Presence (« En écoute sur Vitrine »)
- ⬜ Mises à jour automatiques
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
- Reste à faire : écoute réelle sur un PC Windows (le test automatique a validé la lecture, pas le son)

### Phase 2 — Bêta v0.2 *(en cours)*
- **Sprint 1 (fait)** : file d'attente, touches multimédia et contrôles système, pages artiste, titres likés
  — vérifiés sur données fictives, à valider sur compte réel avec le volume
- **Sprint 2 (fait)** : thème « Mystic » (mysticsaba.com) en option, mini-lecteur
- **Prochaine étape** : une session de test sur compte réel pour valider les éléments 🧪 (volume, file
  d'attente, titres likés, pages artiste, contrôles système), puis envoi sur GitHub pour produire
  l'installateur Windows et écouter sur un vrai PC
- Signature DRM « VMP » castlabs (requise pour une lecture fiable en production)
- Signature de code Windows et notarisation Apple (supprime les alertes de sécurité à l'installation)
- Bêta fermée (≤ 25 utilisateurs, limite du mode développement Spotify)

### Phase 3 — Version 1.0 *(+8 semaines)*
- Mises à jour automatiques, Discord, traduction anglaise
- Demande de « quota étendu » auprès de Spotify pour ouvrir l'appli au-delà de 25 utilisateurs
- Tests de charge mémoire/CPU, accessibilité clavier

### Phase 4 — Au-delà
- Récapitulatif mensuel, paroles traduites, thèmes, version Linux

---

## 4. Journal des tests sur compte réel

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

---

## 5. Risques et points d'attention

| Risque | Impact | Parade |
|---|---|---|
| Spotify limite les applis en mode développement (nombre d'utilisateurs autorisés) | Diffusion bloquée au-delà d'une bêta | Demander le quota étendu ; en attendant chaque utilisateur peut saisir son propre Client ID |
| La lecture locale exige Premium + Widevine | Utilisateurs gratuits sans son sur PC | Mode télécommande automatique ; message clair |
| Widevine non signé VMP refusé par Spotify en production | Lecture locale en échec | Compte castlabs EVS + signature VMP dans la chaîne de build (déjà prévue) |
| Évolution de l'API Spotify (points d'accès retirés) | Écrans vides | Appels défensifs, replis (`/items` → `/tracks`), suivi du changelog Spotify |
| Lecture déclenchée sur un autre appareil de l'utilisateur | Musique qui démarre ailleurs (vécu en test) | Règle de choix de l'appareil corrigée et testée ; le test automatique s'arrête si la lecture n'est pas sur Vitrine |
| Licence des polices Clash Display et Satoshi (Fontshare, ITF Free Font License) | Diffusion du thème Mystic | Polices chargées depuis les serveurs Fontshare, pas intégrées ; vérifier la licence avant diffusion, repli automatique sur Archivo Black / Inter |
| Usage commercial | Les conditions développeur Spotify encadrent la monétisation | Validation juridique avant toute diffusion payante |
