# Livrer une version de Vitrine — la liste

Ce qu'il faut pour qu'une version arrive propre chez les gens : construite par l'intégration continue, signée,
publiée sur GitHub, et mise à jour toute seule chez ceux qui l'ont déjà.

## 1. Les comptes et secrets (une fois)

| Pour | Quoi | Où le mettre (secrets du dépôt GitHub) |
|---|---|---|
| Lecture protégée (Widevine) | Compte **castlabs EVS** (gratuit) : signe Vitrine pour que Spotify fasse confiance à son lecteur | `EVS_ACCOUNT_NAME`, `EVS_PASSWD` |
| Windows sans alerte SmartScreen | Certificat de signature de code (OV ou EV), ou **Azure Trusted Signing** | `CSC_LINK` + `CSC_KEY_PASSWORD`, ou les variables Azure d'electron-builder |
| macOS sans « développeur non identifié » | Compte Apple Developer (99 $/an) : certificat **Developer ID Application** et **notarisation** | `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` |
| Client ID intégré (facultatif) | L'application Spotify de Vitrine, si l'on ne veut pas que chacun crée la sienne | `VITRINE_CLIENT_ID` |

Ordre des signatures, imposé par castlabs : **EVS d'abord** (le crochet `afterPack`, `scripts/evs-sign.cjs`), **puis**
la signature de code Windows ou Apple. `python -m castlabs_evs.vmp verify-pkg <dossier>` vérifie le résultat.

Sans ces secrets, tout se construit quand même : les installateurs ne sont simplement pas signés (Windows prévient
au premier lancement, macOS demande un clic droit › Ouvrir).

## 2. Préparer la version

- [ ] `npm run typecheck`, `npm test`, `npm run build:renderer && npm run test:e2e` : tout vert
- [ ] `node scripts/i18n-extract.mjs --missing` : 0 texte sans traduction anglaise
- [ ] `version` de `package.json` montée (`1.0.0`)
- [ ] README (nouveautés), ROADMAP, `docs/PLAN-…` cochés
- [ ] Captures à jour dans `docs/screenshots/`
- [ ] Essai à la main sur un vrai compte Premium : connexion, lecture sur l'ordinateur, paroles, like, playlist,
      déconnexion ; puis avec une **application Spotify créée après février 2026** (les règles ne sont pas les mêmes)

## 3. Publier

```bash
git push origin main
git tag v1.0.0
git push origin v1.0.0
```

L'intégration continue (`.github/workflows/build.yml`) :

1. vérifie que le tag correspond à `package.json`, lance les tests et l'essai de bout en bout ;
2. construit l'installateur Windows, les images macOS (Apple Silicon et Intel) et l'**AppImage Linux** ;
3. publie la version GitHub avec `latest.yml` (Windows) et `latest-linux.yml` (AppImage), que les mises à jour
   automatiques lisent.

## 4. Après la publication

- [ ] Télécharger chaque fichier depuis la page de la version et le lancer (Windows, macOS, Linux)
- [ ] Une version précédente installée se met à jour seule (Réglages › Mises à jour)
- [ ] Notes de version : les nouveautés en clair, en français et en anglais
- [ ] Empreintes SHA-256 des fichiers dans les notes (`sha256sum release/*.exe release/*.dmg release/*.AppImage`)

## 5. Revenir en arrière

Une version cassée : la marquer « pre-release » sur GitHub (les mises à jour automatiques l'ignorent), puis
publier une version corrigée avec un numéro plus haut. Ne jamais republier sous le même numéro : les PC qui l'ont
déjà ne la reprendraient pas.

## Linux

- **AppImage** : un seul fichier, `chmod +x Vitrine-1.0.0-x86_64.AppImage` puis double-clic. Se met à jour seul.
- Lancement au démarrage : Vitrine écrit `~/.config/autostart/vitrine.desktop` quand l'option est cochée.
- Raccourcis globaux : fonctionnent sous X11 ; sous Wayland, cela dépend du bureau.
- Égaliseur : Equalizer APO est pour Windows ; sous Linux, EasyEffects (PipeWire).
- Si l'AppImage ne s'ouvre pas : installer `libfuse2` (Ubuntu 22.04 et plus), ou lancer avec
  `--appimage-extract-and-run`.
