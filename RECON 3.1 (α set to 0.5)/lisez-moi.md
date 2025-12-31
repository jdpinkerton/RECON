# Outil RECON (Reading Contrasting)

## Vue d'ensemble

RECON est un outil entièrement orienté client conçu pour la comparaison méticuleuse de textes et l'analyse des variations informationnelles entre les objets d'information textuels. Initialement développé pour l'étude des réimpressions du début de l'ère moderne, ses capacités polyvalentes le rendent adapté à tous les textes où des variations orthographiques, typographiques et de contenu plus larges sont intéressantes. Il exploite la puissance de « diff-match-patch » pour capturer les différences au niveau des caractères et des mots, fournissant ainsi un cadre pour mesurer la dérive et la transformation informationnelles.

RECON fournit une suite complète de fonctionnalités pour l'analyse textuelle et le suivi de l'information :

* **Comparaison de granularité double :** Analysez les textes au niveau du **caractère** (pour une détection précise des erreurs, comme les erreurs OCR) ou au **niveau du mot** (pour des modifications de contenu plus larges).
* **Analyse riche des variantes :** Identifie et comptabilise automatiquement divers phénomènes textuels, notamment :
    * Ligatures (par exemple, « æ » vs. « ae »)
    * Logogrammes (par exemple, « & » vs. « et »)
    * Formes de lettres archaïques (par exemple, « s » vs. « s »)
    * Variations de caractères U/V et I/J
    * Normalisation de « uu"/"vv » en « w » (et vice-versa)
* **Visualisation interactive :** Présente les résultats de la comparaison avec un balisage HTML en ligne clair, mettant en évidence les suppressions, les insertions et les substitutions.
* **Plusieurs formats d'exportation :**
    * **Standoff JSON :** Un manifeste détaillé, lisible par machine, de toutes les variantes avec leurs types et décalages.
    * **XML :** Une représentation XML de la comparaison inspirée de la TEI, adaptée aux flux de travail des humanités numériques.
* **Statistiques complètes :** Calcule un large éventail de mesures :
    * Taux d'erreur de caractère (CER) et taux d'erreur de mot (WER)
    * Distance de Levenshtein et distance d'édition normalisée
    * Similitude de Jaccard et similitude cosinus
    * Rapport type-jeton (TTR) et densité lexicale
    * Ponctuation, majuscules et nombre de caractères
    * Distributions de longueur et de fréquence des mots
    * Balisage de partie du discours (POS) et distributions NER (Named Entity Recognition) (nécessite un accès Internet pour la bibliothèque Compromise.js).
* **Paramètres configurables et persistants :**
    * Affinez le comportement de comparaison (par exemple, inclure/ignorer les espaces, la ponctuation, les majuscules, les normalisations spécifiques).
    * Ajustez les paramètres sous-jacents 'diff-match-patch'.
    * Enregistrez les paramètres préférés dans le navigateur 'localStorage' pour les sessions futures, avec une option pour réinitialiser les paramètres par défaut.
La base de code présente une conception modulaire utilisant des modules ES6, améliorant la clarté, la maintenabilité et l'extensibilité.

RECON se veut un outil de recherche pour faciliter l'étude textuelle approfondie et l'analyse quantitative des changements textuels.

## Configuration et utilisation

### Pour les utilisateurs finaux

RECON est conçu pour être facile à utiliser et ne nécessite aucune installation complexe.

1. **Télécharger/Obtenir des fichiers :** Assurez-vous d'avoir tous les fichiers du projet, en particulier 'recon.html' et le répertoire 'dist'.
2. **Ouvrir dans le navigateur :** Ouvrez simplement le fichier 'recon.html' dans un navigateur Web moderne (par exemple, Chrome, Firefox, Safari, Edge).
3. Activez JavaScript :** JavaScript doit être activé dans votre navigateur (il est par défaut dans la plupart des navigateurs).
4. **Connexion Internet (pour les fonctionnalités NLP complètes:** Pour le balisage Part-of-Speech (POS) et les statistiques NER (Named Entity Recognition), une connexion Internet active est nécessaire lors du premier chargement pour récupérer la bibliothèque de traitement du langage naturel 'Compromise.js' à partir de son réseau de diffusion de contenu (CDN). S'ils sont hors ligne, ces mesures spécifiques ne seront pas disponibles, mais les fonctionnalités de comparaison de base devraient toujours fonctionner.

### Pour les développeurs et les contributeurs

Si vous souhaitez modifier la base de code RECON ou la construire à partir de ses fichiers sources :

1. **Prérequis :**
    * Node.js, un environnement d'exécution Javascript open-source et multiplateforme installé sur votre système (https://nodejs.org/en/download/). Node.js inclut le gestionnaire de packages de nœuds (npm).
2. **Cloner le référentiel :**
    '''bash
    git clone votre-url-de-dépôt ici
    reconnaissance de CD
    ```
    (Remplacez 'your-repository-url-here' par l'URL réelle du dépôt Git le cas échéant.)
3. Installer les dépendances :**
    '''bash
    installation npm
    ```
    Cela téléchargera les dépendances de développement, principalement 'esbuild' pour le regroupement.
4. **Construire le projet :**
    '''bash
    Génération d'exécution npm
    ```
    Cette commande regroupe 'script.js' et ses modules associés du répertoire 'modules/' dans un seul fichier : 'dist/recon.bundle.js'. Le fichier recon.html est configuré pour charger ce bundle.
5. **Mode de surveillance de développement :**
    '''bash
    npm run dev
    ```
    Cette commande surveille les modifications apportées à 'script.js' et à ses modules, reconstruisant automatiquement le paquet chaque fois qu'un fichier est enregistré. Ceci est utile pour le rechargement en direct dans le navigateur pendant le développement.

--- 

## Fonctionnalités détaillées

RECON offre une gamme de fonctionnalités pour permettre la comparaison de texte nuancée et l'analyse de la façon dont les informations textuelles se transforment entre les versions.

### 1. Options de comparaison

Le cœur de la flexibilité de RECON réside dans ses options de comparaison configurables, permettant aux utilisateurs d'adapter l'analyse à leurs documents textuels spécifiques, à leurs questions de recherche et à la façon dont ils définissent une variation informative significative.

***Granularité:**
    * **Niveau du caractère :** Compare les textes caractère par caractère. Ce mode est très précis et idéal pour identifier les variations mineures, telles que les erreurs typographiques, les inexactitudes OCR ou les différences d'orthographe subtiles.
    * **Niveau du mot :** Compare les textes mot par mot (jeton par jeton). Ce mode est généralement meilleur pour comprendre les modifications, les ajouts ou les suppressions de contenu plus importants, tout en étant moins sensible aux variations mineures à l'intérieur d'un mot si celles-ci ne sont pas au centre de l'attention.

* **Bascules d'inclusion :** Ces cases à cocher contrôlent les éléments considérés comme significatifs pour la comparaison :
    * **Inclure les espaces :** Lorsque cette option est cochée, les différences d'espacement (espaces, tabulations, sauts de ligne) seront mises en évidence en tant que modifications. Lorsqu'elle n'est pas cochée, les variations uniquement dues aux espaces sont ignorées (par exemple, « hello world » vs. « hello world » serait traité comme identique si cette case n'est pas cochée et qu'aucune autre différence n'existe).
    * **Inclure la ponctuation :** Lorsque cette option est cochée, les différences dans les signes de ponctuation (par exemple, les virgules, les points, les traits d'union) sont traitées comme des changements significatifs. Lorsque cette option n'est pas cochée, ces différences sont ignorées.
    Lorsque cette option est cochée, les différences de casse (par exemple, « Texte » et « texte ») sont mises en évidence en tant que modifications. Lorsqu'elle n'est pas cochée, les majuscules sont ignorées et « Texte » et « texte » sont traités comme le même mot.

* **Normalisation et gestion des variants :** Ces options contrôlent la façon dont des variantes textuelles spécifiques, souvent historiquement significatives, sont traitées lors du prétraitement et de l'analyse :
    Lorsqu'il est coché, les logogrammes courants (par exemple, « & ») et leurs expansions (par exemple, « et ») sont normalisés à une forme commune *avant* comparaison, ce qui signifie que les différences entre eux ne seront pas signalées comme des modifications. Les mappages spécifiques sont définis dans 'constants.js'.
    Lorsqu'elle est cochée, les ligatures typographiques (par exemple, « æ », « fi ») et leurs lettres constitutives (par exemple, « ae », « f i ») sont normalisées, de sorte que les variations entre elles ne sont pas traitées comme des différences. Les mappages sont en 'constants.js'.
    Lorsqu'elles sont cochées, les formes de lettres archaïques courantes (par exemple, « s » long vs. « s », « ꝛ » vs. « r ») sont normalisées, empêchant ces variations historiques connues d'être signalées comme des changements. Les mappages sont en 'constants.js.
    * **Ignorer les variations u/v :** Lorsqu'ils sont cochés, 'u' et 'v' (et leurs équivalents en majuscules) sont traités comme équivalents (en changeant tous les 'v en 'u's). Ceci est utile pour les textes où ces lettres ont été utilisées de manière interchangeable. 
    * **Ignorer les variations i/j :** Lorsqu'ils sont cochés, 'i' et 'j' (et leurs équivalents en majuscules) sont traités comme équivalents (en remplaçant tous les 'j' par 'i's). Semblable à u/v, il gère les textes avec une utilisation i/j interchangeable.
    * **Normaliser uu/vv en w :** Lorsque cette option est cochée, les instances de « uu » ou « vv » (et leurs combinaisons majuscules/minuscules) sont normalisées en « w » (et « W », respectivement), et l'inverse est également suivi dans les métriques. Cela aide à comparer les textes où se trouve cette convention courante de scribe ou d'impression au début de l'ère moderne.

Les choix effectués pour ces options affectent directement la sortie diff (les transformations enregistrées), les statistiques calculées (les mesures de variation) et le contenu des fichiers exportés. Les paramètres actuels sont affichés dans le panneau « Paramètres de comparaison » et également intégrés dans les métadonnées des fichiers exportés.

### 2. Visualisation interactive

RECON affiche les différences, c'est-à-dire les variations informatives identifiées, entre les deux textes d'entrée directement dans le navigateur, à l'aide d'un codage couleur et d'un style distinct pour mettre en évidence les modifications :

* **Mise en évidence en ligne :**
    * **Suppressions :** Les segments de texte présents dans le texte 1 mais pas dans le texte 2 sont généralement affichés avec une couleur d'arrière-plan spécifique (par exemple, rouge ou rose) et/ou barrée.
    * **Insertions :** Les segments de texte présents dans le texte 2 mais pas dans le texte 1 sont affichés avec une couleur d'arrière-plan différente (par exemple, vert ou bleu clair).
    Lorsqu'un segment du texte 1 est remplacé par un segment différent du texte 2, la partie supprimée (du texte 1) et la partie insérée (du texte 2) sont affichées côte à côte, regroupées visuellement.
    * **Texte inchangé :** Les segments identiques dans les deux textes (après application des options de comparaison sélectionnées) sont affichés normalement, sans mise en surbrillance spéciale.
Des caractères spéciaux (par exemple, « ␠ » pour l'espace, « ↵ » pour le saut de ligne) sont utilisés dans les segments en surbrillance (supprimés/insérés/substitués) pour rendre les modifications d'espaces explicites et visibles. Étant un outil axé sur l'impression moderne, aucune considération pour les paragraphes (¶) n'est prise en compte - les nouvelles lignes étant plus discrètes.
Les utilisateurs peuvent choisir entre les thèmes clairs, sombres et par défaut du système, ainsi que basculer un mode de contraste élevé pour une accessibilité et une lisibilité améliorées. Ces paramètres sont accessibles via le menu des paramètres de visualisation (haute luminosité/icône en forme de rouage).
La zone d'affichage visuelle différente (l'"appareil ») peut être agrandie ou réduite par l'utilisateur pour afficher plus ou moins de textes comparés à la fois, ce qui est utile pour les textes très longs.

### 3. Formats d'exportation

RECON permet aux utilisateurs d'exporter les résultats de la comparaison et les métadonnées associées dans deux formats standard. Ces exportations servent d'enregistrements durables des variations et des transformations informationnelles détectées, facilitant ainsi l'analyse, l'archivage ou l'intégration dans d'autres flux de travail :

Standoff JSON ('recon_standoff.json'):**
    * **Structure :** Ce format fournit un objet JSON lisible par machine. Il comprend une section « méta » contenant tous les paramètres de comparaison (granularité, options d'inclusion/d'exclusion définissant l'objectif d'analyse, paramètres DMP), un horodatage et un bloc « statistiques » complet (reflétant ce qui est affiché dans l'interface utilisateur, y compris les décomptes détaillés de l'analyse des variants). Le cœur du fichier est un tableau de « variantes », où chaque objet représente une différence détectée (une unité élémentaire de transformation de l'information, telle qu'une insertion ou une suppression) avec ses décalages de caractères de début/fin par rapport au texte 1, les différents segments de texte du texte 1 et du texte 2, et un identificateur de type.
    Idéal pour l'analyse informatique, l'exploration de données ou comme entrée pour d'autres outils capables de traiter des données différentielles structurées. La nature de l'entretoise (les décalages faisant référence aux textes originaux) le rend robuste pour le suivi des modifications entre les versions textuelles.

* **(Quasi-TEI) XML ('<granularité>comparison_criticalapparatus_<options>.xml'):**
    Ce format fournit un fichier XML qui utilise des éléments communs [Text Encoding Initiative (TEI](https://tei-c.org/) pour représenter l'appareil critique, ce qui le rend adapté à de nombreux projets d'humanités numériques et aux éditions savantes. La sortie comporte un élément racine personnalisé ('<reconOutputTEI>') contenant :
        * Une section '<reconMetadata>' avec des 'comparisonOptions' détaillés, des 'dmpParameters' et un bloc 'statistics' (y compris 'variantAnalysis'), documentant les paramètres d'analyse.
        * Un corps de <texte> où la comparaison est représentée à l'aide d'éléments TEI pour les variations textuelles :
            * '<del>' pour les suppressions.
            * '<add>' pour les insertions.
            * '<app><lem>... </lem><rdg>... </rdg></app>' pour les substitutions (lemme et lecture).
            * '<lb/>' pour les sauts de ligne.
        * Remarque : Bien qu'il utilise des éléments TEI pour l'appareil, il n'inclut pas d'espace de noms TEI formel ou de « <teiHeader > standard ».
    Utile pour l'édition scientifique, la création d'appareils critiques numériques qui documentent la fluidité textuelle ou l'intégration avec des environnements de recherche basés sur la TEI (potentiellement avec des ajustements mineurs pour une stricte conformité à la TEI). Le nom du fichier reflète dynamiquement la granularité et les options clés utilisées pour la comparaison, ce qui facilite la gestion des différentes perspectives analytiques.

### 4. Métriques statistiques

RECON calcule et affiche un large éventail de mesures statistiques pour quantifier les différences, les similitudes et la dérive informative globale entre les deux textes. Ces mesures fournissent des informations quantitatives sur la nature et l'étendue des variations textuelles. La disponibilité de certaines métriques dépend de la granularité sélectionnée (caractère ou mot) et du chargement de la bibliothèque Compromise.js (pour les statistiques dépendantes de NLP).

**Métriques courantes (granularités de caractères et de mots):**

* **Comptage de l'analyse des variantes :** (Affiché sous les sections Ligature, Logogramme, Lettre archaïque, U/V, I/J, UU/VV↔W Analyse)
    * Nombre de variantes spécifiques (par exemple, « æ », « & », « s ») dans chaque texte d'entrée, reflétant la matière première pour la transformation potentielle de l'information.
    * Nombre de transformations entre ces formes (par exemple, « æ → ae », « & → et) détectées dans la comparaison, quantifiant des types spécifiques de changement éditorial ou de transmission. L'ensemble des logogrammes comprend des logogrammes spécifiques du début de l'ère moderne (par exemple, « ꝑ → per ») dans le but de fournir des informations plus granulaires sur de telles transformations dans les textes du début de l'ère moderne.

**Métriques spécifiques au niveau du personnage :**

Nombre total de caractères :** Nombre total de caractères dans chaque texte (après prétraitement), avec une répartition détaillée par type de caractère (lettres, chiffres, espaces, ponctuation, symboles).
* **Distance de Levenshtein :** Le nombre minimum de modifications d'un seul caractère (insertions, suppressions ou substitutions) nécessaires pour remplacer un texte traité par un autre.
* **Taux d'erreur de caractères (CER):** (Distance de Levenshtein / Nombre total de caractères dans le texte 1) * 100. Il s'agit d'une mesure courante pour quantifier la divergence au niveau des caractères, souvent utilisée pour l'évaluation de la précision de l'OCR.
* **Distance d'édition normalisée (NED):** (distance de Levenshtein / longueur du texte traité plus long) * 100. Mesure symétrique de la différence au niveau des caractères, normalisée en fonction de la longueur du texte.
* **Modifications des majuscules :** Suit les mots en majuscules supprimés du texte 1, ajoutés au texte 2 ou inchangés entre les textes originaux, avec les détails de mots spécifiques.
* **Analyse de la ponctuation :** Nombre total et répartition de chaque signe de ponctuation dans les textes originaux.

**Métriques spécifiques au niveau des mots :**

Nombre total de mots (jetons) dans chaque texte après prétraitement et tokenisation (à l'exclusion des jetons d'espace si l'option « Inclure les espaces » est désactivée).
* **Taux d'erreur de mot (WER):** ((Substitutions + Insertions + Suppressions) / Nombre total de mots dans le texte 1) * 100. Affiche le nombre brut de S/I/D, offrant une mesure de base de la divergence informationnelle au niveau des mots.
* **Similitude Jaccard :** Mesure la similitude entre les ensembles de mots (vocabulaires) des deux textes traités (Intersection / Union). Ignore la fréquence des mots, se concentrant sur les éléments lexicaux partagés comme indicateur de chevauchement informationnel.
* **Similitude cosinus :** Mesure la similarité basée sur la fréquence des mots (TF) dans les textes traités, reflétant la similitude dans la proéminence des termes informationnels.
* **Type-Token Ratio (TTR):** (Nombre de mots uniques / Nombre total de mots) pour chaque texte traité. Mesure la diversité lexicale.
* **Chevauchement du vocabulaire :** Pourcentage de mots uniques communs aux deux textes traités, par rapport au nombre moyen de mots uniques.
* **Densité lexicale :** (Mots de contenu / Nombre total de mots) pour chaque texte original. Proportion de noms, verbes, adjectifs, adverbes. (Nécessite NLP - Compromise.js).
* **Longueur moyenne des mots :** Longueur moyenne des caractères dans chaque texte traité.
* **Analyse des mots vides :** Pourcentage de mots dans chaque texte traité qui sont des mots vides courants.
Distribution de la longueur des mots :** Distribution de fréquence des mots de différentes longueurs pour chaque texte traité.
* **Distribution d'une partie du discours (POS) :** Distribution de balises POS (nom, verbe, etc.) dans chaque texte original. (Nécessite NLP - Compromise.js).
* **Entités nommées (NER):** Comptes et listes de personnes, de lieux et d'organisations identifiés dans chaque texte original. (Nécessite NLP - Compromise.js).
* ** Les 10 mots les plus fréquents :** Les dix mots les plus fréquents et leur nombre pour chaque texte traité.

Chaque mesure de l'interface utilisateur comprend une info-bulle expliquant son calcul et sa signification en termes de différence textuelle ou informative.

### 5. Métriques OCR tenant compte des biais

RECON comprend des mesures avancées sensibles aux biais spécialement conçues pour traiter les biais OCR. Lorsque l'on compare des textes qui ont été traités par OCR, les mesures de similarité standard peuvent être très trompeuses en raison d'erreurs systématiques qui créent des similitudes artificielles entre les textes.

#### Le problème du biais OCR

Les systèmes OCR comme, comme le modèle OCR spécialisé Transkribus que j'ai formé pour la comparaison des réimpressions Hero et Leander (MHaLm), présentent des modèles d'erreur prévisibles. Par exemple, ils peuvent souvent mal interpréter la lettre « I » comme un « l » minuscule parce que ces caractères se ressemblent dans les polices de caractères historiques. Lorsque l'on compare deux éditions différentes du même texte :

1. Les deux exécutions OCR peuvent faire les mêmes erreurs (les deux se lisent « ISLAND » comme « lSLAND »)
2. Les outils de similarité standard considèrent qu'il s'agit d'une « correspondance » et signalent une similitude élevée
3. Cette similitude est artificielle, en raison d'erreurs OCR partagées, et non d'une similitude textuelle réelle
4. Les chercheurs peuvent tirer de fausses conclusions sur les relations textuelles

**Ce qui est nécessaire :** Méthodes statistiques pour distinguer entre :
- **Véritables similitudes textuelles** (les textes originaux étaient en fait similaires)
- **Fausses similitudes** causées par des modèles d'erreur OCR cohérents

#### Fondation Matrice de Confusion

Les deux approches fondées sur les biais adoptées dans RECON reposent sur une **matrice de confusion** 'C' où :
- 'C[i][j] = P(L'OCR affiche le caractère j | le caractère vrai était i)'
- Construit en exécutant le système OCR sur des données de test de vérité terrain (GT)
- Capture les modèles d'erreur spécifiques de l'OCR

Comment générer une matrice de confusion :**
1. Utilisez RECON pour comparer le texte de la vérité terrain à sa sortie OCR
2. Réglez la granularité au niveau « Caractère »
3. Activez les options « Inclure les espaces », « Inclure la ponctuation » et « Inclure les majuscules »
4. Cliquez sur « Générer une matrice de confusion » dans le panneau des résultats
5. Téléchargez le fichier matriciel résultant pour l'utiliser dans de futures comparaisons

#### Méthode 1 : similarité normalisée au départ (S_corr)

Calculez le score de similarité que nous attendrions d'un biais OCR pur, puis ajustez le score observé.

**Formule mathématique :**

**Probabilité d'accord par glyphe :**
```
S_g = Σ_k C[g][k]²
```
Il s'agit de la probabilité que deux exécutions OCR indépendantes s'accordent sur le caractère 'g', comprenant les deux :
- Lectures correctes : 'C[g][g]²' 
- Erreurs partagées : 'C[g][k]²' pour 'k≠g'

**Similitude de base :**
```
S_baseline = Σ_g f_g × S_g
```
Où 'f_g' est la fréquence du caractère 'g' dans les textes comparés. Cela représente la similitude à laquelle nous nous attendrions même si les textes originaux étaient complètement différents.

**Similitude corrigée :**
```
S_corr = (S_obs - S_baseline) / (1 - S_baseline)
```
Où « S_obs » est le score de similitude brut de RECON.

**Interprétation:**
- **S_corr = 0 :** Pas mieux qu'un biais OCR aléatoire (les textes semblent sans rapport)
- **S_corr = 1 :** Similitude parfaite au-delà du biais OCR (les textes sont probablement identiques)
- **S_corr < 0 :** La similitude observée est pire que prévu par le hasard (indique des différences réelles)

**Résumé de la méthode 1 :** Cette métrique répond : « Après avoir pris en compte le fait que l'OCR fait des erreurs prévisibles, dans quelle mesure ces textes sont-ils vraiment similaires ? » C'est comme ajuster le score d'un test en soustrayant les points que vous obtiendriez simplement en devinant.

#### Méthode 2 : Similitude pondérée bayésienne (S_adj)

Pour chaque paire de caractères de la comparaison, calculez la probabilité que les vrais caractères sous-jacents soient identiques, puis faites la moyenne de ces probabilités.

**Formule mathématique :**

**Pour chaque paire de caractères observée (x,y), calculez le poids de probabilité :**
```
w(x,y) = P(SameTrue | obs x,y)
```

Ceci est calculé à l'aide d'un raisonnement bayésien avec des rapports de vraisemblance :
```
LR(x,y) = P(obs x,y | SameTrue) / P(obs x,y | DiffTrue)
w(x,y) = LR(x,y) / (1 + LR(x,y))
```

Où:
```
P(obs x,y | SameTrue) = Σ_i π(i) × C[i→x] × C[i→y]
P(obs x,y | DiffTrue) = [Σ_i π(i) × C[i→x]] × [Σ_j π(j) × C[j→y]] - Σ_k π(k)² × C[k→x] × C[k→y]
```

Et 'π(i)' est la fréquence a priori du caractère vrai 'i'.

**Similitude pondérée :**
```
S_adj = (1/N) × Σ_k w(x_k, y_k)
```

Au lieu de compter les correspondances de caractères comme simplement 0 ou 1, chaque paire alignée '(x_k, y_k)' apporte sa probabilité 'w(x_k, y_k)' de représenter le même caractère vrai.

**Interprétation:**
- **S_adj = 0 :** Il est très peu probable que les caractères à chaque position partagent le même véritable caractère sous-jacent
- **S_adj = 1 :** Les caractères à chaque position sont très susceptibles de partager le même véritable caractère sous-jacent
- **Valeurs comprises entre 0 et 1 :** Probabilité moyenne que les caractères alignés représentent les mêmes caractères vrais

**Résumé de la méthode 2 :** Cette métrique demande pour chaque paire de caractères : « Compte tenu de ce que nous savons sur la façon dont l'OCR qui a généré le CM fait des erreurs, quelle est la probabilité que ces deux caractères proviennent du même caractère original ? » Il fait ensuite la moyenne de ces probabilités sur l'ensemble du texte.

#### Quand les métriques sensibles aux biais sont disponibles

Les métriques sensibles aux biais (S_corr et S_adj) sont automatiquement calculées lorsque **toutes** des conditions suivantes sont remplies :

1. **La granularité au niveau des caractères** est sélectionnée
2. Une **matrice de confusion** a été chargée dans RECON
3. La matrice de confusion est compatible avec les caractères de vos textes
4. Toutes les fonctions de calcul nécessaires tenant compte du biais sont disponibles

#### Directives d'utilisation pratiques

**Pour les chercheurs :**
- Utilisez S_corr lorsque vous voulez savoir si la similitude observée dépasse ce que le biais OCR seul produirait
- **Utilisez S_adj** lorsque vous souhaitez une mesure de similarité plus nuancée et pondérée en fonction des probabilités
- **Comparez les deux mesures** avec une similarité standard (S_obs) pour comprendre l'impact du biais OCR

**Modèles de résultats typiques :**
- **OCR de haute qualité (S_baseline < 0,95):** Toutes les métriques ont tendance à concorder
- **OCR avec des modèles d'erreur hautement prévisibles (S_baseline > 0,98):** S_corr devient plus conservateur S_adj fournit des résultats plus nuancés
- **Textes sans rapport avec un OCR médiocre :** S_obs peut être élevé, mais S_corr tend vers 0 et S_adj est inférieur
- **Textes connexes avec un OCR médiocre :** S_corr et S_adj aident à révéler une véritable similitude masquée par le bruit OCR

**Indicateurs de qualité :**
- **S_baseline valeurs :** Des valeurs plus faibles (< 0,95) indiquent un OCR de meilleure qualité avec moins de biais systématique
- **S_baseline > 0.98 :** Indique l'OCR avec des modèles d'erreur hautement prévisibles où la correction du biais devient critique
- **Grands écarts entre S_obs et S_corr/S_adj :** Suggère un biais OCR significatif affectant les métriques standard

### 6. Paramètres configurables et persistance

RECON offre aux utilisateurs plusieurs façons de personnaliser le comportement et l'apparence de l'outil, et il se souvient de ces préférences.

* **Paramètres de l'algorithme de comparaison (DMP) :**
    * Situées sous le panneau « Diff Settings » près des principales commandes de comparaison, ces options permettent aux utilisateurs avancés d'affiner la façon dont RECON détecte les différences entre les textes à l'aide de l'algorithme diff-match-patch (DMP).
    * Bien que les valeurs par défaut fonctionnent bien dans la plupart des cas, l'ajustement de ces paramètres peut aider à adapter les comparaisons à différents types de textes (par exemple, vers denses, prose, sortie OCR, etc.). Voici ce que chaque paramètre fait en termes plus quotidiens :
        * 'Diff Timeout' : Définit une limite de temps (en secondes) pour le temps que le système doit passer à essayer de trouver les meilleures différences entre deux textes. S'il est défini sur 0, il n'y a pas de limite de temps, ce qui peut améliorer la précision, mais peut ralentir les choses pour les comparaisons importantes ou complexes.
        * 'Coût d'édition de diff' : Contrôle le « coût » d'une modification (comme une insertion ou une suppression). Un nombre plus élevé rend l'algorithme plus réticent à diviser ou à réécrire le texte - il favorise les morceaux plus gros qui correspondent étroitement, plutôt que de diviser les choses en beaucoup de petites modifications.
        * 'Match Threshold' : Il s'agit d'un paramètre de flou : il indique à l'algorithme à quel point il doit être pointilleux lorsqu'il essaie d'aligner un texte similaire. Une valeur de 0,0 signifie qu'il n'accepte que des correspondances presque parfaites ; Une valeur plus proche de 1,0 signifie qu'il se contentera de correspondances plus lâches, ce qui peut aider lorsque les textes sont très différents mais toujours liés.
        * 'Distance de correspondance' : Indique à l'algorithme jusqu'où regarder en avant ou en arrière dans le texte lorsqu'il essaie de trouver une correspondance. Un petit nombre permet de se concentrer localement (ce qui est idéal pour des comparaisons courtes et nettes), tandis qu'un nombre plus grand le rend plus flexible, en particulier lorsque des morceaux de texte ont été déplacés.
        * 'Seuil de suppression de correctif' : Détermine la quantité de modification qui doit être supprimée avant d'être traitée comme telle dans le correctif final (c'est-à-dire un enregistrement des modifications). Cela affecte principalement l'apparence de la sortie lorsque des morceaux sont manquants dans une version par rapport à l'autre.
        * 'Marge de patch' : Définit la quantité de contexte environnant à inclure lors de la génération d'un patch. Pensez-y comme si vous donniez quelques mots supplémentaires de « rembourrage » de chaque côté d'une monnaie pour aider à l'ancrer clairement en place.
    * Ces paramètres peuvent avoir un impact sur les performances et la qualité des résultats de diff, influençant ainsi la nature perçue de la transformation textuelle ou informative pour des types de textes spécifiques.
    * Les modifications peuvent être enregistrées dans le 'localStorage' du navigateur et seront chargées automatiquement lors des sessions futures. Un bouton « Réinitialiser les paramètres par défaut » restaure les paramètres DMP d'origine.

* **Paramètres de visualisation :**
    * Accessible via le menu des paramètres de visualisation (icône en forme de roue dentée dans l'en-tête).
    * **Personnalisation du thème :** Les utilisateurs peuvent sélectionner :
        * 'Thème de la lumière'
        * 'Thème sombre'
        * 'Thème système' (s'adapte automatiquement à la préférence de mode clair/sombre du système d'exploitation).
    * **Mode de contraste élevé :** Une bascule pour passer à une version à contraste élevé du thème actuel, améliorant ainsi la lisibilité pour les utilisateurs malvoyants.
    * Ces préférences sont également enregistrées dans 'localStorage' et persistent d'une session à l'autre.

La persistance de ces paramètres garantit que les utilisateurs peuvent conserver leur environnement de travail préféré sans avoir à reconfigurer l'outil à chaque fois qu'ils l'utilisent.

---

## Structure des fichiers

Le projet RECON est organisé en fichiers clés et répertoires suivants :

* **'recon.html'** : Le fichier HTML principal qui structure l'interface utilisateur. Il s'agit du fichier que vous ouvrez dans un navigateur Web pour exécuter l'application.
* **'styles.css'** : Contient toutes les règles CSS pour styliser l'apparence de l'application, y compris les thèmes et la mise en évidence des différences.
* **'script.js'** : (Fichier source) Le point d'entrée JavaScript principal qui orchestre les interactions avec l'interface utilisateur, le traitement des données, les calculs statistiques et intègre les différents modules ES6. Il s'agit de la source du code de l'application groupée.
* **'constants.js'** : Définit les constantes partagées utilisées dans l'ensemble de l'application, telles que les cartes de normalisation (ligatures, logogrammes), les granularités, les types d'exportation, etc. Il est chargé par 'recon.html' et également importé par modules.
* **'fastest-levenshtein.js'** : Une bibliothèque externe fournissant un calcul rapide de la distance de Levenshtein, utilisée pour les métriques CER et NED. Chargé par 'recon.html'.
* **'stopwords.js'** : Contient un ensemble prédéfini de mots vides utilisés pour la métrique d'analyse des mots vides. Chargé par 'recon.html'.

* **'modules/'** : Ce répertoire contient des modules JavaScript ES6 qui encapsulent des fonctionnalités spécifiques, favorisant l'organisation du code et la réutilisabilité :
    * **'diffEngine.js'** : Gère la logique de comparaison de base, y compris le prétraitement de texte, la tokenisation et l'interfaçage avec la bibliothèque 'diff-match-patch' pour générer des données de comparaison.
    * **'utility.js'** : Contient diverses fonctions d'assistance et utilitaires utilisées dans l'application (par exemple, échappement de texte, fonctions de formatage pour les statistiques).

* **'src/'** : Ce répertoire contient des modules ES6 spécialisés pour les métriques OCR sensibles aux biais :
    * **'confusion.js'** : Gère le traitement des matrices de confusion, la conversion des matrices de comptage en matrices de probabilité et la gestion des mappages de caractères à index.
    * **'baseline.js'** : Implémente les calculs de similarité normalisés de base, y compris les probabilités d'accord par glyphe et le calcul global de l'accord de base.
    * **'weights.js'** : Gère les calculs de poids bayésiens pour la métrique de similarité pondérée, le calcul des rapports de vraisemblance et des probabilités a posteriori.
    * **'similarity.js'** : Contient les principales fonctions de calcul de similarité pour les deux méthodes sensibles aux biais (S_corr et S_adj).

* **'dist/'** : Ce répertoire contient le fichier JavaScript fourni :
    * **'recon.bundle.js'** : La version groupée et minifiée de 'script.js' et de ses modules ES6 importés du répertoire 'modules/', créé par 'esbuild'. Il s'agit du script réellement chargé par 'recon.html' pour être exécuté dans le navigateur.

* **'README.md'** : Ce fichier fournit une vue d'ensemble, des instructions de configuration et de la documentation pour le projet.
* **'package.json'** : Node.js fichier de package. Définit les métadonnées du projet, les scripts (pour la construction et le développement) et les dépendances de développement (comme 'esbuild').
* **'package-lock.json'** : Enregistre les versions exactes des dépendances, garantissant des constructions reproductibles.
* **'node_modules/'** : Répertoire où npm installe les dépendances du projet (par exemple, 'esbuild'). Ce répertoire n'est généralement pas inclus dans le contrôle de version si d'autres utilisateurs sont censés exécuter « npm install ».

Cette structure sépare l'interface utilisateur ('recon.html', 'styles.css'), la logique de base ('script.js', 'modules/'), la sortie groupée ('dist/') et la gestion des projets/dépendances ('package.json', 'node_modules/').

---

## Guide de l'interface utilisateur

L'interface RECON est conçue pour être simple. Voici une ventilation de ses principaux composants :

1. **Barre d'en-tête :**
    * **Titre :** « RECON »
    * **Paramètres de visualisation (icône en forme de rouage):** Ouvre un menu déroulant pour contrôler :
        * **Thème :** Clair, Sombre, Système.
        * **Mode de contraste élevé :** Bascule le contraste élevé pour le thème sélectionné.
    * **Paramètres DMP (icône d'engrenage):** Ouvre une boîte de dialogue modale pour ajuster les paramètres de l'algorithme 'diff-match-patch'. Permet d'enregistrer des paramètres personnalisés ou de rétablir les paramètres par défaut.

2. **Zone d'entrée :**
    * **Panneaux Texte 1 et Texte 2 :** Deux grands champs de zone de texte côte à côte pour coller ou taper les textes que vous souhaitez comparer.
        Vous pouvez double-cliquer dans une zone de texte ou glisser-déposer un fichier '.txt' dessus pour charger le texte d'un fichier.
    * **Bouton « Comparer les textes » :** Lance le processus de comparaison à l'aide des textes actuels et des options sélectionnées.

3. **Panneau de configuration :** Située sous les zones de saisie, cette section contient toutes les options pour configurer la comparaison :
    * **Groupe de comparaison :**
        * **Liste déroulante de granularité :** Sélectionnez la comparaison de niveau « Caractère » ou « Mot ».
    * **Inclure le groupe :** Cases à cocher pour :
        * 'Espace blanc'
        * 'Ponctuation'
        * 'Capitalisation'
    * **Groupe de normalisation et de gestion des variants :** Cases à cocher pour :
        * 'Ignorer les logogrammes'
        * 'Ignorer les ligatures'
        * 'Ignorer les lettres archaïques'
        * 'Ignorer les variations u/v'
        * 'Ignorer les variations i/j'
        * 'Normaliser uu/vv en w'
    * **Bouton « Exporter les résultats » :** Devient actif après une comparaison. Vous permet de télécharger les résultats.
        * **Exporter le format des boutons radio :** Choisissez entre « Standoff JSON » et « TEI XML ».

4. **Zone de résultats :** Affiché sous le panneau de commandes après l'exécution d'une comparaison.
    * **Représentation visuelle (appareil):**
        * Montre les deux textes en synthèse, avec les différences mises en évidence (suppressions, insertions, substitutions).
        * **Bouton « Développer/Réduire l'appareil » :** Bascule la hauteur de cette zone d'affichage, utile pour les textes longs.
    * **Panneau de matrice de confusion :** (Apparaît lorsque la comparaison au niveau du caractère est utilisée)
        * **Bouton « Générer une matrice de confusion » :** Crée une matrice de confusion à partir de la comparaison actuelle (généralement utilisée lors de la comparaison de la vérité terrain avec la sortie OCR).
        * **Bouton « Charger la matrice de confusion » :** Vous permet de télécharger un fichier de matrice de confusion précédemment enregistré pour une analyse sensible aux biais.
        * **Affichage de l'état de la matrice :** Indique si une matrice de confusion est chargée et compatible avec vos textes.
    * **Tableau des statistiques :** Un tableau répertoriant toutes les mesures calculées pour la comparaison actuelle. Lorsqu'une matrice de confusion est chargée et qu'une granularité au niveau des caractères est utilisée, cela inclut les métriques sensibles aux biais (S_baseline, S_corr, S_adj). Chaque nom de métrique est accompagné d'une info-bulle expliquant sa signification. Certaines mesures proposent un bouton « Détails » pour afficher des informations plus granulaires (par exemple, des mots spécifiques en majuscules, des entités nommées).

5. **Pied de page :**
    * Contient une « date de dernière modification » pour la page de demande elle-même.
    * Peut inclure des liens ou d'autres textes informatifs.

**Flux de travail général :**

1. Entrez vos deux textes dans les zones de saisie « Texte 1 » et « Texte 2 ».
2. Sélectionnez les options « Granularité », « Inclure » et « Normalisation » souhaitées dans le panneau de configuration.
3. (Facultatif) Ajustez les paramètres DMP avancés ou les paramètres de visualisation si nécessaire.
4. Cliquez sur le bouton « Comparer les textes ».
5. Examinez les différences mises en évidence dans la zone « Représentation visuelle » et les chiffres dans le « Tableau des statistiques ».
6. Si vous le souhaitez, cliquez sur « Exporter les résultats », choisissez un format et le fichier sera téléchargé.

**Pour l'analyse OCR tenant compte des biais :**

1. Tout d'abord, créez une matrice de confusion :** Comparez le texte de vérité terrain à sa sortie OCR en utilisant la granularité au niveau des caractères avec espaces, ponctuation et majuscules inclus.
2. Cliquez sur « Générer une matrice de confusion » et téléchargez le fichier de matrice résultant.
3. **Pour les analyses ultérieures :** Chargez votre matrice de confusion enregistrée à l'aide de « Charger la matrice de confusion » avant de comparer les textes OCR.
4. **Comparez vos textes OCR** à l'aide de la granularité au niveau des caractères - les mesures sensibles aux biais (S_baseline, S_corr, S_adj) apparaîtront automatiquement.
5. Interprétez les résultats :** Comparez S_obs avec S_corr et S_adj pour comprendre la véritable similitude au-delà du biais OCR.

---

## Licence

Ce projet est sous licence **ISC**. Il s'agit d'une licence permissive de logiciel libre (open source).

Licence ISC

Droits d'auteur (c) 2023-2025 Jonathan David Pinkerton

Autorisation d'utiliser, de copier, de modifier et/ou de distribuer ce logiciel pour tout
l'objectif avec ou sans frais est accordé par la présente, à condition que les conditions ci-dessus
L'avis de droit d'auteur et cet avis d'autorisation apparaissent dans toutes les copies.

LE LOGICIEL EST FOURNI « EN L'ÉTAT » ET L'AUTEUR DÉCLINE TOUTE GARANTIE
EN CE QUI CONCERNE CE LOGICIEL, Y COMPRIS TOUTES LES GARANTIES IMPLICITES DE
QUALITÉ MARCHANDE ET APTITUDE. EN AUCUN CAS, L'AUTEUR NE SERA RESPONSABLE DE
TOUT DOMMAGE SPÉCIAL, DIRECT, INDIRECT OU CONSÉCUTIF OU TOUT DOMMAGE
QUOI QU'IL EN RÉSULTE D'UNE PERTE D'UTILISATION, DE DONNÉES OU DE BÉNÉFICES, QUE CE SOIT DANS UN
ACTION CONTRACTUELLE, NÉGLIGENCE OU AUTRE ACTION DÉLICTUELLE, DÉCOULANT DE
OU EN RELATION AVEC L'UTILISATION OU LES PERFORMANCES DE CE LOGICIEL.

RECON vise à être un outil open-source pour la communauté des chercheurs. Il intègre également des fonctionnalités d'autres bibliothèques open source, notamment :

* **diff-match-patch :** (Typiquement Apache License 2.0) - Utilisé pour l'algorithme de différenciation de texte de base.
* **fastest-levenshtein :** (Généralement licence MIT) - Utilisé pour les calculs de distance Levenshtein.
* **Compromise.js :** (Généralement licence MIT) - Utilisé pour les fonctionnalités de traitement du langage naturel (balisage POS, NER).

Les utilisateurs doivent également connaître les licences de ces composants et de tout autre composant tiers.

---

## Modification et extension de RECON

L'architecture modulaire ES6 de RECON est conçue pour le rendre adaptable aux utilisateurs qui souhaitent modifier ou étendre ses fonctionnalités à leurs besoins de recherche spécifiques, en particulier dans le suivi et l'analyse des différentes facettes de la variation informationnelle.

* **Logique de base :** La logique d'application principale réside dans 'script.js' (le point d'entrée pour le bundle 'dist/recon.bundle.js'). Ce fichier orchestre les interactions avec l'interface utilisateur, le traitement des données, les calculs statistiques et intègre les fonctionnalités des différents modules ES6.
* **Modules spécialisés :**
    * 'modules/diffEngine.js' : Contient la logique de base pour le prétraitement de texte, la tokenisation et l'interfaçage avec la bibliothèque 'diff-match-patch' pour générer des données de comparaison fondamentales pour identifier les changements d'information.
    * 'modules/utility.js' : Fournit diverses fonctions d'assistance utilisées dans l'application, aidant à des tâches telles que le formatage et la présentation des données.
* **Ajout de nouvelles métriques :** De nouveaux calculs statistiques peuvent être ajoutés à 'script.js' ou encapsulés dans de nouveaux modules. Il s'agit généralement de définir comment un nouveau type de variation informationnelle est quantifié. Les résultats devraient ensuite être intégrés dans la fonction 'displayStatistics' (ou une logique de rendu d'interface utilisateur équivalente) dans 'script.js.
Les cartes de normalisation dans 'constants.js' peuvent être étendues ou modifiées pour prendre en charge des variantes textuelles supplémentaires ou pour affiner la façon dont des types spécifiques d'informations (par exemple, orthographiques, sémantiques) sont régularisés avant la comparaison.

Ce projet encourage les utilisateurs à l'adapter à leurs propres objectifs de recherche, en tirant parti de son cadre pour diverses analyses de la transformation textuelle.

Ce projet a été développé par Jonathan David Pinkerton (Université de Lille, Université du Kent), avec l'aide significative de codage de divers modèles d'IA, notamment la série ChatGPT d'OpenAI, la série Claude d'Anthropic et la série Gemini de Google, souvent facilitée par l'éditeur de texte CursorAI.

---

## Problèmes connus et limitations

Bien que RECON soit continuellement amélioré, les utilisateurs doivent être conscients des problèmes connus, des limitations et des domaines suivants à prendre en compte à l'avenir. Ces points visent à fournir une compréhension transparente des capacités actuelles et de la portée de l'outil.

Bien qu'optimisé pour les longueurs de texte de recherche typiques (par exemple, articles, chapitres, œuvres de jeu), la comparaison de documents très volumineux (par exemple, de longs livres entiers) directement dans le navigateur peut toujours rencontrer une dégradation des performances ou des ralentissements du navigateur. La bibliothèque sous-jacente 'diff-match-patch' est efficace, mais l'exécution de JavaScript par le navigateur et la manipulation du DOM pour les diffs extensifs ont des limites inhérentes.
* **NLP Dépendance à Internet :** Comme indiqué, le balisage POS (Part-of-Speech) et la reconnaissance d'entités nommées (NER) reposent actuellement sur la bibliothèque 'Compromise.js' chargée à partir d'un CDN. Ces fonctionnalités statistiques avancées dérivées du NLP ne seront pas disponibles si l'utilisateur est hors ligne ou si le CDN est inaccessible. La comparaison de base et d'autres caractéristiques statistiques ne sont pas affectées.
* **Hypothèses modernes de la NLP dans les textes historiques :**
    * **Limitations POS/NER :** Le balisage de partie du discours et la reconnaissance d'entités nommées (NER) utilisent la bibliothèque 'Compromise.js', qui est entraînée sur l'anglais moderne. Il peut ne pas reconnaître les structures grammaticales archaïques, les noms latinisés ou les formes de mots obsolètes courantes dans les textes du début de l'ère moderne.
    * **Biais de mots vides et de fréquence :** La liste intégrée de mots vides **a été élargie pour inclure un ensemble significatif de mots fonctionnels courants en anglais moderne (par exemple, *thou*, *hath*, *dost*, *'tis*)**, ce qui aide à atténuer certains biais d'utilisation modernes. Cependant, la fréquence des mots, les mesures de similarité (Jaccard, Cosinus) et le chevauchement du vocabulaire peuvent toujours être influencés par la logique de tokenisation moderne restante et tout vocabulaire spécifique à une période non géré.
    * **Interprétation des majuscules :** RECON traite les différences de majuscules comme significatives lorsqu'elles sont activées. Cela peut déformer les majuscules stylistiques ou non sémantiques typiques des conventions d'impression du début de l'ère moderne.
    * **Recommandations pour le matériel historique :**
        * Activez les options de normalisation (ligatures, lettres archaïques, variantes u/v et i/j, et assurez-vous que l'option « Ignorer les logogrammes » est active pour bénéficier d'une liste élargie d'abréviations spécifiques à l'époque reconnues, comme ꝑ pour « per » ou ⁊ pour « et ») lorsque vous travaillez avec des textes du début de l'ère moderne. Soyez prudent lorsque vous interprétez des statistiques dérivées du NLP, sauf si vous travaillez à partir d'éditions normalisées ou modernisées sur le plan éditorial. La liste améliorée de mots vides et la reconnaissance du logogramme visent à améliorer le prétraitement de ce type de matériel historique, bien qu'elles soient certes imparfaites pour la tâche.
* **Différences entre les sensibilités et les alignements de l'algorithme :**
    * L'algorithme 'diff-match-patch' est puissant mais, comme tous les algorithmes de diff, peut occasionnellement produire des alignements pour des variations textuelles complexes (en particulier avec des changements qui se chevauchent ou des niveaux élevés de normalisation) qui peuvent sembler contre-intuitifs à l'interprétation humaine. Le diff résultant est toujours « correct » sur le plan informatique selon la logique de l'algorithme, mais peut ne pas être la seule représentation du changement ou la plus sémantiquement significative.
    * **Spécificités au niveau du mot :**
        * Lorsque vous comparez des textes au niveau du mot, en particulier avec le suivi des majuscules activé, l'outil peut parfois produire des alignements qui ne correspondent pas parfaitement aux attentes intuitives, en particulier s'il y a de nombreuses différences typographiques mineures. Envisagez de désactiver le suivi des majuscules ou d'examiner attentivement les résultats dans de tels cas.
        * La comparaison au niveau des mots tente d'aligner précisément les jetons ; Des différences typographiques mineures (au-delà des majuscules, si elles sont ignorées) entre les mots peuvent parfois conduire à des désalignements mineurs ou à des segmentations qui semblent loin d'être idéales.
    * **Spécificités au niveau du personnage :** La comparaison au niveau du personnage identifie chaque modification de personnage. Bien que très précis, ce niveau de détail peut être écrasant ou moins informatif pour des analyses axées sur des changements de contenu plus larges dans des textes très longs.
    * L'ajustement des paramètres DMP (par exemple, « Seuil de correspondance », « Coût d'édition de diff ») peut influencer les résultats et peut nécessiter une expérimentation pour optimiser des objectifs analytiques spécifiques concernant la variance informationnelle.
Lorsque l'option « Inclure les espaces » est activée dans la granularité des mots, les séquences de caractères d'espace (y compris les sauts de ligne) sont traitées comme des jetons distincts. Il s'agit d'une analyse méticuleuse, mais cela peut parfois conduire à un grand nombre de diffs contenant uniquement des espaces si les textes varient considérablement dans leur formatage, mais pas dans le contenu substantiel.
* **Spécificité de l'analyse des variants :** L'analyse actuelle des variants identifie principalement les substitutions directes et prédéfinies (par exemple, « formA » dans le texte 1 vs « formB » dans le texte 2). Il se peut qu'il ne capture pas toutes les variantes contextuelles nuancées ou les transformations combinées sans une correspondance de motifs plus complexe ou des définitions étendues dans constants.js.
* **Objectif d'exportation XML :** L'exportation XML inspirée de TEI fournit une structure d'appareil critique robuste et commune. Pour les projets TEI hautement spécialisés ou les exigences d'encodage avancées, une personnalisation ou un post-traitement supplémentaire du XML exporté peut être nécessaire pour s'aligner sur des schémas spécifiques ou des objectifs scientifiques.
* **Compatibilité des navigateurs :** RECON est conçu pour les navigateurs Web modernes. Bien que des efforts soient faits pour une compatibilité étendue, des incohérences ou des problèmes mineurs de rendu pourraient théoriquement survenir dans les versions de navigateur plus anciennes ou moins courantes. Les tests se concentrent principalement sur les versions récentes des principaux navigateurs tels que Edge (Chromium), Chrome et Firefox.
* **Affichage de l'appareil critique :** L'affichage de l'appareil critique est conçu pour être réactif, ce qui signifie que son contenu textuel s'adapte automatiquement à la largeur de la fenêtre du navigateur. Cela garantit que l'appareil est visible sur différentes tailles d'écran. Cependant, un élément clé à prendre en compte est que sur les écrans plus petits, en particulier avec une comparaison activée par les espaces, l'espace horizontal limité peut entraîner la fragmentation des lignes de texte. Cette fragmentation peut réduire la clarté globale et rendre l'appareil moins intuitif à lire et à interpréter. L'ajustement des paramètres d'affichage du navigateur peut améliorer certains de ces problèmes sur les écrans plus petits.

Les commentaires, les rapports de bogues et les contributions visant à résoudre ces limitations, à améliorer les fonctionnalités ou à identifier de nouveaux domaines d'amélioration sont les bienvenus, bien que j'espère que ce readme servira de base suffisante pour que l'on puisse itérer directement sur le projet. Il est maintenant entre vos mains numériques.
