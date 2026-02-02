You are a software architect specializing in game development. Your task is to build a fully functional Algerian version of Monopoly Deal, a property card game, in HTML, CSS, and Java.

**Game Overview:**
The game supports both single-player (against AI) and multiplayer modes. A player wins by completing 3 full property sets of different colors before opponents do.

**Core Data Models:**

1. **Property Cards**: Have a color, monetary value, and a target count to complete the set (e.g., blue requires 2 cards, yellow requires 3).

2. **Wildcard Cards**: Multi-colored property cards that count as any color the player assigns them to. They can be moved between sets and reassigned at any time during the player's turn without counting toward the move limit.

3. **Money Cards**: Denominations from 1 to 10 million dinars.

4. **Action Cards**: Have an action type (the effect they trigger) and a monetary value. Once placed in the bank, they permanently convert to money and cannot return to the player's hand.

**Game Loop (Turn Structure):**

Each turn consists of exactly 4 phases:

1. **Start Phase**: Check the player's hand size. If empty, draw 5 cards. If non-empty, draw 2 cards automatically from the deck.

2. **Action Phase**: The player can execute up to 3 moves. Examples of moves: play a card from hand to the bank, place a property card on the field, activate an action card. Moving property cards between sets or reassigning a wildcard's color is a free move that does not count toward the 3-move limit.

3. **Validation Phase**: After each move, check if the player has completed 3 different property sets. If yes, end the game and declare the winner.

4. **End Phase**: Enforce the hand limit. If the player has more than 7 cards, they must discard excess cards back to the deck before ending their turn. The system should prevent turn completion until this requirement is met.

**Property Field Logic:**

The property field is an object organized by color. Each color group has a maximum capacity equal to the cards needed to complete that set. The system must prevent exceeding the required count per set—if a set requires 3 cards, a 4th card of the same color starts a new group of that color.

**Payment System (Critical):**

When an action card triggers a payment demand:

- The paying player must choose to pay from either their bank (money and converted action cards) or their property field (property cards). They cannot pay from their hand under any circumstances.
- If the player has insufficient funds or properties in the field, they pay nothing.
- "No change" rule applies: if 2 million dinars is owed and the player only has a 10 million dinar card in the bank, they must pay the full 10 million and lose the 8 million difference.

**Winning Condition:**

A property set is complete when it contains the required number of property cards of the same color. Wildcards count toward the color they are assigned. Buildings (houses/hotels) are optional and do not affect set completion—they only increase rental value if implemented.

**Code Quality Requirements:**

- Build with clean, maintainable code following standard software architecture practices.
- Implement proper state management for each phase of the turn.
- Validate all moves according to the rules above—prevent invalid moves programmatically.
- Handle the payment system logic precisely as described, with no exceptions.
- Include comprehensive error handling for edge cases (insufficient funds, invalid card placements, hand limit violations).
- Provide clear code documentation explaining complex logic, especially around phase transitions and payment validation.
- Make the codebase production-ready with consideration for future expansions (additional cards, rule variants, UI enhancements).

Support both single-player (with AI opponent logic) and multiplayer (turn-based gameplay for multiple human players).

and it has to be in arabic 