// Enum for Card Types
const CardType = {
    PROPERTY: 'property',
    MONEY: 'money',
    ACTION: 'action',
    WILDCARD: 'wildcard',
    RENT: 'rent'
};

// Colors and their set requirements and rent values
const PropertyColors = {
    BROWN: { name: 'بني', colorCode: 'bg-brown', required: 2, rent: [1, 2] },
    DARK_BLUE: { name: 'أزرق غامق', colorCode: 'bg-blue', required: 2, rent: [3, 8] },
    GREEN: { name: 'أخضر', colorCode: 'bg-green', required: 3, rent: [2, 4, 7] },
    YELLOW: { name: 'أصفر', colorCode: 'bg-yellow', required: 3, rent: [2, 4, 6] },
    RED: { name: 'أحمر', colorCode: 'bg-red', required: 3, rent: [2, 3, 6] },
    ORANGE: { name: 'برتقالي', colorCode: 'bg-orange', required: 3, rent: [1, 3, 5] },
    PINK: { name: 'وردي', colorCode: 'bg-pink', required: 3, rent: [1, 2, 4] },
    LIGHT_BLUE: { name: 'أزرق فاتح', colorCode: 'bg-light-blue', required: 3, rent: [1, 2, 3] },
    RAILROAD: { name: 'محطة', colorCode: 'bg-railroad', required: 4, rent: [1, 2, 3, 4] },
    UTILITY: { name: 'شركة', colorCode: 'bg-utility', required: 2, rent: [1, 2] }
};

class Card {
    constructor(id, name, type, value) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.value = value;
    }
}

class PropertyCard extends Card {
    constructor(id, name, value, colorKey) {
        super(id, name, CardType.PROPERTY, value);
        this.colorKey = colorKey;
        this.colorInfo = PropertyColors[colorKey];
    }
}

class WildcardProperty extends Card {
    constructor(id, value, validColors) {
        super(id, 'جوكر عقارات', CardType.WILDCARD, value);
        this.validColors = validColors; // Array of color keys
        this.currentColor = validColors[0]; // Default to first
    }

    setDetails(name) {
        this.name = name || 'جوكر';
    }
}

class MoneyCard extends Card {
    constructor(id, value) {
        super(id, value, CardType.MONEY, value); // Name is just Value for Money
    }
}

class ActionCard extends Card {
    constructor(id, name, value, actionType, description) {
        super(id, name, CardType.ACTION, value);
        this.actionType = actionType;
        this.description = description;
    }
}

class RentCard extends Card {
    constructor(id, value, validColors) {
        super(id, 'خلصني', CardType.RENT, value);
        this.validColors = validColors; // Array of color keys
    }
}

// Deck Factory
class DeckFactory {
    static createDeck() {
        let deck = [];
        let idCounter = 1;

        // --- Money Cards ---
        // 1M x 6, 2M x 5, 3M x 3, 4M x 3, 5M x 2, 10M x 1
        const moneyCounts = { 1: 6, 2: 5, 3: 3, 4: 3, 5: 2, 10: 1 };
        for (let val in moneyCounts) {
            for (let i = 0; i < moneyCounts[val]; i++) {
                deck.push(new MoneyCard(idCounter++, parseInt(val)));
            }
        }

        // --- Property Cards ---
        // Helper to add properties
        const addProps = (colorKey, count, value, names) => {
            for (let i = 0; i < count; i++) {
                deck.push(new PropertyCard(idCounter++, names[i] || PropertyColors[colorKey].name, value, colorKey));
            }
        };

        addProps('BROWN', 2, 1, ['حي القصبة', 'باب الواد']);
        addProps('DARK_BLUE', 2, 4, ['حيدرة', 'المرادية']);
        addProps('GREEN', 3, 4, ['الأبيار', 'بن عكنون', 'الشراقة']);
        addProps('YELLOW', 3, 3, ['ساحة الشهداء', 'الحراش', 'بلكور']); 
        addProps('RED', 3, 3, ['وهران (الباهية)', 'قسنطينة (الجسور)', 'عنابة (بونة)']);
        addProps('ORANGE', 3, 2, ['سطيف', 'باتنة', 'بجاية']);
        addProps('PINK', 3, 2, ['تلمسان', 'مستغانم', 'سيدي بلعباس']);
        addProps('LIGHT_BLUE', 3, 1, ['غرداية', 'بسكرة', 'الوادي']);
        addProps('RAILROAD', 4, 2, ['محطة آغا', 'محطة الخروبة', 'مطار هواري بومدين', 'ميناء الجزائر']);
        addProps('UTILITY', 2, 2, ['سونلغاز', 'سيال']);

        // --- Wildcards ---
        // 2x Multi-color (all), 11x Dual color
        
        // 2 Multicolor
        let wildAll1 = new WildcardProperty(idCounter++, 0, Object.keys(PropertyColors));
        wildAll1.setDetails('جوكر شامل');
        let wildAll2 = new WildcardProperty(idCounter++, 0, Object.keys(PropertyColors));
        wildAll2.setDetails('جوكر شامل');
        deck.push(wildAll1, wildAll2);

        // Dual Colors (Simplified distribution)
        // Brown/Light Blue (1)
        deck.push(new WildcardProperty(idCounter++, 1, ['BROWN', 'LIGHT_BLUE']));
        // Pink/Orange (2)
        deck.push(new WildcardProperty(idCounter++, 2, ['PINK', 'ORANGE']));
        deck.push(new WildcardProperty(idCounter++, 2, ['PINK', 'ORANGE']));
        // Green/Railroad (1)
        deck.push(new WildcardProperty(idCounter++, 4, ['GREEN', 'RAILROAD']));
        // Blue/Green (1)
        deck.push(new WildcardProperty(idCounter++, 4, ['DARK_BLUE', 'GREEN']));
        // Light Blue/Brown (1) - already added one way?
        // Utility/Railroad (1)
        deck.push(new WildcardProperty(idCounter++, 2, ['UTILITY', 'RAILROAD']));
        // Yellow/Red (2)
        deck.push(new WildcardProperty(idCounter++, 3, ['YELLOW', 'RED']));
        deck.push(new WildcardProperty(idCounter++, 3, ['YELLOW', 'RED']));

        // --- Action Cards ---
        // Deal Breaker (2) - 5M
        deck.push(new ActionCard(idCounter++, 'السطو', 5, 'DEAL_BREAKER', 'اسرق مجموعة كاملة من الخصم'));
        deck.push(new ActionCard(idCounter++, 'السطو', 5, 'DEAL_BREAKER', 'اسرق مجموعة كاملة من الخصم'));

        // Just Say No (3) - 4M
        deck.push(new ActionCard(idCounter++, 'لا لا!', 4, 'JUST_SAY_NO', 'إلغاء حركة الخصم ضدك'));
        deck.push(new ActionCard(idCounter++, 'لا لا!', 4, 'JUST_SAY_NO', 'إلغاء حركة الخصم ضدك'));
        deck.push(new ActionCard(idCounter++, 'لا لا!', 4, 'JUST_SAY_NO', 'إلغاء حركة الخصم ضدك'));

        // Sly Deal (3) - 3M
        deck.push(new ActionCard(idCounter++, 'خفة يد', 3, 'SLY_DEAL', 'اسرق بطاقة عقار واحدة من الخصم'));
        deck.push(new ActionCard(idCounter++, 'خفة يد', 3, 'SLY_DEAL', 'اسرق بطاقة عقار واحدة من الخصم'));
        deck.push(new ActionCard(idCounter++, 'خفة يد', 3, 'SLY_DEAL', 'اسرق بطاقة عقار واحدة من الخصم'));

        // Forced Deal (3) - 3M
        deck.push(new ActionCard(idCounter++, 'بدلني', 3, 'FORCED_DEAL', 'بادل بطاقة عقار مع الخصم'));
        deck.push(new ActionCard(idCounter++, 'بدلني', 3, 'FORCED_DEAL', 'بادل بطاقة عقار مع الخصم'));
        deck.push(new ActionCard(idCounter++, 'بدلني', 3, 'FORCED_DEAL', 'بادل بطاقة عقار مع الخصم'));

        // Debt Collector (3) - 3M
        deck.push(new ActionCard(idCounter++, 'قاع يخلصوا', 3, 'DEBT_COLLECTOR', 'اطلب 5 مليون من كل لاعب'));
        deck.push(new ActionCard(idCounter++, 'قاع يخلصوا', 3, 'DEBT_COLLECTOR', 'اطلب 5 مليون من كل لاعب'));
        deck.push(new ActionCard(idCounter++, 'قاع يخلصوا', 3, 'DEBT_COLLECTOR', 'اطلب 5 مليون من كل لاعب'));

        // It's My Birthday (3) - 2M
        deck.push(new ActionCard(idCounter++, 'عيد ميلادي', 2, 'BIRTHDAY', 'اطلب 2 مليون من كل لاعب'));
        deck.push(new ActionCard(idCounter++, 'عيد ميلادي', 2, 'BIRTHDAY', 'اطلب 2 مليون من كل لاعب'));
        deck.push(new ActionCard(idCounter++, 'عيد ميلادي', 2, 'BIRTHDAY', 'اطلب 2 مليون من كل لاعب'));

        // Pass Go (10) - 1M
        for(let i=0; i<10; i++) {
            deck.push(new ActionCard(idCounter++, 'هات الدالة', 1, 'PASS_GO', 'اسحب بطاقتين'));
        }

        // House (3) - 3M
        deck.push(new ActionCard(idCounter++, 'دار', 3, 'HOUSE', 'أضف 3 مليون للإيجار'));
        deck.push(new ActionCard(idCounter++, 'دار', 3, 'HOUSE', 'أضف 3 مليون للإيجار'));
        deck.push(new ActionCard(idCounter++, 'دار', 3, 'HOUSE', 'أضف 3 مليون للإيجار'));

        // Hotel (2) - 4M
        deck.push(new ActionCard(idCounter++, 'أوتيل', 4, 'HOTEL', 'أضف 4 مليون للإيجار'));
        deck.push(new ActionCard(idCounter++, 'أوتيل', 4, 'HOTEL', 'أضف 4 مليون للإيجار'));

        // Double Rent (2) - 1M
        deck.push(new ActionCard(idCounter++, 'إيجار مضاعف', 1, 'DOUBLE_RENT', 'ضاعف قيمة الإيجار'));
        deck.push(new ActionCard(idCounter++, 'إيجار مضاعف', 1, 'DOUBLE_RENT', 'ضاعف قيمة الإيجار'));

        // --- Rent Cards ---
        // 2x Wild Rent (All colors) - 3M
        deck.push(new RentCard(idCounter++, 3, Object.keys(PropertyColors)));
        deck.push(new RentCard(idCounter++, 3, Object.keys(PropertyColors)));
        
        // Dual Color Rents (Simplified)
        deck.push(new RentCard(idCounter++, 1, ['BROWN', 'LIGHT_BLUE']));
        deck.push(new RentCard(idCounter++, 1, ['BROWN', 'LIGHT_BLUE']));
        deck.push(new RentCard(idCounter++, 1, ['PINK', 'ORANGE']));
        deck.push(new RentCard(idCounter++, 1, ['PINK', 'ORANGE']));
        deck.push(new RentCard(idCounter++, 1, ['GREEN', 'DARK_BLUE']));
        deck.push(new RentCard(idCounter++, 1, ['GREEN', 'DARK_BLUE']));
        deck.push(new RentCard(idCounter++, 1, ['YELLOW', 'RED']));
        deck.push(new RentCard(idCounter++, 1, ['YELLOW', 'RED']));
        deck.push(new RentCard(idCounter++, 1, ['UTILITY', 'RAILROAD']));
        deck.push(new RentCard(idCounter++, 1, ['UTILITY', 'RAILROAD']));

        return DeckFactory.shuffle(deck);
    }

    static shuffle(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }
}
