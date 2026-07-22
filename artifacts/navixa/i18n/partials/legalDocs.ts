/**
 * i18n partial — full in-app legal documents (App Store ready).
 *
 * Owned by the "legal docs" agent. Each document lives under
 * `legalDocs.<doc>` and is modelled as a flat set of string keys so it fits
 * i18next's string-only values:
 *
 *   legalDocs.<doc>.title          — document title
 *   legalDocs.<doc>.updated        — "last updated" date (ISO)
 *   legalDocs.<doc>.sectionCount   — number of sections the screen iterates
 *   legalDocs.<doc>.s{n}.heading   — section n heading
 *   legalDocs.<doc>.s{n}.body      — section n body
 *
 * The screen (`app/legal/[page].tsx`) reads `sectionCount` and renders
 * `s1 … sN`. Only `en` and `sv` are authored here; the other 12 locales fall
 * back to `en` via i18next's `fallbackLng`.
 *
 * Real, finished text. The ONLY placeholders are company-specific details that
 * a human must supply before store submission:
 *   [COMPANY_NAME], [COMPANY_ADDRESS], [SUPPORT_EMAIL], [COUNTRY]
 */

const UPDATED = '2026-07-21';

export default {
  en: {
    legalDocs: {
      /* ------------------------------------------------------------------ */
      /* Privacy policy                                                     */
      /* ------------------------------------------------------------------ */
      privacy: {
        title: 'Privacy Policy',
        updated: UPDATED,
        sectionCount: '11',
        s1: {
          heading: 'Who we are',
          body: 'Navixa is a turn-based naval strategy game. This Privacy Policy explains what personal data we process when you use the app, why we process it, and the choices and rights you have. The data controller is [COMPANY_NAME], [COMPANY_ADDRESS]. For any privacy question you can reach us at [SUPPORT_EMAIL].',
        },
        s2: {
          heading: 'Playing as a guest',
          body: 'You can play Navixa without creating an account. When you play as a guest we generate an anonymous device-scoped identifier so we can save your progress and match you with opponents. A guest identity is not linked to an email address. If you later create an account, your guest progress can be associated with that account.',
        },
        s3: {
          heading: 'Data we collect',
          body: 'Account: your email address (only if you register — it is stored by our authentication provider and is never shown to other players). Profile: display name and, optionally, a country and short bio, plus a chosen avatar or cosmetic. Gameplay: matches, moves, results, ratings and rating history, quests, achievements and cosmetic inventory. Settings: your preferences such as sound, music, haptics, motion, language and notification opt-ins. Technical: anonymous or account identifiers, session tokens stored on your device to keep you signed in, and — only if you opt in — a push notification token for your device.',
        },
        s4: {
          heading: 'What we do NOT collect',
          body: 'We do not access your camera, microphone, contacts, or your precise or coarse device location. The "country" on your profile is something you choose yourself; it is never derived from device location. We do not use third-party advertising or analytics SDKs, and we show no ads. We never sell your personal data. The app includes an in-game shop that uses test currency only — there are currently no real-money purchases and we do not process any payment data.',
        },
        s5: {
          heading: 'How we use your data',
          body: 'We use your data to run the game: to authenticate you, save progress, match you with opponents, calculate ratings and leaderboards, deliver optional turn and social notifications, apply your settings, and keep the game fair and secure (for example detecting cheating or abuse). Secret information such as your hidden board layout is stored separately and is never exposed to other players or their devices.',
        },
        s6: {
          heading: 'Where your data is stored',
          body: 'Our backend is provided by Supabase (Postgres database and authentication). Depending on the configured project region, data may be hosted in the European Union or the United States. Where data is transferred outside your region, it is protected by appropriate safeguards such as the European Commission’s Standard Contractual Clauses. Push notifications, when you enable them, are delivered through Expo’s push service.',
        },
        s7: {
          heading: 'Sharing',
          body: 'The only data visible to other players is your public profile (display name, avatar, optional country) and public gameplay information such as leaderboard standing and finished-match results. Your email address is never visible to other users. We share data with our processors only to operate the service: Supabase (hosting and authentication) and Expo (push delivery, if enabled). We may disclose data where required by law.',
        },
        s8: {
          heading: 'Retention',
          body: 'We keep your account data for as long as your account exists. When you delete your account we anonymise your profile and remove your personal data (see the Data Deletion document). Some records may be retained in anonymised form where they form part of another player’s match history, and limited security or audit logs may be kept for a short period to protect the service.',
        },
        s9: {
          heading: 'Your rights',
          body: 'Under the GDPR and similar laws you have the right to access, rectify, erase, restrict and object to the processing of your personal data, and the right to data portability. You can exercise the most important rights yourself in the app: use Settings → Export data to download a copy of your data as JSON, and Settings → Account → Delete account to erase it. For any other request, contact [SUPPORT_EMAIL]. You also have the right to lodge a complaint with a supervisory authority — in Sweden this is the Swedish Authority for Privacy Protection (IMY).',
        },
        s10: {
          heading: 'Children',
          body: 'Navixa is a strategy game suitable for a general audience. It contains no targeted advertising and no content directed at children, and it can be played as a guest without providing any personal information. If you believe a child has provided us personal data in a way that requires action, contact us at [SUPPORT_EMAIL] and we will address it.',
        },
        s11: {
          heading: 'Changes and contact',
          body: 'We may update this policy as the app evolves; the "Last updated" date above always reflects the current version, and material changes will be highlighted in the app. Questions or requests: [SUPPORT_EMAIL], [COMPANY_NAME], [COMPANY_ADDRESS].',
        },
      },

      /* ------------------------------------------------------------------ */
      /* Terms of service                                                   */
      /* ------------------------------------------------------------------ */
      terms: {
        title: 'Terms of Service',
        updated: UPDATED,
        sectionCount: '10',
        s1: {
          heading: 'Acceptance',
          body: 'By downloading, accessing or playing Navixa you agree to these Terms of Service. If you do not agree, please do not use the app. These Terms are a legal agreement between you and [COMPANY_NAME], [COMPANY_ADDRESS].',
        },
        s2: {
          heading: 'Licence to use the app',
          body: 'We grant you a personal, limited, non-exclusive, non-transferable and revocable licence to install and use Navixa for your own non-commercial entertainment. You may not copy, modify, reverse engineer, decompile, resell or distribute the app or any part of it except as permitted by law.',
        },
        s3: {
          heading: 'Your account',
          body: 'You may create one account and are responsible for keeping access to it secure. Do not share your account or your sign-in credentials, and do not use another player’s account. You must provide accurate information and are responsible for activity that occurs under your account. You can also play as a guest without an account.',
        },
        s4: {
          heading: 'In-game items and virtual currency',
          body: 'The game may include cosmetics, coins, experience and other virtual items. These are provided under a limited licence for use inside the game only. They have no monetary value, cannot be exchanged for real money or transferred outside the game, and may be adjusted or removed as part of normal game operation. The current shop uses test currency only; there are no real-money purchases.',
        },
        s5: {
          heading: 'Fair play and acceptable use',
          body: 'You agree to play fairly and to follow our Community Guidelines and Fair Play Policy. You must not cheat, use bots or unauthorised software, exploit bugs, manipulate ratings, operate multiple accounts to gain an advantage, harass other players, or use the game for any unlawful purpose.',
        },
        s6: {
          heading: 'User content',
          body: 'You are responsible for the content you provide, including your display name, bio and reports. Do not submit content that is illegal, hateful, harassing, deceptive or infringes others’ rights. We may remove content and take action against accounts that violate these Terms.',
        },
        s7: {
          heading: 'Suspension and termination',
          body: 'We may suspend or terminate your access, or remove content, if you breach these Terms or our policies, or where necessary to protect players or the service. You may stop using the app at any time and can delete your account in Settings. On termination, the licences granted to you end.',
        },
        s8: {
          heading: 'Disclaimers',
          body: 'The app is provided "as is" and "as available". To the maximum extent permitted by law, we do not warrant that the app will be uninterrupted, error-free or secure, or that matchmaking, ratings or availability will meet your expectations. Some jurisdictions do not allow certain disclaimers, so parts of this section may not apply to you.',
        },
        s9: {
          heading: 'Limitation of liability',
          body: 'To the maximum extent permitted by law, [COMPANY_NAME] is not liable for indirect, incidental, special or consequential damages, or for loss of data, progress or virtual items, arising from your use of the app. Nothing in these Terms limits liability that cannot be limited by law, including your statutory consumer rights.',
        },
        s10: {
          heading: 'Governing law and changes',
          body: 'These Terms are governed by the laws of [COUNTRY], without regard to conflict-of-law rules, subject to any mandatory consumer protections in your country of residence. We may update these Terms as the app changes; the "Last updated" date reflects the current version and continued use after an update means you accept the revised Terms. Questions: [SUPPORT_EMAIL].',
        },
      },

      /* ------------------------------------------------------------------ */
      /* Community guidelines                                               */
      /* ------------------------------------------------------------------ */
      community: {
        title: 'Community Guidelines',
        updated: UPDATED,
        sectionCount: '6',
        s1: {
          heading: 'Be respectful',
          body: 'Navixa is for everyone. Treat other players with respect, whether you win or lose. Good sportsmanship keeps matches fun and the community welcoming.',
        },
        s2: {
          heading: 'Zero tolerance for harassment and hate',
          body: 'Do not harass, threaten, bully or intimidate other players. Hate speech or discrimination based on race, ethnicity, nationality, religion, gender, sexual orientation, disability or any similar characteristic is never allowed.',
        },
        s3: {
          heading: 'No cheating',
          body: 'Cheating ruins the game for everyone. Do not use bots, unauthorised software, exploits, or any method to gain an unfair advantage. See our Fair Play Policy for details on what is prohibited and how it is enforced.',
        },
        s4: {
          heading: 'Choose an appropriate name',
          body: 'Your display name must not be offensive, hateful, harassing, sexually explicit, or impersonate another person, staff member or brand. We may require you to change a name that breaks these rules.',
        },
        s5: {
          heading: 'Reporting and blocking',
          body: 'If someone behaves badly, use the in-app tools: report a player to bring them to our attention, and block a player to stop interacting with them. Reports are reviewed and help keep the community safe.',
        },
        s6: {
          heading: 'Moderation',
          body: 'Breaking these guidelines can lead to content removal, a warning, temporary suspension or a permanent ban, depending on the severity and history. We aim to be fair and proportionate. If you think a decision was wrong, contact us at [SUPPORT_EMAIL].',
        },
      },

      /* ------------------------------------------------------------------ */
      /* Fair play policy                                                   */
      /* ------------------------------------------------------------------ */
      'fair-play': {
        title: 'Fair Play Policy',
        updated: UPDATED,
        sectionCount: '6',
        s1: {
          heading: 'Server-authoritative gameplay',
          body: 'Navixa runs its core game logic on the server. Moves are validated server-side and secret information — such as your hidden fleet layout — is never sent to other players’ devices. This design keeps matches fair and makes many common cheats ineffective.',
        },
        s2: {
          heading: 'What counts as cheating',
          body: 'Prohibited behaviour includes using bots or automation, modifying the game or its network traffic, exploiting bugs, using third-party tools to reveal hidden information, and any attempt to bypass server validation.',
        },
        s3: {
          heading: 'Multi-accounting and boosting',
          body: 'Do not create or use multiple accounts to gain an advantage, and do not "boost" — deliberately losing to inflate another player’s rating, or arranging matches to farm rewards or rankings.',
        },
        s4: {
          heading: 'Rating manipulation',
          body: 'Ratings and leaderboards must reflect genuine play. Colluding to manipulate ratings, queue-dodging to game matchmaking, or otherwise distorting competitive results is prohibited.',
        },
        s5: {
          heading: 'Enforcement ladder',
          body: 'We take action proportionate to the behaviour and history: a warning for minor or first offences, a temporary suspension for repeated or more serious violations, and a permanent ban for severe or persistent cheating. Ratings, rewards or items gained through violations may be reversed.',
        },
        s6: {
          heading: 'Appeals',
          body: 'If you believe enforcement action was taken in error, you can appeal by contacting support at [SUPPORT_EMAIL]. Please include your display name and any relevant details so we can review your case.',
        },
      },

      /* ------------------------------------------------------------------ */
      /* Data deletion                                                      */
      /* ------------------------------------------------------------------ */
      'data-deletion': {
        title: 'Data Deletion',
        updated: UPDATED,
        sectionCount: '6',
        s1: {
          heading: 'Delete your account in the app',
          body: 'You can delete your account directly in Navixa. Go to Settings → Account → Delete account and confirm. No email or web form is required — deletion is fully self-service.',
        },
        s2: {
          heading: 'What happens when you delete',
          body: 'Your profile is anonymised (display name changed to "Deleted player", and your bio, avatar and country removed) and your account is deleted. Your authentication record — including your email — is permanently removed, and your associated data such as settings, ratings, social connections and notifications is deleted as part of this process. Your push notification tokens are deactivated so we stop sending to your device.',
        },
        s3: {
          heading: 'What is anonymised rather than erased',
          body: 'Some finished-match records are retained in anonymised form. This is because a completed match belongs to more than one player: keeping it (without your personal identity attached) preserves the integrity of your former opponents’ match history and statistics.',
        },
        s4: {
          heading: 'Active matches',
          body: 'For fairness to your opponents, you cannot delete your account while you have a match in progress. Finish or resign your active matches first, then delete your account.',
        },
        s5: {
          heading: 'Timeline',
          body: 'Deletion of your account and personal data begins immediately when you confirm. Any residual copies in backups or short-term security logs are removed within 30 days.',
        },
        s6: {
          heading: 'Guest accounts and export',
          body: 'Guest play is tied to an anonymous device identifier rather than an email; clearing the app’s data or uninstalling removes the local guest session. Before deleting, you can download a copy of your data with Settings → Export data. Questions: [SUPPORT_EMAIL].',
        },
      },

      /* ------------------------------------------------------------------ */
      /* Support                                                            */
      /* ------------------------------------------------------------------ */
      support: {
        title: 'Support',
        updated: UPDATED,
        sectionCount: '4',
        s1: {
          heading: 'How to get help',
          body: 'Need a hand? Email us at [SUPPORT_EMAIL] and we will do our best to help. Many questions about accounts, data and fair play are already answered in the Privacy Policy, Terms of Service, Community Guidelines and Fair Play Policy documents in this section.',
        },
        s2: {
          heading: 'What to include',
          body: 'To help us resolve your issue quickly, please include: your display name, the platform and app version (shown at the bottom of Settings), a clear description of the problem, the steps to reproduce it, and screenshots if relevant.',
        },
        s3: {
          heading: 'Response time',
          body: 'We aim to respond within a few business days. Response times may be longer during weekends and holidays. Reports of abuse or cheating are prioritised.',
        },
        s4: {
          heading: 'Account and data requests',
          body: 'You can export your data (Settings → Export data) or delete your account (Settings → Account → Delete account) yourself. For anything else, contact [SUPPORT_EMAIL].',
        },
      },

      /* ------------------------------------------------------------------ */
      /* Contact                                                            */
      /* ------------------------------------------------------------------ */
      contact: {
        title: 'Contact',
        updated: UPDATED,
        sectionCount: '2',
        s1: {
          heading: 'Get in touch',
          body: 'Navixa is operated by [COMPANY_NAME], [COMPANY_ADDRESS]. For support, feedback, or privacy and legal enquiries, email us at [SUPPORT_EMAIL].',
        },
        s2: {
          heading: 'Privacy and legal requests',
          body: 'For data-protection requests you can use the in-app tools (export and delete) or write to [SUPPORT_EMAIL]. You also have the right to contact your local data protection supervisory authority — in Sweden this is the Swedish Authority for Privacy Protection (IMY).',
        },
      },

      /* ------------------------------------------------------------------ */
      /* Open-source licenses                                               */
      /* ------------------------------------------------------------------ */
      licenses: {
        title: 'Open-Source Licenses',
        updated: UPDATED,
        sectionCount: '3',
        s1: {
          heading: 'Acknowledgements',
          body: 'Navixa is built with the help of open-source software and we are grateful to the maintainers of these projects.',
        },
        s2: {
          heading: 'Libraries we use',
          body: 'These include, among others: React and React Native, Expo and Expo Router, the Supabase JavaScript client, Zustand, i18next and react-i18next, React Native Reanimated, React Native Gesture Handler, React Native Screens, React Native Safe Area Context, React Native SVG, TanStack Query, Zod, and the Expo icon set. Each library is distributed under its own licence (most commonly the MIT licence).',
        },
        s3: {
          heading: 'Full license texts',
          body: 'The complete licence texts for all dependencies are available in the project’s source repository and can also be provided on request by emailing [SUPPORT_EMAIL].',
        },
      },
    },
  },

  sv: {
    legalDocs: {
      /* ------------------------------------------------------------------ */
      /* Integritetspolicy                                                  */
      /* ------------------------------------------------------------------ */
      privacy: {
        title: 'Integritetspolicy',
        updated: UPDATED,
        sectionCount: '11',
        s1: {
          heading: 'Vilka vi är',
          body: 'Navixa är ett turordningsbaserat marint strategispel. Den här integritetspolicyn förklarar vilka personuppgifter vi behandlar när du använder appen, varför vi gör det och vilka val och rättigheter du har. Personuppgiftsansvarig är [COMPANY_NAME], [COMPANY_ADDRESS]. Vid frågor om integritet når du oss på [SUPPORT_EMAIL].',
        },
        s2: {
          heading: 'Att spela som gäst',
          body: 'Du kan spela Navixa utan att skapa ett konto. När du spelar som gäst skapar vi en anonym enhetsbunden identifierare så att vi kan spara dina framsteg och matcha dig med motståndare. En gästidentitet är inte kopplad till en e-postadress. Om du senare skapar ett konto kan dina gästframsteg kopplas till det kontot.',
        },
        s3: {
          heading: 'Uppgifter vi samlar in',
          body: 'Konto: din e-postadress (endast om du registrerar dig — den lagras av vår autentiseringsleverantör och visas aldrig för andra spelare). Profil: visningsnamn och, valfritt, land och en kort presentation, samt en vald avatar eller kosmetik. Spel: matcher, drag, resultat, ratingar och ratinghistorik, uppdrag, prestationer och kosmetiskt innehav. Inställningar: dina preferenser såsom ljud, musik, haptik, rörelse, språk och aviseringsval. Tekniskt: anonyma identifierare eller kontoidentifierare, sessionstoken som lagras på din enhet för att hålla dig inloggad och — endast om du väljer det — en push-token för din enhet.',
        },
        s4: {
          heading: 'Vad vi INTE samlar in',
          body: 'Vi använder inte din kamera, mikrofon, dina kontakter eller din exakta eller ungefärliga plats. Landet på din profil väljer du själv; det härleds aldrig från enhetens plats. Vi använder inga tredjepartsbibliotek för annonsering eller analys och visar inga annonser. Vi säljer aldrig dina personuppgifter. Appen har en butik i spelet som endast använder testvaluta — det finns för närvarande inga köp med riktiga pengar och vi behandlar inga betalningsuppgifter.',
        },
        s5: {
          heading: 'Hur vi använder dina uppgifter',
          body: 'Vi använder dina uppgifter för att driva spelet: autentisera dig, spara framsteg, matcha dig med motståndare, beräkna ratingar och topplistor, leverera valfria aviseringar om drag och sociala händelser, tillämpa dina inställningar och hålla spelet rättvist och säkert (till exempel upptäcka fusk eller missbruk). Hemlig information såsom din dolda brädplacering lagras separat och exponeras aldrig för andra spelare eller deras enheter.',
        },
        s6: {
          heading: 'Var dina uppgifter lagras',
          body: 'Vår backend tillhandahålls av Supabase (Postgres-databas och autentisering). Beroende på projektets konfigurerade region kan uppgifter lagras inom EU eller i USA. När uppgifter överförs utanför din region skyddas de av lämpliga skyddsåtgärder, såsom EU-kommissionens standardavtalsklausuler. Push-aviseringar levereras, när du aktiverar dem, via Expos push-tjänst.',
        },
        s7: {
          heading: 'Delning',
          body: 'De enda uppgifter som är synliga för andra spelare är din offentliga profil (visningsnamn, avatar, valfritt land) och offentlig spelinformation såsom placering på topplistor och resultat från avslutade matcher. Din e-postadress är aldrig synlig för andra användare. Vi delar uppgifter med våra personuppgiftsbiträden endast för att driva tjänsten: Supabase (drift och autentisering) och Expo (push-leverans, om aktiverad). Vi kan lämna ut uppgifter när lagen kräver det.',
        },
        s8: {
          heading: 'Lagring',
          body: 'Vi sparar dina kontouppgifter så länge ditt konto finns. När du raderar ditt konto anonymiserar vi din profil och tar bort dina personuppgifter (se dokumentet Radering av uppgifter). Vissa poster kan sparas i anonymiserad form när de ingår i en annan spelares matchhistorik, och begränsade säkerhets- eller granskningsloggar kan sparas en kort tid för att skydda tjänsten.',
        },
        s9: {
          heading: 'Dina rättigheter',
          body: 'Enligt GDPR och liknande lagar har du rätt till tillgång, rättelse, radering, begränsning och att invända mot behandlingen av dina personuppgifter, samt rätt till dataportabilitet. De viktigaste rättigheterna kan du utöva själv i appen: använd Inställningar → Exportera data för att ladda ner en kopia av dina uppgifter som JSON, och Inställningar → Konto → Radera konto för att radera dem. För övriga önskemål, kontakta [SUPPORT_EMAIL]. Du har även rätt att lämna in ett klagomål till en tillsynsmyndighet — i Sverige är detta Integritetsskyddsmyndigheten (IMY).',
        },
        s10: {
          heading: 'Barn',
          body: 'Navixa är ett strategispel som passar en bred publik. Det innehåller ingen riktad annonsering och inget innehåll riktat till barn, och det kan spelas som gäst utan att lämna några personuppgifter. Om du tror att ett barn har lämnat personuppgifter till oss på ett sätt som kräver åtgärd, kontakta oss på [SUPPORT_EMAIL] så åtgärdar vi det.',
        },
        s11: {
          heading: 'Ändringar och kontakt',
          body: 'Vi kan uppdatera denna policy i takt med att appen utvecklas; datumet "Senast uppdaterad" ovan speglar alltid den aktuella versionen, och väsentliga ändringar markeras i appen. Frågor eller önskemål: [SUPPORT_EMAIL], [COMPANY_NAME], [COMPANY_ADDRESS].',
        },
      },

      /* ------------------------------------------------------------------ */
      /* Användarvillkor                                                    */
      /* ------------------------------------------------------------------ */
      terms: {
        title: 'Användarvillkor',
        updated: UPDATED,
        sectionCount: '10',
        s1: {
          heading: 'Godkännande',
          body: 'Genom att ladda ner, öppna eller spela Navixa godkänner du dessa användarvillkor. Om du inte godkänner dem ska du inte använda appen. Villkoren utgör ett juridiskt avtal mellan dig och [COMPANY_NAME], [COMPANY_ADDRESS].',
        },
        s2: {
          heading: 'Licens att använda appen',
          body: 'Vi ger dig en personlig, begränsad, icke-exklusiv, icke-överlåtbar och återkallelig licens att installera och använda Navixa för din egen icke-kommersiella underhållning. Du får inte kopiera, ändra, bakåtkompilera, dekompilera, sälja vidare eller distribuera appen eller någon del av den, annat än vad lagen tillåter.',
        },
        s3: {
          heading: 'Ditt konto',
          body: 'Du får skapa ett konto och ansvarar för att hålla åtkomsten till det säker. Dela inte ditt konto eller dina inloggningsuppgifter och använd inte en annan spelares konto. Du ska lämna korrekta uppgifter och ansvarar för aktivitet som sker under ditt konto. Du kan även spela som gäst utan konto.',
        },
        s4: {
          heading: 'Föremål i spelet och virtuell valuta',
          body: 'Spelet kan innehålla kosmetik, mynt, erfarenhet och andra virtuella föremål. Dessa tillhandahålls under en begränsad licens endast för användning inuti spelet. De har inget ekonomiskt värde, kan inte bytas mot riktiga pengar eller överföras utanför spelet och kan justeras eller tas bort som en del av den normala driften. Den nuvarande butiken använder endast testvaluta; det finns inga köp med riktiga pengar.',
        },
        s5: {
          heading: 'Rent spel och tillåten användning',
          body: 'Du samtycker till att spela rättvist och följa våra communityregler och policy för rent spel. Du får inte fuska, använda bottar eller otillåten programvara, utnyttja buggar, manipulera ratingar, använda flera konton för att skaffa fördelar, trakassera andra spelare eller använda spelet för olagliga ändamål.',
        },
        s6: {
          heading: 'Användarinnehåll',
          body: 'Du ansvarar för det innehåll du lämnar, inklusive ditt visningsnamn, din presentation och dina anmälningar. Lämna inte innehåll som är olagligt, hatiskt, trakasserande, vilseledande eller som kränker andras rättigheter. Vi kan ta bort innehåll och vidta åtgärder mot konton som bryter mot dessa villkor.',
        },
        s7: {
          heading: 'Avstängning och uppsägning',
          body: 'Vi kan stänga av eller avsluta din åtkomst, eller ta bort innehåll, om du bryter mot dessa villkor eller våra policyer, eller när det behövs för att skydda spelare eller tjänsten. Du kan sluta använda appen när som helst och kan radera ditt konto under Inställningar. Vid uppsägning upphör de licenser som beviljats dig.',
        },
        s8: {
          heading: 'Friskrivningar',
          body: 'Appen tillhandahålls "i befintligt skick" och "i mån av tillgång". I den utsträckning lagen tillåter garanterar vi inte att appen är oavbruten, felfri eller säker, eller att matchmaking, ratingar eller tillgänglighet motsvarar dina förväntningar. Vissa jurisdiktioner tillåter inte alla friskrivningar, så delar av detta avsnitt kan sakna tillämpning för dig.',
        },
        s9: {
          heading: 'Ansvarsbegränsning',
          body: 'I den utsträckning lagen tillåter ansvarar [COMPANY_NAME] inte för indirekta skador, följdskador eller särskilda skador, eller för förlust av data, framsteg eller virtuella föremål, som uppstår genom din användning av appen. Inget i dessa villkor begränsar ansvar som inte kan begränsas enligt lag, inklusive dina lagstadgade konsumenträttigheter.',
        },
        s10: {
          heading: 'Tillämplig lag och ändringar',
          body: 'Dessa villkor regleras av lagen i [COUNTRY], utan hänsyn till lagvalsregler och med förbehåll för tvingande konsumentskydd i ditt hemland. Vi kan uppdatera villkoren när appen förändras; datumet "Senast uppdaterad" speglar den aktuella versionen och fortsatt användning efter en uppdatering innebär att du godkänner de reviderade villkoren. Frågor: [SUPPORT_EMAIL].',
        },
      },

      /* ------------------------------------------------------------------ */
      /* Communityregler                                                    */
      /* ------------------------------------------------------------------ */
      community: {
        title: 'Communityregler',
        updated: UPDATED,
        sectionCount: '6',
        s1: {
          heading: 'Visa respekt',
          body: 'Navixa är till för alla. Behandla andra spelare med respekt, oavsett om du vinner eller förlorar. Gott sportmannaskap gör matcherna roliga och gör communityt välkomnande.',
        },
        s2: {
          heading: 'Nolltolerans mot trakasserier och hat',
          body: 'Du får inte trakassera, hota, mobba eller skrämma andra spelare. Hatpropaganda eller diskriminering på grund av etnicitet, nationalitet, religion, kön, sexuell läggning, funktionsnedsättning eller liknande är aldrig tillåtet.',
        },
        s3: {
          heading: 'Inget fusk',
          body: 'Fusk förstör spelet för alla. Använd inte bottar, otillåten programvara, exploits eller någon metod för att skaffa en orättvis fördel. Se vår policy för rent spel för detaljer om vad som är förbjudet och hur det hanteras.',
        },
        s4: {
          heading: 'Välj ett lämpligt namn',
          body: 'Ditt visningsnamn får inte vara stötande, hatiskt, trakasserande eller sexuellt explicit, och det får inte utge sig för att vara en annan person, en anställd eller ett varumärke. Vi kan kräva att du byter ett namn som bryter mot dessa regler.',
        },
        s5: {
          heading: 'Anmäla och blockera',
          body: 'Om någon beter sig illa, använd verktygen i appen: anmäl en spelare för att uppmärksamma oss, och blockera en spelare för att sluta interagera med denne. Anmälningar granskas och hjälper till att hålla communityt tryggt.',
        },
        s6: {
          heading: 'Moderering',
          body: 'Att bryta mot dessa regler kan leda till borttaget innehåll, en varning, tillfällig avstängning eller permanent avstängning, beroende på hur allvarligt det är och tidigare händelser. Vi strävar efter att vara rättvisa och proportionerliga. Om du tror att ett beslut var felaktigt, kontakta oss på [SUPPORT_EMAIL].',
        },
      },

      /* ------------------------------------------------------------------ */
      /* Policy för rent spel                                               */
      /* ------------------------------------------------------------------ */
      'fair-play': {
        title: 'Policy för rent spel',
        updated: UPDATED,
        sectionCount: '6',
        s1: {
          heading: 'Serverstyrt spel',
          body: 'Navixa kör sin centrala spellogik på servern. Drag valideras på serversidan och hemlig information — såsom din dolda flottplacering — skickas aldrig till andra spelares enheter. Denna design håller matcherna rättvisa och gör många vanliga fusk verkningslösa.',
        },
        s2: {
          heading: 'Vad som räknas som fusk',
          body: 'Förbjudet beteende inkluderar att använda bottar eller automatisering, ändra spelet eller dess nätverkstrafik, utnyttja buggar, använda tredjepartsverktyg för att avslöja dold information och alla försök att kringgå servervalidering.',
        },
        s3: {
          heading: 'Flera konton och boosting',
          body: 'Skapa eller använd inte flera konton för att skaffa fördelar, och ägna dig inte åt "boosting" — att avsiktligt förlora för att blåsa upp en annan spelares rating, eller att arrangera matcher för att samla belöningar eller placeringar.',
        },
        s4: {
          heading: 'Ratingmanipulation',
          body: 'Ratingar och topplistor ska spegla genuint spel. Att samverka för att manipulera ratingar, undvika köer för att lura matchmakingen eller på annat sätt snedvrida tävlingsresultat är förbjudet.',
        },
        s5: {
          heading: 'Åtgärdstrappa',
          body: 'Vi vidtar åtgärder i proportion till beteendet och tidigare händelser: en varning vid mindre eller första förseelser, en tillfällig avstängning vid upprepade eller allvarligare överträdelser och en permanent avstängning vid grovt eller ihållande fusk. Ratingar, belöningar eller föremål som erhållits genom överträdelser kan återställas.',
        },
        s6: {
          heading: 'Överklagande',
          body: 'Om du tror att en åtgärd vidtogs felaktigt kan du överklaga genom att kontakta supporten på [SUPPORT_EMAIL]. Ange gärna ditt visningsnamn och relevanta detaljer så att vi kan granska ditt ärende.',
        },
      },

      /* ------------------------------------------------------------------ */
      /* Radering av uppgifter                                              */
      /* ------------------------------------------------------------------ */
      'data-deletion': {
        title: 'Radering av uppgifter',
        updated: UPDATED,
        sectionCount: '6',
        s1: {
          heading: 'Radera ditt konto i appen',
          body: 'Du kan radera ditt konto direkt i Navixa. Gå till Inställningar → Konto → Radera konto och bekräfta. Ingen e-post eller webbformulär krävs — raderingen sköter du helt själv.',
        },
        s2: {
          heading: 'Vad som händer när du raderar',
          body: 'Din profil anonymiseras (visningsnamnet ändras till "Deleted player" och din presentation, avatar och land tas bort) och ditt konto raderas. Din autentiseringspost — inklusive din e-postadress — tas bort permanent, och tillhörande uppgifter såsom inställningar, ratingar, sociala kopplingar och aviseringar raderas som en del av processen. Dina push-token inaktiveras så att vi slutar skicka till din enhet.',
        },
        s3: {
          heading: 'Vad som anonymiseras i stället för att raderas',
          body: 'Vissa poster från avslutade matcher sparas i anonymiserad form. Det beror på att en avslutad match tillhör mer än en spelare: att behålla den (utan din personliga identitet kopplad) bevarar integriteten i dina tidigare motståndares matchhistorik och statistik.',
        },
        s4: {
          heading: 'Pågående matcher',
          body: 'Av rättviseskäl gentemot dina motståndare kan du inte radera ditt konto medan du har en pågående match. Avsluta eller ge upp dina aktiva matcher först och radera sedan ditt konto.',
        },
        s5: {
          heading: 'Tidsram',
          body: 'Raderingen av ditt konto och dina personuppgifter påbörjas omedelbart när du bekräftar. Eventuella kvarvarande kopior i säkerhetskopior eller kortsiktiga säkerhetsloggar tas bort inom 30 dagar.',
        },
        s6: {
          heading: 'Gästkonton och export',
          body: 'Gästspel är kopplat till en anonym enhetsidentifierare i stället för en e-postadress; att rensa appens data eller avinstallera tar bort den lokala gästsessionen. Innan du raderar kan du ladda ner en kopia av dina uppgifter via Inställningar → Exportera data. Frågor: [SUPPORT_EMAIL].',
        },
      },

      /* ------------------------------------------------------------------ */
      /* Support                                                            */
      /* ------------------------------------------------------------------ */
      support: {
        title: 'Support',
        updated: UPDATED,
        sectionCount: '4',
        s1: {
          heading: 'Så får du hjälp',
          body: 'Behöver du hjälp? Mejla oss på [SUPPORT_EMAIL] så gör vi vårt bästa för att hjälpa till. Många frågor om konton, uppgifter och rent spel besvaras redan i dokumenten Integritetspolicy, Användarvillkor, Communityregler och Policy för rent spel i det här avsnittet.',
        },
        s2: {
          heading: 'Vad du bör ta med',
          body: 'För att vi ska kunna lösa ditt ärende snabbt, ange gärna: ditt visningsnamn, plattform och appversion (visas längst ner i Inställningar), en tydlig beskrivning av problemet, stegen för att återskapa det och skärmbilder om det är relevant.',
        },
        s3: {
          heading: 'Svarstid',
          body: 'Vi strävar efter att svara inom några arbetsdagar. Svarstiderna kan vara längre under helger och lov. Anmälningar om missbruk eller fusk prioriteras.',
        },
        s4: {
          heading: 'Konto- och datauppgifter',
          body: 'Du kan exportera dina uppgifter (Inställningar → Exportera data) eller radera ditt konto (Inställningar → Konto → Radera konto) själv. För övrigt, kontakta [SUPPORT_EMAIL].',
        },
      },

      /* ------------------------------------------------------------------ */
      /* Kontakt                                                            */
      /* ------------------------------------------------------------------ */
      contact: {
        title: 'Kontakt',
        updated: UPDATED,
        sectionCount: '2',
        s1: {
          heading: 'Kontakta oss',
          body: 'Navixa drivs av [COMPANY_NAME], [COMPANY_ADDRESS]. För support, återkoppling eller frågor om integritet och juridik, mejla oss på [SUPPORT_EMAIL].',
        },
        s2: {
          heading: 'Integritets- och juridiska ärenden',
          body: 'För dataskyddsärenden kan du använda verktygen i appen (export och radering) eller skriva till [SUPPORT_EMAIL]. Du har även rätt att kontakta din lokala tillsynsmyndighet för dataskydd — i Sverige är detta Integritetsskyddsmyndigheten (IMY).',
        },
      },

      /* ------------------------------------------------------------------ */
      /* Öppen källkod-licenser                                             */
      /* ------------------------------------------------------------------ */
      licenses: {
        title: 'Öppen källkod-licenser',
        updated: UPDATED,
        sectionCount: '3',
        s1: {
          heading: 'Erkännanden',
          body: 'Navixa är byggt med hjälp av programvara med öppen källkod och vi är tacksamma mot dem som underhåller dessa projekt.',
        },
        s2: {
          heading: 'Bibliotek vi använder',
          body: 'Dessa inkluderar bland annat: React och React Native, Expo och Expo Router, Supabase JavaScript-klient, Zustand, i18next och react-i18next, React Native Reanimated, React Native Gesture Handler, React Native Screens, React Native Safe Area Context, React Native SVG, TanStack Query, Zod och Expos ikonuppsättning. Varje bibliotek distribueras under sin egen licens (oftast MIT-licensen).',
        },
        s3: {
          heading: 'Fullständiga licenstexter',
          body: 'De fullständiga licenstexterna för alla beroenden finns i projektets källkodsförråd och kan även tillhandahållas på begäran genom att mejla [SUPPORT_EMAIL].',
        },
      },
    },
  },
};
