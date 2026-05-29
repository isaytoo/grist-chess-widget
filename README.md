# ♟ Échecs & Dames — Widget Grist / Chess & Checkers Grist Widget

> Widget personnalisé pour [Grist](https://www.getgrist.com) — jouez aux échecs ou aux dames directement dans vos documents, avec une IA locale avancée et persistance automatique des parties.

> Custom widget for [Grist](https://www.getgrist.com) — play chess or checkers directly in your documents, with an advanced local AI engine and automatic game persistence.

---

## 🇫🇷 Français

### Fonctionnalités

- **Deux jeux** : Échecs et Dames, accessibles en un clic
- **IA locale avancée** — sans API externe :
  - Minimax avec élagage alpha-bêta
  - Iterative deepening avec limite de temps
  - Transposition table (hachage Zobrist)
  - Quiescence search (évite l'effet horizon)
  - Killer moves + History heuristic
  - Ordonnancement MVV-LVA des coups
- **Drag & drop** des pièces (desktop + tactile via Pointer Events API)
- **3 modes de jeu** : Humain vs IA · Humain vs Humain · IA vs IA
- **Panneau d'analyse** : score, profondeur, nœuds évalués, meilleur coup, temps de réflexion
- **Export FEN & PGN** (copie dans le presse-papier)
- **Retour arrière** (annule le coup + le coup IA)
- **Interface bilingue FR/EN** (sélecteur de langue + auto-détection du navigateur)
- **Persistance Grist** : création automatique des tables et sauvegarde de chaque coup

### Tables Grist créées automatiquement

| Table | Contenu |
|---|---|
| `Chess_Games` | Parties (type, dates, statut, vainqueur, tour, nombre de coups, FEN) |
| `Chess_Moves` | Coups joués (partie, index, joueur, notation, case départ/arrivée, pièce, capture, évaluation) |

### Installation

1. Dans Grist, ajouter un widget personnalisé
2. Coller l'URL du widget :
   ```
   https://grist-chess-widget.vercel.app
   ```
3. Accorder l'accès **Document complet** (pour la persistance)
4. Le widget crée automatiquement les tables si elles n'existent pas

### Développement local

```bash
# Cloner le dépôt
git clone https://github.com/isaytoo/grist-chess-widget.git
cd grist-chess-widget

# Ouvrir directement dans le navigateur
open index.html
```

---

## 🇬🇧 English

### Features

- **Two games**: Chess and Checkers, accessible in one click
- **Advanced local AI** — no external API:
  - Minimax with alpha-beta pruning
  - Iterative deepening with time limit
  - Transposition table (Zobrist hashing)
  - Quiescence search (avoids horizon effect)
  - Killer moves + History heuristic
  - MVV-LVA move ordering
- **Drag & drop** pieces (desktop + touch via Pointer Events API)
- **3 play modes**: Human vs AI · Human vs Human · AI vs AI
- **Analysis panel**: score, depth, evaluated nodes, best move, thinking time
- **FEN & PGN export** (copy to clipboard)
- **Undo** (reverts last move + AI response)
- **Bilingual UI EN/FR** (language switcher + browser auto-detection)
- **Grist persistence**: automatic table creation and move-by-move saving

### Grist Tables (auto-created)

| Table | Content |
|---|---|
| `Chess_Games` | Games (type, dates, status, winner, turn, move count, FEN) |
| `Chess_Moves` | Played moves (game, index, player, notation, from/to square, piece, capture, eval) |

### Installation

1. In Grist, add a custom widget
2. Paste the widget URL:
   ```
   https://grist-chess-widget.vercel.app
   ```
3. Grant **Full document** access (required for persistence)
4. The widget automatically creates required tables if they don't exist

### Local development

```bash
# Clone the repository
git clone https://github.com/isaytoo/grist-chess-widget.git
cd grist-chess-widget

# Open directly in browser
open index.html
```

---

## Architecture

```
index.html   — HTML structure + CSS (board, panels, UI)
game.js      — Game engine + AI + Grist API + Drag & Drop
```

---

## License

MIT — [isaytoo](https://github.com/isaytoo)
