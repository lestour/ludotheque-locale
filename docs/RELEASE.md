# Préparer une publication

Cette liste s’applique au dépôt public et à l’archive partagée avec des amis.

## Avant le commit

1. Vérifier les fichiers modifiés : `git status --short` puis `git diff --check`.
2. Lancer `python3 tools/check_javascript.py`.
3. Lancer `python3 -m unittest discover -s tests -p 'test_*.py'`.
4. Lancer `python3 tools/run_browser_smoke.py` lorsque Chrome ou Chromium est disponible ; sous macOS, lancer aussi `python3 tools/run_safari_smoke.py` après avoir autorisé l’automatisation distante dans Safari.
5. Tester manuellement sur téléphone au moins une grille zoomable, un jeu de cartes, un jeu de plateau et un jeu musical.

## Ressources et licences

- Ne jamais ajouter une image importée, une partition `.mscz`/`.mscx`/MusicXML ou un enregistrement audio sans droit de redistribution.
- Conserver `LICENSE`, `LEGAL.md`, `THIRD_PARTY_NOTICES.md` et `games/rhythm/assets/MS-Basic-LICENSE.md` dans chaque archive.
- Garder les noms et visuels des jeux comme des adaptations indépendantes ; ne pas ajouter logo, règle ou illustration officielle non autorisée.
- La clé HTTPS créée dans `.runtime/tls` est privée : elle ne doit pas être commitée ou distribuée.

## Archive multiplateforme

1. Construire l’archive : `python3 tools/package_release.py`.
2. Vérifier son contenu : `python3 tools/package_release.py --verify dist/Ludotheque-locale.zip`.
3. Décompresser l’archive dans un nouveau dossier et vérifier les trois lanceurs : macOS, Windows et Linux.
4. Dans Rhythm Lab, cliquer sur **Tester MS Basic** : le SoundFont, les modules AudioWorklet et les dépendances locales doivent être trouvés.
5. Pour le LAN mobile avec microphone, créer puis installer un certificat local avec `python3 tools/create_lan_certificate.py`.

## Après publication

- Vérifier le workflow GitHub `Validation locale`.
- Tester l’URL du Hub depuis un dossier décompressé et sans Git.
- En cas de rapport utilisateur, récupérer le diagnostic Rhythm Lab et les informations navigateur avant de modifier le parseur ou le moteur audio.
