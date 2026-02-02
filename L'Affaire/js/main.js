const game = new Game();

// UI References
const els = {
    turnIndicator: document.getElementById('turn-indicator'),
    currentPlayerName: document.getElementById('current-player-name'),
    phaseIndicator: document.getElementById('current-phase'),
    deckCount: document.getElementById('cards-left'),
    
    aiBankTotal: document.getElementById('ai-bank-total'),
    aiField: document.getElementById('ai-field'),
    aiBank: document.getElementById('ai-bank'),
    aiHand: document.getElementById('ai-hand'),

    playerBankTotal: document.getElementById('player-bank-total'),
    playerField: document.getElementById('player-field'),
    playerBank: document.getElementById('player-bank'),
    playerHand: document.getElementById('player-hand'),
    movesDisplay: document.getElementById('moves-display'),

    endTurnBtn: document.getElementById('end-turn-btn'),
    confirmPaymentBtn: document.getElementById('confirm-payment-btn'),
    declineBtn: document.getElementById('decline-btn'),
    actionLog: document.getElementById('action-log'),
    
    playerArea: document.getElementById('player-area'),
    opponentArea: document.getElementById('opponent-area'),
    toastContainer: document.getElementById('toast-container')
};

// State for UI interactions
let selectedForPayment = []; // Array of {source, index, color, value}

// Toast Function
function showToast(message) {
    if (!els.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    els.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'scale(0.8)';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// Override Log to use Toasts for important messages
const originalLog = log;
window.log = (msg, isImportant = false) => {
    const entry = document.createElement('div');
    entry.textContent = msg;
    entry.className = 'log-entry';
    els.actionLog.appendChild(entry);
    els.actionLog.scrollTop = els.actionLog.scrollHeight;
    
    // Auto-detect importance or use flag
    if (isImportant || msg.includes('!')) {
        showToast(msg);
    }
};

// Override Game.updateUI
game.updateUI = () => {
    renderGameState();
};

function renderGameState() {
    const p1 = game.players[0]; // Human
    const p2 = game.players[1]; // AI

    // Status
    els.currentPlayerName.textContent = game.getCurrentPlayer().name;
    els.phaseIndicator.textContent = getPhaseText(game.phase);
    els.deckCount.textContent = game.deck.length;
    
    // Moves Render (Visual)
    els.movesDisplay.innerHTML = '';
    for(let i=0; i<3; i++) {
        const dot = document.createElement('div');
        dot.className = 'move-dot';
        if (i < p1.movesLeft) {
            dot.classList.add('active');
        }
        els.movesDisplay.appendChild(dot);
    }
    
    // Active Turn Glow
    if (game.currentPlayerIndex === 0) {
        els.playerArea.classList.add('active-turn');
        els.opponentArea.classList.remove('active-turn');
    } else {
        els.playerArea.classList.remove('active-turn');
        els.opponentArea.classList.add('active-turn');
    }

    // AI Render
    els.aiBankTotal.textContent = p2.getBankTotal();
    renderHand(p2, els.aiHand, true);
    renderField(p2, els.aiField, false); // No interaction with AI field yet (unless stealing)
    renderBank(p2, els.aiBank, false);

    // Player Render
    els.playerBankTotal.textContent = p1.getBankTotal();
    renderHand(p1, els.playerHand, false);
    renderField(p1, els.playerField, true);
    renderBank(p1, els.playerBank, true);

    // Controls
    els.endTurnBtn.disabled = !(game.currentPlayerIndex === 0 && game.phase === 'ACTION');
    
    // Reset Buttons Default State
    els.confirmPaymentBtn.style.display = 'none';
    els.declineBtn.style.display = 'none';
    els.endTurnBtn.style.display = 'inline-block';

    // Payment UI
    if (game.phase === 'PAYMENT') {
        if (game.paymentRequest.debtorIndex === 0) {
            // Human needs to pay
            els.confirmPaymentBtn.style.display = 'inline-block';
            els.endTurnBtn.style.display = 'none';
            els.confirmPaymentBtn.style.backgroundColor = '#e74c3c';
            
            const totalSelected = selectedForPayment.reduce((sum, item) => sum + item.value, 0);
            els.confirmPaymentBtn.textContent = `دفع ${totalSelected}M / مطلوب ${game.paymentRequest.amount}M`;
            els.confirmPaymentBtn.onclick = () => {
                 game.resolvePayment(selectedForPayment);
                 selectedForPayment = [];
            };
            
            log(`مطلوب منك دفع ${game.paymentRequest.amount} مليون! اختر من البنك أو العقارات.`);
        } else {
            // AI is paying (waiting)
            els.endTurnBtn.disabled = true;
            log('الخصم يقوم بالدفع...');
        }
    } else if (game.phase === 'TARGETING') {
        els.declineBtn.style.display = 'inline-block';
        els.declineBtn.textContent = 'إلغاء الاستهداف';
        els.declineBtn.onclick = () => game.cancelTargeting();
        
        els.endTurnBtn.style.display = 'none';
        log('اختر عقاراً من الخصم لسرقته!');
    } else if (game.phase === 'FORCED_DEAL_SOURCE') {
        els.declineBtn.style.display = 'inline-block';
        els.declineBtn.textContent = 'إلغاء';
        els.declineBtn.onclick = () => game.cancelTargeting();
        
        els.endTurnBtn.style.display = 'none';
        log('اختر أحد عقاراتك للمبادلة.');
    } else if (game.phase === 'COUNTER_OPPORTUNITY') {
        els.endTurnBtn.style.display = 'none';
        
        if (game.counterRequest && game.counterRequest.victimIndex === 0) {
             // Human is being attacked
             log(game.counterRequest.message || 'هل تريد استخدام بطاقة "لا لا!" لإلغاء الحركة؟');
             
             // Check if has card
             const hasJustSayNo = p1.hand.some(c => c.actionType === 'JUST_SAY_NO');
             
             if (hasJustSayNo) {
                 els.confirmPaymentBtn.style.display = 'inline-block';
                 els.confirmPaymentBtn.textContent = 'استخدام "لا لا!"';
                 els.confirmPaymentBtn.style.backgroundColor = '#3498db'; // Blue
                 els.confirmPaymentBtn.onclick = () => game.resolveCounter(true);
             } else {
                 log('ليس لديك بطاقة "لا لا!".');
             }

             els.declineBtn.style.display = 'inline-block';
             els.declineBtn.textContent = 'قبول الحركة'; // Accept Fate
             els.declineBtn.onclick = () => game.resolveCounter(false);

        } else {
            // AI is thinking about countering
            els.endTurnBtn.disabled = true;
            log('الخصم يفكر في استخدام "لا!"...');
        }
    } else if (game.phase === 'DRAW') {
        els.endTurnBtn.style.display = 'none';
        log('انقر على مجموعة البطاقات لسحب أوراقك!');
    } else {
        selectedForPayment = []; // Reset selection
    }

    if (game.phase === 'DISCARD' && game.currentPlayerIndex === 0) {
        log('يجب عليك رمي البطاقات الزائدة!');
    }
}

function getPhaseText(phase) {
    switch(phase) {
        case 'START': return 'بداية الدور';
        case 'DRAW': return 'سحب بطاقات';
        case 'ACTION': return 'مرحلة اللعب';
        case 'DISCARD': return 'رمي البطاقات';
        case 'PAYMENT': return 'دفع الديون';
        case 'TARGETING': return 'اختيار الهدف';
        case 'COUNTER_OPPORTUNITY': return 'فرصة الرد';
        case 'GAME_OVER': return 'نهاية اللعبة';
        default: return phase;
    }
}

function renderHand(player, container, isHidden) {
    container.innerHTML = '';
    player.hand.forEach((card, index) => {
        const cardEl = createCardElement(card);
        if (isHidden) {
            cardEl.innerHTML = '<div class="card-back"></div>';
            cardEl.className += ' card-back-style';
        } else {
            // Click Event for Human
            cardEl.onclick = () => handleHandCardClick(index, card);
            
            // Hover Effects for Zone Guidance
            cardEl.onmouseenter = () => highlightValidZones(card);
            cardEl.onmouseleave = () => clearZoneHighlights();
        }
        container.appendChild(cardEl);
    });
}

function highlightValidZones(card) {
    if (game.currentPlayerIndex !== 0 || game.phase !== 'ACTION') return;

    // Money -> Bank
    if (card.type === CardType.MONEY) {
        if (els.playerBank.parentElement) els.playerBank.parentElement.classList.add('zone-highlight');
    } 
    // Property -> Field
    else if (card.type === CardType.PROPERTY) {
        if (els.playerField.parentElement) els.playerField.parentElement.classList.add('zone-highlight');
    } 
    // Wildcard -> Field
    else if (card.type === CardType.WILDCARD) {
        if (els.playerField.parentElement) els.playerField.parentElement.classList.add('zone-highlight');
    }
    // Rent -> Center (Action) or Bank
    else if (card.type === CardType.RENT) {
        if (els.playerBank.parentElement) els.playerBank.parentElement.classList.add('zone-highlight');
        // Rent usually targets center/opponent, but visually we can highlight the field to imply "affects properties"
        // or just the center area if we had a clear "Play Area" zone.
        // For now, let's highlight Bank (as money) and Field (as it relies on properties)
        if (els.playerField.parentElement) els.playerField.parentElement.classList.add('zone-highlight');
    }
    // Action -> Center or Bank
    else if (card.type === CardType.ACTION) {
        if (els.playerBank.parentElement) els.playerBank.parentElement.classList.add('zone-highlight');
        // Action targets center usually
        const centerZone = document.getElementById('center-area');
        if (centerZone) centerZone.classList.add('zone-highlight');
    }
}

function clearZoneHighlights() {
    document.querySelectorAll('.zone-highlight').forEach(el => el.classList.remove('zone-highlight'));
}

function renderField(player, container, isInteractive) {
    container.innerHTML = '';
    // Group by color
    for (let colorKey in player.field) {
        const set = player.field[colorKey];
        if (set.length === 0) continue;

        const setDiv = document.createElement('div');
        setDiv.className = 'property-set';
        
        set.forEach((card, index) => {
            const cardEl = createCardElement(card);
            
            // Payment Selection Visuals
            if (isInteractive && game.phase === 'PAYMENT' && game.paymentRequest.debtorIndex === 0) {
                const isSelected = selectedForPayment.some(i => i.source === 'field' && i.color === colorKey && i.index === index);
                if (isSelected) {
                    cardEl.classList.add('selected');
                }
                cardEl.onclick = () => togglePaymentSelection('field', index, card, colorKey);
            }

            // Wildcard Rearranging (Owner Only, Action Phase)
            if (isInteractive && game.phase === 'ACTION' && card.type === CardType.WILDCARD) {
                cardEl.style.cursor = 'pointer';
                cardEl.title = 'انقر لتغيير اللون';
                cardEl.onclick = () => {
                    const options = card.validColors.map(c => PropertyColors[c].name).join(', ');
                    const choiceName = prompt(`تغيير لون الجوكر؟ الألوان المتاحة: ${options}`);
                    if (!choiceName) return;
                    
                    const foundColor = card.validColors.find(c => PropertyColors[c].name === choiceName || PropertyColors[c].name.includes(choiceName));
                    if (foundColor) {
                        game.switchPropertyColor(colorKey, index, foundColor);
                    } else {
                        alert('لون غير صحيح لهذه البطاقة.');
                    }
                };
            }

            // Forced Deal Source Selection (Owner Only)
            if (isInteractive && game.phase === 'FORCED_DEAL_SOURCE' && game.currentPlayerIndex === 0) {
                cardEl.style.cursor = 'pointer';
                cardEl.classList.add('selectable'); // Add visual cue if CSS supports it
                cardEl.onclick = () => {
                     game.selectMyForcedDealProperty(colorKey, index);
                };
            }

            // Targeting Visuals (Stealing from Opponent)
            // If it's Targeting phase and this field belongs to the target (not current player)
            const isOpponent = player !== game.getCurrentPlayer();
            if (game.phase === 'TARGETING' && isOpponent) {
                 cardEl.style.cursor = 'crosshair';
                 cardEl.onclick = () => {
                     // Confirm
                     if (confirm(`هل أنت متأكد من استهداف ${card.name}؟`)) {
                         game.resolveTargetedAction({
                             playerIndex: game.players.indexOf(player),
                             colorKey: colorKey,
                             cardIndex: index
                         });
                     }
                 };
            }

            setDiv.appendChild(cardEl);
        });

        container.appendChild(setDiv);
    }
}

function renderBank(player, container, isInteractive) {
    container.innerHTML = '';
    player.bank.forEach((card, index) => {
        const cardEl = createCardElement(card);
        
        // Payment Selection Visuals
        if (isInteractive && game.phase === 'PAYMENT' && game.paymentRequest.debtorIndex === 0) {
            const isSelected = selectedForPayment.some(i => i.source === 'bank' && i.index === index);
            if (isSelected) {
                cardEl.classList.add('selected');
            }
            cardEl.onclick = () => togglePaymentSelection('bank', index, card);
        }

        container.appendChild(cardEl);
    });
}

function createCardElement(card) {
    const el = document.createElement('div');
    el.className = 'card';
    
    // Add Inspector Events to wrapper
    el.addEventListener('mouseenter', () => showCardInspector(card));
    el.addEventListener('mouseleave', () => hideCardInspector());
    
    if (card.type === CardType.PROPERTY) {
        // --- New Property Card Design ---
        el.classList.add('card-property');
        
        // 1. Header Section (Identity)
        const header = document.createElement('div');
        header.className = `prop-header ${card.colorInfo.colorCode}`;
        
        const valCircle = document.createElement('div');
        valCircle.className = 'prop-value-circle';
        valCircle.textContent = card.value + 'M';
        
        const name = document.createElement('div');
        name.className = 'prop-name';
        name.textContent = card.name;
        
        header.appendChild(valCircle);
        header.appendChild(name);
        el.appendChild(header);

        // 2. Central Section (Rent Logic)
        const body = document.createElement('div');
        body.className = 'prop-body';
        
        const rentTitle = document.createElement('div');
        rentTitle.className = 'rent-header';
        rentTitle.textContent = 'قيمة الإيجار';
        body.appendChild(rentTitle);

        const rentTable = document.createElement('div');
        rentTable.className = 'rent-table';
        
        card.colorInfo.rent.forEach((amount, index) => {
            const row = document.createElement('div');
            row.className = 'rent-row';
            // Mark row ID for highlighting later (optional, handled by renderField usually)
            row.dataset.count = index + 1; 

            // Icons (1 card, 2 cards...)
            const iconGroup = document.createElement('div');
            iconGroup.className = 'card-icon-group';
            for(let i=0; i<=index; i++) {
                const icon = document.createElement('div');
                icon.className = 'card-icon-mini';
                iconGroup.appendChild(icon);
            }
            
            const price = document.createElement('div');
            price.className = 'rent-price';
            price.textContent = amount + 'M';
            
            row.appendChild(iconGroup);
            row.appendChild(price);
            rentTable.appendChild(row);
        });
        body.appendChild(rentTable);
        el.appendChild(body);

        // 3. Footer Section (Game Logic)
        const footer = document.createElement('div');
        footer.className = 'prop-footer';
        footer.textContent = `تكتمل المجموعة بـ :${card.colorInfo.required}`;
        el.appendChild(footer);

        // Inspector Logic (Removed from here, added to top of function)
    /*
    el.addEventListener('mouseenter', (e) => {
        // Only inspect if not dragging (future)
        showCardInspector(card);
    });

    el.addEventListener('mouseleave', () => {
        hideCardInspector();
    });
    */

    return el;

} else if (card.type === CardType.MONEY) {
        // --- Money Card Design ---
        el.classList.add('card-money'); // Keep generic class for selection logic if any
        
        // Header
        const header = document.createElement('div');
        header.className = 'card-header-std bg-money-green';
        
        const valCircle = document.createElement('div');
        valCircle.className = 'card-val-circle';
        valCircle.textContent = card.value + 'M';
        
        const title = document.createElement('div');
        title.className = 'card-title';
        title.textContent = 'مال';
        
        header.appendChild(valCircle);
        header.appendChild(title);
        el.appendChild(header);

        // Body
        const body = document.createElement('div');
        body.className = 'card-body-std money-body-content';
        
        const bigValue = document.createElement('div');
        bigValue.className = 'money-big-value';
        bigValue.textContent = card.value + 'M';
        
        body.appendChild(bigValue);
        el.appendChild(body);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'card-footer-std';
        footer.textContent = 'بنك';
        el.appendChild(footer);

    } else if (card.type === CardType.ACTION) {
        // --- Action Card Design ---
        el.classList.add('card-action');
        
        // Header
        const header = document.createElement('div');
        header.className = 'card-header-std bg-action-red';
        
        const valCircle = document.createElement('div');
        valCircle.className = 'card-val-circle';
        valCircle.textContent = card.value + 'M';
        
        const title = document.createElement('div');
        title.className = 'card-title';
        title.textContent = card.name;
        
        header.appendChild(valCircle);
        header.appendChild(title);
        el.appendChild(header);

        // Body
        const body = document.createElement('div');
        body.className = 'card-body-std action-body-content';
        
        const desc = document.createElement('div');
        desc.className = 'action-desc';
        desc.textContent = card.description;
        
        body.appendChild(desc);
        el.appendChild(body);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'card-footer-std';
        footer.textContent = 'بطاقة حركة';
        el.appendChild(footer);

    } else if (card.type === CardType.RENT) {
        // --- Rent Card Design ---
        el.classList.add('card-rent');
        
        // Header
        const header = document.createElement('div');
        header.className = 'card-header-std bg-rent-purple';
        
        const valCircle = document.createElement('div');
        valCircle.className = 'card-val-circle';
        valCircle.textContent = card.value + 'M';
        
        const title = document.createElement('div');
        title.className = 'card-title';
        title.textContent = 'خلصني (إيجار)';
        
        header.appendChild(valCircle);
        header.appendChild(title);
        el.appendChild(header);

        // Body
        const body = document.createElement('div');
        body.className = 'card-body-std rent-body-content';
        
        const subTitle = document.createElement('div');
        subTitle.className = 'rent-subtitle';
        subTitle.textContent = 'صالح للألوان:';
        body.appendChild(subTitle);

        const colorsRow = document.createElement('div');
        colorsRow.className = 'rent-colors-row';
        
        if (card.validColors) {
            card.validColors.forEach(c => {
                const dot = document.createElement('div');
                if (PropertyColors[c]) {
                    dot.className = `rent-color-dot ${PropertyColors[c].colorCode}`;
                }
                colorsRow.appendChild(dot);
            });
        }
        body.appendChild(colorsRow);
        el.appendChild(body);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'card-footer-std';
        footer.textContent = 'بطاقة إيجار';
        el.appendChild(footer);

    } else if (card.type === CardType.WILDCARD) {
        // --- Wildcard Design ---
        el.classList.add('card-wild');
        
        // Header
        const header = document.createElement('div');
        header.className = 'card-header-std bg-wild-gradient';
        
        const valCircle = document.createElement('div');
        valCircle.className = 'card-val-circle';
        valCircle.textContent = card.value + 'M';
        
        const title = document.createElement('div');
        title.className = 'card-title';
        title.textContent = 'جوكر';
        
        header.appendChild(valCircle);
        header.appendChild(title);
        el.appendChild(header);

        // Body
        const body = document.createElement('div');
        body.className = 'card-body-std wild-body-content';
        
        const subTitle = document.createElement('div');
        subTitle.className = 'wild-subtitle';
        subTitle.textContent = 'يغير اللون إلى:';
        body.appendChild(subTitle);

        const colorsRow = document.createElement('div');
        colorsRow.className = 'wild-colors-row';
        
        if (card.validColors) {
            card.validColors.forEach(c => {
                if (PropertyColors[c]) {
                    const bar = document.createElement('div');
                    bar.className = `wild-color-bar ${PropertyColors[c].colorCode}`;
                    bar.textContent = PropertyColors[c].name;
                    colorsRow.appendChild(bar);
                }
            });
        }
        body.appendChild(colorsRow);
        el.appendChild(body);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'card-footer-std';
        footer.textContent = 'عقار متغير';
        el.appendChild(footer);
    }

    return el;
}

function handleHandCardClick(index, card) {
    if (game.currentPlayerIndex !== 0) return; // Not human turn

    if (game.phase === 'DISCARD') {
        game.discardExcessCard(index);
        return;
    }

    if (game.phase !== 'ACTION') return;

    if (card.type === CardType.PROPERTY || card.type === CardType.WILDCARD) {
        game.playPropertyToField(index);
    } else if (card.type === CardType.MONEY) {
        game.playCardToBank(index);
    } else if (card.type === CardType.RENT) {
        // Prompt for Rent Target Color
        // For simple rent, we need to know WHICH property color to charge for.
        // If card has multiple valid colors, we check which ones the player actually has.
        const validOwnedColors = card.validColors.filter(c => game.players[0].field[c] && game.players[0].field[c].length > 0);
        
        if (validOwnedColors.length === 0) {
            alert('لا يمكنك استخدام بطاقة الإيجار هذه لأنك لا تملك عقارات مطابقة.');
            return;
        }

        let chosenColor = validOwnedColors[0];
        if (validOwnedColors.length > 1) {
            // Simple prompt
            // In a real app, use a modal.
            // Map colors to names
            const options = validOwnedColors.map(c => PropertyColors[c].name).join(', ');
            const choiceName = prompt(`اختر لون الإيجار: ${options}`);
            // Find key by name (fuzzy) or just iterate
            const found = validOwnedColors.find(c => PropertyColors[c].name === choiceName);
            if (found) chosenColor = found;
            else if (choiceName) {
                 // Try loose match
                 chosenColor = validOwnedColors.find(c => PropertyColors[c].name.includes(choiceName)) || chosenColor;
            }
        }
        
        game.playRent(index, chosenColor);

    } else {
        // Action
        // Check if it's a "Playable to Bank" card (Action cards can go to bank)
        const choice = confirm(`هل تريد لعب "${card.name}" كحركة (OK) أم وضعها في البنك كمال (Cancel)؟`);
        if (choice) {
            game.playAction(index); 
        } else {
            game.playCardToBank(index);
        }
    }
}

function togglePaymentSelection(source, index, card, colorKey = null) {
    // Check if already selected
    const existingIndex = selectedForPayment.findIndex(i => i.source === source && i.index === index && i.color === colorKey);
    
    if (existingIndex >= 0) {
        selectedForPayment.splice(existingIndex, 1);
    } else {
        selectedForPayment.push({ source, index, card, color: colorKey, value: card.value });
    }
    renderGameState();
}

function log(msg) {
    const div = document.createElement('div');
    div.textContent = msg;
    els.actionLog.prepend(div);
}

// Controls
els.endTurnBtn.addEventListener('click', () => {
    game.endTurn();
});

els.confirmPaymentBtn.addEventListener('click', () => {
    game.resolvePayment(selectedForPayment);
    selectedForPayment = [];
});

// Deck Click Listener
document.getElementById('deck').addEventListener('click', () => {
    if (game.phase === 'DRAW' && game.currentPlayerIndex === 0) {
        game.performDraw();
    }
});

// Toggle Log Listener
const toggleLogBtn = document.getElementById('toggle-log-btn');
const actionLogContainer = document.getElementById('action-log-container');

if (toggleLogBtn && actionLogContainer) {
    toggleLogBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent clicking through to something else if needed
        actionLogContainer.classList.toggle('collapsed');
        toggleLogBtn.textContent = actionLogContainer.classList.contains('collapsed') ? '+' : '−';
    });
}

// --- Inspector Functions ---
function showCardInspector(card) {
    const content = document.getElementById('inspector-content');
    if (!content) return;
    
    // Clear previous
    content.innerHTML = '';
    
    // Create a new visual element for the card
    // We can reuse createCardElement but remove the hover listeners to avoid recursion loop (though it calls showCardInspector again, which is fine if we don't attach listener to clone)
    // Actually createCardElement attaches listeners. We need a clean version or clone.
    // Easier: Create it, then cloneNode(true) to strip listeners? No, cloneNode keeps inline listeners but not addEventListener ones usually.
    // Let's try creating it and appending. The listeners on the preview card won't matter much as mouse is over the source card.
    
    const previewCard = createCardElement(card);
    
    // Remove "selected" or other state classes if copied? createCardElement creates fresh.
    // We might want to remove the 'mouseenter' listener to be safe, but we can't easily remove anonymous functions.
    // However, since the preview card is in a pointer-events: none container (mostly), it shouldn't trigger itself.
    // Wait, #card-inspector has pointer-events: none. So mouse won't interact with it. Safe.
    
    content.appendChild(previewCard);
}

function hideCardInspector() {
    const content = document.getElementById('inspector-content');
    if (!content) return;
    
    // Optional: Delay hiding or keep last card? 
    // User said "instantly appears".
    content.innerHTML = '<div class="inspector-placeholder">مرر الفأرة فوق أي بطاقة للمعاينة</div>';
}

// Start
game.start();
