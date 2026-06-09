export interface Thirukural {
    number: number;
    chapter: string;
    tamil: string;
    meaning: string;
}

export const THIRUKURALS: Thirukural[] = [
    // Arivudaimai (Accession of Knowledge)
    {
        number: 423,
        chapter: "Arivudaimai",
        tamil: "எப்பொருள் யார்யார்வாய்க் கேட்பினும் அப்பொருள்\nமெய்ப்பொருள் காண்ப தறிவு.",
        meaning: "To discern the truth in everything, by whomsoever spoken, is wisdom."
    },
    // Vinaithitpam (Firmness of Action)
    {
        number: 666,
        chapter: "Vinaithitpam",
        tamil: "எண்ணிய எண்ணியாங் கெய்துவர் எண்ணியார்\nதிண்ணியர் ஆகப் பெறின்.",
        meaning: "Those who think of doing things with a firm mind will achieve what they thought of."
    },
    // Kaalam Arithal (Knowing the Fitting Time)
    {
        number: 484,
        chapter: "Kaalam Arithal",
        tamil: "ஞாலம் கருதினுங் கைகூடும் காலம்\nகருதி இடத்தாற் செயின்.",
        meaning: "One may conquer the world, if they choose the right time and place for action."
    },
    // Madiyinmai (Unsluggishness / Hard Work)
    {
        number: 611,
        chapter: "Madiyinmai",
        tamil: "மடியிலா மன்னவன் எய்தும் அடியளந்தான்\nதாஅய தெல்லாம் ஒருங்கு.",
        meaning: "The king who never idles will possess the whole world passed by the Lord who measured it."
    },
    {
        number: 619,
        chapter: "Madiyinmai",
        tamil: "தெய்வத்தான் ஆகா தெனினும் முயற்சிதன்\nமெய்வருத்தக் கூலி தரும்.",
        meaning: "Even if fate is against you, your physical effort will pay you the wages of your labor."
    },
    {
        number: 620,
        chapter: "Madiyinmai",
        tamil: "ஊழையும் உப்பக்கம் காண்பர் உலைவின்றித்\nதாழாது உஞற்று பவர்.",
        meaning: "Those who strive with undismayed and unremitting exertion will defeat even fate."
    },
    // Idanarithal (Knowing the Place)
    {
        number: 491,
        chapter: "Idanarithal",
        tamil: "தொடங்கற்க எவ்வினையும் எள்ளற்க முற்றும்\nஇடங்கண்ட பின்அல் லது.",
        meaning: "Begin no action and despise no enemy until you have found the right place for the start."
    },
    // Therindu Seyalvakai (Deliberation before Action)
    {
        number: 467,
        chapter: "Therindu Seyalvakai",
        tamil: "எண்ணித் துணிக கருமம் துணிந்தபின்\nஎண்ணுவம் என்பது இழுக்கு.",
        meaning: "Think before you act; to think after you act is a mistake."
    },
    // Kelvi (Hearing)
    {
        number: 416,
        chapter: "Kelvi",
        tamil: "எனைத்தானும் நல்லவை கேட்க அனைத்தானும்\nஆன்ற பெருமை தரும்.",
        meaning: "Listen to good things, however small; it will yield geatness in equal measure."
    },
    // Alvinaiudaimai (Manly Effort)
    {
        number: 615,
        chapter: "Alvinaiudaimai",
        tamil: "இன்பம் விழையான் இடும்பை இயல்பென்பான்\nதுன்பம் உறுதல் இலன்.",
        meaning: "He who desires not pleasure but accepts trouble as natural, will not be troubled by grief."
    },
    // Solvanmai (Power of Speech)
    {
        number: 642,
        chapter: "Solvanmai",
        tamil: "கேட்டார்ப் பிணிக்கும் தகையவாய்க் கேளாரும்\nவேட்ப மொழிவதாம் சொல்.",
        meaning: "Speech should act like a spell on those who listen, and make even those who don't want to listen, desire to hear."
    },
    // Kalvi (Education)
    {
        number: 391,
        chapter: "Kalvi",
        tamil: "கற்க கசடறக் கற்பவை கற்றபின்\nநிற்க அதற்குத் தக.",
        meaning: "Learn flawlessly what needs to be learned; and after learning, live by it."
    },
    // Ozhukkamudaimai (Possession of Decorum)
    {
        number: 131,
        chapter: "Ozhukkamudaimai",
        tamil: "ஒழுக்கம் விழுப்பந் தரலான் ஒழுக்கம்\nஉயிரினும் ஓம்பப் படும்.",
        meaning: "Decorum gives special excellence; therefore, it should be guarded with more care than life itself."
    },
    // Vaaipmai (Truthfulness)
    {
        number: 291,
        chapter: "Vaaimai",
        tamil: "வாய்மை எனப்படுவது யாதெனின் யாதொன்றும்\nதீமை இலாத சொலல்.",
        meaning: "Truthfulness is speaking that which causes no harm to others."
    },
    // Inna Seyyamai (Not doing Evil)
    {
        number: 317,
        chapter: "Inna Seyyamai",
        tamil: "எனைத்தானும் எஞ்ஞான்றும் யார்க்கும் மனத்தானாம்\nமாணாசெய் யாமை தலை.",
        meaning: "It is the chief of all virtues not to knowingly do any harm to anyone at any time."
    }
];

export const getDailyKural = (): Thirukural => {
    // Use current date to select a Kural
    // This ensures the same Kural is shown for the entire day to all users
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 0);
    const diff = today.getTime() - startOfYear.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);

    // Use modulo to cycle through the list
    const index = dayOfYear % THIRUKURALS.length;

    return THIRUKURALS[index];
};
