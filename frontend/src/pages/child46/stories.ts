import type { Language } from '../../lib/types'

type L = Record<Language, string>
export interface Choice { l: L; to: string; emoji: string }
export interface Node { t: L; next?: string; choices?: Choice[]; end?: boolean }
export interface Story { id: string; title: L; emoji: string; tint: string; blurb: L; start: string; nodes: Record<string, Node>; bedtime?: boolean }

/** Short, hand-written bedtime stories. Telugu and Hinglish versions were written for this app and have
 *  not been checked by a native-speaker reviewer yet — see README "Known limitations". */
export const STORIES: Story[] = [
  {
    id: 'moon', emoji: '🌙', tint: '#E4DAF5', bedtime: true, start: 'p1',
    title: { English: 'The Sleepy Moon', Telugu: 'నిద్రపోతున్న చంద్రుడు', Hinglish: 'Neendi Chaand' },
    blurb: { English: 'A quiet goodnight story', Telugu: 'ప్రశాంతమైన శుభరాత్రి కథ', Hinglish: 'Ek shaant good-night kahani' },
    nodes: {
      p1: { next: 'p2', t: { English: 'The Moon was very sleepy tonight. She yawned a big, slow yawn over the quiet hills.', Telugu: 'ఈ రాత్రి చంద్రుడికి చాలా నిద్ర వస్తోంది. నిశ్శబ్దమైన కొండల మీద చంద్రుడు మెల్లగా ఆవలించాడు.', Hinglish: 'Aaj raat Chaand ko bahut neend aa rahi thi. Shaant pahaadiyon ke upar usne dheere se jamhai li.' } },
      p2: { next: 'p3', t: { English: "Mallow the bunny looked up and whispered, 'Good night, Moon.' The stars blinked softly, one by one.", Telugu: "మల్లో కుందేలు పైకి చూసి, 'శుభరాత్రి చంద్రుడా' అని మెల్లగా అంది. నక్షత్రాలు ఒక్కొక్కటిగా మిణుకుమన్నాయి.", Hinglish: "Mallow bunny ne upar dekha aur dheere se kaha, 'Good night, Chaand.' Taare ek ek karke halke se chamke." } },
      p3: { next: 'p4', t: { English: 'A cool breeze rocked the flowers, and the little birds tucked their heads under their wings.', Telugu: 'చల్లని గాలి పూలను ఊపింది. చిన్న పక్షులు రెక్కల కింద తల దాచుకున్నాయి.', Hinglish: 'Thandi hawa ne phoolon ko jhulaya, aur chhoti chidiyaon ne apne par ke neeche sar chhupa liya.' } },
      p4: { end: true, t: { English: 'Mallow snuggled into the soft grass, closed their eyes, and fell asleep. Sweet dreams, little one. The end.', Telugu: 'మల్లో మెత్తని గడ్డిలో ముడుచుకుని, కళ్ళు మూసుకుని నిద్రపోయింది. మంచి కలలు రావాలి, చిన్నారీ. కథ ముగిసింది.', Hinglish: 'Mallow narm ghaas mein sikud gaya, aankhein band kin aur so gaya. Sweet dreams, chhotu. Kahani khatam.' } },
    },
  },
  {
    id: 'lantern', emoji: '🏮', tint: '#FFDCC4', start: 's1',
    title: { English: 'The Little Lantern', Telugu: 'చిన్న లాంతరు', Hinglish: 'Chhoti Lantern' },
    blurb: { English: 'You choose what happens next', Telugu: 'తర్వాత ఏమి జరగాలో నువ్వే ఎంచుకో', Hinglish: 'Aage kya hoga, tum chuno' },
    nodes: {
      s1: { next: 's2', t: { English: 'Mallow found a tiny lantern glowing softly under a mushroom. It was warm, like a little sleepy sun.', Telugu: 'మల్లో ఒక పుట్టగొడుగు కింద మెల్లగా మెరుస్తున్న చిన్న లాంతరును చూసింది. అది చిన్న నిద్రపోతున్న సూర్యుడిలా వెచ్చగా ఉంది.', Hinglish: 'Mallow ko ek mushroom ke neeche halki si chamakti hui chhoti lantern mili. Wo garam thi, jaise ek chhota sa neendi suraj.' } },
      s2: {
        t: { English: "'Where do you belong?' asked Mallow. The lantern flickered toward two paths. Which one should Mallow take?", Telugu: "'నువ్వు ఎక్కడికి చెందినదానివి?' అని మల్లో అడిగింది. లాంతరు రెండు దారుల వైపు మెరిసింది. మల్లో ఏ దారిలో వెళ్ళాలి?", Hinglish: "'Tum kahan ki ho?' Mallow ne poochha. Lantern do raaston ki taraf jhilmilayi. Mallow ko kaun sa raasta lena chahiye?" },
        choices: [
          { to: 'fire', emoji: '✨', l: { English: 'Follow the fireflies', Telugu: 'మిణుగురులను అనుసరించు', Hinglish: 'Jugnuon ke peeche chalo' } },
          { to: 'owl', emoji: '🦉', l: { English: 'Ask the wise owl', Telugu: 'తెలివైన గుడ్లగూబను అడుగు', Hinglish: 'Samajhdaar ullu se poochho' } },
        ],
      },
      fire: { next: 'endA', t: { English: 'The fireflies danced ahead, drawing slow circles of light. They led Mallow to a quiet pond.', Telugu: 'మిణుగురులు ముందుకు నాట్యం చేస్తూ, వెలుగు వలయాలు గీశాయి. అవి మల్లోను ఒక ప్రశాంతమైన చెరువు దగ్గరకు తీసుకెళ్ళాయి.', Hinglish: 'Jugnu aage naachte hue roshni ke dheeme gol ghere banate gaye. Wo Mallow ko ek shaant talaab tak le gaye.' } },
      owl: { next: 'endB', t: { English: "The owl blinked slowly. 'Look for the oldest tree,' she hooted. Mallow walked there, one gentle step at a time.", Telugu: "గుడ్లగూబ మెల్లగా రెప్పలు ఆడించింది. 'అన్నిటికంటే పాత చెట్టును వెతుకు' అని అంది. మల్లో ఒక్కో అడుగు వేస్తూ అక్కడికి నడిచింది.", Hinglish: "Ullu ne dheere se palkein jhapkayin. 'Sabse purana ped dhoondho,' usne kaha. Mallow ek ek kadam chalkar wahan pahunch gaya." } },
      endA: { end: true, t: { English: 'At the pond, a small star-flower waited to be lit. Mallow placed the lantern beside it, and the whole pond glowed. Home at last. The end.', Telugu: 'చెరువు దగ్గర వెలిగించడానికి ఒక చిన్న నక్షత్ర పువ్వు ఎదురు చూస్తోంది. మల్లో లాంతరును దాని పక్కన ఉంచగానే చెరువు అంతా మెరిసింది. చివరికి ఇల్లు చేరింది. కథ ముగిసింది.', Hinglish: 'Talaab ke paas ek chhota sa taara-phool jalne ka intezaar kar raha tha. Mallow ne lantern uske paas rakhi aur poora talaab jagmaga utha. Aakhir ghar mil gaya. Kahani khatam.' } },
      endB: { end: true, t: { English: 'Under the oldest tree, a cosy burrow held an empty lamp stand. Mallow set the lantern there, and the burrow glowed warm and gold. Home at last. The end.', Telugu: 'పాత చెట్టు కింద ఒక హాయైన బొరియలో ఖాళీ దీపస్తంభం ఉంది. మల్లో లాంతరును అక్కడ పెట్టగానే బొరియ బంగారు వెలుగుతో నిండింది. చివరికి ఇల్లు చేరింది. కథ ముగిసింది.', Hinglish: 'Purane ped ke neeche ek aaramdeh bil mein khaali deep-stand tha. Mallow ne lantern wahan rakhi aur bil sunehri roshni se bhar gaya. Aakhir ghar mil gaya. Kahani khatam.' } },
    },
  },
  {
    id: 'seed', emoji: '🌱', tint: '#D6EFE3', start: 'p1', bedtime: true,
    title: { English: 'The Brave Little Seed', Telugu: 'ధైర్యవంతమైన చిన్న విత్తనం', Hinglish: 'Himmatwala Chhota Beej' },
    blurb: { English: 'A gentle story about growing', Telugu: 'ఎదగడం గురించిన మృదువైన కథ', Hinglish: 'Badhne ki ek pyari kahani' },
    nodes: {
      p1: { next: 'p2', t: { English: 'Deep in the soil lay a little seed named Sunny. It was dark and quiet, and Sunny felt a bit shy.', Telugu: 'మట్టి లోపల సన్నీ అనే చిన్న విత్తనం ఉండేది. అక్కడ చీకటిగా, నిశ్శబ్దంగా ఉంది. సన్నీకి కొంచెం సిగ్గుగా అనిపించింది.', Hinglish: 'Mitti ke andar Sunny naam ka ek chhota beej tha. Wahan andhera aur shaanti thi, aur Sunny ko thodi sharm aa rahi thi.' } },
      p2: { next: 'p3', t: { English: "Rain came tap, tap, tap, and the soil grew soft and cool. 'Time to stretch,' whispered the earth.", Telugu: "చినుకులు టప్ టప్ అని పడ్డాయి, మట్టి మెత్తగా చల్లగా మారింది. 'ఇప్పుడు సాగే సమయం' అని భూమి మెల్లగా చెప్పింది.", Hinglish: "Baarish tap, tap, tap karke aayi, aur mitti narm aur thandi ho gayi. 'Ab badhne ka time hai,' dharti ne dheere se kaha." } },
      p3: { next: 'p4', t: { English: 'Sunny pushed up slowly, slowly, until a tiny green leaf peeked into the warm sunshine.', Telugu: 'సన్నీ మెల్లగా, మెల్లగా పైకి నెట్టుకుంటూ వచ్చింది. చివరికి ఒక చిన్న పచ్చని ఆకు వెచ్చని ఎండలోకి తొంగి చూసింది.', Hinglish: 'Sunny dheere, dheere upar badha, aur ek chhota hara patta garam dhoop mein jhaank raha tha.' } },
      p4: { end: true, t: { English: 'Day by day Sunny grew into a bright yellow flower. And every evening, a little bunny came to say hello. The end.', Telugu: 'రోజు రోజుకీ సన్నీ ఒక అందమైన పసుపు పువ్వుగా పెరిగింది. ప్రతి సాయంత్రం ఒక చిన్న కుందేలు హలో చెప్పడానికి వచ్చేది. కథ ముగిసింది.', Hinglish: 'Din ba din Sunny ek chamakta peela phool ban gaya. Aur har shaam ek chhota bunny hello kehne aata tha. Kahani khatam.' } },
    },
  },
]

export const UI: Record<string, L> = {
  next: { English: 'Next', Telugu: 'తర్వాత', Hinglish: 'Aage' },
  readTo: { English: 'Read to me', Telugu: 'చదివి వినిపించు', Hinglish: 'Mujhe padh kar sunao' },
  stop: { English: 'Stop', Telugu: 'ఆపు', Hinglish: 'Ruko' },
  again: { English: 'Read again', Telugu: 'మళ్ళీ చదువు', Hinglish: 'Phir se padho' },
  another: { English: 'Pick another story', Telugu: 'మరో కథ ఎంచుకో', Hinglish: 'Doosri kahani chuno' },
  choose: { English: 'What should Mallow do?', Telugu: 'మల్లో ఏమి చేయాలి?', Hinglish: 'Mallow ko kya karna chahiye?' },
}
