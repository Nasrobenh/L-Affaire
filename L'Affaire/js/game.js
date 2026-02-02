class Player {
    constructor(name, isAI = false) {
        this.name = name;
        this.isAI = isAI;
        this.hand = [];
        this.bank = []; // Array of Cards (Action or Money)
        this.field = {}; // Object: ColorKey -> Array of PropertyCards
        this.movesLeft = 0;
    }

    addToHand(cards) {
        this.hand.push(...cards);
    }

    addToBank(card) {
        this.bank.push(card);
    }

    addToField(card, colorKey) {
        if (!this.field[colorKey]) {
            this.field[colorKey] = [];
        }
        this.field[colorKey].push(card);
    }

    getBankTotal() {
        return this.bank.reduce((sum, card) => sum + card.value, 0);
    }

    getAssetsValue() {
        let total = this.getBankTotal();
        for (let color in this.field) {
            this.field[color].forEach(card => total += card.value);
        }
        return total;
    }
}

class Game {
    constructor() {
        this.deck = DeckFactory.createDeck();
        this.discardPile = [];
        this.players = [
            new Player('أنت', false),
            new Player('الخصم', true)
        ];
        this.currentPlayerIndex = 0; // 0 for Human, 1 for AI
        this.phase = 'START'; // START, ACTION, DISCARD, PAYMENT, GAME_OVER
        this.winner = null;
        
        // Payment State
        this.paymentRequest = null; // { amount: 0, from: playerIndex, to: playerIndex }
        
        // Targeting State
        this.pendingAction = null; // { cardIndex, type, sourcePlayerIndex }

        // Counter State (Just Say No)
        this.counterState = null; // { noCount: 0, targetIndex, aggressorIndex, onResolve, onCancel }
    }

    isSetComplete(player, colorKey) {
        if (!player.field[colorKey]) return false;
        // Only count properties and wildcards, not House/Hotel
        const propertyCount = player.field[colorKey].filter(c => c.type === CardType.PROPERTY || c.type === CardType.WILDCARD).length;
        return propertyCount >= PropertyColors[colorKey].required;
    }

    checkCounterChance(targetIndex, onResolve, onCancel) {
        const aggressorIndex = (targetIndex + 1) % 2;
        
        this.counterState = {
            noCount: 0,
            targetIndex: targetIndex,
            aggressorIndex: aggressorIndex,
            onResolve: onResolve,
            onCancel: onCancel
        };

        this.processCounterState();
    }

    processCounterState() {
        if (!this.counterState) return;

        const { noCount, targetIndex, aggressorIndex, onResolve, onCancel } = this.counterState;
        
        // Even noCount: It's Target's turn to say No (to stop action)
        // Odd noCount: It's Aggressor's turn to say No (to stop previous No)
        const activePlayerIndex = (noCount % 2 === 0) ? targetIndex : aggressorIndex;
        const activePlayer = this.players[activePlayerIndex];
        
        const hasJustSayNo = activePlayer.hand.some(c => c.actionType === 'JUST_SAY_NO');
        
        if (!hasJustSayNo) {
            // Cannot continue counter war
            this.finalizeCounter();
            return;
        }

        // Offer opportunity
        this.phase = 'COUNTER_OPPORTUNITY';
        const msg = (noCount % 2 === 0) 
            ? `فرصة للتصدي للحركة (Player ${activePlayerIndex})` 
            : `فرصة للتصدي لـ "لا!" (Player ${activePlayerIndex})`;
        console.log(msg);

        // Update UI Request Object for Main.js
        this.counterRequest = {
            victimIndex: activePlayerIndex, // "Victim" is just the one being asked now
            message: (noCount % 2 === 0) ? 'هل تريد إلغاء الحركة بـ "لا لا!"؟' : 'هل تريد إلغاء الـ "لا لا!" الخاصة بخصمك؟'
        };
        
        this.updateUI();

        if (activePlayer.isAI) {
            setTimeout(() => {
                // AI Strategy: Always use it if available
                this.resolveCounter(true); 
            }, 1000);
        }
    }

    finalizeCounter() {
        const { noCount, onResolve, onCancel } = this.counterState;
        this.counterState = null;
        this.counterRequest = null;

        // Even noCount: No "No"s, or cancelled by even number of "No"s -> Action Proceeds
        // Odd noCount: Action stopped by "No" -> Action Cancelled
        
        if (noCount % 2 === 0) {
            console.log("Counter finished: Action Proceeds");
            onResolve();
        } else {
            console.log("Counter finished: Action Cancelled");
            onCancel();
        }
        
        // Resume AI if needed
        if (this.phase === 'ACTION' && this.getCurrentPlayer().isAI) {
            this.playAITurn();
        }
    }

    resolveCounter(didUse) {
        if (this.phase !== 'COUNTER_OPPORTUNITY' || !this.counterState) return;
        
        const { noCount, targetIndex, aggressorIndex } = this.counterState;
        const activePlayerIndex = (noCount % 2 === 0) ? targetIndex : aggressorIndex;
        const activePlayer = this.players[activePlayerIndex];

        if (didUse) {
            const cardIndex = activePlayer.hand.findIndex(c => c.actionType === 'JUST_SAY_NO');
            if (cardIndex >= 0) {
                const card = activePlayer.hand.splice(cardIndex, 1)[0];
                this.discardPile.push(card);
                console.log(`Player ${activePlayerIndex} used JUST SAY NO!`);
                
                this.counterState.noCount++;
                this.processCounterState(); // Next step in war
            } else {
                // Should not happen
                this.finalizeCounter();
            }
        } else {
            console.log(`Player ${activePlayerIndex} declined to use JUST SAY NO.`);
            this.finalizeCounter();
        }
    }

    start() {
        // Initial Draw: 5 cards each
        this.players.forEach(p => {
            p.addToHand(this.drawCards(5));
        });
        this.startTurn();
    }

    drawCards(count) {
        let drawn = [];
        for (let i = 0; i < count; i++) {
            if (this.deck.length === 0) {
                if (this.discardPile.length === 0) break; // No cards left
                this.deck = DeckFactory.shuffle([...this.discardPile]);
                this.discardPile = [];
            }
            drawn.push(this.deck.pop());
        }
        return drawn;
    }

    startTurn() {
        this.phase = 'START';
        const player = this.getCurrentPlayer();
        
        const drawCount = player.hand.length === 0 ? 5 : 2;
        
        if (player.isAI) {
            player.addToHand(this.drawCards(drawCount));
            player.movesLeft = 3;
            this.phase = 'ACTION';
            console.log(`Turn started for ${player.name}`);
            this.updateUI();
            this.playAITurn();
        } else {
            // Human: Wait for manual draw
            this.phase = 'DRAW';
            this.pendingDrawCount = drawCount;
            console.log(`Turn started for ${player.name}. Waiting for draw.`);
            this.updateUI();
        }
    }

    performDraw() {
        if (this.phase !== 'DRAW') return;
        const player = this.getCurrentPlayer();
        
        player.addToHand(this.drawCards(this.pendingDrawCount));
        player.movesLeft = 3;
        this.phase = 'ACTION';
        
        this.updateUI();
    }

    playCardToBank(cardIndex) {
        if (this.phase !== 'ACTION') return false;
        const player = this.getCurrentPlayer();
        if (player.movesLeft <= 0) return false;

        const card = player.hand[cardIndex];
        if (card.type === CardType.PROPERTY || card.type === CardType.WILDCARD) {
            return false; 
        }

        player.hand.splice(cardIndex, 1);
        player.addToBank(card);
        player.movesLeft--;
        
        this.checkWinCondition();
        this.updateUI();
        return true;
    }

    playPropertyToField(cardIndex, targetColorKey = null) {
        if (this.phase !== 'ACTION') return false;
        const player = this.getCurrentPlayer();
        if (player.movesLeft <= 0) return false;

        const card = player.hand[cardIndex];
        
        if (card.type !== CardType.PROPERTY && card.type !== CardType.WILDCARD) {
            return false;
        }

        let colorToUse = null;

        if (card.type === CardType.PROPERTY) {
            colorToUse = card.colorKey;
        } else if (card.type === CardType.WILDCARD) {
            if (!targetColorKey) {
                colorToUse = targetColorKey || card.validColors[0];
            } else {
                if (!card.validColors.includes(targetColorKey)) return false;
                colorToUse = targetColorKey;
            }
            card.currentColor = colorToUse;
        }

        player.hand.splice(cardIndex, 1);
        player.addToField(card, colorToUse);
        player.movesLeft--;

        this.checkWinCondition();
        this.updateUI();
        return true;
    }

    playAction(cardIndex) {
        if (this.phase !== 'ACTION') return false;
        const player = this.getCurrentPlayer();
        if (player.movesLeft <= 0) return false;

        const card = player.hand[cardIndex];
        // Note: RENT cards are handled by playRent, not here usually, unless generic action handling
        
        if (card.actionType === 'PASS_GO') {
             player.hand.splice(cardIndex, 1);
             this.discardPile.push(card);
             player.addToHand(this.drawCards(2));
             player.movesLeft--;
             this.updateUI();
             return true;
        } else if (card.actionType === 'BIRTHDAY' || card.actionType === 'DEBT_COLLECTOR') {
            const amount = card.actionType === 'BIRTHDAY' ? 2 : 5;
            player.hand.splice(cardIndex, 1);
            this.discardPile.push(card);
            player.movesLeft--;
            
            // Trigger Payment
            // For 2 players, it's simple. 
            const opponentIndex = (this.currentPlayerIndex + 1) % 2;
            
            this.checkCounterChance(opponentIndex, 
                () => this.initiatePayment(amount, opponentIndex, this.currentPlayerIndex),
                () => {
                    alert('تم إلغاء طلب المال بواسطة "لا!"');
                    this.phase = 'ACTION';
                    this.updateUI();
                }
            );
            return true;
        } else if (card.actionType === 'SLY_DEAL' || card.actionType === 'DEAL_BREAKER') {
            // Enter Targeting Phase
            this.pendingAction = {
                cardIndex: cardIndex,
                type: card.actionType,
                sourcePlayerIndex: this.currentPlayerIndex
            };
            this.phase = 'TARGETING';
            console.log(`Entered Targeting Phase for ${card.actionType}`);
            this.updateUI();
            return true;
        } else if (card.actionType === 'FORCED_DEAL') {
            // Enter Selection Phase (My Property)
            this.pendingAction = {
                cardIndex: cardIndex,
                type: card.actionType,
                sourcePlayerIndex: this.currentPlayerIndex,
                myProperty: null
            };
            this.phase = 'FORCED_DEAL_SOURCE';
            console.log(`Select your property to swap`);
            this.updateUI();
            return true;
        } else if (card.actionType === 'HOUSE' || card.actionType === 'HOTEL') {
            const completeSets = Object.keys(player.field).filter(k => this.isSetComplete(player, k));
            
            if (completeSets.length === 0) {
                alert('لا يمكنك لعب هذه البطاقة إلا على مجموعة مكتملة.');
                return false;
            }

            // If HOTEL, must have HOUSE first? 
            // Rules: "You can add a House to any full set... You can add a Hotel to any full set with a House."
            
            let validSets = completeSets;
            if (card.actionType === 'HOTEL') {
                validSets = completeSets.filter(k => player.field[k].some(c => c.actionType === 'HOUSE'));
                if (validSets.length === 0) {
                    alert('تحتاج إلى منزل أولاً قبل بناء فندق!');
                    return false;
                }
            } else {
                 // House: Cannot add if already has House? 
                 // Rules: "Only 1 House per set."
                 validSets = completeSets.filter(k => !player.field[k].some(c => c.actionType === 'HOUSE' || c.actionType === 'HOTEL'));
                 if (validSets.length === 0) {
                     alert('كل مجموعاتك المكتملة تحتوي على منازل بالفعل.');
                     return false;
                 }
            }

            // Prompt user
             let chosenColor = null;
             
             if (!player.isAI) {
                 const options = validSets.map(c => PropertyColors[c].name).join(', ');
                 const choiceName = prompt(`اختر مجموعة لإضافة ${card.name}: ${options}`);
                 if (!choiceName) return false;
                 
                 chosenColor = validSets.find(c => PropertyColors[c].name === choiceName || PropertyColors[c].name.includes(choiceName));
                 if (!chosenColor) {
                    alert('اختيار غير صحيح.');
                    return false;
                 }
             } else {
                 // AI Choice: Pick first valid set
                 chosenColor = validSets[0];
             }

             player.hand.splice(cardIndex, 1);
             player.addToField(card, chosenColor);
             player.movesLeft--;
             this.updateUI();
             return true;
        }

        alert('هذه البطاقة تتطلب هدفاً محدداً أو غير مفعلة بعد.');
        return false;
    }

    cancelTargeting() {
        if (this.phase !== 'TARGETING' && this.phase !== 'FORCED_DEAL_SOURCE') return;
        this.pendingAction = null;
        this.phase = 'ACTION';
        this.updateUI();
    }

    selectMyForcedDealProperty(colorKey, cardIndex) {
        if (this.phase !== 'FORCED_DEAL_SOURCE') return;
        
        // Validation: Ensure the card exists
        const player = this.getCurrentPlayer();
        if (!player.field[colorKey] || !player.field[colorKey][cardIndex]) return;

        // Store selection
        this.pendingAction.myProperty = { colorKey, cardIndex };
        
        // Move to next phase: Target opponent
        this.phase = 'TARGETING';
        console.log(`Property selected. Now select opponent's property.`);
        this.updateUI();
    }

    resolveTargetedAction(target) { // { playerIndex, colorKey, cardIndex }
        if (this.phase !== 'TARGETING' || !this.pendingAction) return;

        const action = this.pendingAction;
        const player = this.players[action.sourcePlayerIndex];
        const targetPlayer = this.players[target.playerIndex];
        
        // Validation
        if (action.type === 'SLY_DEAL') {
            // Can steal single property, but NOT from a complete set
            if (this.isSetComplete(targetPlayer, target.colorKey)) {
                alert('لا يمكنك سرقة عقار من مجموعة مكتملة باستخدام Sly Deal!');
                return;
            }
        } else if (action.type === 'DEAL_BREAKER') {
            // Must steal COMPLETE set
            if (!this.isSetComplete(targetPlayer, target.colorKey)) {
                alert('يجب استخدام Deal Breaker على مجموعة مكتملة فقط!');
                return;
            }
        } else if (action.type === 'FORCED_DEAL') {
             // Cannot force deal a complete set (usually)
             if (this.isSetComplete(targetPlayer, target.colorKey)) {
                 alert('لا يمكنك مبادلة عقار من مجموعة مكتملة!');
                 return;
             }
        }

        // Check for Counter (Just Say No)
        this.checkCounterChance(target.playerIndex,
            () => {
                // On Resolve: Execute the Action
                this.executeTargetedAction(target);
            },
            () => {
                // On Cancel: Action blocked
                alert('تم إلغاء الحركة بواسطة "لا!"');
                
                // The action card is still used/discarded?
                // Rules: "If an action is cancelled, the card is discarded and counts as a move."
                const cardUsed = player.hand.splice(action.cardIndex, 1)[0];
                this.discardPile.push(cardUsed);
                player.movesLeft--;

                this.pendingAction = null;
                this.phase = 'ACTION';
                this.updateUI();
            }
        );
    }

    executeTargetedAction(target) {
        const action = this.pendingAction;
        const player = this.players[action.sourcePlayerIndex];
        const targetPlayer = this.players[target.playerIndex];

        if (action.type === 'SLY_DEAL') {
            // Execute Steal
            const card = targetPlayer.field[target.colorKey].splice(target.cardIndex, 1)[0];
            player.addToField(card, target.colorKey); // Add to thief's field

        } else if (action.type === 'DEAL_BREAKER') {
            // Execute Steal Set
            const set = targetPlayer.field[target.colorKey];
            targetPlayer.field[target.colorKey] = []; // Empty the victim's set
            
            // Move all to thief
            set.forEach(c => player.addToField(c, target.colorKey));
        } else if (action.type === 'FORCED_DEAL') {
            // Execute Swap
            // 1. Get my property
            const myColor = action.myProperty.colorKey;
            const myIndex = action.myProperty.cardIndex;
            const myCard = player.field[myColor].splice(myIndex, 1)[0];
            
            // 2. Get their property
            const theirColor = target.colorKey;
            const theirIndex = target.cardIndex;
            const theirCard = targetPlayer.field[theirColor].splice(theirIndex, 1)[0];
            
            // 3. Swap
            player.addToField(theirCard, theirColor);
            targetPlayer.addToField(myCard, myColor);
        }

        // Finish Action
        const cardUsed = player.hand.splice(action.cardIndex, 1)[0];
        this.discardPile.push(cardUsed);
        player.movesLeft--;

        this.pendingAction = null;
        this.phase = 'ACTION';
        
        this.checkWinCondition();
        this.updateUI();
    }

    switchPropertyColor(currentKind, cardIndex, newColor) {
        // Rearranging is free (no moves cost)
        if (this.phase !== 'ACTION') return;
        
        const player = this.getCurrentPlayer();
        const set = player.field[currentKind];
        if (!set || !set[cardIndex]) return;

        const card = set[cardIndex];
        
        // Validate
        if (card.type !== CardType.WILDCARD) {
            alert('يمكنك تغيير لون البطاقات الجوكر (Wildcards) فقط.');
            return;
        }
        if (!card.validColors.includes(newColor)) {
            alert('هذه البطاقة لا تدعم اللون المختار.');
            return;
        }
        if (card.currentColor === newColor) return;

        // Execute Move
        set.splice(cardIndex, 1);
        card.currentColor = newColor;
        player.addToField(card, newColor);

        this.checkWinCondition();
        this.updateUI();
    }

    playRent(cardIndex, colorKey) {
        if (this.phase !== 'ACTION') return false;
        const player = this.getCurrentPlayer();
        if (player.movesLeft <= 0) return false;

        const card = player.hand[cardIndex];
        if (card.type !== CardType.RENT) return false;

        // Validate Color
        if (!card.validColors.includes(colorKey)) return false;

        // Check if player has properties of this color
        if (!player.field[colorKey] || player.field[colorKey].length === 0) {
            alert('ليس لديك عقارات بهذا اللون لتحصيل الإيجار!');
            return false;
        }

        let rentAmount = this.calculateRent(player, colorKey);
        
        // Check for Double Rent
        const doubleRentIndex = player.hand.findIndex(c => c.actionType === 'DOUBLE_RENT');
        if (doubleRentIndex >= 0) {
            let useDouble = false;
            if (!player.isAI) {
                useDouble = confirm('هل تريد استخدام بطاقة "مضاعفة الإيجار"؟');
            } else {
                useDouble = true; // AI always doubles if possible
            }

            if (useDouble) {
                rentAmount *= 2;
                const doubleCard = player.hand.splice(doubleRentIndex, 1)[0];
                this.discardPile.push(doubleCard);
                // Double Rent counts as a move? Usually played WITH rent card. 
                // Rules say: "Play with a standard rent card". Usually counts as 1 move total or separate?
                // Official rules: "Counts as 1 card played" (the rent card). Double Rent also counts as 1 card?
                // Actually: "You can play it with a rent card."
                // Most digital versions count it as 1 move for the Rent, and Double Rent is just a modifier?
                // Or 2 moves?
                // Let's assume it costs 1 extra move if we treat it as a played card.
                // But usually played *with*.
                // Let's count it as 1 extra move for simplicity of code (2 cards left hand).
                // If movesLeft < 1, maybe can't use it? 
                // Let's be generous and say it's part of the same action for now, but usually it's 2 cards played.
                if (player.movesLeft > 1) {
                     player.movesLeft--; // Deduct extra move
                }
            }
        }
        
        player.hand.splice(cardIndex, 1);
        this.discardPile.push(card);
        player.movesLeft--;

        const opponentIndex = (this.currentPlayerIndex + 1) % 2;
        
        this.checkCounterChance(opponentIndex, 
            () => this.initiatePayment(rentAmount, opponentIndex, this.currentPlayerIndex),
            () => {
                alert('تم إلغاء الإيجار بواسطة "لا!"');
                this.phase = 'ACTION';
                this.updateUI();
            }
        );
        return true;
    }

    calculateRent(player, colorKey) {
        const cards = player.field[colorKey] || [];
        const propertyCount = cards.filter(c => c.type === CardType.PROPERTY || c.type === CardType.WILDCARD).length;
        if (propertyCount === 0) return 0;

        const colorInfo = PropertyColors[colorKey];
        // Rent array index is count-1 (1 card -> index 0)
        // Ensure we don't exceed max rent index
        const rentIndex = Math.min(propertyCount, colorInfo.rent.length) - 1;
        let rent = colorInfo.rent[rentIndex];

        // Check for House/Hotel
        const hasHouse = cards.some(c => c.actionType === 'HOUSE');
        const hasHotel = cards.some(c => c.actionType === 'HOTEL');

        if (hasHouse) rent += 3;
        if (hasHotel) rent += 4;

        return rent;
    }

    initiatePayment(amount, debtorIndex, creditorIndex) {
        this.paymentRequest = {
            amount: amount,
            debtorIndex: debtorIndex,
            creditorIndex: creditorIndex,
            paid: 0
        };
        this.phase = 'PAYMENT';
        console.log(`Payment requested: ${amount}M from Player ${debtorIndex} to Player ${creditorIndex}`);
        
        this.updateUI();

        // If Debtor is AI, auto-pay
        if (this.players[debtorIndex].isAI) {
            setTimeout(() => this.handleAIPayment(), 1000);
        }
    }

    resolvePayment(selectedAssets) { // selectedAssets: Array of {type: 'bank'|'field', index: number, colorKey?: string}
        if (this.phase !== 'PAYMENT') return;
        const req = this.paymentRequest;
        const debtor = this.players[req.debtorIndex];
        const creditor = this.players[req.creditorIndex];

        let totalValue = 0;
        let cardsToTransfer = [];

        // Validate and Gather cards
        // Need to process in reverse order of indices if removing from same array, but here we have mixed sources.
        // Better to verify first, then move.
        
        // Simplified: Assume selectedAssets contains card objects or we lookup carefully.
        // Let's expect input as: [{source: 'bank', index: 0}, {source: 'field', color: 'RED', index: 0}]
        
        // Verification pass
        for (let item of selectedAssets) {
            let card;
            if (item.source === 'bank') {
                card = debtor.bank[item.index];
            } else {
                card = debtor.field[item.color][item.index];
            }
            if (!card) continue; // Should not happen
            totalValue += card.value;
            cardsToTransfer.push({ ...item, card });
        }

        // Check if sufficient or if player is bankrupt (giving all they have)
        const debtorTotalAssets = debtor.getAssetsValue();
        const amountOwed = req.amount;

        if (totalValue < amountOwed && totalValue < debtorTotalAssets) {
            alert(`المبلغ غير كافٍ. مطلوب ${amountOwed}M، اخترت ${totalValue}M.`);
            return;
        }

        // Execute Transfer
        // Sort by index descending to avoid shift issues? No, arrays are different.
        // But removing multiple from same array (bank) needs care.
        // We will filter out transferred cards.
        
        // 1. Remove from Debtor
        // To do this safely, we can rebuild the bank/field arrays or mark for deletion.
        // Let's use IDs if possible, but we don't strictly enforce unique IDs in logic yet (though cards have them).
        // Let's filter.
        
        const transferIds = new Set(cardsToTransfer.map(i => i.card.id));
        
        debtor.bank = debtor.bank.filter(c => !transferIds.has(c.id));
        for (let color in debtor.field) {
            debtor.field[color] = debtor.field[color].filter(c => !transferIds.has(c.id));
        }

        // 2. Add to Creditor (Bank or Field?)
        // Rules: Money -> Bank. Properties -> Field (must form sets).
        // Actually, usually paying with Property puts it into Creditor's Field.
        // Paying with Money puts it into Creditor's Bank.
        // Paying with Action (from Bank) puts it into Creditor's Bank (as money).
        
        cardsToTransfer.forEach(item => {
            const card = item.card;
            if (card.type === CardType.MONEY || card.type === CardType.ACTION || card.type === CardType.RENT) {
                creditor.addToBank(card);
            } else if (card.type === CardType.PROPERTY || card.type === CardType.WILDCARD) {
                // Determine color for property
                let color = card.colorKey;
                if (card.type === CardType.WILDCARD) {
                    // Reset wildcard color or keep? 
                    // Usually player chooses. For simplicity, default to first valid or current.
                    color = card.currentColor || card.validColors[0];
                }
                creditor.addToField(card, color);
            }
        });

        this.paymentRequest = null;
        
        // Return control to the player whose turn it was
        this.phase = 'ACTION';
        
        // If it was AI's turn, continue AI
        if (this.players[this.currentPlayerIndex].isAI) {
            this.playAITurn();
        } else {
            this.updateUI();
        }
    }

    handleAIPayment() {
        const req = this.paymentRequest;
        if (!req) return;
        const ai = this.players[req.debtorIndex];
        const amount = req.amount;
        
        let currentSum = 0;
        let selected = [];

        // Strategy: Pay with Bank (Money) first, then Bank (Action), then Properties (Cheapest/Non-set)
        
        // 1. Bank Money
        for (let i = 0; i < ai.bank.length; i++) {
            if (currentSum >= amount) break;
            selected.push({ source: 'bank', index: i, card: ai.bank[i] });
            currentSum += ai.bank[i].value;
        }

        // 2. Properties (if needed)
        if (currentSum < amount) {
            for (let color in ai.field) {
                const cards = ai.field[color];
                for (let i = 0; i < cards.length; i++) {
                    if (currentSum >= amount) break;
                    selected.push({ source: 'field', color: color, index: i, card: cards[i] });
                    currentSum += cards[i].value;
                }
            }
        }

        this.resolvePayment(selected);
    }

    endTurn() {
        if (this.phase !== 'ACTION') return;
        
        const player = this.getCurrentPlayer();
        
        if (player.hand.length > 7) {
            this.phase = 'DISCARD';
            if (!player.isAI) {
                alert('لديك أكثر من 7 بطاقات! يجب عليك رمي البطاقات الزائدة.');
            } else {
                // AI Discard
                while (player.hand.length > 7) {
                    const card = player.hand.pop(); // Simple discard last
                    this.discardPile.push(card);
                }
                this.endTurn(); // Recursive call to finish
                return;
            }
            this.updateUI();
            return;
        }

        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % 2;
        this.startTurn();
    }

    discardExcessCard(cardIndex) {
        if (this.phase !== 'DISCARD') return;
        const player = this.getCurrentPlayer();
        
        const card = player.hand.splice(cardIndex, 1)[0];
        this.discardPile.push(card);
        
        if (player.hand.length <= 7) {
            this.endTurn();
        } else {
            this.updateUI();
        }
    }

    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex];
    }

    checkWinCondition() {
        const player = this.getCurrentPlayer();
        let fullSets = 0;
        for (let color in player.field) {
            const cards = player.field[color];
            if (!cards || cards.length === 0) continue;
            
            const req = PropertyColors[color].required;
            if (cards.length >= req) {
                fullSets++;
            }
        }

        if (fullSets >= 3) {
            this.winner = player;
            alert(`الفائز هو ${player.name}!`);
            this.phase = 'GAME_OVER';
        }
    }

    updateUI() {}

    playAITurn() {
        setTimeout(() => {
            const ai = this.getCurrentPlayer();
            const opponentIndex = (this.currentPlayerIndex + 1) % 2;
            const opponent = this.players[opponentIndex];
            
            // Limit loop to prevent infinite loops
            let attempts = 0;
            const maxAttempts = 10; 

            while (ai.movesLeft > 0 && attempts < maxAttempts) {
                attempts++;
                let played = false;

                // 1. Play Money (Always good to have cash)
                const moneyIdx = ai.hand.findIndex(c => c.type === CardType.MONEY);
                if (moneyIdx >= 0) {
                    this.playCardToBank(moneyIdx);
                    played = true;
                    continue;
                }

                // 2. Play Properties
                const propIdx = ai.hand.findIndex(c => c.type === CardType.PROPERTY || c.type === CardType.WILDCARD);
                if (propIdx >= 0) {
                    this.playPropertyToField(propIdx);
                    played = true;
                    continue;
                }

                // 3. Play Actions
                for (let i = 0; i < ai.hand.length; i++) {
                    const c = ai.hand[i];
                    
                    // Rent
                    if (c.type === CardType.RENT) {
                        const validColor = c.validColors.find(k => ai.field[k] && ai.field[k].length > 0);
                        if (validColor) {
                            this.playRent(i, validColor);
                            // Rent triggers payment which pauses turn or ends it for now
                            return;
                        }
                    }

                    if (c.type !== CardType.ACTION) continue;

                    // Pass Go
                    if (c.actionType === 'PASS_GO') {
                        this.playAction(i);
                        played = true; break;
                    }
                    
                    // Birthday / Debt Collector
                    if (c.actionType === 'BIRTHDAY' || c.actionType === 'DEBT_COLLECTOR') {
                        this.playAction(i);
                        // Triggers payment
                        return; 
                    }
                    
                    // House / Hotel
                    if (c.actionType === 'HOUSE' || c.actionType === 'HOTEL') {
                         if (this.playAction(i)) {
                             played = true; break;
                         }
                    }

                    // Aggressive Actions
                    if (c.actionType === 'SLY_DEAL') {
                        // Find stealable property (not part of complete set)
                        let target = null;
                        for (let color in opponent.field) {
                            if (!this.isSetComplete(opponent, color) && opponent.field[color].length > 0) {
                                target = { playerIndex: opponentIndex, colorKey: color, cardIndex: 0 };
                                break;
                            }
                        }
                        if (target) {
                             this.playAction(i); // Enter Targeting
                             this.resolveTargetedAction(target); // Execute
                             played = true; break;
                        }
                    }

                    if (c.actionType === 'DEAL_BREAKER') {
                         // Find complete set
                         let target = null;
                         for (let color in opponent.field) {
                            if (this.isSetComplete(opponent, color)) {
                                target = { playerIndex: opponentIndex, colorKey: color, cardIndex: 0 };
                                break;
                            }
                         }
                         if (target) {
                             this.playAction(i);
                             this.resolveTargetedAction(target);
                             played = true; break;
                         }
                    }
                    
                    // Forced Deal
                    if (c.actionType === 'FORCED_DEAL') {
                         let myProp = null;
                         for(let color in ai.field) {
                             if(ai.field[color].length > 0 && !this.isSetComplete(ai, color)) {
                                 myProp = { colorKey: color, cardIndex: 0 };
                                 break;
                             }
                         }
                         let theirProp = null;
                         for(let color in opponent.field) {
                             if(opponent.field[color].length > 0 && !this.isSetComplete(opponent, color)) {
                                 theirProp = { playerIndex: opponentIndex, colorKey: color, cardIndex: 0 };
                                 break;
                             }
                         }
                         
                         if(myProp && theirProp) {
                             this.playAction(i); // Sets phase to FORCED_DEAL_SOURCE
                             this.selectMyForcedDealProperty(myProp.colorKey, myProp.cardIndex); // Sets phase to TARGETING
                             this.resolveTargetedAction(theirProp); // Executes
                             played = true; break;
                         }
                    }
                }
                
                if (played) continue;
                
                // If nothing played this loop, stop
                break;
            }
            
            if (this.phase === 'ACTION') {
                this.endTurn();
            }

        }, 1000);
    }
}
