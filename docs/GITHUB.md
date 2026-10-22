# Publier Vitrine PC sur GitHub et obtenir les installateurs

Ce guide part de zéro : un compte GitHub suffit. Une fois le code sur GitHub, chaque envoi déclenche
**GitHub Actions**, qui fabrique tout seul l'installateur Windows (`.exe`) et les images macOS (`.dmg`).

---

## 1. Créer le dépôt (2 minutes)

1. Connectez-vous sur [github.com](https://github.com), puis ouvrez [github.com/new](https://github.com/new).
2. **Repository name** : `vitrine-pc`.
3. **Visibilité** :
   - **Private** (recommandé pour commencer) : personne d'autre ne voit le code.
   - **Public** : les builds GitHub Actions sont gratuits et illimités, mais le code est visible de tous.
4. Ne cochez **rien** d'autre (pas de README, pas de .gitignore, pas de licence) : le dépôt doit être vide.
5. Cliquez sur **Create repository**.

## 2. Envoyer le code

**Option A — par Claude (le plus simple).** Donnez-lui le nom du dépôt, par exemple `votre-compte/vitrine-pc`.
Il y envoie le code depuis la session. Si GitHub refuse l'accès, claude.ai vous indique où autoriser le dépôt
(application GitHub de Claude, ou connecteur GitHub dans les réglages de claude.ai).

**Option B — vous-même**, depuis un dossier qui contient le projet :

```bash
git remote add origin https://github.com/reeeeeess/vitrine.git
git push -u origin main
```

## 3. Ajouter les secrets (facultatif mais recommandé)

Dans le dépôt : **Settings → Secrets and variables → Actions → New repository secret**.

| Nom | Valeur | À quoi ça sert |
|---|---|---|
| `VITRINE_CLIENT_ID` | le Client ID de votre appli Spotify | Intégré à l'appli : plus besoin de le saisir au premier lancement |
| `EVS_ACCOUNT_NAME` | votre identifiant castlabs EVS | Signature DRM « VMP » : **nécessaire pour que Spotify accepte la lecture sur l'ordinateur sous Windows et macOS** |
| `EVS_PASSWD` | votre mot de passe castlabs EVS | (même usage) |

Créer le compte castlabs EVS (gratuit), une seule fois, sur votre ordinateur :

```bash
python3 -m pip install --upgrade castlabs-evs
python3 -m castlabs_evs.account signup
```

Sans ces deux secrets EVS, l'appli s'installe et fonctionne, mais la lecture sur l'ordinateur peut être
refusée par Spotify ; le mode télécommande (piloter votre téléphone ou un autre appareil) marche dans tous les cas.

## 4. Lancer la fabrication

- Automatique : chaque envoi sur la branche `main` lance le workflow **Build**.
- Manuel : onglet **Actions** → **Build** → bouton **Run workflow**.

Le workflow vérifie d'abord le code (tests + TypeScript), puis fabrique en parallèle :

| Machine | Résultat | Durée indicative |
|---|---|---|
| Windows | `Vitrine-Setup-x.y.z.exe` | ~10 min |
| macOS | `Vitrine-x.y.z-arm64.dmg` (Apple Silicon) et `-x64.dmg` (Intel) | ~10 min |

## 5. Télécharger et installer

1. Onglet **Actions** → cliquez sur la dernière exécution **Build** (coche verte).
2. En bas, section **Artifacts** : `vitrine-win` ou `vitrine-mac` (un fichier .zip à décompresser).
3. **Windows** : lancez `Vitrine-Setup-x.y.z.exe`. L'installateur n'étant pas signé, SmartScreen affiche
   « Windows a protégé votre ordinateur » : **Informations complémentaires → Exécuter quand même**.
4. **macOS** : ouvrez le `.dmg`, glissez Vitrine dans Applications. Au premier lancement :
   **Réglages Système → Confidentialité et sécurité → Ouvrir quand même**.

Les artefacts sont conservés 90 jours par GitHub.

## 6. Publier une version (quand vous êtes prêt)

1. Onglet **Releases** → **Draft a new release** → tag `v0.1.0`.
2. Joignez les fichiers téléchargés à l'étape 5, puis **Publish release**.

Les testeurs téléchargent alors directement depuis la page Releases.

## 7. Ouvrir l'appli à d'autres comptes Spotify

Tant que l'appli Spotify est en « mode développement », seuls les comptes listés peuvent se connecter :
[developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → votre appli → **User Management**
→ ajoutez le nom et l'e-mail Spotify de chaque testeur.

## Coûts GitHub Actions

| Dépôt | Coût |
|---|---|
| Public | Gratuit, sans limite |
| Privé | 2 000 minutes gratuites par mois ; une minute macOS compte pour 10, une minute Windows pour 2. Une fabrication complète consomme environ 130 minutes du quota, soit une quinzaine de builds par mois |

Pour économiser le quota d'un dépôt privé, lancez les builds à la main (étape 4) plutôt qu'à chaque envoi.

## En cas de problème

| Symptôme | Cause probable | Solution |
|---|---|---|
| Le job `test` échoue | Un test ou TypeScript signale une erreur | Ouvrez le job pour lire l'erreur, ou demandez à Claude de corriger |
| `npm ci` échoue sur `electron-releases` | Accès au dépôt castlabs | Relancez le job (souvent passager) |
| « Premium requis » ou erreur DRM au lancement | Signature VMP absente | Ajoutez les secrets EVS (étape 3) et refabriquez |
| `LimitExceededException … Exceeded daily email limit` à l'inscription castlabs | Le service d'inscription de castlabs (Amazon Cognito) a envoyé son quota d'e-mails du jour, pour tous ses utilisateurs | Réessayez plus tard (le lendemain). Si l'outil répond alors que le compte existe déjà, demandez le code : `py -m castlabs_evs.account resend`, puis saisissez le code reçu |
| La connexion Spotify échoue | URI de redirection absente | Ajoutez `http://127.0.0.1:8898/callback` dans le tableau de bord Spotify |
