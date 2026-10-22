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

Légende : ✅ fait dans la v0.1 · 🟡 en cours · ⬜ prévu

### Compte et sécurité
- ✅ Connexion Spotify officielle (OAuth PKCE, sans secret client) via le navigateur du système
- ✅ Jeton de rafraîchissement chiffré (Trousseau macOS / DPAPI Windows), jamais exposé à l'interface
- ✅ Client ID fourni par l'utilisateur ou intégré à la compilation
- ✅ Déconnexion, et reconnexion automatique si Spotify révoque la session

### Lecture
- ✅ Lecture sur l'ordinateur (Web Playback SDK, appareil « Vitrine (cet ordinateur) ») — Premium requis
- ✅ Mode télécommande : piloter le téléphone, une enceinte ou l'appli officielle (Spotify Connect)
- ✅ Lecture / pause, précédent / suivant, avance, volume, aléatoire, répétition
- ✅ Choix et transfert de l'appareil de lecture
- ⬜ File d'attente visible et réorganisable
- ⬜ Touches multimédia du clavier et contrôles système (barre des tâches Windows, Centre de contrôle macOS)

### Découverte et bibliothèque
- ✅ Accueil façon plateforme de streaming : grand bandeau défilant + rangées horizontales
- ✅ Écoutés récemment, vos playlists, vos albums, vos artistes favoris
- ✅ Recherche (titres, albums, playlists, artistes)
- ✅ Pages playlist et album avec liste des titres et lecture en un clic
- ⬜ Pages artiste
- ⬜ Ajouter / retirer des favoris, créer des playlists

### Immersion (l'esprit Vitrine)
- ✅ Lecteur plein écran avec pochette géante et fond coloré tiré de la pochette
- ✅ Paroles synchronisées (LRCLIB, base ouverte), défilement automatique, clic pour aller au passage
- ✅ Cartes qui prennent la couleur de leur pochette au survol
- ⬜ Fond animé (pochette floutée en mouvement), mode « mini-lecteur » toujours au premier plan
- ⬜ Paroles traduites

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

### Phase 1 — MVP v0.1 *(en cours)*
- Connexion sécurisée, lecture locale + télécommande, accueil, recherche, bibliothèque,
  playlists/albums, lecteur plein écran avec paroles, statistiques
- Construction automatique Windows + macOS par GitHub Actions
- **Critère de sortie** : un utilisateur Premium installe l'appli, se connecte et écoute une playlist
  avec paroles en moins de 3 minutes

### Phase 2 — Bêta v0.2 *(+4 semaines)*
- File d'attente, touches multimédia, contrôles système, pages artiste, favoris
- Signature DRM « VMP » castlabs (requise pour une lecture fiable en production)
- Signature de code Windows et notarisation Apple (supprime les alertes de sécurité à l'installation)
- Bêta fermée (≤ 25 utilisateurs, limite du mode développement Spotify)

### Phase 3 — Version 1.0 *(+8 semaines)*
- Mises à jour automatiques, Discord, mini-lecteur, fond animé, traduction anglaise
- Demande de « quota étendu » auprès de Spotify pour ouvrir l'appli au-delà de 25 utilisateurs
- Tests de charge mémoire/CPU, accessibilité clavier

### Phase 4 — Au-delà
- Récapitulatif mensuel, paroles traduites, thèmes, version Linux

---

## 4. Risques et points d'attention

| Risque | Impact | Parade |
|---|---|---|
| Spotify limite les applis en mode développement (nombre d'utilisateurs autorisés) | Diffusion bloquée au-delà d'une bêta | Demander le quota étendu ; en attendant chaque utilisateur peut saisir son propre Client ID |
| La lecture locale exige Premium + Widevine | Utilisateurs gratuits sans son sur PC | Mode télécommande automatique ; message clair |
| Widevine non signé VMP refusé par Spotify en production | Lecture locale en échec | Compte castlabs EVS + signature VMP dans la chaîne de build (déjà prévue) |
| Évolution de l'API Spotify (points d'accès retirés) | Écrans vides | Appels défensifs, replis (`/items` → `/tracks`), suivi du changelog Spotify |
| Usage commercial | Les conditions développeur Spotify encadrent la monétisation | Validation juridique avant toute diffusion payante |
