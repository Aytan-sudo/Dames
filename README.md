# Dames

Les dames internationales 10×10 et les dames anglaises 8×8, contre l'ordinateur
ou à deux sur le même écran. Jouable au doigt comme à la souris, hors ligne,
sans serveur ni dépendance. Une page statique posée sur GitHub Pages.

## Jouer

Touchez votre pièce, puis la case où elle va. Les cases jouables s'allument —
avec la prise obligatoire, elles sont souvent une ou deux seulement, et voir
lesquelles évite de chercher pourquoi les autres ne répondent pas.

Pour une rafle, touchez chaque case d'arrivée l'une après l'autre. C'est
nécessaire : une dame peut manger les mêmes pions par deux chemins différents,
et les deux ne la laissent pas au même endroit. Quand une seule rafle reste
possible, elle part d'un seul appui.

<kbd>N</kbd> nouvelle partie · <kbd>U</kbd> ou <kbd>Ctrl</kbd>+<kbd>Z</kbd>
annuler · <kbd>T</kbd> thème · <kbd>R</kbd> réglages · <kbd>?</kbd> règles.

## Les deux jeux

|  | Internationales | Anglaises |
| --- | --- | --- |
| Damier | 10×10, 20 pions | 8×8, 12 pions |
| Ouverture | les blancs | **les noirs** |
| Le pion prend | en avant **et en arrière** | en avant seulement |
| La dame | vole sur toute la diagonale | avance d'une case |
| La prise | obligatoire et **majoritaire** | obligatoire mais **libre** |

La prise majoritaire fait tout le jeu international : quand plusieurs rafles
sont possibles, il faut jouer la plus longue, et l'adversaire n'a donc pas le
choix de refuser. C'est ce qui permet de donner un pion pour en reprendre
trois — un sacrifice qui n'existe pas aux anglaises, où l'on peut toujours
préférer la petite prise et laisser le piège se refermer sur le vide.

Le reste est commun aux deux : les pièces mangées ne quittent le damier qu'à la
fin de la rafle, on ne repasse jamais deux fois sur la même, et elles barrent le
passage jusqu'au bout. Un pion qui ne fait que traverser la rangée adverse au
milieu d'une rafle reste pion ; il faut s'y arrêter pour être couronné.

Trois fois la même position, vingt-cinq coups de dames sans prise ni mouvement
de pion, ou une finale à trois contre une dame qui s'éternise : la partie est
nulle.

## L'adversaire

Un alpha-bêta avec approfondissement progressif, arrêté par le temps plutôt que
par la profondeur — une position où tout est forcé se calcule très loin, une
position ouverte beaucoup moins.

Il ne s'arrête jamais d'évaluer sur une prise en suspens. Aux dames une prise
est obligatoire : couper la recherche juste avant, c'est croire qu'on vient de
gagner un pion quand on vient d'en perdre trois.

C'est justement ce filet qui rendait les niveaux indiscernables : presque toute
la tactique des dames tient dans des suites forcées, et une machine qui les
résout toutes ne rate rien de ce qu'un débutant peut lui tendre, même en ne
cherchant qu'à deux demi-coups. Baisser la profondeur ne la rendait pas plus
facile à battre.

Quatre niveaux, donc, réglés sur quatre choses à la fois — jusqu'où la recherche
va, jusqu'où elle résout les prises **au-delà** de sa profondeur, de combien elle
se trompe en jugeant, et à quelle fréquence elle joue autre chose que son
meilleur coup :

| Niveau | Voit | Résout les prises | Se trompe |
| --- | --- | --- | --- |
| Très facile | son propre coup | pas du tout — il ne voit pas la reprise | souvent, et joue à côté un coup sur trois |
| Facile | un coup à l'avance | deux demi-coups de plus | un peu |
| Normal | deux coups à l'avance | jusqu'au bout des rafles | presque jamais |
| Difficile | aussi loin qu'une seconde et demie le permet | jusqu'au bout | jamais |

Chaque niveau bat le précédent dix fois sur dix en tournoi interne, et le test
de l'échelle le vérifie à chaque exécution.

## Réglages

Variante, adversaire et niveau, camp joué, thème clair ou sombre (ou celui du
système), six palettes de damier, cases jouables, numérotation officielle des
cases, vibration. Les statistiques sont tenues par variante et par niveau : une
victoire aux anglaises contre le niveau facile n'a rien à voir avec une victoire
aux internationales en difficile.

### Règles maison

Quatre règles se lèvent une par une : la prise obligatoire, la prise
majoritaire, la prise en arrière du pion, le vol de la dame. Ce sont exactement
les drapeaux que le moteur lit pour distinguer les deux variantes — déroger
n'ajoute aucun cas particulier au code, ça retourne un interrupteur. Chaque
interrupteur part de la valeur officielle du jeu choisi : la prise majoritaire
est cochée aux internationales, décochée aux anglaises, et c'est la règle du
livre dans les deux cas.

Une partie dont une règle diffère n'est pas comptée dans le tableau. Elle se
joue très bien ; elle ne se compare à rien. Les règles sont posées sur la
position au moment où la partie commence, si bien qu'une partie garde les
siennes jusqu'au bout — et qu'une sauvegarde reprise sous d'autres règles est
refusée plutôt que rejouée de travers.

La partie en cours, les préférences et les statistiques vivent dans le
`localStorage`. Fermer l'onglet ne coûte rien.

## Sous le capot

Aucune dépendance, aucun outil de construction : les fichiers du dépôt sont
exactement ceux que le navigateur télécharge.

- `js/damier.js` — la géométrie, en numérotation officielle (1 à 50, ou 1 à 32).
  Voisins et diagonales sont calculés une fois par taille de damier ; le moteur
  ne refait aucune division pendant une recherche.
- `js/variantes.js` — tout ce qui sépare les deux jeux, en quatre drapeaux. Le
  reste du moteur les lit et ne sait rien d'autre.
- `js/regles.js` — coups légaux, rafles, promotions. Ne touche ni au DOM ni au
  hasard, donc se teste entièrement en Node.
- `js/selection.js` — la saisie d'un coup case après case, seule façon de
  désigner une rafle sans ambiguïté.
- `js/partie.js` — ce qui dure d'un coup à l'autre : historique, annulation,
  nulles, sauvegarde. On enregistre les coups, pas les positions : une partie
  relue est rejouée et validée par les règles.
- `js/ia.js` — l'adversaire.
- `js/rendu.js` — chaque pièce est un élément placé par `transform`. Déplacer
  une pièce, c'est changer deux variables CSS ; la transition fait le reste.
- `css/style.css` — les palettes, la géométrie du plateau, les animations. Les
  couleurs y sont écrites plutôt que posées par le JavaScript, pour que la
  palette du joueur soit rétablie avant le premier rendu.

## Développer

```bash
npm test      # 188 vérifications : les deux moteurs, la saisie, l'adversaire, la page
npm run serve # http://localhost:8765
```

Les deux jeux de règles sont validés par les nombres de perft de référence —
9, 81, 658, 4265, 27117 aux internationales, 7, 49, 302, 1469, 7361 aux
anglaises. Ces nombres ne dépendent d'aucun choix d'implémentation : s'ils
tombent juste, la prise obligatoire, la rafle maximale, la prise en arrière et
les promotions sont exactes.

Le reste couvre l'annulation, les nulles, la sauvegarde, la symétrie de
l'évaluation (la machine ne doit pas jouer mieux d'un côté que de l'autre), et
la cohérence de la page : modules déclarés au service worker, identifiants
cherchés par l'interface, accord des palettes entre la feuille de style et le
JavaScript, et concordance du numéro de version entre `package.json`, les
réglages et le cache hors ligne.
